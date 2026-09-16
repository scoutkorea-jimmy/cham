/**
 * GET /llms.txt — AI 검색·답변 엔진이 읽는 요약. **상품·가격은 D1 에서, 연락처는 운영 설정에서** 만든다.
 *
 * 정적 파일(public/llms.txt)로 두었더니 선물상자 45,000원(실제 50,000원) · 장류 '가격 문의'
 * (실제 판매가 있음) · 숨긴 와인이 그대로 남아 있었다. 가격표에서 두 번 겪은 병과 같다 —
 * 값이 두 군데 있으면 반드시 어긋난다. sitemap·robots 처럼 요청 때 만든다.
 *
 * 설정에 없는 값은 **적지 않는다.** 틀린 연락처는 없는 것만 못하다.
 * 주소는 요청 호스트에서 만들어 도메인이 바뀌어도 손댈 것이 없다.
 */
import { readDoc } from './_shared/store.js';
import { loadSellable, priceText } from './_shared/product-seo.js';
import { SITE_NAME } from './_shared/org-seo.js';

/* 페이지 안내 — 주소 뒤의 설명은 페이지 <title>·description 과 같은 뜻을 짧게. */
const PAGES = [
  ['', '홈 — 3대 사업(수제식초·전통 장류·발효 교육), 대표 인사말, 조합 현황, 제품·교육 미리보기'],
  ['about', '협동조합 소개 — 인사말, 소셜미션, 조직·강사진, 인증·사업자 정보, 파트너 정선만장대, 오시는 길'],
  ['ferments', '전통발효식품 — 발효의 원리, 발효 미생물, 기능성 메주 7가지 균주, 씨장 이야기, 발효식품 종류·효능'],
  ['vinegar', '식초 — 수제 발효식초 서연(瑞蓮): 만드는 과정 4단계, 종류, 마시는 방법, 품질·시험성적, 가격'],
  ['instructor', '체험지도사 과정 — 전통발효식품 체험지도사 1급 12주 과정, 프로그램 12가지, 모집 기수, 수료 후 진로'],
  ['nuruk', '누룩이야기 — 쌀누룩 만들기, 요거트, 저염 고추장·막장·간장 수업, 원데이 수업'],
  ['products', '제품 — 서연 수제식초, 명절 선물세트, 전통 장류, 발효식품, 가격표, 씨장 분양, 자주 묻는 질문'],
  ['news', '소식마당 — 공지사항, 교육 일정, 현장 갤러리'],
  ['contact', '문의하기 — 일반·교육·제품·제휴 문의'],
];

/* 제품 페이지의 분류 순서와 같다 — 선물세트가 맨 위(명절 판매 주력) */
const CAT_ORDER = ['선물세트', '식초', '장류', '발효식품'];

const line = (label, v) => (v ? `- ${label}: ${String(v).replace(/\s*\n\s*/g, ' / ')}` : null);

