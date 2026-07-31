/**
 * GET /sitemap.xml — 주소를 요청 호스트에서 만든다.
 *
 * 정적 sitemap.xml 은 옛 GitHub Pages 주소가 박혀 있어 도메인이 바뀔 때마다 손봐야 했다.
 * 여기서 만들면 pages.dev 든 정식 도메인이든 **연결하는 즉시 맞는 주소**가 된다.
 * 상품 상세는 실제 판매 중인 것만 넣는다(숨김·품절은 색인해도 손님에게 도움이 안 된다).
 */
/* 확장자 없는 주소로 적는다.
   Pages 는 `/products.html` 을 `/products` 로 308 로 넘기고, 페이지가 스스로 밝히는
   canonical 도 `/products` 다. sitemap 만 `.html` 을 실으면 색인해 달라고 낸 주소가
   전부 '리다이렉트 + 정본은 딴 곳' 이 되어, 검색엔진에 같은 문서가 둘로 보인다. */
const PAGES = [
  ['', 'weekly', '1.0'],
  ['about', 'monthly', '0.8'],
  ['ferments', 'monthly', '0.7'],
  ['vinegar', 'monthly', '0.9'],
  ['instructor', 'monthly', '0.9'],
  ['nuruk', 'monthly', '0.8'],
  ['products', 'weekly', '0.9'],
  ['news', 'weekly', '0.7'],
  ['contact', 'monthly', '0.6'],
  ['terms', 'yearly', '0.3'],
  ['privacy', 'yearly', '0.3'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const rows = PAGES.map(([path, freq, pri]) =>
    `  <url><loc>${esc(origin)}/${path}</loc><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`);

  if (env && env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT id FROM products WHERE status = '판매중' ORDER BY sort_order, id`
      ).all();
      (results || []).forEach((p) => {
        rows.push(`  <url><loc>${esc(origin)}/product?id=${esc(p.id)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
      });
    } catch { /* 상품을 못 읽어도 나머지 주소는 내보낸다 */ }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
