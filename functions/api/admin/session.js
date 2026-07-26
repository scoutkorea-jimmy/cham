/**
 * GET /api/admin/session — 현재 로그인 상태 확인.
 * 화면이 켜질 때마다 호출한다. 쿠키의 admin_session/admin_role 은 표시용일 뿐이라
 * 실제 판단은 반드시 이 응답으로 한다.
 */
import { getSession } from '../../_shared/auth.js';
import { publicUser } from '../../_shared/admin-users.js';
import { ALL_PERMS } from '../../_shared/perm.js';
import { json, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env);
  if (!s) return json({ authenticated: false }, 200);
  // 화면이 사이드바를 거를 때 쓴다. 서버도 같은 키로 막으므로 이 값만 고쳐도 뚫리지 않는다.
  const perms = s.perms === null ? ALL_PERMS : s.perms;
  return json({ authenticated: true, user: publicUser(s.user), perms, roleName: s.roleName }, 200);
}

export const onRequestPost = methodNotAllowed;
