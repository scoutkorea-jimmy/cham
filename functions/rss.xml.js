/**
 * GET /rss.xml — 소식마당 글 피드.
 *
 * **왜 사이트맵으로 부족한가.** 네이버 서치어드바이저는 사이트맵과 **RSS 를 따로** 받는다.
 * 사이트맵은 "이런 주소가 있다"는 목록이고, RSS 는 "이 글이 새로 올라왔다"는 알림이라
 * 새 글의 수집이 눈에 띄게 빠르다. 교육 일정처럼 **때를 놓치면 소용없는 글**이 있으니
 * 이 차이가 실제로 손님 수를 가른다.
 *
 * 주소는 요청 호스트에서 만든다 — 도메인이 바뀌어도 손댈 것이 없다(sitemap 과 같은 규칙).
 * 운영자가 할 일은 서치어드바이저에 `https://charmjt.org/rss.xml` 을 한 번 내는 것뿐이다.
 */
import { plainText } from './_shared/html-text.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));

/* RSS 의 날짜는 RFC 822 여야 한다. D1 의 시각은 'YYYY-MM-DD HH:MM:SS'(UTC) 라 그대로 못 쓴다.
   형식이 틀리면 수집기가 그 항목을 버리므로, 못 읽는 값이면 날짜를 아예 넣지 않는다. */
function rfc822(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.replace(' ', 'T') + (/[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
}

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const title = '한국참전통발효식품협동조합 소식';
  const desc = '전통발효식품 교육·체험지도사 과정과 수제식초 서연(瑞蓮)의 새 소식.';

  let items = [];
  if (env && env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, cat, title, html, badge, created_at, author_name FROM posts
          WHERE sample = 0 ORDER BY created_at DESC LIMIT 50`
      ).all();
      items = results || [];
    } catch { /* 글을 못 읽어도 빈 피드는 내보낸다 — 주소가 죽으면 등록이 풀린다 */ }
  }

  const rows = items.map((p) => {
    const link = `${origin}/news?id=${encodeURIComponent(p.id)}`;
    const when = rfc822(p.created_at);
    return '  <item>\n' +
      `    <title>${esc(p.title)}</title>\n` +
      `    <link>${esc(link)}</link>\n` +
      `    <guid isPermaLink="true">${esc(link)}</guid>\n` +
      (when ? `    <pubDate>${when}</pubDate>\n` : '') +
      (p.cat ? `    <category>${esc(p.cat)}</category>\n` : '') +
      (p.author_name ? `    <author>${esc(p.author_name)}</author>\n` : '') +
      `    <description>${esc(plainText(p.html, 300))}</description>\n` +
      '  </item>';
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>\n' +
    `  <title>${esc(title)}</title>\n` +
    `  <link>${origin}/news</link>\n` +
    `  <description>${esc(desc)}</description>\n` +
    '  <language>ko</language>\n' +
    `  <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>\n` +
    (rows ? rows + '\n' : '') +
    '</channel>\n</rss>\n';

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
  });
}
