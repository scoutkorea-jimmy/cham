/**
 * PATCH  /api/admin/roles/:id — 이름·설명·권한 수정
 * DELETE /api/admin/roles/:id — 삭제
 *
 * 기본 그룹(is_system)은 지울 수 없고, 권한도 줄일 수 없다 —
 * '최고 관리자'에서 accounts.manage 를 빼면 아무도 권한을 되돌릴 수 없게 된다.
 */
import { getSession } from '../../../_shared/auth.js';
import { parsePerms, can } from '../../../_shared/perm.js';
import { json, badRequest, forbidden, notFound, readJson, methodNotAllowed } from '../../../_shared/http.js';

export async function onRequestPatch({ request, env, params, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'accounts.manage')) return forbidden();
  const id = Number(params.id);
  const row = await env.DB.prepare(`SELECT * FROM admin_roles WHERE id = ?`).bind(id).first();
  if (!row) return notFound('그룹을 찾을 수 없습니다.');

  const b = await readJson(request);
  if (!b) return badRequest();
  const sets = [], binds = [];
  if (typeof b.name === 'string' && b.name.trim()) { sets.push('name = ?'); binds.push(b.name.trim().slice(0, 40)); }
  if (typeof b.description === 'string') { sets.push('description = ?'); binds.push(b.description.trim().slice(0, 200)); }
  if (Array.isArray(b.perms)) {
    if (row.is_system) return json({ error: '기본 그룹의 권한은 바꿀 수 없습니다. 새 그룹을 만들어 쓰세요.', code: 'system_role' }, 409);
    sets.push('perms = ?'); binds.push(JSON.stringify(parsePerms(b.perms)));
  }
  if (!sets.length) return badRequest('변경할 내용이 없습니다.');
  sets.push("updated_at = datetime('now')");
  binds.push(id);
  try {
    await env.DB.prepare(`UPDATE admin_roles SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) return json({ error: '같은 이름의 그룹이 있습니다.', code: 'duplicate' }, 409);
    throw e;
  }
  const out = await env.DB.prepare(`SELECT * FROM admin_roles WHERE id = ?`).bind(id).first();
  return json({ role: { id: out.id, name: out.name, description: out.description || '', perms: parsePerms(out.perms), isSystem: !!out.is_system } });
}

export async function onRequestDelete({ request, env, params, data }) {
  const s = (data && data.session) || await getSession(request, env);
  if (!can(s, 'accounts.manage')) return forbidden();
  const id = Number(params.id);
  const row = await env.DB.prepare(`SELECT * FROM admin_roles WHERE id = ?`).bind(id).first();
  if (!row) return notFound('그룹을 찾을 수 없습니다.');
  if (row.is_system) return json({ error: '기본 그룹은 지울 수 없습니다.', code: 'system_role' }, 409);
  const used = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ?`).bind(id).first();
  if (Number(used && used.n)) return json({ error: '이 그룹을 쓰는 계정이 있습니다. 먼저 다른 그룹으로 옮겨 주세요.', code: 'in_use' }, 409);
  await env.DB.prepare(`DELETE FROM admin_roles WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
export const onRequestGet = methodNotAllowed;
