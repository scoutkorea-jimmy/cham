/**
 * GET   /api/members/me — 내 정보 + 내 주문 내역
 * PATCH /api/members/me — 내 정보 수정 (이름·연락처·이메일·주소·수신동의·비밀번호)
 *
 * 손님이 자기 것만 만지도록, **무엇을 바꿀 수 있는지를 여기서 못박는다.**
 * username(아이디)·status·memo·must_change_password 는 받지 않는다 —
 * 아이디를 바꾸면 지난 주문·문의와의 연결이 끊기고, 나머지는 운영자 몫이다.
 */
import {
  getMemberSession, hashPassword, verifyPassword, checkPasswordStrength, loadMemberSecret,
  createMemberToken, buildMemberCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { checkEmail, normPhone, publicMember } from '../../_shared/members.js';
import { orderRowToObj, attachOrderItems } from '../../_shared/store.js';
import { json, badRequest, readJson, methodNotAllowed } from '../../_shared/http.js';

const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const unauthorized = () => json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, 401);

export async function onRequestGet({ request, env }) {
  const s = await getMemberSession(request, env);
  if (!s) return unauthorized();

  /* 주문 내역 — member_id 로 묶인 것만. 비회원으로 넣은 주문은 여기 나오지 않는다
     (연락처가 같아도 남의 주문일 수 있어 연락처로 묶지 않는다 — 그건 주문조회의 몫이다). */
  let orders = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM orders WHERE member_id = ? ORDER BY created_at DESC LIMIT 100`
    ).bind(s.mid).all();
    orders = await attachOrderItems(env, (results || []).map(orderRowToObj));
  } catch { orders = []; }

  return json({ member: publicMember(s.member, true), orders });
}

export async function onRequestPatch({ request, env }) {
  const s = await getMemberSession(request, env);
  if (!s) return unauthorized();
  const b = await readJson(request);
  if (!b) return badRequest();

  /* 비밀번호 변경은 **지금 비밀번호를 확인한 뒤에만** 한다.
     로그인된 화면을 잠깐 빌려도 비밀번호까지 바꾸지는 못하게 하기 위해서다. */
  if (b.newPassword) {
    const stored = await loadMemberSecret(env, s.mid);
    if (!stored || !await verifyPassword(String(b.currentPassword || ''), stored)) {
      return json({ error: '지금 쓰시는 비밀번호가 올바르지 않습니다.', code: 'bad_password' }, 400);
    }
    const weak = checkPasswordStrength(String(b.newPassword));
    if (weak) return json({ error: weak, code: 'weak_password' }, 400);
    const hash = await hashPassword(String(b.newPassword));
    /* token_min_iat 를 올려 지금까지 발급된 세션을 모두 끊는다 —
       비밀번호를 바꾸는 이유가 '누가 내 계정을 보고 있다' 일 수 있다. */
    const cut = Date.now();
    try {
      await env.DB.prepare(
        `UPDATE members SET password_hash = ?, must_change_password = 0, token_min_iat = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(hash), cut, s.mid).run();
    } catch { return json({ error: '비밀번호를 바꾸지 못했습니다.' }, 500); }

    // 방금 끊은 세션에 나 자신이 포함된다 — 새 토큰을 바로 내려 로그인 상태를 유지한다
    const token = await createMemberToken(env.ADMIN_SECRET, { mid: s.mid, username: s.username });
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    for (const c of buildMemberCookies(token, { secure: isSecureRequest(request) })) headers.append('Set-Cookie', c);
    const row = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(s.mid).first();
    return new Response(JSON.stringify({ ok: true, member: publicMember(row, true), passwordChanged: true }), { status: 200, headers });
  }

  // ── 일반 정보 수정 ──────────────────────────────────────────
  const name = b.name === undefined ? s.member.name : clean(b.name, 60);
  if (!name) return json({ error: '이름을 입력해 주세요.', code: 'bad_request' }, 400);

  let phone = s.member.phone;
  if (b.phone !== undefined) {
    phone = normPhone(b.phone);
    if (!phone) return json({ error: '휴대전화번호를 정확히 입력해 주세요.', code: 'bad_request' }, 400);
  }
  if (b.email !== undefined) {
    const mailErr = checkEmail(b.email);
    if (mailErr) return json({ error: mailErr, code: 'bad_request' }, 400);
  }
  const email = b.email === undefined ? s.member.email : clean(b.email, 120);
  const postcode = b.postcode === undefined ? s.member.postcode : clean(b.postcode, 10);
  const address = b.address === undefined ? s.member.address : clean(b.address, 200);
  const addressDetail = b.addressDetail === undefined ? s.member.address_detail : clean(b.addressDetail, 120);
  const optin = b.marketingOptin === undefined ? (s.member.marketing_optin ? 1 : 0) : (b.marketingOptin ? 1 : 0);

  try {
    await env.DB.prepare(
      `UPDATE members SET name = ?, phone = ?, email = ?, postcode = ?, address = ?, address_detail = ?,
              marketing_optin = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(name, phone, email, postcode, address, addressDetail, optin, s.mid).run();
  } catch { return json({ error: '저장하지 못했습니다.' }, 500); }

  const row = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(s.mid).first();
  return json({ ok: true, member: publicMember(row, true) });
}

export const onRequestPost = methodNotAllowed;
