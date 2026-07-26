/**
 * GET    /api/admin/members/:id — 상세(주소·메모 포함) (members.view)
 * PATCH  /api/admin/members/:id — 수정·비밀번호 재설정 (members.manage)
 * DELETE /api/admin/members/:id — 사용 중지 (members.manage)
 *
 * 지우지 않고 중지하는 이유는 관리자 계정과 같다 — 주문·신청 기록의 '누구'를 잃지 않기 위해서.
 */
import { getSession, hashPassword, checkPasswordStrength } from '../../../_shared/auth.js';
import { can } from '../../../_shared/perm.js';
import { checkEmail, normPhone, publicMember } from '../../../_shared/members.js';
import { json, badRequest, forbidden, notFound, readJson } from '../../../_shared/http.js';

const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

export async function onRequestGet({ request, env, params, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'members.view')) return forbidden();
  const row = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(Number(params.id)).first();
  if (!row) return notFound('회원을 찾을 수 없습니다.');
  return json({ member: publicMember(row, true) });
}

export async function onRequestPatch({ request, env, params, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'members.manage')) return forbidden();
  const id = Number(params.id);
  const row = await env.DB.prepare(`SELECT id FROM members WHERE id = ?`).bind(id).first();
  if (!row) return notFound('회원을 찾을 수 없습니다.');

  const b = await readJson(request);
  if (!b) return badRequest();
  const sets = [], binds = [];
  const put = (col, val) => { sets.push(col + ' = ?'); binds.push(val); };

  if (typeof b.name === 'string') {
    const v = clean(b.name, 60);
    if (!v) return json({ error: '이름을 비울 수 없습니다.', code: 'bad_request' }, 400);
    put('name', v);
  }
  if (typeof b.phone === 'string') {
    const p = normPhone(b.phone);
    if (!p) return json({ error: '휴대전화번호를 정확히 입력해 주세요.', code: 'bad_request' }, 400);
    put('phone', p);
  }
  if (b.email !== undefined) {
    const e = checkEmail(b.email);
    if (e) return json({ error: e, code: 'bad_request' }, 400);
    put('email', clean(b.email, 120));
  }
  if (b.postcode !== undefined)      put('postcode', clean(b.postcode, 10));
  if (b.address !== undefined)       put('address', clean(b.address, 200));
  if (b.addressDetail !== undefined) put('address_detail', clean(b.addressDetail, 120));
  if (b.memo !== undefined)          put('memo', clean(b.memo, 500));
  if (b.marketingOptin !== undefined) put('marketing_optin', b.marketingOptin ? 1 : 0);
  if (b.status === 'active' || b.status === 'disabled') {
    put('status', b.status);
    if (b.status === 'disabled') put('token_min_iat', Date.now());
  }
  if (typeof b.password === 'string' && b.password) {
    const weak = checkPasswordStrength(b.password);
    if (weak) return json({ error: weak, code: 'weak_password' }, 400);
    put('password_hash', JSON.stringify(await hashPassword(b.password)));
    put('must_change_password', 1);
    put('token_min_iat', Date.now());
  }
  if (!sets.length) return badRequest('변경할 내용이 없습니다.');
  sets.push("updated_at = datetime('now')");
  binds.push(id);
  await env.DB.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  const out = await env.DB.prepare(`SELECT * FROM members WHERE id = ?`).bind(id).first();
  return json({ member: publicMember(out, true) });
}

export async function onRequestDelete({ request, env, params, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'members.manage')) return forbidden();
  const id = Number(params.id);
  const row = await env.DB.prepare(`SELECT id FROM members WHERE id = ?`).bind(id).first();
  if (!row) return notFound('회원을 찾을 수 없습니다.');
  await env.DB.prepare(
    `UPDATE members SET status='disabled', token_min_iat=?, updated_at=datetime('now') WHERE id = ?`
  ).bind(Date.now(), id).run();
  return json({ ok: true, disabled: true });
}
