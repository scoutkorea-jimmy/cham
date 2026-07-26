/**
 * 관리자 데이터 읽기·쓰기 단일 창구.
 *
 *   GET  /api/admin/data/:kind          → { items|doc, version }
 *   PUT  /api/admin/data/:kind          → 통째로 교체. { items|doc, version }
 *
 * kind: orders | applications | inquiries | products | posts
 *       cohorts | partners | popups | settings | consents | kms | visits
 *
 * '통째로 교체'로 둔 이유 — 관리자 코드가 전부 `배열을 통째로 다시 저장`하는
 * 모양이다(setProducts(a) 등). 같은 모양을 유지해야 화면 코드를 안 건드린다.
 *
 * 그 대신 두 가지를 지킨다.
 *
 * 1) **건수 제한이 없어야 한다.**
 *    예전엔 `DELETE ... WHERE id NOT IN (?,?,?…)` 로 항목마다 물음표를 하나씩 썼다.
 *    D1 은 쿼리당 바인딩 값이 100개까지라, **101건째부터 저장이 통째로 실패**했다
 *    (운영에서 재현: 100건 200 OK / 101건 500). 주문은 손님이 넣는 대로 쌓이므로
 *    반드시 닿는 한계였다. json_each 로 목록을 값 하나로 넘겨 상한을 없앤다.
 *
 * 2) **남의 작업을 조용히 덮지 않아야 한다.**
 *    두 사람이 같은 시점의 목록을 각자 읽고 각자 저장하면 나중 저장이 앞 사람 작업을
 *    되돌린다(재현됨). 읽을 때 준 version 을 저장할 때 되돌려받아, 그 사이 누가
 *    바꿨으면 409 로 거절하고 **누가 언제 바꿨는지** 알려 준다.
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

/* 목록 버전 — 동시 편집 판정용. 표가 아직 없으면(마이그레이션 전) 0 을 주고 검사를 건너뛴다. */
async function readVersion(env, kind) {
  try {
    const row = await env.DB.prepare(
      `SELECT version, updated_at, updated_by FROM list_versions WHERE kind = ?`).bind(kind).first();
    return row ? { version: row.version, at: row.updated_at, by: row.updated_by } : { version: 0 };
  } catch { return { version: 0 }; }
}

function bumpVersion(env, kind, who) {
  return env.DB.prepare(
    `INSERT INTO list_versions (kind, version, updated_at, updated_by) VALUES (?, 1, datetime('now'), ?)
     ON CONFLICT(kind) DO UPDATE SET version = version + 1, updated_at = datetime('now'), updated_by = excluded.updated_by`
  ).bind(kind, who || null);
}

/** 목록을 값 하나로 넘긴다 — 항목마다 물음표를 쓰면 100건에서 막힌다. */
function keepClause(table) {
  return `DELETE FROM ${table} WHERE id NOT IN (SELECT value FROM json_each(?))`;
}

