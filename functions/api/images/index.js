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

  const q = ref
    ? env.DB.prepare(
        `SELECT id, scope, ref, role, ord, name, size, pcx, pcy, mbx, mby
           FROM images WHERE scope = ? AND ref = ? ORDER BY ord, id`
      ).bind(scope, ref)
    : env.DB.prepare(
        `SELECT id, scope, ref, role, ord, name, size, pcx, pcy, mbx, mby
           FROM images WHERE scope = ? ORDER BY ord, id`
      ).bind(scope);

  const { results } = await q.all();
  return json({ images: (results || []).map(imageRowToObj) });
}
