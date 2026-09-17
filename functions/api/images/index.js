/**
 * GET /api/images?scope=product&ref=p_vin_omija — 목록(메타만).
 * 실제 파일은 /api/images/:id 로 받는다.
 */
import { imageRowToObj } from '../../_shared/store.js';
import { json, badRequest } from '../../_shared/http.js';

const SCOPES = new Set(['product', 'page', 'post', 'gallery']);

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return json({ images: [] });

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || '';
  const ref = url.searchParams.get('ref');
  if (!SCOPES.has(scope)) return badRequest('scope 가 올바르지 않습니다.');
  // 상품·게시글 사진은 그 상품·글의 것만 — scope 전체를 훑을 이유가 없다(갤러리·페이지 슬롯만 전체가 필요하다)
  if (!ref && scope !== 'gallery' && scope !== 'page') return badRequest('ref 가 필요합니다.');

  const q = ref
    ? env.DB.prepare(
        `SELECT id, scope, ref, role, ord, mime, name, size, pcx, pcy, mbx, mby, created_at
           FROM images WHERE scope = ? AND ref = ? ORDER BY ord, id LIMIT 1000`
      ).bind(scope, ref)
    : env.DB.prepare(
        `SELECT id, scope, ref, role, ord, mime, name, size, pcx, pcy, mbx, mby, created_at
           FROM images WHERE scope = ? ORDER BY ord, id LIMIT 1000`
      ).bind(scope);

  const { results } = await q.all();
  return json({ images: (results || []).map(imageRowToObj) });
}
