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
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    'Disallow: /admin',
    'Disallow: /login.html',
    'Disallow: /login',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
