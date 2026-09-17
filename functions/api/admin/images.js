/**
 * POST   /api/admin/images   multipart — 이미지 올리기
 *          file, scope(product|page|post|gallery), ref, role, ord, id(선택 — 페이지 슬롯은 슬롯 id 고정)
 * PATCH  /api/admin/images   { id, pcx, pcy, mbx, mby }  — 페이지 슬롯 초점 위치만 수정
 *                            { id, role?, ord? }        — 상품 사진의 역할(main|extra|detail)·순서만 수정
 * DELETE /api/admin/images   { id } 또는 { scope, ref }  — 낱개 또는 한 상품의 전체
 *
 * 실물은 R2, 메타는 D1. 브라우저에서 만든 dataURL 을 D1 에 넣지 않는다 —
 * localStorage 5MB 한계를 벗어나려고 옮기는 것인데 다시 문자열로 넣으면 의미가 없다.
 */
import { IMAGE_INSERT, imageRowToObj } from '../../_shared/store.js';
import { json, badRequest, notFound, forbidden, readJson } from '../../_shared/http.js';
import { canAny } from '../../_shared/perm.js';

// 상품 사진은 판매 처리, 나머지(페이지·글·갤러리)는 콘텐츠 관리 권한 — 둘 중 하나면 된다
const IMAGE_PERMS = ['sales.manage', 'content.manage'];

const SCOPES = new Set(['product', 'page', 'post', 'gallery']);
// 화면(assets/site.js MAX_IMAGE_BYTES)과 같은 값이어야 한다 — 다르면 그 사이 파일이 조용히 실패한다
const MAX_BYTES = 5 * 1024 * 1024;
const OK_MIME = /^image\/(jpeg|png|webp|gif|avif)$/;

const rid = () => 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const clampPct = (v) => (v == null ? null : Math.max(0, Math.min(100, Math.round(Number(v)) || 0)));

