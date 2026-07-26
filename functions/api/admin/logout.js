/**
 * POST /api/admin/logout — 세션 쿠키를 만료시킨다.
 * 세션이 없어도 200 으로 답한다(로그아웃은 실패할 일이 아니다).
 */
import { clearSessionCookies, isSecureRequest } from '../../_shared/auth.js';
import { json, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestPost({ request }) {
  return json({ ok: true }, 200, {
    'Set-Cookie': clearSessionCookies({ secure: isSecureRequest(request) }),
  });
}

export const onRequestGet = methodNotAllowed;
