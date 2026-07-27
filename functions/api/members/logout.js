/** POST /api/members/logout — 회원 세션 쿠키를 지운다. 세션이 없어도 성공으로 답한다. */
import { clearMemberCookies, isSecureRequest } from '../../_shared/auth.js';
import { methodNotAllowed } from '../../_shared/http.js';

export async function onRequestPost({ request }) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  for (const c of clearMemberCookies({ secure: isSecureRequest(request) })) {
    headers.append('Set-Cookie', c);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export const onRequestGet = methodNotAllowed;
