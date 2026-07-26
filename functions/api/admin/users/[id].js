/**
 * PATCH  /api/admin/users/:id  — 이름·역할·상태 변경, 비밀번호 재설정
 * DELETE /api/admin/users/:id  — 비활성화(행은 남긴다 — 누가 처리했는지 기록이 사라지면 안 된다)
 * owner 전용.
 *
 * 잠금 방지 두 가지:
 *   · 마지막 활성 owner 는 강등·비활성화할 수 없다.
 *   · 자기 자신은 비활성화할 수 없다.
 */
import { getOwnerSession, hashPassword, checkPasswordStrength } from '../../../_shared/auth.js';
import { loadById, isLastActiveOwner, publicUser } from '../../../_shared/admin-users.js';
import { json, badRequest, forbidden, notFound, methodNotAllowed, readJson } from '../../../_shared/http.js';

export async function onRequestPatch({ request, env, params }) {
  const s = await getOwnerSession(request, env);
  if (!s) return forbidden();

  const id = Number(params.id);
  if (!Number.isFinite(id)) return badRequest();
  const row = await loadById(env, id);
  if (!row) return notFound('계정을 찾을 수 없습니다.');

  const body = await readJson(request);
  if (!body) return badRequest();

  const sets = [];
  const binds = [];

  if (typeof body.displayName === 'string') {
    const dn = body.displayName.trim();
    if (!dn) return json({ error: '이름을 비울 수 없습니다.', code: 'bad_request' }, 400);
    sets.push('display_name = ?'); binds.push(dn);
  }

  if (body.role === 'owner' || body.role === 'staff') {
    if (row.role === 'owner' && body.role !== 'owner' && await isLastActiveOwner(env, id)) {
      return json({ error: '마지막 관리자(owner)의 권한은 내릴 수 없습니다.', code: 'last_owner' }, 409);
    }
    sets.push('role = ?'); binds.push(body.role);
  }

  if (body.status === 'active' || body.status === 'disabled') {
    if (body.status === 'disabled') {
      if (id === s.uid) {
        return json({ error: '자기 계정은 비활성화할 수 없습니다.', code: 'self_disable' }, 409);
      }
      if (row.role === 'owner' && await isLastActiveOwner(env, id)) {
        return json({ error: '마지막 관리자(owner)는 비활성화할 수 없습니다.', code: 'last_owner' }, 409);
      }
    }
    sets.push('status = ?'); binds.push(body.status);
  }

  // 비밀번호 재설정 — 현재 비밀번호를 묻지 않는다(owner 가 잊은 사람을 도와주는 경로).
  // 대신 받은 사람이 반드시 바꾸도록 must_change_password 를 세우고 기존 세션을 끊는다.
  let resetSession = false;
  if (typeof body.password === 'string' && body.password) {
    const weak = checkPasswordStrength(body.password);
    if (weak) return json({ error: weak, code: 'weak_password' }, 400);
    const hash = await hashPassword(body.password);
    sets.push('password_hash = ?', 'must_change_password = 1', 'token_min_iat = ?');
    binds.push(JSON.stringify(hash), Date.now());
    resetSession = true;
  }

  if (!sets.length) return badRequest('변경할 내용이 없습니다.');

  // 비활성화한 계정의 세션도 즉시 끊는다(getSession 이 status 를 보지만 이중으로 막는다)
  if (body.status === 'disabled' && !resetSession) {
    sets.push('token_min_iat = ?'); binds.push(Date.now());
  }

  sets.push("updated_at = datetime('now')");
  binds.push(id);
  await env.DB.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();

  return json({ user: publicUser(await loadById(env, id)) });
}

export async function onRequestDelete({ request, env, params }) {
  const s = await getOwnerSession(request, env);
  if (!s) return forbidden();

  const id = Number(params.id);
  if (!Number.isFinite(id)) return badRequest();
  if (id === s.uid) return json({ error: '자기 계정은 삭제할 수 없습니다.', code: 'self_disable' }, 409);

  const row = await loadById(env, id);
  if (!row) return notFound('계정을 찾을 수 없습니다.');
  if (row.role === 'owner' && await isLastActiveOwner(env, id)) {
    return json({ error: '마지막 관리자(owner)는 삭제할 수 없습니다.', code: 'last_owner' }, 409);
  }

  // 행을 지우지 않고 비활성으로 둔다 — 지난 처리 기록의 '누가'를 잃지 않기 위해서.
  await env.DB.prepare(
    `UPDATE admin_users SET status = 'disabled', token_min_iat = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(Date.now(), id).run();

  return json({ ok: true, disabled: true });
}

export const onRequestGet = methodNotAllowed;
