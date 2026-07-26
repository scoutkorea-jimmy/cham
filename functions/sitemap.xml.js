/**
 * GET /sitemap.xml — 주소를 요청 호스트에서 만든다.
 *
 * 정적 sitemap.xml 은 옛 GitHub Pages 주소가 박혀 있어 도메인이 바뀔 때마다 손봐야 했다.
 * 여기서 만들면 pages.dev 든 정식 도메인이든 **연결하는 즉시 맞는 주소**가 된다.
 * 상품 상세는 실제 판매 중인 것만 넣는다(숨김·품절은 색인해도 손님에게 도움이 안 된다).
 */
const PAGES = [
  ['', 'weekly', '1.0'],
  ['about.html', 'monthly', '0.8'],
  ['ferments.html', 'monthly', '0.7'],
  ['vinegar.html', 'monthly', '0.9'],
  ['instructor.html', 'monthly', '0.9'],
  ['nuruk.html', 'monthly', '0.8'],
  ['products.html', 'weekly', '0.9'],
  ['news.html', 'weekly', '0.7'],
  ['contact.html', 'monthly', '0.6'],
  ['terms.html', 'yearly', '0.3'],
  ['privacy.html', 'yearly', '0.3'],
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
        rows.push(`  <url><loc>${esc(origin)}/product.html?id=${esc(p.id)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
      });
    } catch { /* 상품을 못 읽어도 나머지 주소는 내보낸다 */ }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