export async function onRequestGet({ params, env }) {
  const kind = String(params.kind || '');
  // 화면은 이 version 을 들고 있다가 저장할 때 되돌려준다 → 그 사이 남이 바꿨는지 가린다
  const ver = await readVersion(env, kind);

  if (kind === 'orders') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM orders ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map(orderRowToObj), version: ver.version });
  }
  if (kind === 'applications') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM applications ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map((r) => recordRowToObj(r, 'apply')), version: ver.version });
  }
  if (kind === 'inquiries') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM inquiries ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map((r) => recordRowToObj(r, 'inquiry')), version: ver.version });
  }
  if (kind === 'products') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM products ORDER BY sort_order, id`).all();
    return json({ items: (results || []).map(productRowToObj), version: ver.version });
  }
  if (kind === 'posts') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM posts ORDER BY created_at DESC`).all();
    return json({ items: (results || []).map(postRowToObj), version: ver.version });
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
  if (COLLECTIONS.has(kind)) return json({ items: await readCollection(env, kind), version: ver.version });
  if (DOCS.has(kind)) return json({ doc: await readDoc(env, kind), version: ver.version });

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

  const who = (session && (session.displayName || session.username)) || null;

  /* 동시 편집 차단 — 읽을 때 준 version 과 지금 버전이 다르면 그 사이 누가 바꾼 것이다.
     그대로 저장하면 그 사람 작업이 조용히 사라진다. version 을 안 보내는 옛 화면은
     검사하지 않는다(배포 중 두 판이 섞여 돌아도 저장이 막히지 않게). */
  const cur = await readVersion(env, kind);
  if (cur.version > 0 && body.version != null && Number(body.version) !== cur.version) {
    return json({
      error: (cur.by ? cur.by + '님이' : '다른 사람이') + ' 먼저 저장했습니다. 화면을 새로 불러온 뒤 다시 해주세요.',
      code: 'conflict', by: cur.by || null, at: cur.at || null, version: cur.version,
    }, 409);
  }

  if (DOCS.has(kind)) {
    if (typeof body.doc !== 'object' || body.doc === null) return badRequest();
    await writeDoc(env, kind, body.doc);
    await bumpVersion(env, kind, who).run();
    return json({ ok: true, version: cur.version + 1 });
  }

  if (COLLECTIONS.has(kind)) {
    if (!Array.isArray(body.items)) return badRequest();
    await writeCollection(env, kind, body.items);
    await bumpVersion(env, kind, who).run();
    return json({ ok: true, count: body.items.length, version: cur.version + 1 });
  }

  if (!Array.isArray(body.items)) return badRequest();
  const items = body.items;

  // 목록형은 '보낸 것이 전부' — 빠진 행은 지운다(삭제를 별도 API 없이 처리).
  // 남길 id 는 **JSON 값 하나**로 넘긴다. 항목마다 물음표를 쓰면 100건에서 막힌다.
  const keepJson = JSON.stringify(items.map((x) => String(x.id)));

  if (kind === 'orders') {
    await env.DB.batch([
      env.DB.prepare(keepClause('orders')).bind(keepJson),
      ...items.map((o) => env.DB.prepare(ORDER_INSERT).bind(...orderObjToBind(o))),
      bumpVersion(env, kind, who),
    ]);
    return json({ ok: true, count: items.length, version: cur.version + 1 });
  }
  if (kind === 'applications') {
    await env.DB.batch([
      env.DB.prepare(keepClause('applications')).bind(keepJson),
      ...items.map((r) => env.DB.prepare(APP_INSERT).bind(...appBind(r))),
      bumpVersion(env, kind, who),
    ]);
    return json({ ok: true, count: items.length, version: cur.version + 1 });
  }
  if (kind === 'inquiries') {
    await env.DB.batch([
      env.DB.prepare(keepClause('inquiries')).bind(keepJson),
      ...items.map((r) => env.DB.prepare(INQ_INSERT).bind(...inqBind(r))),
      bumpVersion(env, kind, who),
    ]);
    return json({ ok: true, count: items.length, version: cur.version + 1 });
  }
  if (kind === 'products') {
    await env.DB.batch([
      env.DB.prepare(keepClause('products')).bind(keepJson),
      ...items.map((p, i) => env.DB.prepare(PRODUCT_INSERT).bind(...productObjToBind(p, i))),
      bumpVersion(env, kind, who),
    ]);
    return json({ ok: true, count: items.length, version: cur.version + 1 });
  }
  if (kind === 'posts') {
    await env.DB.batch([
      env.DB.prepare(keepClause('posts')).bind(keepJson),
      ...items.map((p) => env.DB.prepare(POST_INSERT).bind(...postBind(p))),
      bumpVersion(env, kind, who),
    ]);
    return json({ ok: true, count: items.length, version: cur.version + 1 });
  }

  return notFound('알 수 없는 항목입니다.');
}

export const onRequestDelete = methodNotAllowed;
