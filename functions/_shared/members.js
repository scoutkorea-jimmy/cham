/** cham · 일반 계정(회원) 검증·정규화. 개인정보를 다루므로 내보내는 모양을 한 곳에서 정한다. */

export const digitsOnly = (v) => String(v == null ? '' : v).replace(/\D/g, '');

/** 휴대전화 — 저장은 숫자만, 표시는 하이픈. 저장 형태가 제각각이면 중복·검색이 어긋난다. */
export function normPhone(v) {
  const d = digitsOnly(v);
  return d.length >= 9 && d.length <= 11 ? d : null;
}
export function fmtPhone(d) {
  const s = digitsOnly(d);
  if (s.length === 11) return s.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (s.length === 10) return s.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return s;
}
export function checkEmail(v) {
  const s = String(v || '').trim();
  if (!s) return null;                       // 선택 항목
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : '이메일 형식이 올바르지 않습니다.';
}
/** 아이디 — 영문 소문자·숫자·_·-·. 4~32자, 또는 이메일 주소 */
export function checkMemberId(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '아이디를 입력해 주세요.';
  if (s.includes('@')) return checkEmail(s) ? '이메일 형식이 올바르지 않습니다.' : null;
  return /^[a-z0-9._-]{4,32}$/.test(s) ? null : '아이디는 영문 소문자·숫자·_·-·. 조합 4~32자여야 합니다.';
}

/**
 * 화면에 내보낼 모양. password_hash·token_min_iat 은 **절대** 넣지 않는다.
 * full=false 면 목록용으로 주소를 뺀다 — 목록에 주소까지 뿌릴 이유가 없다.
 */
export function publicMember(r, full) {
  if (!r) return null;
  const o = {
    id: r.id, username: r.username, name: r.name,
    phone: fmtPhone(r.phone), email: r.email || null,
    status: r.status, mustChangePassword: !!r.must_change_password,
    marketingOptin: !!r.marketing_optin,
    lastLoginAt: r.last_login_at || null, createdAt: r.created_at || null,
  };
  if (full) {
    o.postcode = r.postcode || null;
    o.address = r.address || null;
    o.addressDetail = r.address_detail || null;
    o.memo = r.memo || null;
  }
  return o;
}
