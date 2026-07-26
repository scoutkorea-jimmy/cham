/**
 * GET /api/admin/export — 전체 데이터를 백업 JSON 으로. (owner 전용)
 *
 * 형식은 기존 브라우저 백업과 **같다** — 그래야 같은 파일로 다시 가져오기가 되고,
 * 운영자가 배우던 절차('백업 파일 내려받기')가 그대로 유지된다.
 *   { app:'kach', local:{ kach_*: "JSON 문자열" }, idb:{ pimg, simg, files, gallery } }
 *
 * 이미지는 R2 에서 읽어 dataURL 로 되돌린다. 사진이 많으면 응답이 커지므로
 * 전체 크기를 제한하고, 넘치면 무엇이 빠졌는지 알려 준다(조용히 자르지 않는다).
 */
import {
  orderRowToObj, recordRowToObj, productRowToObj, postRowToObj,
  readCollection, readDoc,
} from '../../_shared/store.js';
import { getOwnerSession } from '../../_shared/auth.js';
import { json, forbidden } from '../../_shared/http.js';

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;   // 백업 한 번에 담을 이미지 총량

function b64(bytes) {
  let bin = '';
  const chunk = 0x8000;   // 한 번에 다 넘기면 스택이 넘친다
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const STORE_OF = { product: 'pimg', page: 'simg', post: 'files', gallery: 'gallery' };

export async function onRequestGet({ request, env, data }) {
  const session = (data && data.session) || await getOwnerSession(request, env);
  if (!session || session.role !== 'owner') return forbidden('내보내기는 관리자(owner)만 할 수 있습니다.');

  const [orders, apps, inq, products, posts, cohorts, partners, popups, settings, consents, kms, visits, sources] =
    await Promise.all([
      env.DB.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all().then((r) => (r.results || []).map(orderRowToObj)),
      env.DB.prepare(`SELECT * FROM applications ORDER BY created_at DESC`).all().then((r) => (r.results || []).map((x) => recordRowToObj(x, 'apply'))),
      env.DB.prepare(`SELECT * FROM inquiries ORDER BY created_at DESC`).all().then((r) => (r.results || []).map((x) => recordRowToObj(x, 'inquiry'))),
      env.DB.prepare(`SELECT * FROM products ORDER BY sort_order, id`).all().then((r) => (r.results || []).map(productRowToObj)),
      env.DB.prepare(`SELECT * FROM posts ORDER BY created_at DESC`).all().then((r) => (r.results || []).map(postRowToObj)),
      readCollection(env, 'cohorts'), readCollection(env, 'partners'), readCollection(env, 'popups'),
      readDoc(env, 'settings'), readDoc(env, 'consents'), readDoc(env, 'kms'),
      env.DB.prepare(`SELECT day, pv, uv FROM visits`).all().then((r) => r.results || []),
      env.DB.prepare(`SELECT kind, n FROM visit_sources`).all().then((r) => r.results || []),
    ]);

  const local = {};
  const put = (k, v) => { if (v != null) local[k] = JSON.stringify(v); };
  put('kach_orders', orders);
  put('kach_applications', apps);
  put('kach_inquiries', inq);
  put('kach_products_v3', products);
  put('kach_posts_v1', posts);
  put('kach_cohorts_v1', cohorts);
  put('kach_partners_v1', partners);
  put('kach_popups_v1', popups);
  put('kach_settings_v1', settings);
  put('kach_consents_v1', consents);
  put('kach_kms_v1', kms);
  const v = {}; visits.forEach((r) => { v[r.day] = { pv: r.pv, uv: r.uv }; });
  const s = {}; sources.forEach((r) => { s[r.kind] = r.n; });
  put('kach_visits_v1', v);
  put('kach_sources_v1', s);

  const idb = { pimg: [], simg: [], files: [], gallery: [] };
  const skipped = [];
  let bytes = 0;

  const { results: imgs } = await env.DB.prepare(
    `SELECT id, scope, ref, role, ord, r2_key, mime, size, name, pcx, pcy, mbx, mby FROM images`
  ).all();

  for (const im of (imgs || [])) {
    const store = STORE_OF[im.scope];
    if (!store) continue;
    if (bytes + (im.size || 0) > MAX_IMAGE_BYTES) { skipped.push(im.name || im.id); continue; }
    let obj = null;
    try { obj = env.MEDIA ? await env.MEDIA.get(im.r2_key) : null; } catch {}
    if (!obj) { skipped.push(im.name || im.id); continue; }
    const buf = new Uint8Array(await obj.arrayBuffer());
    bytes += buf.length;
    const rec = { id: im.id, _blob: 1, blob: `data:${im.mime || 'image/jpeg'};base64,${b64(buf)}` };
    if (im.scope === 'product') { rec.productId = im.ref; rec.role = im.role; rec.ord = im.ord; }
    if (im.scope === 'post') { rec.postId = im.ref; rec.name = im.name; rec.size = im.size; rec.type = im.mime; }
    if (im.scope === 'gallery') { rec.name = im.name; rec.at = null; }
    if (im.scope === 'page') { rec.pcx = im.pcx; rec.pcy = im.pcy; rec.mbx = im.mbx; rec.mby = im.mby; }
    idb[store].push(rec);
  }

  return json({
    app: 'kach', version: 2, exportedAt: new Date().toISOString(),
    local, idb,
    ...(skipped.length ? { skippedImages: skipped } : {}),
  });
}
