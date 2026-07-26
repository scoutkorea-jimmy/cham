/**
 * POST /api/admin/import — 기존 백업 JSON 을 서버로 옮긴다. (owner 전용)
 *
 * 관리자 '데이터 백업 → 백업 파일 내려받기'가 뽑는 파일을 **그대로** 받는다.
 *   { app:'kach', local:{ kach_*: "JSON 문자열" }, idb:{ files, gallery, pimg, simg } }
 * idb 레코드의 blob 은 dataURL 문자열(`_blob:1`)이다 — 여기서 R2 로 옮긴다.
 *
 * 손으로 옮길 것이 없도록 이 한 번의 호출로 끝내는 것이 목적이다.
 * 같은 파일을 두 번 넣어도 결과가 같다(id 기준 upsert).
 */
import {
  ORDER_INSERT, orderObjToBind, APP_INSERT, INQ_INSERT, appBind, inqBind,
  PRODUCT_INSERT, productObjToBind, POST_INSERT, postBind,
  writeCollection, writeDoc, IMAGE_INSERT, parseJSON,
} from '../../_shared/store.js';
import { getOwnerSession } from '../../_shared/auth.js';
import { json, badRequest, forbidden, readJson } from '../../_shared/http.js';

/** "data:image/jpeg;base64,..." → { bytes, mime } */
function decodeDataURL(durl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(durl || ''));
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  try {
    if (m[2]) {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime };
  } catch { return null; }
}

/** IndexedDB 스토어 이름 → images.scope */
const SCOPE_OF = { pimg: 'product', simg: 'page', files: 'post', gallery: 'gallery' };

export async function onRequestPost({ request, env, data }) {
  const session = (data && data.session) || null;
  if (!session || session.role !== 'owner') return forbidden('가져오기는 관리자(owner)만 할 수 있습니다.');
  if (!env.DB) return json({ error: '데이터베이스가 연결되지 않았습니다.', code: 'server_unavailable' }, 503);

  const dump = await readJson(request);
  if (!dump || dump.app !== 'kach') return badRequest('이 사이트의 백업 파일이 아닙니다.');

  const local = dump.local || {};
  const get = (k) => parseJSON(local[k], null);
  const report = {};

  /* ── localStorage 쪽 ─────────────────────────────────── */
  const orders = get('kach_orders') || [];
  if (orders.length) {
    await env.DB.batch(orders.map((o) => env.DB.prepare(ORDER_INSERT).bind(...orderObjToBind(o))));
  }
  report.orders = orders.length;

  const apps = get('kach_applications') || [];
  if (apps.length) await env.DB.batch(apps.map((r) => env.DB.prepare(APP_INSERT).bind(...appBind(r))));
  report.applications = apps.length;

  const inq = get('kach_inquiries') || [];
  if (inq.length) await env.DB.batch(inq.map((r) => env.DB.prepare(INQ_INSERT).bind(...inqBind(r))));
  report.inquiries = inq.length;

  // 상품 키는 버전이 올라간 적이 있다(v2 → v3) — 최신 것을 쓰고, 없으면 이전 것을 본다
  const products = get('kach_products_v3') || get('kach_products_v2') || [];
  if (products.length) {
    await env.DB.batch(products.map((p, i) => env.DB.prepare(PRODUCT_INSERT).bind(...productObjToBind(p, i))));
  }
  report.products = products.length;

  const posts = get('kach_posts_v1') || [];
  if (posts.length) await env.DB.batch(posts.map((p) => env.DB.prepare(POST_INSERT).bind(...postBind(p))));
  report.posts = posts.length;

  for (const [key, kind] of [['kach_cohorts_v1', 'cohorts'], ['kach_partners_v1', 'partners'], ['kach_popups_v1', 'popups']]) {
    const list = get(key);
    if (Array.isArray(list)) { await writeCollection(env, kind, list); report[kind] = list.length; }
  }
  for (const [key, name] of [['kach_settings_v1', 'settings'], ['kach_consents_v1', 'consents'], ['kach_kms_v1', 'kms']]) {
    const doc = get(key);
    if (doc && typeof doc === 'object') { await writeDoc(env, name, doc); report[name] = 1; }
  }

  const visits = get('kach_visits_v1') || {};
  const vDays = Object.keys(visits);
  if (vDays.length) {
    await env.DB.batch(vDays.map((d) => env.DB.prepare(
      `INSERT INTO visits (day, pv, uv) VALUES (?,?,?)
       ON CONFLICT(day) DO UPDATE SET pv = excluded.pv, uv = excluded.uv`
    ).bind(d, Number(visits[d].pv) || 0, Number(visits[d].uv) || 0)));
  }
  const sources = get('kach_sources_v1') || {};
  const sKeys = Object.keys(sources);
  if (sKeys.length) {
    await env.DB.batch(sKeys.map((k) => env.DB.prepare(
      `INSERT INTO visit_sources (kind, n) VALUES (?,?)
       ON CONFLICT(kind) DO UPDATE SET n = excluded.n`
    ).bind(k, Number(sources[k]) || 0)));
  }
  report.visitDays = vDays.length;

  /* ── IndexedDB 이미지 → R2 ───────────────────────────── */
  let imported = 0, skipped = 0;
  const idb = dump.idb || {};
  for (const store of Object.keys(SCOPE_OF)) {
    const recs = idb[store] || [];
    for (const rec of recs) {
      const decoded = rec && rec._blob && typeof rec.blob === 'string' ? decodeDataURL(rec.blob) : null;
      if (!decoded || !env.MEDIA) { skipped += 1; continue; }
      const scope = SCOPE_OF[store];
      const id = String(rec.id);
      const key = `${scope}/${id}`;
      try {
        await env.MEDIA.put(key, decoded.bytes, { httpMetadata: { contentType: decoded.mime } });
        await env.DB.prepare(IMAGE_INSERT).bind(
          id, scope,
          rec.productId ?? rec.postId ?? (scope === 'page' ? id : null),
          rec.role ?? null, Number(rec.ord) || 0, key, decoded.mime, decoded.bytes.length,
          rec.name ?? null,
          rec.pcx ?? null, rec.pcy ?? null, rec.mbx ?? null, rec.mby ?? null,
        ).run();
        imported += 1;
      } catch { skipped += 1; }
    }
  }
  report.images = imported;
  report.imagesSkipped = skipped;

  return json({ ok: true, report });
}
