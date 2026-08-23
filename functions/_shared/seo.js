/**
 * 검색 노출 — 서버가 `<head>` 를 손본다.
 *
 * **왜 서버인가.** 검색엔진 인증 코드와 공유 이미지는 크롤러가 HTML 을 받은 그 순간
 * 들어 있어야 한다. JS 로 넣으면 스크립트를 실행하지 않는 크롤러(카카오톡·페이스북의
 * 미리보기 수집기가 그렇다)는 영영 못 본다.
 *
 * **고치는 것.**
 *  1. `og:image` 를 절대 주소로. OG 규격은 절대 주소를 요구한다 —
 *     `assets/logo.png` 처럼 상대 경로면 링크를 붙여도 썸네일이 뜨지 않는다.
 *  2. `og:url` · `canonical` 을 지금 보고 있는 절대 주소로.
 *  3. **JSON-LD 안의 주소도 절대 주소로.** schema.org 는 절대 주소를 요구한다.
 *     페이지들이 `"item":"index.html"` 처럼 적고 있어 빵부스러기가 통째로 무효였다.
 *  4. 구글·네이버 소유 확인 메타를 넣는다(관리자 > 검색 노출에서 코드를 받는다).
 *  5. 상세 화면(소식 글·상품)이면 제목·설명·본문·구조화 데이터를 그것의 것으로 바꾼다.
 *
 * 주소를 요청에서 뽑으므로 **도메인을 붙여도 고칠 곳이 없다.**
 */

import { orgJsonLd, siteJsonLd, SITE_NAME } from './org-seo.js';

const ABS = /^(https?:)?\/\//i;

