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
  const name = s.corpName || '한국참전통발효식품협동조합';
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#org`,
    name,
    alternateName: 'The Authentic Korean Traditional Fermented Foods Cooperative',
    url: `${origin}/`,
    logo: `${origin}/assets/logo.png`,
    image: `${origin}/assets/logo.png`,
    description: '전통 발효식품 관련 체험학습 및 강사 육성 교육프로그램 12가지를 운영하는 협동조합. '
      + '교육기부 진로체험기관 인증, 전통발효식품 체험지도사 양성, 수제식초 브랜드 서연(瑞蓮) 운영.',
    knowsLanguage: 'ko',
    areaServed: { '@type': 'Country', name: '대한민국' },
  };
  if (s.founded) org.foundingDate = String(s.founded).slice(0, 10);
  if (s.ceo) org.founder = { '@type': 'Person', name: s.ceo };
  if (s.bizNo) org.taxID = s.bizNo;
  if (s.email) org.email = s.email;

  /* 전화번호는 국제 표기로 바꾼다 — 검색엔진은 '02-855-8806' 이 어느 나라 번호인지 모른다. */
  const tel = String(s.phone || '').replace(/[^\d]/g, '');
  if (tel) org.telephone = '+82-' + tel.replace(/^0/, '');

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
    name: (st && st.corpName) || '한국참전통발효식품협동조합',
    url: `${origin}/`,
    inLanguage: 'ko',
    publisher: { '@id': `${origin}/#org` },
  };
}
