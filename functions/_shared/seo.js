/**
 * 검색 노출 — 서버가 `<head>` 를 손본다.
 *
 * **왜 서버인가.** 검색엔진 인증 코드와 공유 이미지는 크롤러가 HTML 을 받은 그 순간
 * 들어 있어야 한다. JS 로 넣으면 스크립트를 실행하지 않는 크롤러(카카오톡·페이스북의
 * 미리보기 수집기가 그렇다)는 영영 못 본다.
 *
 * **고치는 것 세 가지.**
 *  1. `og:image` 를 절대 주소로. OG 규격은 절대 주소를 요구한다 —
 *     `assets/logo.png` 처럼 상대 경로면 링크를 붙여도 썸네일이 뜨지 않는다.
 *  2. `og:url` · `canonical` 을 지금 보고 있는 절대 주소로.
 *  3. 구글·네이버 소유 확인 메타를 넣는다(관리자 > 검색 노출에서 코드를 받는다).
 *
 * 주소를 요청에서 뽑으므로 **도메인을 붙여도 고칠 곳이 없다.**
 */

import { postHeadTags, postBodyHTML } from './post-seo.js';

const ABS = /^(https?:)?\/\//i;

/** 상대 경로를 지금 요청 기준 절대 주소로. 이미 절대면 그대로 둔다. */
export function absolute(origin, path) {
  const v = String(path || '').trim();
  if (!v) return '';
  if (ABS.test(v)) return v;
  return origin.replace(/\/$/, '') + '/' + v.replace(/^\.?\//, '');
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

/**
 * HTML 응답의 <head> 를 손본다. HTML 이 아니면 그대로 돌려준다.
 *
 * @param {Response} res   원본 응답
 * @param {URL} url        요청 주소
 * @param {object} seo     { google, naver, image, siteName }
 * @param {object} [post]  소식마당 글 하나(/news?id=). 있으면 제목·설명을 그 글의 것으로
 *                         바꾸고 본문을 `#post-ssr` 에 넣는다 → _shared/post-seo.js
 */
export function rewriteHead(res, url, seo, post) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;

  const origin = url.origin;
  /* 질의문자열은 **상품 상세와 소식 글(?id=)만** 의미가 있다 — 나머지(utm 등)는 같은 문서로 본다.
     ?id= 를 canonical 에 남기지 않으면 소식 글 스무 개가 전부 /news 한 문서로 합쳐진다. */
  const id = url.searchParams.get('id');
  const canonical = origin + url.pathname + (id ? '?id=' + encodeURIComponent(id) : '');
  const image = absolute(origin, seo.image || 'assets/logo.png');

  const siteName = seo.siteName || '한국참전통발효식품협동조합';
  const head = post ? postHeadTags(post, siteName) : null;

  let sawOgUrl = false;
  let sawCanonical = false;
  let sawIcon = false;

  const rw = new HTMLRewriter()
    // 상대 경로 og:image → 절대 주소
    .on('meta[property="og:image"]', {
      element(el) {
        const c = el.getAttribute('content') || '';
        el.setAttribute('content', ABS.test(c) ? c : absolute(origin, c || seo.image));
      },
    })
    .on('meta[property="og:url"]', { element(el) { sawOgUrl = true; el.setAttribute('content', canonical); } })
    .on('link[rel="canonical"]', { element(el) { sawCanonical = true; el.setAttribute('href', canonical); } })
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
           닫는 태그에서 붙여야 위 두 핸들러가 먼저 돌아 판정이 맞는다. */
        el.onEndTag((end) => {
          const add = [];
          if (!sawOgUrl) add.push(`<meta property="og:url" content="${canonical}">`);
          if (!sawCanonical) add.push(`<link rel="canonical" href="${canonical}">`);
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
          const g = extractCode(seo.google), n = extractCode(seo.naver);
          if (g) add.push(`<meta name="google-site-verification" content="${g}">`);
          if (n) add.push(`<meta name="naver-site-verification" content="${n}">`);
          if (add.length) end.before('\n' + add.join('\n') + '\n', { html: true });
        });
      },
    });

  /* 소식 글 하나를 보는 중이면 제목·설명을 그 글의 것으로 바꾼다.
     안 바꾸면 글 스무 개의 검색결과 제목이 전부 '소식마당'으로 같아지고,
     카톡으로 링크를 보내도 어느 글인지 알 수 없다. */
  if (head) {
    rw.on('title', { element(el) { el.setInnerContent(head.title); } })
      .on('meta[name="description"]', { element(el) { el.setAttribute('content', head.desc); } })
      .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', head.title); } })
      .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', head.desc); } })
      /* 본문을 HTML 에 실어 보낸다. 이 자리가 없으면 크롤러는 글이 있다는 것조차 모른다
         — 자바스크립트를 돌리지 않기 때문이다. JS 가 뜨면 board.js 가 걷어내고 모달로 연다. */
      .on('#post-ssr', { element(el) { el.setInnerContent(postBodyHTML(post), { html: true }); } });
  }

  return rw.transform(res);
}
