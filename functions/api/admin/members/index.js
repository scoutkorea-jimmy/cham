/**
 * GET  /api/admin/members?q= — 회원 목록 (members.view)
 * POST /api/admin/members    — 회원 등록 (members.manage)
 *
 * 필수: 아이디, 비밀번호, 이름, 휴대전화 / 선택: 이메일, 주소
 */
import { getSession, hashPassword, checkPasswordStrength } from '../../../_shared/auth.js';
import { can } from '../../../_shared/perm.js';
import { checkMemberId, checkEmail, normPhone, publicMember } from '../../../_shared/members.js';
import { json, badRequest, forbidden, readJson, methodNotAllowed } from '../../../_shared/http.js';

const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

export async function onRequestGet({ request, env, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'members.view')) return forbidden();
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  let stmt;
  if (q) {
    const like = `%${q}%`;
    stmt = env.DB.prepare(
      `SELECT * FROM members WHERE name LIKE ? OR phone LIKE ? OR username LIKE ? OR email LIKE ?
        ORDER BY created_at DESC LIMIT 300`
    ).bind(like, `%${q.replace(/\D/g, '')}%` || like, like, like);
  } else {
    stmt = env.DB.prepare(`SELECT * FROM members ORDER BY created_at DESC LIMIT 300`);
  }
  const { results } = await stmt.all();
  return json({ members: (results || []).map((r) => publicMember(r, false)) });
}

export async function onRequestPost({ request, env, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'members.manage')) return forbidden();
  const b = await readJson(request);
  if (!b) return badRequest();

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

  try {
    const ins = await env.DB.prepare(
      `INSERT INTO members (username, password_hash, name, phone, email, postcode, address, address_detail, memo, marketing_optin, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?,?,1)`
    ).bind(username, JSON.stringify(hash), name, phone, clean(b.email, 120),
           clean(b.postcode, 10), clean(b.address, 200), clean(b.addressDetail, 120),
           clean(b.memo, 500), b.marketingOptin ? 1 : 0).run();
    const row = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(ins?.meta?.last_row_id).first();
    return json({ member: publicMember(row, true) }, 201);
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) return json({ error: '이미 쓰고 있는 아이디입니다.', code: 'duplicate' }, 409);
    return json({ error: '계정을 만들지 못했습니다.', code: 'server_error' }, 500);
  }
}
export const onRequestDelete = methodNotAllowed;
