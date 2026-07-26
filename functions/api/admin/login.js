/**
 * POST /api/admin/login   { username, password }
 *
 * 성공: 200 + HttpOnly 세션 쿠키 + { user }
 * 실패: 401 { code: 'rejected' }  — 비밀번호 오류·비활성 계정·없는 아이디를
 *       **구분해 알려주지 않는다.** 구분해 주면 아이디가 존재하는지 떠볼 수 있다.
 * 제한: 429 { code: 'throttled', retryAfter }
 *
 * IP 단위 지수 백오프. 계정 단위로 잠그지 않는 이유 — 남의 아이디로 일부러
 * 틀려서 그 사람을 잠글 수 있기 때문이다(계정 잠금은 그 자체가 공격 수단이 된다).
 */
import {
  createToken, hashPassword, verifyPassword,
  buildSessionCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { loadByUsername, normalizeUsername, publicUser } from '../../_shared/admin-users.js';
import { json, badRequest, methodNotAllowed, readJson } from '../../_shared/http.js';

const FAIL_FREE_ATTEMPTS = 3;              // 오타 몇 번은 봐준다
const BASE_DELAY_SECONDS = 60;
const MAX_DELAY_SECONDS = 24 * 60 * 60;
const IDLE_RESET_SECONDS = 72 * 60 * 60;   // 사흘간 시도가 없으면 카운터 초기화

function requiredDelay(count) {
  if (count < FAIL_FREE_ATTEMPTS) return 0;
  const power = Math.min(count - FAIL_FREE_ATTEMPTS, 24);
  return Math.min(BASE_DELAY_SECONDS * 2 ** power, MAX_DELAY_SECONDS);
}

async function getAttempts(env, ip) {
  try {
    const row = await env.DB.prepare(
      `SELECT attempt_count, first_attempt_at, last_attempt_at FROM admin_login_attempts WHERE ip = ?`
    ).bind(ip).first();
    if (!row) return { count: 0, first: 0, last: 0 };
    return {
      count: Number(row.attempt_count) || 0,
      first: Number(row.first_attempt_at) || 0,
      last: Number(row.last_attempt_at) || 0,
    };
  } catch { return { count: 0, first: 0, last: 0 }; }
}

async function recordFailure(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const prev = await getAttempts(env, ip);
    await env.DB.prepare(
      `INSERT INTO admin_login_attempts (ip, attempt_count, first_attempt_at, last_attempt_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET
         attempt_count    = excluded.attempt_count,
         first_attempt_at = excluded.first_attempt_at,
         last_attempt_at  = excluded.last_attempt_at`
    ).bind(ip, prev.count + 1, prev.count > 0 && prev.first ? prev.first : now, now).run();
  } catch { /* 카운터 기록 실패로 로그인 자체를 막지는 않는다 */ }
}

async function clearAttempts(env, ip) {
  try { await env.DB.prepare(`DELETE FROM admin_login_attempts WHERE ip = ?`).bind(ip).run(); } catch {}
}

/** 어떤 검사에서 걸렸든 같은 응답. 타이밍 차이도 무작위 지연으로 흐린다. */
async function rejected() {
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 200)));
  return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.', code: 'rejected' }, 401);
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_SECRET) {
    return json({ error: '서버 설정이 완료되지 않았습니다.', code: 'server_unavailable' }, 500);
  }

  const body = await readJson(request);
  if (!body) return badRequest();
  const username = normalizeUsername(body.username);
  const password = body.password;
  if (!username || typeof password !== 'string' || !password) return badRequest();

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Math.floor(Date.now() / 1000);

  let att = await getAttempts(env, ip);
  if (att.count > 0 && att.last && now - att.last >= IDLE_RESET_SECONDS) {
    await clearAttempts(env, ip);
    att = { count: 0, first: 0, last: 0 };
  }
  if (att.count >= FAIL_FREE_ATTEMPTS && att.last) {
    const earliest = att.last + requiredDelay(att.count);
    if (now < earliest) {
      const retryAfter = earliest - now;
      return json({
        error: '로그인을 여러 번 실패해 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
        code: 'throttled', retryAfter,
      }, 429, { 'Retry-After': String(retryAfter) });
    }
  }

  let sessionUser = null;
  const row = await loadByUsername(env, username);

  if (row) {
    if (row.status === 'active') {
      let stored = null;
      try { stored = JSON.parse(row.password_hash || 'null'); } catch {}
      if (stored && await verifyPassword(password, stored)) sessionUser = row;
    }
    // status가 disabled면 비밀번호가 맞아도 통과시키지 않는다(응답은 동일)
  } else if (
    env.ADMIN_BOOTSTRAP_USER &&
    env.ADMIN_BOOTSTRAP_PASSWORD &&
    // 약한 값이 시크릿에 들어가면 이 경로가 그대로 취약점이 된다.
    // 이 아이디에는 계정 행이 없어 지수 백오프 말고는 막을 것이 없기 때문이다.
    String(env.ADMIN_BOOTSTRAP_PASSWORD).length >= 16 &&
    username === normalizeUsername(env.ADMIN_BOOTSTRAP_USER) &&
    password === env.ADMIN_BOOTSTRAP_PASSWORD
  ) {
    /* 복구 경로(break-glass) — 숨겨 둔 뒷문이 아니라 **문서에 적힌 비상구**다.
       · 이 아이디로 된 계정 행이 **없을 때만** 열린다. 한 번 쓰면 행이 생겨 스스로 닫힌다.
       · 쓰려면 Cloudflare 대시보드에서 시크릿을 볼 수/바꿀 수 있어야 한다 — 즉 계정 주인만 쓴다.
       · 만들어진 계정은 계정 관리 목록에 그대로 보이므로, 누가 썼는지 흔적이 남는다.
       · 최초 설치 때도 같은 경로로 첫 관리자가 만들어진다.
       절차는 docs/deploy.md '관리자 계정을 잃었을 때' 참조. */
    try {
      const hash = await hashPassword(password);
      const ins = await env.DB.prepare(
        `INSERT INTO admin_users (username, display_name, password_hash, role, status, must_change_password)
         VALUES (?, ?, ?, 'owner', 'active', 1)`
      ).bind(username, '복구 계정', JSON.stringify(hash)).run();
      sessionUser = {
        id: ins?.meta?.last_row_id, username, display_name: '복구 계정',
        role: 'owner', status: 'active', must_change_password: 1,
      };
    } catch {
      // 삽입에 실패하면 통과시키지 않는다 — 행 없이 세션만 주는 편이 더 위험하다
    }
  }

  if (!sessionUser) {
    await recordFailure(env, ip);
    return rejected();
  }

  await clearAttempts(env, ip);
  try {
    await env.DB.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`)
      .bind(sessionUser.id).run();
  } catch {}

  const token = await createToken(env.ADMIN_SECRET, {
    uid: sessionUser.id, username: sessionUser.username, role: sessionUser.role,
  });

  return json({ user: publicUser(sessionUser) }, 200, {
    'Set-Cookie': buildSessionCookies(token, {
      secure: isSecureRequest(request), role: sessionUser.role,
    }),
  });
}

export const onRequestGet = methodNotAllowed;
