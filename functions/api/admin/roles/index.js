/**
 * GET  /api/admin/roles — 권한 그룹 목록 + 권한 정의
 * POST /api/admin/roles — 그룹 만들기 { name, description, perms[] }
 * accounts.manage 권한 필요.
 */
import { getSession } from '../../../_shared/auth.js';
import { PERMS, parsePerms, can } from '../../../_shared/perm.js';
import { json, badRequest, forbidden, readJson, methodNotAllowed } from '../../../_shared/http.js';

const row2obj = (r) => ({
  id: r.id, name: r.name, description: r.description || '',
  perms: parsePerms(r.perms), isSystem: !!r.is_system, memberCount: r.n || 0,
});

export async function onRequestGet({ request, env, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'accounts.manage')) return forbidden();
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT COUNT(*) FROM admin_users u WHERE u.role_id = r.id AND u.status='active') AS n
       FROM admin_roles r ORDER BY r.is_system DESC, r.id`
  ).all();
  return json({ roles: (results || []).map(row2obj), defs: PERMS });
}

export async function onRequestPost({ request, env, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'accounts.manage')) return forbidden();
  const b = await readJson(request);
  if (!b) return badRequest();
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return badRequest('그룹 이름을 입력해 주세요.');
  const perms = parsePerms(b.perms);
  try {
    const ins = await env.DB.prepare(
      `INSERT INTO admin_roles (name, description, perms, is_system) VALUES (?,?,?,0)`
    ).bind(name, String(b.description || '').trim().slice(0, 200), JSON.stringify(perms)).run();
    return json({ role: { id: ins?.meta?.last_row_id, name, perms, isSystem: false } }, 201);
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) return json({ error: '같은 이름의 그룹이 있습니다.', code: 'duplicate' }, 409);
    return json({ error: '그룹을 만들지 못했습니다.', code: 'server_error' }, 500);
  }
}
export const onRequestDelete = methodNotAllowed;
