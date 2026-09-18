/**
 * 홈의 제품 칸 — **무엇을 어느 차례로 세울지 서버가 정한다.**
 *
 * 예전 홈은 카드 넉 장을 HTML 에 손으로 적어 두었다. 그래서 둘이 어긋났다:
 * 관리자가 상품 사진을 바꿔도 홈만 저장소에 든 옛 사진을 계속 내보냈고,
 * 무엇을 앞에 둘지도 사람이 정한 채 굳어 있었다. 가격은 이미 같은 이유로
 * 데이터에서 채우도록 옮긴 뒤였다(`data-price-of` → 지금은 카드째 데이터에서 만든다).
 *
 * 이제 **주문이 많은 순**으로 고른다. 그 규칙은 이 파일 하나에만 있다 —
 * 화면(`shop.js`)은 여기서 실어 보낸 차례를 그대로 따라 그린다.
 *
 * 크롤러는 스크립트를 돌리지 않으므로, 사람이 보는 카드와 **같은 상품**을 글로도
 * 싣는다. 제품 목록이 같은 방식이다(`product-seo.js` 의 `pl-ssr`).
 */

import { attr } from './html-text.js';
import { SITE_NAME } from './org-seo.js';
import { loadSellable, priceText } from './product-seo.js';

/** 홈에 세우는 칸 수 — 그리드 한 줄(g-4). */
const PICK = 4;

/**
 * 상품별 주문 수량 합. 취소·반품완료된 주문은 세지 않는다 —
 * 되돌아온 주문을 세면 팔리지 않은 물건이 '많이 찾는 것'으로 앞에 선다.
 * @returns {Promise<Map<string, number>>} 상품 id → 수량 합
 */
async function orderedQty(env) {
  const { results } = await env.DB.prepare(
    `SELECT oi.product_id AS id, SUM(oi.qty) AS qty
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('취소', '반품완료')
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id`
  ).all();
  const m = new Map();
  for (const r of results || []) m.set(r.id, Number(r.qty) || 0);
  return m;
}

/**
 * 대표 사진이 올라가 있는 상품 id. 코드에 적힌 정적 사진(`doc.photo`)은 상품 쪽에서 본다.
 * @returns {Promise<Set<string>>}
 */
async function withMainImage(env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT ref FROM images WHERE scope = 'product' AND role = 'main'`
  ).all();
  return new Set((results || []).map((r) => r.ref).filter(Boolean));
}

/**
 * 홈에 세울 상품 — 주문 많은 순, 같으면 관리자가 정한 차례(`sort_order`).
 *
 * 품절은 뺀다. 자리가 넷뿐이라 지금 살 수 없는 물건에 한 칸을 주면 그만큼 덜 팔린다
 * (제품 목록은 품절도 '품절' 표시와 함께 그대로 보여 준다 — 거기는 전부를 보이는 자리다).
 * 숨김은 `loadSellable` 이 이미 걸러 온다.
 *
 * **사진 없는 상품도 뺀다.** 첫 화면에 자리표시 카드가 서면 사이트 전체가 미완성으로 보인다
 * — 제품 목록의 선물세트 칸을 같은 이유로 그렇게 했다(2026-09-18 · S10).
 * 다만 사진 있는 상품이 하나도 없으면 홈의 제품 칸이 통째로 비어 버리므로, 그때는 거르지 않는다.
 */
export async function homePicks(env) {
  const [rows, qty, shot] = await Promise.all([loadSellable(env), orderedQty(env), withMainImage(env)]);
  const sellable = rows.filter((p) => p.status !== '품절');
  const shown = sellable.filter((p) => p.photo || shot.has(p.id));
  return (shown.length ? shown : sellable)
    .map((p, i) => ({ p, ord: i, q: qty.get(p.id) || 0 }))
    .sort((a, b) => (b.q - a.q) || (a.ord - b.ord))
    .slice(0, PICK)
    .map((x) => x.p);
}

/* 차례를 `data-pid` 로 함께 싣는다 — 화면은 이것을 읽어 같은 순서로 카드를 그린다.
   순서를 정하는 규칙을 화면에도 적어 두면 언젠가 한쪽만 고쳐져 둘이 어긋난다. */
function homeBodyHTML(rows) {
  return '<div class="wrap legal"><article class="card card-pad"><h2>제품</h2><ul>' +
    rows.map((p) => `<li data-pid="${attr(p.id)}">` +
      `<a href="/product?id=${encodeURIComponent(p.id)}">${attr(p.name)}</a> — ${attr(priceText(p))}` +
      (p.summary ? ` · ${attr(p.summary)}` : '') + '</li>').join('') +
    '</ul></article></div>';
}

/** ItemList — 검색결과가 홈의 제품 칸을 '상품 모음'으로 알아본다. */
function homeJsonLd(rows, origin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${SITE_NAME} 제품`,
    numberOfItems: rows.length,
    itemListElement: rows.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${origin}/product?id=${encodeURIComponent(p.id)}`,
    })),
  };
}

/**
 * 홈이면 제품 칸을 실어 보낸다. 제목·설명은 페이지가 적어 둔 것을 그대로 둔다 —
 * 홈의 제목은 무엇이 많이 팔리느냐에 따라 달라질 값이 아니다.
 * @returns {null|{slot,bodyHTML,jsonLd}}
 */
export async function loadHomeDetail(env, url) {
  if (!env || !env.DB) return null;
  if (!/^\/(?:index(?:\.html)?)?$/.test(url.pathname)) return null;
  try {
    const rows = await homePicks(env);
    if (!rows.length) return null;
    return { slot: 'home-ssr', bodyHTML: homeBodyHTML(rows), jsonLd: [homeJsonLd(rows, url.origin)] };
  } catch {
    return null;                                // 못 읽어도 홈은 그대로 나가야 한다
  }
}
