/**
 * cham · 권한 정의와 판정
 *
 * 권한 목록을 여기 한 곳에만 둔다. 화면(사이드바 노출)과 서버(엔드포인트 차단)가
 * 같은 키를 봐야, 화면에서 감췄는데 API 는 열려 있는 어긋남이 생기지 않는다.
 */

export const PERMS = [
  { key: 'sales.view',       group: '판매',   label: '판매 보기',        desc: '상품·주문·매출을 봅니다' },
  { key: 'sales.manage',     group: '판매',   label: '판매 처리',        desc: '상품 등록·수정, 주문 상태 처리' },
  { key: 'customers.view',   group: '고객',   label: '신청·문의 보기',   desc: '지도사 신청과 문의를 봅니다' },
  { key: 'customers.manage', group: '고객',   label: '신청·문의 처리',   desc: '상태 변경·메모, 교육과정(기수) 관리' },
  { key: 'members.view',     group: '회원',   label: '일반 계정 보기',   desc: '회원의 이름·연락처 등 개인정보를 봅니다' },
  { key: 'members.manage',   group: '회원',   label: '일반 계정 관리',   desc: '회원 등록·수정·사용 중지' },
  { key: 'content.manage',   group: '콘텐츠', label: '콘텐츠 관리',      desc: '게시글·페이지 사진·팝업·파트너' },
  { key: 'settings.manage',  group: '운영',   label: '운영 정보 관리',   desc: '계좌·연락처·사업자정보·약도' },
  { key: 'accounts.manage',  group: '운영',   label: '계정·권한 관리',   desc: '관리자 계정과 권한 그룹' },
  { key: 'system.manage',    group: '시스템', label: '시스템 관리',      desc: '동의문·KMS·데이터 백업' },
];

export const PERM_KEYS = PERMS.map((p) => p.key);
export const ALL_PERMS = PERM_KEYS.slice();

/** 저장된 문자열/배열을 항상 '아는 키만 담긴 배열'로 만든다. */
export function parsePerms(raw) {
  let arr = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr.filter((k) => PERM_KEYS.indexOf(k) > -1);
}

/**
 * 세션이 권한을 갖고 있는가.
 * 예전 owner 계정은 권한 그룹이 없어도 전부 허용한다 — 이관 전에 잠기면 안 된다.
 */
export function can(session, perm) {
  if (!session) return false;
  if (session.role === 'owner' && !session.perms) return true;
  const perms = session.perms || [];
  if (perms.indexOf(perm) > -1) return true;
  // '처리' 권한이 있으면 같은 묶음의 '보기'는 자동으로 포함한다
  if (perm.endsWith('.view')) {
    const manage = perm.replace(/\.view$/, '.manage');
    if (perms.indexOf(manage) > -1) return true;
  }
  return false;
}

/** 여러 권한 중 하나라도 있으면 통과 */
export function canAny(session, list) {
  return list.some((p) => can(session, p));
}
