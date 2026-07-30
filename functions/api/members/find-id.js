/**
 * POST /api/members/find-id   { name, phone }
 *
 * 아이디 찾기. **비밀번호는 여기서 다루지 않는다** — 메일 발송 수단을 아직 정하지
 * 않아서, 비밀번호는 지금처럼 전화로 본인 확인 후 관리자가 다시 설정한다.
 *
 * 개인정보를 돌려주는 창구라 세 가지를 지킨다.
 *   · **이름과 전화번호가 둘 다** 맞아야 한다. 전화번호만으로 열면 번호를 훑어
 *     "이 번호는 회원이다"를 알아낼 수 있다.
 *   · 아이디를 **가려서** 보여준다. 그대로 주면 그 다음은 비밀번호 맞히기다.
 *   · 실패가 쌓이면 IP 단위로 느려진다(로그인과 같은 방식, 키만 다르다).
 *
 * 없을 때와 안 맞을 때를 구분하지 않는 것도 로그인과 같다.
 */
import { normPhone } from '../../_shared/members.js';
import { makeThrottle } from '../../_shared/throttle.js';
import { json, badRequest, methodNotAllowed, readJson } from '../../_shared/http.js';

const throttle = makeThrottle({ prefix: 'f:', freeAttempts: 5 });

/**
 * 아이디 가리기 — 본인은 알아보고 남은 못 쓰게.
 *   hong1234        → ho****34
 *   me@naver.com    → me***@naver.com
 */
function maskUsername(u) {
  const s = String(u || '');
  const at = s.indexOf('@');
  if (at > 0) {
    const head = s.slice(0, at);
    const shown = head.slice(0, Math.min(2, head.length));
    return shown + '*'.repeat(Math.max(1, head.length - shown.length)) + s.slice(at);
  }
  if (s.length <= 3) return s.slice(0, 1) + '*'.repeat(Math.max(1, s.length - 1));
  const head = s.slice(0, 2);
  const tail = s.length >= 6 ? s.slice(-2) : '';
  return head + '*'.repeat(s.length - head.length - tail.length) + tail;
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ error: '조회할 수 없습니다.', code: 'server_unavailable' }, 503);

  const body = await readJson(request);
  if (!body) return badRequest();
  const name = String(body.name || '').trim();
  const phone = normPhone(body.phone);
  if (!name || !phone) return badRequest('이름과 휴대전화번호를 입력해 주세요.');

  const blocked = await throttle.check(request, env);
  if (blocked) {
    return json({
      error: '여러 번 조회해 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
      code: 'throttled', retryAfter: blocked.retryAfter,
    }, 429, { 'Retry-After': String(blocked.retryAfter) });
  }

  let rows = [];
  try {
    const r = await env.DB.prepare(
      `SELECT username, created_at FROM members
        WHERE phone = ? AND name = ? AND status = 'active'
        ORDER BY created_at LIMIT 5`
    ).bind(phone, name).all();
    rows = r.results || [];
  } catch { return json({ error: '조회하지 못했습니다.' }, 500); }

  if (!rows.length) {
    await throttle.fail(request, env);
    // 있는데 이름이 다른 경우와 아예 없는 경우를 구분하지 않는다
    return json({ found: false }, 200);
  }

  await throttle.clear(request, env);
  return json({
    found: true,
    ids: rows.map((r) => ({ masked: maskUsername(r.username), at: r.created_at })),
  });
}

export const onRequestGet = methodNotAllowed;
