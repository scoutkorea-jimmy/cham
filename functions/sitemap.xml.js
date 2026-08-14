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
  ['sitemap', 'monthly', '0.3'],   // 사람이 보는 사이트맵 페이지(sitemap.html)
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));

/* `<lastmod>` 는 **YYYY-MM-DD** 여야 한다. D1 의 시각은 'YYYY-MM-DD HH:MM:SS' 라 앞 열 자만 쓴다.
   형식이 틀리면 검색엔진이 그 줄을 통째로 버린다 — 없는 것만 못하다. */
const day = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const urlRow = (loc, freq, pri, mod) =>
  `  <url><loc>${esc(loc)}</loc>` +
  (mod ? `<lastmod>${mod}</lastmod>` : '') +
  `<changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const rows = PAGES.map(([path, freq, pri]) => urlRow(`${origin}/${path}`, freq, pri));

  if (env && env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, updated_at FROM products WHERE status = '판매중' ORDER BY sort_order, id`
      ).all();
      (results || []).forEach((p) => {
        rows.push(urlRow(`${origin}/product?id=${p.id}`, 'weekly', '0.7', day(p.updated_at)));
      });
    } catch { /* 상품을 못 읽어도 나머지 주소는 내보낸다 */ }

    /* 소식마당 글. 예전에는 글에 **주소가 없어** 실을 것이 없었다 —
       모달로 펼치기만 했기 때문이다. 이제 /news?id= 로 열리고 서버가 본문을 실어 주므로
       색인될 수 있다. 이것이 없으면 강사분들이 쓰는 교육 소식이 전부 검색 밖에 남는다. */
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, updated_at, created_at FROM posts WHERE sample = 0 ORDER BY created_at DESC LIMIT 500`
      ).all();
      (results || []).forEach((p) => {
        rows.push(urlRow(`${origin}/news?id=${p.id}`, 'monthly', '0.6', day(p.updated_at || p.created_at)));
      });
    } catch { /* 글을 못 읽어도 나머지 주소는 내보낸다 */ }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
