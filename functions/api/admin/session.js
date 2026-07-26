/**
 * GET /api/admin/session — 현재 로그인 상태 확인.
 * 화면이 켜질 때마다 호출한다. 쿠키의 admin_session/admin_role 은 표시용일 뿐이라
 * 실제 판단은 반드시 이 응답으로 한다.
 */
import { getSession } from '../../_shared/auth.js';
import { publicUser } from '../../_shared/admin-users.js';
import { json, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env);
  if (!s) return json({ authenticated: false }, 200);
  return json({ authenticated: true, user: publicUser(s.user) }, 200);
}

export const onRequestPost = methodNotAllowed;
