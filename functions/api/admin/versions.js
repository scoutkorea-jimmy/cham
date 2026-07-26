/**
 * GET /api/admin/versions → { versions: { orders: 3, products: 12, … } }
 *
 * 관리자 화면이 켜질 때 한 번 받아 둔다.
 *
 * 왜 따로 있는가 — 공개 bootstrap 이 상품·게시글·설정 따위를 한 번에 실어 주는데,
 * 거기엔 버전이 없다(손님에게 필요 없는 값이다). 그렇다고 항목마다 GET 을 다시 하면
 * 화면 뜨는 데 7번을 더 기다린다. 버전만 한 번에 받아 온다.
 */
import { json, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestGet({ env }) {
  const versions = {};
  try {
    const { results } = await env.DB.prepare(
      `SELECT kind, version, updated_at, updated_by FROM list_versions`).all();
    (results || []).forEach((r) => {
      versions[r.kind] = r.version;
    });
  } catch {
    // 표가 아직 없는 환경(마이그레이션 전) — 빈 값이면 화면이 검사를 건너뛴다
  }
  return json({ versions });
}

export const onRequestPost = methodNotAllowed;
