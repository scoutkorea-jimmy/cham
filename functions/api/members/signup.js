/**
 * POST /api/members/signup — 손님이 직접 가입한다.
 *
 * 관리자 등록(/api/admin/members)과 일부러 다른 점:
 *   · 로그인이 필요 없다(당연히). 대신 아무나 부를 수 있으므로 입력을 더 좁게 받는다.
 *   · `memo`(관리자 메모)와 `status` 는 **받지 않는다** — 손님이 자기 계정의 상태나
 *     운영자용 메모를 정할 수 있으면 안 된다.
 *   · must_change_password 를 0 으로 둔다. 본인이 정한 비밀번호이므로 바꾸라 할 이유가 없다
 *     (관리자가 만들어 준 계정은 1 이라 첫 로그인 때 바꾸게 되어 있다).
 *   · 가입과 동시에 로그인시킨다 — 방금 정한 비밀번호를 다시 치게 하지 않는다.
 */
import {
  hashPassword, checkPasswordStrength, createMemberToken, buildMemberCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { checkMemberId, checkEmail, normPhone, publicMember } from '../../_shared/members.js';
import { json, badRequest, readJson, methodNotAllowed } from '../../_shared/http.js';
import { makeThrottle } from '../../_shared/throttle.js';
import { recordConsents } from '../../_shared/consent.js';

const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

/* 가입은 아무나 부를 수 있고 한 번 부를 때마다 **개인정보 한 줄이 쌓인다.**
   쌓이면 회원 목록·대시보드가 못 쓰게 되는 정도가 아니라, 진짜 손님이 가짜 사이에 묻힌다.
   한 IP 에서 하루 5명까지는 그대로 받는다 — 가족이 함께 가입하는 일이 실제로 있다.
   그 다음부터 1분 → 2분 → 4분으로 늘어나 스크립트가 쓸모없어진다. */
const throttle = makeThrottle({ prefix: 's:', freeAttempts: 5, baseDelay: 60 });

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB || !env.ADMIN_SECRET) return json({ error: '가입을 처리할 수 없습니다.' }, 503);

  const blocked = await throttle.check(request, env);
  if (blocked) {
    return json({
      error: '가입 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
      code: 'throttled', retryAfter: blocked.retryAfter,
    }, 429, { 'Retry-After': String(blocked.retryAfter) });
  }

  /* 성공·실패를 가리지 않고 센다. 실패한 시도도 자원을 쓰고, 중복 아이디 응답(409)은
     아이디가 있는지 물어보는 수단이 되기도 한다. 화면이 필수 칸을 먼저 검사하므로
     정상 이용자가 서버 검증에서 걸리는 일은 드물다. */
  await throttle.count(request, env);

  const b = await readJson(request);
  if (!b) return badRequest();

  /* 동의는 화면에서만 막지 않는다 — 화면을 거치지 않고 부를 수 있기 때문이다.
     필수 동의 없이 들어온 가입은 여기서 거절한다. */
  if (!b.agreeTerms || !b.agreePrivacy) {
    return json({ error: '이용약관과 개인정보 수집·이용에 동의해 주세요.', code: 'consent_required' }, 400);
  }

  const username = String(b.username || '').trim().toLowerCase();
  const idErr = checkMemberId(username);
  if (idErr) return json({ error: idErr, code: 'bad_request' }, 400);

  const name = clean(b.name, 60);
  if (!name) return json({ error: '이름을 입력해 주세요.', code: 'bad_request' }, 400);
  const phone = normPhone(b.phone);
  if (!phone) return json({ error: '휴대전화번호를 정확히 입력해 주세요.', code: 'bad_request' }, 400);
  const mailErr = checkEmail(b.email);
  if (mailErr) return json({ error: mailErr, code: 'bad_request' }, 400);

  const weak = checkPasswordStrength(String(b.password || ''));
  if (weak) return json({ error: weak, code: 'weak_password' }, 400);
  const hash = await hashPassword(String(b.password));

  let row = null;
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO members (username, password_hash, name, phone, email, postcode, address, address_detail, marketing_optin, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?,0)`
    ).bind(
      username, JSON.stringify(hash), name, phone, clean(b.email, 120),
      clean(b.postcode, 10), clean(b.address, 200), clean(b.addressDetail, 120),
      b.marketingOptin ? 1 : 0
    ).run();
    row = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(ins?.meta?.last_row_id).first();
  } catch (e) {
    // username 은 UNIQUE — 중복이면 여기로 온다. 다른 오류와 뭉뚱그리면 손님이 원인을 모른다.
    if (String(e && e.message || '').toLowerCase().includes('unique')) {
      return json({ error: '이미 사용 중인 아이디입니다.', code: 'duplicate_id' }, 409);
    }
    return json({ error: '가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
  }
  if (!row) return json({ error: '가입을 처리하지 못했습니다.' }, 500);

  /* 계정이 만들어진 **뒤에** 남긴다 — member_id 가 있어야 나중에 이 사람의 이력으로 편다.
     실패해도 가입을 되돌리지 않는다. 동의는 위에서 이미 확인했고(없으면 여기 못 온다),
     기록을 못 남겼다고 방금 만든 계정을 지우는 편이 더 나쁘다. */
  await recordConsents(env, {
    memberId: row.id, refKind: 'signup',
    items: { terms: true, privacy: true, marketing: !!b.marketingOptin },
  });

  const token = await createMemberToken(env.ADMIN_SECRET, { mid: row.id, username: row.username });
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  for (const c of buildMemberCookies(token, { secure: isSecureRequest(request) })) {
    headers.append('Set-Cookie', c);
  }
  return new Response(JSON.stringify({ ok: true, member: publicMember(row, true) }), { status: 201, headers });
}

export const onRequestGet = methodNotAllowed;