export async function onRequestPost({ request, env, data }) {
  if (!canAny(data && data.session, IMAGE_PERMS)) return forbidden('사진을 올릴 권한이 없습니다.');
  if (!env.MEDIA) return json({ error: '이미지 저장소가 연결되지 않았습니다.', code: 'server_unavailable' }, 503);

  let form;
  try { form = await request.formData(); } catch { return badRequest(); }

  const file = form.get('file');
  const scope = String(form.get('scope') || '');
  if (!file || typeof file === 'string') return badRequest('파일이 없습니다.');
  if (!SCOPES.has(scope)) return badRequest('scope 가 올바르지 않습니다.');
  if (file.size > MAX_BYTES) return json({ error: '사진이 너무 큽니다. 한 장에 5MB 까지 올릴 수 있습니다.', code: 'too_large' }, 413);
  if (!OK_MIME.test(file.type || '')) return badRequest('이미지 파일만 올릴 수 있습니다.');

  const ref = form.get('ref') ? String(form.get('ref')).slice(0, 120) : null;
  const role = form.get('role') ? String(form.get('role')).slice(0, 20) : null;
  const ord = Math.max(0, Math.floor(Number(form.get('ord')) || 0));

  // 페이지 슬롯은 자리마다 사진이 하나뿐이라 id 를 슬롯 id 로 고정한다.
  // 그 외에는 새 id → 캐시가 즉시 갈아끼워진다(immutable 캐시를 쓰는 이유).
  const id = scope === 'page' && ref ? ref : rid();
  const key = `${scope}/${id}`;

  // 페이지 슬롯 재업로드 시 기존 초점 위치는 유지한다 — 사진만 바꿨는데
  // 맞춰 둔 위치가 가운데로 돌아가면 다시 맞춰야 한다.
  let prev = null;
  if (scope === 'page') {
    prev = await env.DB.prepare(`SELECT scope, pcx, pcy, mbx, mby FROM images WHERE id = ?`).bind(id).first();
    // 슬롯 id 가 다른 scope 의 사진 id 와 겹치면 그 행을 덮어써 원본 파일이 고아가 된다 — 막는다
    if (prev && prev.scope !== 'page') return badRequest('슬롯 이름이 다른 사진의 id 와 겹칩니다.');
  }

  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await env.DB.prepare(IMAGE_INSERT).bind(
    id, scope, ref, role, ord, key, file.type, file.size,
    file.name ? String(file.name).slice(0, 200) : null,
    prev?.pcx ?? null, prev?.pcy ?? null, prev?.mbx ?? null, prev?.mby ?? null,
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, scope, ref, role, ord, mime, name, size, pcx, pcy, mbx, mby, created_at FROM images WHERE id = ?`
  ).bind(id).first();
  return json({ image: imageRowToObj(row) }, 201);
}

const ROLES = new Set(['main', 'extra', 'detail']);

export async function onRequestPatch({ request, env, data }) {
  if (!canAny(data && data.session, IMAGE_PERMS)) return forbidden('사진을 바꿀 권한이 없습니다.');
  const body = await readJson(request);
  if (!body || !body.id) return badRequest();

  const row = await env.DB.prepare(`SELECT id, scope FROM images WHERE id = ?`).bind(String(body.id)).first();
  if (!row) return notFound('이미지를 찾을 수 없습니다.');

  /* 상품 사진 — 역할·순서. 사진 자체는 그대로라 id 도 캐시도 그대로다.
     페이지 슬롯의 초점 좌표와는 다른 요청이라 갈래를 나눈다(두 갈래가 섞이면 초점이 null 로 지워진다). */
  if ('role' in body || 'ord' in body) {
    if (row.scope !== 'product') return badRequest('역할·순서는 상품 사진만 바꿀 수 있습니다.');
    const role = body.role == null ? null : String(body.role);
    if (role != null && !ROLES.has(role)) return badRequest('역할이 올바르지 않습니다.');
    const ord = body.ord == null ? null : Math.max(0, Math.floor(Number(body.ord) || 0));
    await env.DB.prepare(
      `UPDATE images SET role = COALESCE(?, role), ord = COALESCE(?, ord) WHERE id = ?`
    ).bind(role, ord, String(body.id)).run();
    return json({ ok: true });
  }

  await env.DB.prepare(
    `UPDATE images SET pcx = ?, pcy = ?, mbx = ?, mby = ? WHERE id = ?`
  ).bind(clampPct(body.pcx), clampPct(body.pcy), clampPct(body.mbx), clampPct(body.mby), String(body.id)).run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, data }) {
  if (!canAny(data && data.session, IMAGE_PERMS)) return forbidden('사진을 지울 권한이 없습니다.');
  const body = await readJson(request);
  if (!body) return badRequest();

  let rows = [];
  if (body.id) {
    const r = await env.DB.prepare(`SELECT id, r2_key FROM images WHERE id = ?`).bind(String(body.id)).first();
    if (r) rows = [r];
  } else if (body.scope && body.ref) {
    const { results } = await env.DB.prepare(
      `SELECT id, r2_key FROM images WHERE scope = ? AND ref = ?`
    ).bind(String(body.scope), String(body.ref)).all();
    rows = results || [];
  } else return badRequest();

  if (!rows.length) return json({ ok: true, deleted: 0 });

  /* R2 를 먼저 지우고, **지워진 것만** D1 에서 뺀다. 예전에는 R2 실패를 삼키고 행을 지워
     참조 없는 파일이 신호 없이 남았다. 실패한 것은 행을 남겨 두고 실패를 알린다 — 다시 지우면 된다. */
  const gone = [];
  const failed = [];
  for (const r of rows) {
    try { if (env.MEDIA) await env.MEDIA.delete(r.r2_key); gone.push(r); } catch { failed.push(r.id); }
  }
  if (gone.length) await env.DB.batch(gone.map((r) => env.DB.prepare(`DELETE FROM images WHERE id = ?`).bind(r.id)));
  if (failed.length) {
    return json({ error: `사진 ${failed.length}장을 저장소에서 지우지 못했습니다. 잠시 후 다시 시도해 주세요.`, code: 'partial', deleted: gone.length, failed }, 500);
  }
  return json({ ok: true, deleted: gone.length });
}
