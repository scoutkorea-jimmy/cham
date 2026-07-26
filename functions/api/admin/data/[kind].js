/**
 * 관리자 데이터 읽기·쓰기 단일 창구.
 *
 *   GET  /api/admin/data/:kind          → 전체 목록/문서
 *   PUT  /api/admin/data/:kind          → 통째로 교체(목록·문서형)
 *   POST /api/admin/data/:kind/:id      → [id].js 가 아니라 여기서 처리하지 않는다
 *
 * kind: orders | applications | inquiries | products | posts
 *       cohorts | partners | popups | settings | consents | kms | visits
 *
 * '통째로 교체'로 둔 이유 — 지금 관리자 코드가 전부 `배열을 통째로 다시 저장`하는
 * 모양이다(setProducts(a) 등). 같은 모양을 유지해야 화면 코드를 안 건드린다.
 * 목록이 수천 건이 되면 그때 부분 갱신으로 바꾼다.
 */
import {
  orderRowToObj, ORDER_INSERT, orderObjToBind,
  recordRowToObj, APP_INSERT, INQ_INSERT, appBind, inqBind,
  productRowToObj, PRODUCT_INSERT, productObjToBind,
  postRowToObj, POST_INSERT, postBind,
  readCollection, writeCollection, readDoc, writeDoc,
} from '../../../_shared/store.js';
import { json, badRequest, forbidden, notFound, methodNotAllowed, readJson } from '../../../_shared/http.js';
import { getOwnerSession } from '../../../_shared/auth.js';

const COLLECTIONS = new Set(['cohorts', 'partners', 'popups']);
const DOCS = new Set(['settings', 'consents', 'kms']);
// 설정은 계좌·사업자정보라 owner 만 바꾼다. 나머지는 staff 도 일상 운영으로 다룬다.
const OWNER_ONLY_WRITE = new Set(['settings']);

export async function onRequestGet({ params, env }) {
  const kind = String(params.kind || '');

  if (kind === 'orders') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM orders ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map(orderRowToObj) });
  }
  if (kind === 'applications') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM applications ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map((r) => recordRowToObj(r, 'apply')) });
  }
  if (kind === 'inquiries') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM inquiries ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map((r) => recordRowToObj(r, 'inquiry')) });
  }
  if (kind === 'products') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM products ORDER BY sort_order, id`).all();
    return json({ items: (results || []).map(productRowToObj) });
  }
  if (kind === 'posts') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM posts ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map(postRowToObj) });
  }
  if (kind === 'visits') {
    const [v, s] = await Promise.all([
      env.DB.prepare(`SELECT day, pv, uv FROM visits ORDER BY day`).all(),
      env.DB.prepare(`SELECT kind, n FROM visit_sources`).all(),
    ]);
    const visits = {}; (v.results || []).forEach((r) => { visits[r.day] = { pv: r.pv, uv: r.uv }; });
    const sources = {}; (s.results || []).forEach((r) => { sources[r.kind] = r.n; });
    return json({ visits, sources });
  }
  if (COLLECTIONS.has(kind)) return json({ items: await readCollection(env, kind) });
  if (DOCS.has(kind)) return json({ doc: await readDoc(env, kind) });

  return notFound('알 수 없는 항목입니다.');
}

export async function onRequestPut({ request, params, env, data }) {
  const kind = String(params.kind || '');
  const session = data && data.session;

  if (OWNER_ONLY_WRITE.has(kind) && (!session || session.role !== 'owner')) {
    return forbidden('설정은 관리자(owner)만 바꿀 수 있습니다.');
  }

  const body = await readJson(request);
  if (!body) return badRequest();

  if (DOCS.has(kind)) {
    if (typeof body.doc !== 'object' || body.doc === null) return badRequest();
    await writeDoc(env, kind, body.doc);
    return json({ ok: true });
  }

  if (COLLECTIONS.has(kind)) {
    if (!Array.isArray(body.items)) return badRequest();
    await writeCollection(env, kind, body.items);
    return json({ ok: true, count: body.items.length });
  }

  if (!Array.isArray(body.items)) return badRequest();
  const items = body.items;

  // 목록형은 '보낸 것이 전부' — 빠진 행은 지운다(삭제를 별도 API 없이 처리).
  const keep = items.map((x) => String(x.id));
  const placeholders = keep.length ? keep.map(() => '?').join(',') : "''";

  if (kind === 'orders') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM orders WHERE id NOT IN (${placeholders})`).bind(...keep),
      ...items.map((o) => env.DB.prepare(ORDER_INSERT).bind(...orderObjToBind(o))),
    ]);
    return json({ ok: true, count: items.length });
  }
  if (kind === 'applications') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM applications WHERE id NOT IN (${placeholders})`).bind(...keep),
      ...items.map((r) => env.DB.prepare(APP_INSERT).bind(...appBind(r))),
    ]);
    return json({ ok: true, count: items.length });
  }
  if (kind === 'inquiries') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM inquiries WHERE id NOT IN (${placeholders})`).bind(...keep),
      ...items.map((r) => env.DB.prepare(INQ_INSERT).bind(...inqBind(r))),
    ]);
    return json({ ok: true, count: items.length });
  }
  if (kind === 'products') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM products WHERE id NOT IN (${placeholders})`).bind(...keep),
      ...items.map((p, i) => env.DB.prepare(PRODUCT_INSERT).bind(...productObjToBind(p, i))),
    ]);
    return json({ ok: true, count: items.length });
  }
  if (kind === 'posts') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM posts WHERE id NOT IN (${placeholders})`).bind(...keep),
      ...items.map((p) => env.DB.prepare(POST_INSERT).bind(...postBind(p))),
    ]);
    return json({ ok: true, count: items.length });
  }

  return notFound('알 수 없는 항목입니다.');
}

export const onRequestDelete = methodNotAllowed;
