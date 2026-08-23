/**
 * 조합 자체의 구조화 데이터 — **모든 공개 페이지**가 같은 것을 싣는다.
 *
 * **왜 서버가 만드는가.** 예전에는 `index.html` 안에 전화번호·주소·사업자번호가
 * 손으로 적혀 있었다. 그런데 그 값들의 원본은 **관리자 > 설정**이다(`SETTINGS_DEFAULTS`
 * 를 덮어쓴다). 운영자가 전화번호를 바꾸면 화면 푸터는 바뀌고 구조화 데이터만 옛 번호로
 * 남는다 — 검색결과에 없는 번호가 뜨는 것이 가장 나쁜 결과다. 값이 두 군데 있으면
 * 반드시 어긋난다.
 *
 * 홈에만 싣던 것을 전 페이지로 넓힌 이유는, 검색엔진이 **어느 페이지로 들어오든**
 * 이 사이트가 누구의 것인지 알아야 하기 때문이다. `@id` 로 한 실체를 가리키므로
 * 여러 페이지에 실려도 중복으로 세지 않는다.
 */

/**
 * 사이트가 스스로를 부르는 이름.
 *
 * **운영 설정의 `corpName` 을 쓰면 안 된다.** 그 칸에 들어 있는 값은
 * `한국참전통발효식품 협동조합 (법인사업자)` 처럼 **등기·사업자등록 표기**라,
 * 검색결과 제목에 '(법인사업자)'가 그대로 붙는다. 실제로 한 번 그렇게 나갔다.
 * 표시 이름은 전 페이지의 `og:site_name` 과 같아야 한다 — 그것이 이 값이다.
 * 법인 표기는 버리지 않고 `legalName` 에 담는다(schema.org 가 따로 받는 칸이다).
 */
export const SITE_NAME = '한국참전통발효식품협동조합';

/**
 * schema.org 의 날짜는 ISO 8601 이어야 한다. 운영 설정에는 사람이 읽는 말
 * (`2021년 11월 `)이 들어 있어 그대로 실으면 구글이 그 항목을 버린다.
 * 읽어낼 수 없으면 **null 을 주고 아예 싣지 않는다** — 틀린 날짜는 없는 것만 못하다.
 */
export function isoDate(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) m = s.match(/^(\d{4})\s*년\s*(?:(\d{1,2})\s*월)?\s*(?:(\d{1,2})\s*일)?/);
  if (!m) return null;
  const pad = (x) => String(x).padStart(2, '0');
  if (!m[2]) return m[1];
  return m[3] ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : `${m[1]}-${pad(m[2])}`;
}

/** '평일 09:00 – 18:00 (주말·공휴일 휴무)' 에서 여는 시각과 닫는 시각만 뽑는다. */
function hoursOf(text) {
  const m = String(text || '').match(/(\d{1,2}:\d{2})\s*[–\-~]\s*(\d{1,2}:\d{2})/);
  return m ? { opens: m[1], closes: m[2] } : null;
}

/**
 * @param {string} origin  지금 요청의 절대 주소 기준
 * @param {object} st      관리자 설정(`readDoc(env,'settings')`)
 */
export function orgJsonLd(origin, st) {
  const s = st || {};
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#org`,
    name: SITE_NAME,
    alternateName: 'The Authentic Korean Traditional Fermented Foods Cooperative',
    url: `${origin}/`,
    logo: `${origin}/assets/logo.png`,
    image: `${origin}/assets/logo.png`,
    description: '전통 발효식품 관련 체험학습 및 강사 육성 교육프로그램 12가지를 운영하는 협동조합. '
      + '교육기부 진로체험기관 인증, 전통발효식품 체험지도사 양성, 수제식초 브랜드 서연(瑞蓮) 운영.',
    knowsLanguage: 'ko',
    areaServed: { '@type': 'Country', name: '대한민국' },
  };
  if (s.corpName && s.corpName !== SITE_NAME) org.legalName = s.corpName;
  const founded = isoDate(s.founded);
  if (founded) org.foundingDate = founded;
  if (s.ceo) org.founder = { '@type': 'Person', name: s.ceo };
  if (s.bizNo) org.taxID = s.bizNo;
  if (s.email) org.email = s.email;

  /* 전화번호는 국제 표기로 바꾼다 — 검색엔진은 '02-855-8806' 이 어느 나라 번호인지 모른다.
     **끊어 읽는 자리(하이픈)는 그대로 둔다.** 숫자만 남기면 '+82-28558806' 이 되어
     지역번호와 국번의 경계가 사라진다. 국내 표기의 맨 앞 0 만 국가번호로 바꾼다. */
  const raw = String(s.phone || '').trim();
  const tel = /^0\d/.test(raw) ? '+82-' + raw.slice(1) : (/^\+/.test(raw) ? raw : '');
  if (tel) org.telephone = tel;

  if (s.address) {
    org.address = {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      streetAddress: s.address,
    };
  }

  const h = hoursOf(s.hours);
  if (tel) {
    const cp = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: org.telephone,
      areaServed: 'KR',
      availableLanguage: 'Korean',
    };
    /* 영업시간은 문의 창구의 시간이다 — 방문 매장의 시간이 아니라서 ContactPoint 에 단다. */
    if (h) {
      cp.hoursAvailable = {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: h.opens, closes: h.closes,
      };
    }
    org.contactPoint = [cp];
  }
  return org;
}

/** 사이트 자체. 검색결과에 사이트 이름이 주소 대신 뜨게 하는 값이다. */
export function siteJsonLd(origin, st) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: SITE_NAME,
    url: `${origin}/`,
    inLanguage: 'ko',
    publisher: { '@id': `${origin}/#org` },
  };
}
