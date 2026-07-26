/**
 * cham · 관리자 인증 공용 유틸 (Cloudflare Workers · Web Crypto)
 *
 * 세션 토큰 = <base64url(header)>.<base64url(payload)>.<base64url(HMAC-SHA256)>
 * JWT 를 닮았지만 외부 라이브러리에 넘길 목적이 아니다 —
 * `iat`/`exp` 를 초가 아니라 **밀리초**로 담는다(Date.now() 와 직접 비교하려고).
 *
 * 설계 기준은 gilwell-media/functions/_shared/auth.js 와 같다.
 */

const PBKDF2_ITERS = 210_000;      // OWASP 2023 권고(PBKDF2-SHA256) 기준
const PBKDF2_MAX_ITERS = 1_000_000; // 저장값이 조작돼도 CPU 를 태우지 못하게 상한을 둔다
const SESSION_MS = 12 * 60 * 60 * 1000; // 12시간

/* ── 인코딩 ───────────────────────────────────────────────── */
const enc = (s) => new TextEncoder().encode(s);

function bufToB64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64url(str) { return bufToB64url(enc(str)); }
function b64urlToBuf(s) {
  const norm = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(norm);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return new Uint8Array(0); }
}

/* ── 토큰 ─────────────────────────────────────────────────── */
async function hmacKey(secret, usages) {
  return crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

/**
 * 세션 토큰 발급.
 * @param {string} secret env.ADMIN_SECRET
 * @param {{uid:number, username:string, role:'owner'|'staff'}} user
 */
export async function createToken(secret, user) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Date.now();
  const payload = b64url(JSON.stringify({
    sub: 'admin',
    uid: Number(user.uid),
    username: String(user.username || '').toLowerCase(),
    role: user.role === 'owner' ? 'owner' : 'staff',
    iat: now,
    exp: now + SESSION_MS,
  }));
  const data = `${header}.${payload}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc(data));
  return `${data}.${bufToB64url(sig)}`;
}

/** 서명·만료를 확인하고 payload 를 돌려준다. 조금이라도 어긋나면 null. */
export async function readToken(token, secret) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const ok = await crypto.subtle.verify(
      'HMAC', await hmacKey(secret, ['verify']), b64urlToBuf(sig), enc(`${header}.${payload}`)
    );
    if (!ok) return null;
    const body = JSON.parse(new TextDecoder().decode(b64urlToBuf(payload)));
    if (!body || body.sub !== 'admin') return null;
    if (!Number.isFinite(body.exp) || Date.now() >= body.exp) return null;
    return body;
  } catch { return null; }
}

/**
 * 요청에서 세션을 읽어 계정 행까지 확인한다.
 * 토큰만 믿지 않는 이유 — 비밀번호 변경·계정 비활성이 **즉시** 반영돼야 한다.
 * @returns {Promise<null | {uid,username,role,user}>}
 */
export async function getSession(request, env) {
  if (!env || !env.ADMIN_SECRET) return null;
  const token = readCookie(request, 'admin_token');
  const payload = await readToken(token, env.ADMIN_SECRET);
  if (!payload) return null;

  let row = null;
  try {
    row = await env.DB.prepare(
      `SELECT id, username, display_name, role, status, must_change_password, token_min_iat
         FROM admin_users WHERE id = ?`
    ).bind(payload.uid).first();
  } catch { return null; }

  if (!row || row.status !== 'active') return null;
  // 비밀번호를 바꾼 시각보다 앞서 발급된 토큰은 버린다 → 기존 세션 일괄 종료
  if (Number(row.token_min_iat || 0) > Number(payload.iat || 0)) return null;

  return { uid: row.id, username: row.username, role: row.role, user: row };
}

/** owner 전용 경로용. 세션이 없거나 staff 면 null. */
export async function getOwnerSession(request, env) {
  const s = await getSession(request, env);
  return s && s.role === 'owner' ? s : null;
}

/* ── 쿠키 ─────────────────────────────────────────────────── */
export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return ''; }
  }
  return '';
}

/**
 * 세션 쿠키 3종.
 *   admin_token   HttpOnly — 실제 자격. JS 에서 못 읽는다.
 *   admin_session 화면이 '로그인 상태'를 알기 위한 표식일 뿐, 권한이 아니다.
 *   admin_role    사이드바 메뉴를 접기 위한 표시용. 서버는 이 값을 절대 신뢰하지 않는다.
 * Secure 는 localhost(http) 에서 쿠키가 버려지므로 개발 중에는 뺀다.
 */
export function buildSessionCookies(token, { secure = true, maxAge = SESSION_MS / 1000, role = 'staff' } = {}) {
  const sec = secure ? '; Secure' : '';
  const safeRole = role === 'owner' ? 'owner' : 'staff';
  return [
    `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly${sec}; SameSite=Lax; Max-Age=${maxAge}`,
    `admin_session=1; Path=/${sec}; SameSite=Lax; Max-Age=${maxAge}`,
    `admin_role=${safeRole}; Path=/${sec}; SameSite=Lax; Max-Age=${maxAge}`,
  ];
}

export function clearSessionCookies({ secure = true } = {}) {
  const sec = secure ? '; Secure' : '';
  return [
    `admin_token=; Path=/; HttpOnly${sec}; SameSite=Lax; Max-Age=0`,
    `admin_session=; Path=/${sec}; SameSite=Lax; Max-Age=0`,
    `admin_role=; Path=/${sec}; SameSite=Lax; Max-Age=0`,
  ];
}

/** 개발(localhost·http)에서는 Secure 쿠키가 저장되지 않는다 — 요청 스킴으로 판단. */
export function isSecureRequest(request) {
  try { return new URL(request.url).protocol === 'https:'; } catch { return true; }
}

/* ── 비밀번호 ─────────────────────────────────────────────── */
async function pbkdf2(password, salt, iters) {
  const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  return { algo: 'PBKDF2-SHA256', iters: PBKDF2_ITERS, salt: bufToB64url(salt), hash: bufToB64url(hash) };
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'object' || stored.algo !== 'PBKDF2-SHA256') return false;
  const salt = b64urlToBuf(String(stored.salt || ''));
  const expected = b64urlToBuf(String(stored.hash || ''));
  if (!salt.length || !expected.length) return false;
  const iters = Math.min(Number(stored.iters) || PBKDF2_ITERS, PBKDF2_MAX_ITERS);
  const got = await pbkdf2(password, salt, iters);
  if (got.length !== expected.length) return false;
  // 상수 시간 비교 — 앞자리가 언제 틀렸는지로 해시를 역추적하지 못하게
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= got[i] ^ expected[i];
  return diff === 0;
}

/**
 * 비밀번호 규칙. 조합 운영자가 외울 수 있으면서 무작위 대입에 견디는 선.
 * 길이를 주된 방어선으로 삼고 문자 종류는 2종 이상만 요구한다.
 */
export function checkPasswordStrength(pw) {
  const s = String(pw || '');
  if (s.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (s.length > 200) return '비밀번호가 너무 깁니다.';
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(s)).length;
  if (kinds < 2) return '영문·숫자·기호 중 두 가지 이상을 섞어 주세요.';
  if (/^(.)\1+$/.test(s)) return '같은 문자만 반복할 수 없습니다.';
  return null;
}

export { SESSION_MS };