function productLines(rows) {
  const cats = [];
  for (const p of rows) {
    const key = p.cat || '기타';
    let g = cats.find((c) => c.name === key);
    if (!g) { g = { name: key, items: [] }; cats.push(g); }
    g.items.push(p);
  }
  const rank = (name) => { const i = CAT_ORDER.indexOf(name); return i < 0 ? CAT_ORDER.length : i; };
  cats.sort((a, b) => rank(a.name) - rank(b.name));
  const out = [];
  for (const g of cats) {
    out.push(`### ${g.name}`);
    for (const p of g.items) {
      out.push(`- ${p.name}: ${priceText(p)}${p.status === '품절' ? ' (품절)' : ''}${p.summary ? ' — ' + p.summary : ''}`);
    }
    out.push('');
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const st = (env && env.DB) ? ((await readDoc(env, 'settings').catch(() => null)) || {}) : {};
  let rows = [];
  if (env && env.DB) {
    try { rows = await loadSellable(env); } catch { rows = []; }   // 상품을 못 읽어도 나머지는 낸다
  }
  // 한국 시각 기준 날짜 — UTC 로 적으면 밤 아홉 시 뒤로는 어제 날짜가 된다
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const body = [
    `# ${SITE_NAME} (The Authentic Korean Traditional Fermented Foods Cooperative)`,
    '',
    '> 전통발효식품의 가치를 확산하고 건강한 생활을 유지하도록 돕기 위해 2021년 설립된 협동조합입니다.',
    '> 전통 발효식품 관련 체험학습 및 강사 육성 교육프로그램 12가지를 운영합니다.',
    "> 교육부 '교육기부 진로체험 인증기관'으로 청소년에게 건강·영양·식습관 교육을 제공하며,",
    "> 경력단절 여성과 은퇴 노인에게 전통발효식품 강사 일자리를 창출합니다. 목표는 고령화 사회의 '건강 100세'입니다.",
    "> 수제 발효식초 브랜드 '서연(瑞蓮)'을 운영하며(상표등록), 기술 파트너는 강원 정선의 3대 전통발효명가 '정선만장대'입니다.",
    '',
    `이 문서는 요청할 때 서버가 만듭니다(${today}). 상품·가격은 ${origin}/products 와 같은 자료에서 옵니다.`,
    '',
    '## 주요 페이지',
    ...PAGES.map(([path, desc]) => `- [${desc.split(' — ')[0]}](${origin}/${path}): ${desc.split(' — ').slice(1).join(' — ')}`),
    `- [회원가입](${origin}/signup): 선택 사항 — 가입하면 주문 내역을 한곳에서 보고 주문 시 배송지가 자동으로 채워진다. 가입 없이도 비회원 주문이 가능하다`,
    `- [이용약관](${origin}/terms) · [개인정보처리방침](${origin}/privacy)`,
    '',
    '## 제품 (판매 중인 것만 · 부가세 포함 소비자가)',
    '- 주문: 회원가입 없이 비회원 주문 가능 · 무통장입금 · 주문번호로 조회. 단체·기업 명절 선물은 별도 견적.',
    line('택배비', Number.isFinite(Number(st.shipFee)) && st.shipFee !== '' && st.shipFee != null
      ? `${Number(st.shipFee).toLocaleString('en-US')}원 (일정 금액 이상 무료 — 기준은 제품 페이지 가격표에 표시)` : null),
    '',
    ...productLines(rows),
    '### 씨장 분양',
    '- 전국민 씨장 갖기 운동 — 대를 이어온 발효 원종(原種)을 나눠 드립니다. 분양 수량과 조건은 상담 후 안내 (가격 문의)',
    '',
    '## 식초 (서연 瑞蓮) — 만드는 법 · 마시는 법',
    '- 제조법: 과일 청 3개월 숙성 → 16브릭스 조정 → 효모 발효(25~30℃, 2~3주) = 와인 → 6브릭스 조정 + 초산균 → 33℃ 3주 = 식초',
    '- 마시는 법: 식초 50㎖에 물 6배 희석. 위장이 약하면 공복을 피해 식후에. 마신 뒤 물을 충분히. 꾸준한 섭취가 효과적',
    line('품질', st.productTest),
    line('상표', st.trademark),
    '',
    '## 교육 (전통발효식품 체험지도사 1급 과정)',
    '- 기간: 12주(3개월), 주 1회 / 수강료 무료 (실습비 별도)',
    '- 커리큘럼: 발효식품 개론 · 장류 역사 · 된장 · 막장 · 청국장 · 고추장 · 발효청/효소 · 와인/식초 · 전통주 · 한식 간장',
    '- 정선 만장대 현장 실습 1박 2일 (메주 만들기 + 1급 자격증 시험)',
    '- 수료 후: 보수교육을 거쳐 강사 활동 지원, 홈샵 운영 지원',
    '- 강의처: 유치원·초·중·고교, 방과후·자유학년제, 주민자치위원회, 동주민센터, 구청·시청, 다문화가족지원센터, 백화점 문화센터 등',
    line('인증', st.eduCert),
    '',
    '## 연락처 · 사업자 정보',
    line('전화', [st.phone, st.phone2].filter(Boolean).join(' / ') + (st.hours ? ` · ${st.hours}` : '')),
    line('이메일', st.email),
    line('주소', st.address),
    line('대표', st.ceo),
    line('설립', st.founded),
    line('법인', st.corpName),
    line('사업자등록번호', st.bizNo),
    line('통신판매업신고', st.mailOrderNo),
    line('업태·종목', st.bizType),
    '',
    `## 기계가 읽는 자료`,
    `- 사이트맵: ${origin}/sitemap.xml · RSS: ${origin}/rss.xml · 수집 정책: ${origin}/robots.txt`,
    '',
  ].filter((l) => l !== null).join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
