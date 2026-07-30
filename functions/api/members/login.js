/**
 * POST /api/members/login   { username, password }
 *
 * 관리자 로그인(/api/admin/login)과 같은 원칙을 따른다.
 *   · 실패 사유를 구분해 알려주지 않는다 — 구분해 주면 아이디가 있는지 떠볼 수 있다.
 *   · IP 단위 지수 백오프. 계정 단위로 잠그지 않는다 — 남의 아이디로 일부러 틀려
 *     그 사람을 잠글 수 있고, 그러면 계정 잠금 자체가 공격 수단이 된다.
 *
 * 시도 횟수는 admin_login_attempts 표를 함께 쓰되 키에 `m:` 을 붙인다.
 * 표를 새로 만들 이유가 없고, 무엇보다 **회원 로그인 실패가 관리자 로그인을 잠그면 안 된다**
 * (같은 사무실에서 손님용 화면을 만지다 관리자가 못 들어가는 일이 생긴다).
 */
import {
  verifyPassword, createMemberToken, buildMemberCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { publicMember } from '../../_shared/members.js';
import { makeThrottle } from '../../_shared/throttle.js';
import { json, badRequest, methodNotAllowed, readJson } from '../../_shared/http.js';

// 손님이라 오타를 조금 더 봐준다(관리자보다 느슨한 5회)
const throttle = makeThrottle({ prefix: 'm:', freeAttempts: 5 });

/** 어떤 검사에서 걸렸든 같은 응답. 타이밍 차이도 무작위 지연으로 흐린다. */
async function rejected() {
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 200)));
  return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.', code: 'rejected' }, 401);
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB || !env.ADMIN_SECRET) {
    return json({ error: '서버 설정이 완료되지 않았습니다.', code: 'server_unavailable' }, 500);
  }
  const body = await readJson(request);
  if (!body) return badRequest();
  const username = String(body.username || '').trim().toLowerCase();
  const password = body.password;
  if (!username || typeof password !== 'string' || !password) return badRequest();

  const blocked = await throttle.check(request, env);
  if (blocked) {
    return json({
      error: '로그인을 여러 번 실패해 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
      code: 'throttled', retryAfter: blocked.retryAfter,
    }, 429, { 'Retry-After': String(blocked.retryAfter) });
  }

  let row = null;
  try {
    row = await env.DB.prepare(`SELECT * FROM members WHERE username = ?`).bind(username).first();
  } catch { return json({ error: '로그인을 처리하지 못했습니다.' }, 500); }

  let ok = false;
  if (row && row.status === 'active') {
    let stored = null;
    try { stored = JSON.parse(row.password_hash || 'null'); } catch {}
    if (stored && await verifyPassword(password, stored)) ok = true;
  }
  if (!ok) {
    await throttle.fail(request, env);
    return rejected();
  }

  await throttle.clear(request, env);
  try {
    await env.DB.prepare(`UPDATE members SET last_login_at = datetime('now') WHERE id = ?`).bind(row.id).run();
  } catch { /* 마지막 로그인 시각은 기록에 실패해도 로그인을 막을 이유가 없다 */ }

  const token = await createMemberToken(env.ADMIN_SECRET, { mid: row.id, username: row.username });
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  for (const c of buildMemberCookies(token, { secure: isSecureRequest(request) })) {
    headers.append('Set-Cookie', c);
  }
  return new Response(JSON.stringify({ ok: true, member: publicMember(row, true) }), { status: 200, headers });
}

export const onRequestGet = methodNotAllowed;