/** 상대 경로를 지금 요청 기준 절대 주소로. 이미 절대면 그대로 둔다. */
export function absolute(origin, path) {
  const v = String(path || '').trim();
  if (!v) return '';
  if (ABS.test(v)) return v;
  return origin.replace(/\/$/, '') + '/' + v.replace(/^\.?\//, '');
}

/**
 * 이 요청이 가리키는 정본 주소.
 *
 * 질의문자열은 **상품 상세와 소식 글(?id=)만** 의미가 있다 — 나머지(utm 등)는 같은 문서로 본다.
 * `?id=` 를 canonical 에 남기지 않으면 소식 글 스무 개가 전부 /news 한 문서로 합쳐진다.
 *
 * 상세 화면을 읽는 쪽(post-seo·product-seo)도 이 값을 써야 하므로 밖으로 낸다 —
 * 각자 만들면 언젠가 둘이 어긋난다.
 */
export function canonicalFor(url) {
  const id = url.searchParams.get('id');
  return url.origin + url.pathname + (id ? '?id=' + encodeURIComponent(id) : '');
}

/** 인증 코드는 메타 태그의 content 로 들어간다 — 따옴표·꺾쇠를 막는다. */
function safeAttr(v) {
  return String(v || '').trim().slice(0, 200).replace(/[<>"'&]/g, '');
}

/**
 * 구글·네이버는 `<meta name="..." content="코드">` 통째로 붙여넣는 사람이 많다.
 * 코드만 뽑아 준다 — "붙여넣었는데 왜 안 되나요"를 만들지 않기 위해서다.
 */
export function extractCode(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const m = v.match(/content\s*=\s*["']([^"']+)["']/i);
  return safeAttr(m ? m[1] : v);
}

/* JSON-LD 에서 값이 주소인 칸. schema.org 는 여기에 **절대 주소**를 요구한다.
   상대 주소를 적으면 구글은 그 항목을 통째로 버린다 — 있으나 마나가 아니라 없는 것이 된다. */
const LD_URL_KEYS = new Set(['url', 'logo', 'image', 'item', 'contentUrl', 'sameAs', '@id', 'thumbnailUrl']);

/** JSON-LD 한 덩이 안의 상대 주소를 전부 절대 주소로. 원본을 바꾸지 않고 새 값을 만든다. */
export function absolutizeLd(node, origin) {
  if (Array.isArray(node)) return node.map((v) => absolutizeLd(v, origin));
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (LD_URL_KEYS.has(k)) {
      if (typeof v === 'string') { out[k] = absolute(origin, v); continue; }
      if (Array.isArray(v)) { out[k] = v.map((s) => (typeof s === 'string' ? absolute(origin, s) : absolutizeLd(s, origin))); continue; }
    }
    out[k] = absolutizeLd(v, origin);
  }
  return out;
}

/**
 * HTML 응답의 <head> 를 손본다. HTML 이 아니면 그대로 돌려준다.
 *
 * @param {Response} res   원본 응답
 * @param {URL} url        요청 주소
 * @param {object} seo     { google, naver, image, siteName, settings }
 * @param {object} [detail] 상세 화면 하나 — { slot, title, desc, image, bodyHTML, jsonLd }
 *                         소식 글은 post-seo.js, 상품은 product-seo.js 가 만든다.
 */
export function rewriteHead(res, url, seo, detail) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;

  const origin = url.origin;
  const canonical = canonicalFor(url);
  const image = absolute(origin, (detail && detail.image) || seo.image || 'assets/logo.png');
  const siteName = SITE_NAME;

  let sawOgUrl = false;
  let sawCanonical = false;
  let sawIcon = false;
  let sawLocale = false;
  let ldBuf = '';

  const rw = new HTMLRewriter()
    // 상대 경로 og:image → 절대 주소. 상세 화면이면 그 화면의 사진으로 갈아 끼운다.
    .on('meta[property="og:image"]', {
      element(el) {
        const c = el.getAttribute('content') || '';
        el.setAttribute('content', (detail && detail.image) ? image : (ABS.test(c) ? c : absolute(origin, c || seo.image)));
      },
    })
    .on('meta[property="og:locale"]', { element() { sawLocale = true; } })
    .on('meta[property="og:url"]', { element(el) { sawOgUrl = true; el.setAttribute('content', canonical); } })
    .on('link[rel="canonical"]', { element(el) { sawCanonical = true; el.setAttribute('href', canonical); } })
    /* 페이지가 손으로 적은 JSON-LD 의 상대 주소를 절대 주소로 바꾼다.
       텍스트는 조각으로 나뉘어 오므로 마지막 조각에서 한꺼번에 갈아 끼운다 —
       조각마다 바꾸면 JSON 이 중간에서 잘린 채 파싱을 시도하게 된다. */
    .on('script[type="application/ld+json"]', {
      text(chunk) {
        ldBuf += chunk.text;
        if (!chunk.lastInTextNode) { chunk.remove(); return; }
        let out = ldBuf;
        try {
          out = JSON.stringify(absolutizeLd(JSON.parse(ldBuf), origin));
        } catch {
          /* 못 읽으면 원본 그대로 내보낸다. 손으로 적은 JSON 이라 언젠가 쉼표 하나가
             틀릴 수 있는데, 그때 태그를 비우면 있던 구조화 데이터까지 사라진다. */
        }
        ldBuf = '';
        chunk.replace(out, { html: false });
      },
    })
    /* 탭 아이콘이 어느 페이지에도 선언돼 있지 않아, 브라우저가 방문마다
       /favicon.ico 를 찾다가 404 를 받고 있었다. 페이지마다 적으면 17곳이
       따로 놀므로 여기 한 곳에서 붙인다.
       한때 여기서 `assets/logo.png` 를 가리켰는데, 404 는 사라졌지만 방문마다
       120KB 로고를 받아 16px 로 줄이고 있었다 — 붓질이 뭉개져 알아볼 수도 없었다.
       지금은 전용 마크(assets/favicon.svg · 951B)를 쓴다 → docs/failures.md */
    .on('link[rel~="icon"]', { element() { sawIcon = true; } })
    .on('head', {
      element(el) {
        /* 여는 태그에서 붙이면 안 된다 — 그 시점엔 자식(meta·link)을 아직 읽지 않아
           '이미 있는지'가 항상 false 로 나오고, 있는 페이지에 하나 더 붙게 된다.
           닫는 태그에서 붙여야 위 핸들러들이 먼저 돌아 판정이 맞는다. */
        el.onEndTag((end) => {
          const add = [];
          if (!sawOgUrl) add.push(`<meta property="og:url" content="${canonical}">`);
          if (!sawCanonical) add.push(`<link rel="canonical" href="${canonical}">`);
          /* 한국어 문서임을 밝힌다. `<html lang>` 만으로는 페이스북·카카오 미리보기가
             언어를 모르고, 네이버는 이 값을 국내 문서 판정에 함께 본다. */
          if (!sawLocale) add.push(`<meta property="og:locale" content="ko_KR">`);
          if (!sawIcon) {
            /* SVG 를 먼저 두고 .ico 를 뒤에 둔다 — SVG 를 모르는 브라우저만 뒤엣것을 쓴다.
               apple-touch-icon 은 홈 화면에 담을 때 iOS 가 찾는 이름이라 별도로 붙인다. */
            add.push(`<link rel="icon" type="image/svg+xml" href="${absolute(origin, 'assets/favicon.svg')}">`);
            add.push(`<link rel="icon" sizes="32x32" href="${absolute(origin, 'favicon.ico')}">`);
            add.push(`<link rel="apple-touch-icon" href="${absolute(origin, 'assets/apple-touch-icon.png')}">`);
          }
          // 트위터 카드도 같은 그림을 쓴다 — 없으면 링크가 글자만 나온다
          add.push(`<meta name="twitter:card" content="summary_large_image">`);
          add.push(`<meta name="twitter:image" content="${image}">`);
          /* 소식마당 글은 RSS 로도 나간다. 이 한 줄이 있어야 브라우저·수집기가
             피드를 스스로 찾는다 — 네이버 서치어드바이저도 여기서 확인한다. */
          add.push(`<link rel="alternate" type="application/rss+xml" title="${siteName} 소식" href="${origin}/rss.xml">`);
          const g = extractCode(seo.google), n = extractCode(seo.naver);
          if (g) add.push(`<meta name="google-site-verification" content="${g}">`);
          if (n) add.push(`<meta name="naver-site-verification" content="${n}">`);
          /* 조합·사이트 구조화 데이터. **운영 설정이 원본**이라 서버가 만든다 —
             페이지에 손으로 적어 두면 운영자가 전화번호를 바꿔도 옛 번호가 남는다. */
          const ssrLd = [orgJsonLd(origin, seo.settings), siteJsonLd(origin, seo.settings)];
          /* 상세 화면의 구조화 데이터. 페이지가 손으로 적은 것과 달리 여기서 만든 값은
             이미 절대 주소라 다시 손보지 않는다. */
          if (detail && detail.jsonLd) ssrLd.push(...detail.jsonLd);
          for (const ld of ssrLd) {
            /* `</script>` 가 값 안에 있으면 태그가 거기서 닫힌다 — 여는 꺾쇠를 막는다. */
            add.push(`<script type="application/ld+json" data-ssr="detail">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
          }
          if (add.length) end.before('\n' + add.join('\n') + '\n', { html: true });
        });
      },
    });

  /* 상세 화면(소식 글 하나·상품 하나)을 보는 중이면 제목·설명을 그것의 것으로 바꾼다.
     안 바꾸면 글 스무 개, 상품 열네 개의 검색결과 제목이 전부 같아지고,
     카톡으로 링크를 보내도 어느 것인지 알 수 없다. */
  if (detail) {
    /* 목록 화면(제품 목록·소식 목록)은 **제목을 바꾸지 않는다** — 페이지가 적어 둔 제목이
       이미 그 목록의 것이다. 바꿀 값을 가진 상세 화면만 갈아 끼운다. */
    if (detail.title) {
      rw.on('title', { element(el) { el.setInnerContent(detail.title); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', detail.title); } });
    }
    if (detail.desc) {
      rw.on('meta[name="description"]', { element(el) { el.setAttribute('content', detail.desc); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', detail.desc); } });
    }
    /* 본문을 HTML 에 실어 보낸다. 이 자리가 없으면 크롤러는 내용이 있다는 것조차 모른다
       — 자바스크립트를 돌리지 않기 때문이다. JS 가 뜨면 화면 코드가 걷어내고 제 방식으로 그린다. */
    if (detail.slot && detail.bodyHTML) {
      rw.on(`#${detail.slot}`, { element(el) { el.setInnerContent(detail.bodyHTML, { html: true }); } });
    }
  }

  return rw.transform(res);
}
