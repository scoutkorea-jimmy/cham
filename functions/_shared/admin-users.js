/** cham · 관리자 계정 조회·정규화 */

export function normalizeUsername(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase();
}

/**
 * 아이디 규칙 — 영문 소문자·숫자·밑줄·하이픈 3~32자.
 * 이메일 모양을 막는 이유: 나중에 이메일 로그인을 붙일 때 값이 섞이지 않게.
 */
export function checkUsername(raw) {
  const u = normalizeUsername(raw);
  if (!u) return '아이디를 입력해 주세요.';
  if (u.includes('@')) return '아이디에는 이메일 주소를 쓸 수 없습니다.';
  if (!/^[a-z0-9_-]{3,32}$/.test(u)) return '아이디는 영문 소문자·숫자·_·- 조합 3~32자여야 합니다.';
  return null;
}

export async function loadByUsername(env, username) {
  try {
    return await env.DB.prepare(
      `SELECT id, username, display_name, password_hash, role, status,
              must_change_password, token_min_iat
         FROM admin_users WHERE username = ?`
    ).bind(normalizeUsername(username)).first();
  } catch { return null; }
}

export async function loadById(env, id) {
  try {
    return await env.DB.prepare(
      `SELECT id, username, display_name, password_hash, role, status,
              must_change_password, token_min_iat, last_login_at, created_at
         FROM admin_users WHERE id = ?`
    ).bind(Number(id)).first();
  } catch { return null; }
}

/** 화면에 내보내도 되는 형태 — password_hash·token_min_iat 은 절대 넣지 않는다. */
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    mustChangePassword: !!row.must_change_password,
    roleId: row.role_id || null,
    roleName: row.role_name || null,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
  };
}

/** 마지막 남은 활성 owner 인가 — 스스로를 잠가버리는 사고를 막는다. */
export async function isLastActiveOwner(env, userId) {
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_users
        WHERE role = 'owner' AND status = 'active' AND id != ?`
    ).bind(Number(userId)).first();
    return Number(row && row.n) === 0;
  } catch { return true; } // 확인 실패 시엔 보수적으로 '마지막'으로 취급해 막는다
}
