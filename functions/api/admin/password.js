/**
 * POST /api/admin/password  { currentPassword, newPassword }
 * 본인 비밀번호 변경. 성공하면 token_min_iat 을 올려 **다른 기기의 세션까지 모두 끊고**,
 * 이 요청을 보낸 브라우저에만 새 세션 쿠키를 준다.
 */
import {
  getSession, hashPassword, verifyPassword, checkPasswordStrength,
  createToken, buildSessionCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { loadById } from '../../_shared/admin-users.js';
import { json, badRequest, unauthorized, methodNotAllowed, readJson } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  const s = await getSession(request, env);
  if (!s) return unauthorized();

  const body = await readJson(request);
  if (!body) return badRequest();
  const { currentPassword, newPassword } = body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return badRequest();

  const row = await loadById(env, s.uid);
  if (!row) return unauthorized();

  let stored = null;
  try { stored = JSON.parse(row.password_hash || 'null'); } catch {}
  if (!stored || !(await verifyPassword(currentPassword, stored))) {
    return json({ error: '현재 비밀번호가 올바르지 않습니다.', code: 'rejected' }, 401);
  }
  const weak = checkPasswordStrength(newPassword);
  if (weak) return json({ error: weak, code: 'weak_password' }, 400);
  if (newPassword === currentPassword) {
    return json({ error: '이전과 다른 비밀번호로 바꿔 주세요.', code: 'weak_password' }, 400);
  }

  const hash = await hashPassword(newPassword);
  // token_min_iat = 지금. 이 시각 이전에 발급된 토큰은 getSession 에서 걸러진다.
  const minIat = Date.now();
  await env.DB.prepare(
    `UPDATE admin_users
        SET password_hash = ?, must_change_password = 0, token_min_iat = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).bind(JSON.stringify(hash), minIat, s.uid).run();

  // 새 토큰의 iat 은 minIat 이상이라 이 브라우저만 로그인 상태를 유지한다
  const token = await createToken(env.ADMIN_SECRET, {
    uid: s.uid, username: s.username, role: s.role,
  });
  return json({ ok: true }, 200, {
    'Set-Cookie': buildSessionCookies(token, { secure: isSecureRequest(request), role: s.role }),
  });
}

export const onRequestGet = methodNotAllowed;
