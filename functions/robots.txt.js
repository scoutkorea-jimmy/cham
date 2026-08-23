/**
 * GET /robots.txt — Cloudflare 에서만 검색을 허용한다.
 *
 * 저장소의 정적 robots.txt 는 **옛 GitHub Pages 를 막는 용도**로 전부 Disallow 다.
 * 두 호스팅이 같은 파일을 공유하기 때문에, 같은 사이트가 두 주소로 색인되어
 * 검색 순위가 나뉘는 것을 막으려면 한쪽만 열어야 한다.
 * Functions 는 정적 파일보다 먼저 응답하므로, 여기서 진짜 robots.txt 를 준다.
 *
 * 주소는 요청 호스트에서 만든다 — 도메인을 연결하면 그날부터 자동으로 맞는다.
 */
export function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const body = [
    '# 한국참전통발효식품협동조합 — 수집 정책',
    '#',
    '# 공개 페이지(소개·제품·교육·소식)는 검색엔진과 AI 에이전트가 자유롭게 읽어도 됩니다.',
    '# 요약본은 /llms.txt 에 따로 두었습니다.',
    '#',
    '# 관리자 화면과 그 안의 자료(운영 설명서 · 주문 · 회원 정보)는 사람이든 기계든',
    '# 예외 없이 금지합니다. 검색엔진·AI 크롤러·아카이브 수집기를 구분하지 않습니다.',
    '#',
    '# 이 금지는 robots.txt 에만 기대지 않습니다. robots.txt 는 부탁일 뿐이고,',
    '# 지키지 않는 수집기가 실제로 있습니다. 실제 차단은 세 겹입니다 —',
    '#   1. 서버가 세션 없는 요청을 로그인 화면으로 돌려보낸다 (functions/_middleware.js)',
    '#   2. 모든 응답에 X-Robots-Tag: noindex 헤더를 실어 보낸다 (302 응답에도)',
    '#   3. 관리자 API 는 세션 없이 401 로 답한다',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin.html',
    'Disallow: /login',
    'Disallow: /login.html',
    'Disallow: /assets/manual',
    'Disallow: /assets/manual.html',
    'Disallow: /api/',
    '',
    '# 마이페이지는 일부러 막지 않습니다. 로그인해야 내용이 나오고 페이지 자체가',
    '# noindex 를 달고 있는데, robots 로 크롤링까지 막으면 그 noindex 를 읽지 못해',
    '# 오히려 주소만 검색결과에 남습니다. 응답 헤더로도 같은 표시를 보냅니다.',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
    '# 소식 글은 RSS 로도 나갑니다 — 네이버 서치어드바이저에 따로 낼 수 있습니다.',
    `# Feed: ${origin}/rss.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
