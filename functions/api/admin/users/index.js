/**
 * GET  /api/admin/users  — 계정 목록
 * POST /api/admin/users  — 계정 생성 { username, displayName, role, password }
 * 둘 다 owner 전용.
 */
import { getOwnerSession, hashPassword, checkPasswordStrength } from '../../../_shared/auth.js';
import { checkUsername, normalizeUsername, publicUser, resolveRoleId } from '../../../_shared/admin-users.js';
import { json, badRequest, forbidden, methodNotAllowed, readJson } from '../../../_shared/http.js';

export async function onRequestGet({ request, env }) {
  const s = await getOwnerSession(request, env);
  if (!s) return forbidden();
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.status, u.must_change_password, u.last_login_at, u.created_at,
            u.role_id, r.name AS role_name
       FROM admin_users u LEFT JOIN admin_roles r ON r.id = u.role_id
      ORDER BY u.role = 'owner' DESC, u.username`
  ).all();
  return json({ users: (results || []).map(publicUser) });
}

export async function onRequestPost({ request, env }) {
  const s = await getOwnerSession(request, env);
  if (!s) return forbidden();

  const body = await readJson(request);
  if (!body) return badRequest();

  const username = normalizeUsername(body.username);
  const nameErr = checkUsername(username);
  if (nameErr) return json({ error: nameErr, code: 'bad_request' }, 400);

  const displayName = String(body.displayName || '').trim();
  if (!displayName) return json({ error: '이름을 입력해 주세요.', code: 'bad_request' }, 400);

  const role = body.role === 'owner' ? 'owner' : 'staff';
  const password = String(body.password || '');
  const weak = checkPasswordStrength(password);
  if (weak) return json({ error: weak, code: 'weak_password' }, 400);

  /* 권한 그룹. 화면이 보낸 roleId 가 있으면 그것(있는 그룹인지 확인), 없으면 역할의 기본 그룹.
     예전에는 이 값을 받지도 저장하지도 않아 새 계정이 전부 그룹 없음(role_id NULL)이었다 —
     서버는 전부 거절하고 화면은 전부 보여 주는 반대 방향의 어긋남이었다(2026-09-17 검토). */
  const roleId = await resolveRoleId(env, body.roleId, role);
  if (roleId === false) return json({ error: '권한 그룹을 찾을 수 없습니다.', code: 'bad_request' }, 400);

  const hash = await hashPassword(password);
  try {
    // 새 계정은 must_change_password=1 — 만들어 준 사람이 아는 비밀번호로 계속 쓰지 않게 한다
    const ins = await env.DB.prepare(
      `INSERT INTO admin_users (username, display_name, password_hash, role, status, must_change_password, created_by, role_id)
       VALUES (?, ?, ?, ?, 'active', 1, ?, ?)`
    ).bind(username, displayName, JSON.stringify(hash), role, s.uid, roleId).run();
    return json({
      user: publicUser({
        id: ins?.meta?.last_row_id, username, display_name: displayName,
        role, status: 'active', must_change_password: 1, role_id: roleId,
      }),
    }, 201);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      return json({ error: '이미 쓰고 있는 아이디입니다.', code: 'duplicate' }, 409);
    }
    return json({ error: '계정을 만들지 못했습니다.', code: 'server_error' }, 500);
  }
}

export const onRequestDelete = methodNotAllowed;
