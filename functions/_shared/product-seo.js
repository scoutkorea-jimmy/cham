/**
 * 상품 상세 하나를 **서버가 HTML 에 실어 보낸다.**
 *
 * **왜 필요한가.** `/product?id=` 는 `shop.js` 가 그리는 화면이라, 크롤러가 받는 HTML 은
 * 본문이 스물한 자뿐이고 제목은 상품 열넷이 전부 "제품 상세"로 같았다.
 * `sitemap.xml` 은 그 열네 주소를 색인해 달라고 내고 있었으니, 검색엔진 눈에는
 * **같은 빈 문서를 열네 번 낸 것**이 된다 — 중복으로 묶여 통째로 색인에서 빠진다.
 * 명절 선물세트가 검색에 잡히지 않던 이유다.
 *
 * `shop.js` 도 제목·설명·Product 구조화 데이터를 넣기는 한다. 그러나 그것은
 * **자바스크립트가 돈 뒤의 일**이고, 검색·미리보기 수집기는 스크립트를 돌리지 않는다.
 *
 * 소식마당이 2026-08-22 에 같은 문제를 서버 렌더로 풀었다 → `post-seo.js`.
 * 이 파일은 그 짝이며, 둘 다 `seo.js` 가 아는 **하나의 모양**(detail)으로 돌려준다.
 */

import { productRowToObj } from './store.js';
import { plainText, attr, wonText } from './html-text.js';
import { SITE_NAME } from './org-seo.js';

/** 확정 판매가. `shop.js` 의 규칙과 같아야 한다 — 화면과 구조화 데이터가 어긋나면 안 된다. */
function realPrice(p) {
  return p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);
}

/**
 * `/product?id=` 요청이면 그 상품을 읽어 온다. 아니면 null.
 * **숨김 상품은 null 을 준다** — 화면이 '찾을 수 없습니다'를 보여 주는 것과 같아야 한다.
 */
async function loadProduct(env, id) {
  const r = await env.DB.prepare(
    `SELECT id, name, cat, price, sale_price, unit, status, stock, summary,
            price_on_request, doc
       FROM products WHERE id = ?`
  ).bind(id).first();
  if (!r || r.status === '숨김') return null;
  return productRowToObj(r);
}

/** 대표 사진 한 장의 주소. 없으면 null 을 주고 부르는 쪽이 로고로 떨어진다. */
async function mainImageId(env, id) {
  try {
    const r = await env.DB.prepare(
      `SELECT id FROM images WHERE scope = 'product' AND ref = ? AND role = 'main' ORDER BY ord LIMIT 1`
    ).bind(id).first();
    return r ? r.id : null;
  } catch {
    return null;              // 사진을 못 읽어도 상품 페이지는 그대로 나가야 한다
  }
}

/** 상품정보고시 — 크롤러에게도 손님에게도 이 표가 가장 구체적인 정보다. */
function gosiHTML(gosi) {
  if (!gosi || typeof gosi !== 'object') return '';
  const LABEL = {
    pname: '품목', maker: '제조원', country: '제조국', origin: '원산지',
    volume: '용량·중량', ingredients: '원재료', expiry: '소비기한',
    storage: '보관방법', phone: '문의처', warranty: '품질보증',
  };
  const rows = Object.keys(LABEL)
    .filter((k) => gosi[k])
    .map((k) => `<tr><th>${LABEL[k]}</th><td>${attr(gosi[k])}</td></tr>`)
    .join('');
  return rows ? `<h2>상품정보고시</h2><table class="table"><tbody>${rows}</tbody></table>` : '';
}

/**
 * `#pd-ssr` 안에 넣을 본문.
 *
 * **`descHtml` 은 관리자가 에디터로 쓴 값이라 여기서 다시 이스케이프하지 않는다** —
 * 하면 태그가 글자로 보인다. 상품을 고칠 수 있는 사람은 관리자뿐이고, 그 입력은
 * 저장할 때 걸러진다. 평문으로 넣을 값(이름·요약·고시)만 이스케이프한다.
 */
function bodyHTML(p) {
  const ask = !!p.priceOnRequest;
  const price = ask ? '가격 문의' : `${wonText(realPrice(p))}원${p.unit ? ' / ' + attr(p.unit) : ''}`;
  return '<div class="wrap legal">' +
    '<article class="card card-pad">' +
      '<div class="crumb"><a href="/products">제품</a></div>' +
      `<h1>${attr(p.name)}</h1>` +
      `<p class="muted">${attr(p.cat || '')} · ${price}` +
        (p.status === '품절' ? ' · 품절' : '') + '</p>' +
      (p.summary ? `<p>${attr(p.summary)}</p>` : '') +
      (p.descHtml ? `<div class="rich">${p.descHtml}</div>` : '') +
      gosiHTML(p.gosi) +
      '<p><a class="btn btn-ghost" href="/products">제품 목록으로</a></p>' +
    '</article>' +
  '</div>';
}

/**
 * Product 구조화 데이터. 구글 검색결과에 가격·재고가 함께 뜬다.
 *
 * **가격 문의 상품에는 `offers` 를 넣지 않는다.** 화면에는 '가격 문의'라고 써 두고
 * 구조화 데이터에만 숫자를 실으면 표시가 어긋난 것이고, 구글은 그것을 리치결과
 * 위반으로 본다 — 상품 표시가 통째로 내려간다.
 */
function jsonLd(p, canonical, image, shipFee) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.id,
    url: canonical,
    image: [image],
    description: plainText(p.descHtml, 300) || p.summary || p.name,
    brand: { '@type': 'Brand', name: /식초|와인/.test(p.cat || '') ? '서연(瑞蓮)' : SITE_NAME },
  };
  if (p.cat) ld.category = p.cat;

  if (!p.priceOnRequest) {
    const inStock = p.status === '판매중' && Number(p.stock) > 0;
    const offer = {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'KRW',
      price: String(realPrice(p)),
      itemCondition: 'https://schema.org/NewCondition',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: SITE_NAME },
    };
    /* 배송비는 운영 설정에서 온다. 이것이 있으면 구글이 '무료 리스팅'에 실을 때
       배송비를 따로 묻지 않는다 — 없으면 상품이 후순위로 밀린다. */
    if (Number(shipFee) >= 0) {
      offer.shippingDetails = {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: String(Number(shipFee)), currency: 'KRW' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' },
      };
    }
    ld.offers = offer;
  }
  return ld;
}

/**
 * `seo.js` 가 아는 모양으로 돌려준다.
 * @returns {null|{slot,title,desc,image,bodyHTML,jsonLd}}
 */
export async function loadProductDetail(env, url, canonical, opt) {
  if (!env || !env.DB) return null;
  if (!/^\/product(?:\.html)?$/.test(url.pathname)) return null;
  const id = url.searchParams.get('id');
  if (!id) return null;

  try {
    const p = await loadProduct(env, id);
    if (!p) return null;                        // 없는 id 라도 화면은 그대로 나가야 한다

    const imgId = await mainImageId(env, p.id);
    const image = imgId ? `${url.origin}/api/images/${imgId}` : null;

    const site = SITE_NAME;
    /* 제목에 분류를 함께 넣는다 — '오미자 식초'만으로는 검색어와 겹치는 폭이 좁다.
       '선물세트'·'전통 장류' 같은 말이 제목에 있어야 명절 검색에 닿는다. */
    const title = `${p.name}${p.cat ? ' · ' + p.cat : ''} — ${site}`;
    const desc = plainText(
      [p.summary, plainText(p.descHtml, 200)].filter(Boolean).join(' '), 155
    ) || `${p.name} — ${site}`;

    return {
      slot: 'pd-ssr',
      title,
      desc,
      image,
      bodyHTML: bodyHTML(p),
      jsonLd: [jsonLd(p, canonical, image || `${url.origin}/assets/logo.png`, opt && opt.shipFee)],
    };
  } catch {
    return null;                                // 못 읽어도 제품 페이지는 그대로 나간다
  }
}

/* ── 제품 목록 (/products) ────────────────────────────────────
   목록도 `shop.js` 가 그린다. 크롤러가 받는 HTML 에는 **상품 이름이 한 줄도 없어**
   1,269자짜리 껍데기였다 — '명절 선물세트'로 검색해도 닿을 글자가 페이지에 없었다.
   상세와 같은 방식으로 서버가 목록을 실어 보낸다. */

/** 판매 중인 상품 전부. 숨김은 뺀다 — 화면에 없는 것을 검색에 내보내면 안 된다. */
async function loadSellable(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, cat, price, sale_price, unit, status, stock, summary,
            price_on_request, doc
       FROM products WHERE status <> '숨김' ORDER BY sort_order, id`
  ).all();
  return (results || []).map(productRowToObj);
}

function listBodyHTML(rows) {
  const cats = [];
  for (const p of rows) {
    const key = p.cat || '기타';
    let g = cats.find((c) => c.name === key);
    if (!g) { g = { name: key, items: [] }; cats.push(g); }
    g.items.push(p);
  }
  const block = (g) => `<h2>${attr(g.name)}</h2><ul>` + g.items.map((p) => {
    const price = p.priceOnRequest ? '가격 문의' : `${wonText(realPrice(p))}원${p.unit ? ' / ' + attr(p.unit) : ''}`;
    return `<li><a href="/product?id=${encodeURIComponent(p.id)}">${attr(p.name)}</a> — ${price}` +
      (p.status === '품절' ? ' (품절)' : '') +
      (p.summary ? ` · ${attr(p.summary)}` : '') + '</li>';
  }).join('') + '</ul>';
  return '<div class="wrap legal"><article class="card card-pad">' +
    cats.map(block).join('') +
    '</article></div>';
}

/** ItemList — 검색결과가 목록 페이지를 '상품 모음'으로 알아본다. */
function listJsonLd(rows, origin) {
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
 * `/products` 이면 목록을 실어 보낸다. 제목·설명은 페이지가 적어 둔 것을 그대로 둔다 —
 * 목록 페이지의 제목은 상품마다 달라질 값이 아니다.
 * @returns {null|{slot,bodyHTML,jsonLd}}
 */
export async function loadProductListDetail(env, url) {
  if (!env || !env.DB) return null;
  if (!/^\/products(?:\.html)?$/.test(url.pathname)) return null;
  try {
    const rows = await loadSellable(env);
    if (!rows.length) return null;
    return { slot: 'pl-ssr', bodyHTML: listBodyHTML(rows), jsonLd: [listJsonLd(rows, url.origin)] };
  } catch {
    return null;                                // 못 읽어도 제품 목록 화면은 그대로 나간다
  }
}
