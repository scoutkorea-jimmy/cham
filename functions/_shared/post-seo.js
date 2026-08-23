/**
 * 소식마당 글 하나를 **서버가 HTML 에 실어 보낸다.**
 *
 * **왜 필요한가.** 글은 `openPost(id)` 가 모달로 펼칠 뿐이라 주소가 없었다.
 * 주소가 없으면 사이트맵에 넣을 것도 없고, 링크로 보낼 수도 없고, 무엇보다
 * **크롤러는 자바스크립트를 돌리지 않으므로 글이 있다는 사실조차 모른다.**
 * 2026-07-31 에 강사에게 글쓰기를 열었으니, 앞으로 쌓일 교육 소식이 전부
 * 검색 밖에 있게 된다.
 *
 * 주소를 붙이는 것만으로는 부족하다 — 그 주소를 열었을 때 **글이 HTML 안에**
 * 있어야 한다. 그래서 세 가지를 한다.
 *   1. `<head>` 의 제목·설명·og 를 그 글의 것으로 바꾼다 (카톡 미리보기도 여기서 정해진다)
 *   2. `#post-ssr` 자리에 글 본문을 넣는다 (JS 가 뜨면 걷어내고 모달로 연다)
 *   3. `Article` 구조화 데이터를 실어 글쓴이·날짜를 검색엔진이 알아보게 한다
 *
 * 상품 상세도 같은 처리를 받는다 → `product-seo.js`. 둘 다 `seo.js` 가 아는
 * **하나의 모양**(detail)으로 돌려준다.
 */

import { plainText, attr } from './html-text.js';
import { SITE_NAME } from './org-seo.js';

/** `YYYY-MM-DD HH:MM:SS` → `YYYY-MM-DD`. 형식이 아니면 null — 틀린 날짜는 없는 것만 못하다. */
function isoDay(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * `/news?id=` 요청이면 그 글을 읽어 온다. 아니면 null.
 * **글이 없으면 null 을 준다** — 없는 id 로 들어와도 소식마당 목록이 그대로 보여야 한다.
 */
async function loadPost(env, id) {
  const r = await env.DB.prepare(
    `SELECT id, cat, title, html, badge, created_at, updated_at, author_name FROM posts WHERE id = ?`
  ).bind(id).first();
  if (!r) return null;
  return {
    id: r.id, cat: r.cat, title: r.title, html: r.html || '',
    badge: r.badge, at: r.created_at, updatedAt: r.updated_at, authorName: r.author_name,
  };
}

/**
 * `#post-ssr` 안에 넣을 본문.
 *
 * **`p.html` 은 관리자가 에디터로 쓴 것을 그대로 담은 값이라 여기서 다시 이스케이프하지
 * 않는다** — 하면 태그가 글자로 보인다. 글을 쓸 수 있는 사람은 관리자와 권한을 받은
 * 회원뿐이고, 그 입력은 저장할 때 이미 걸러진다(functions/api/posts).
 * 제목·글쓴이처럼 **평문으로 넣을 값만** 이스케이프한다.
 */
function bodyHTML(post) {
  const when = String(post.at || '').slice(0, 10).replace(/-/g, '.');
  return '<div class="wrap legal">' +
    '<article class="card card-pad">' +
      '<div class="crumb"><a href="/news">소식마당</a></div>' +
      `<h1>${attr(post.title)}</h1>` +
      `<p class="muted">${attr(post.badge || post.cat || '')} · ${attr(when)}` +
        (post.authorName ? ` · ${attr(post.authorName)}` : '') + '</p>' +
      `<div class="rich">${post.html}</div>` +
      '<p><a class="btn btn-ghost" href="/news">소식마당으로</a></p>' +
    '</article>' +
  '</div>';
}

/** 글 하나의 Article 구조화 데이터. 날짜·글쓴이를 검색결과가 함께 보여 준다. */
function jsonLd(post, canonical, image, siteName) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: plainText(post.title, 110),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
    image: [image],
    inLanguage: 'ko',
    description: plainText(post.html, 200),
    publisher: { '@type': 'Organization', name: siteName },
    author: { '@type': post.authorName ? 'Person' : 'Organization', name: post.authorName || siteName },
  };
  const pub = isoDay(post.at);
  if (pub) ld.datePublished = pub;
  const mod = isoDay(post.updatedAt) || pub;
  if (mod) ld.dateModified = mod;
  if (post.cat) ld.articleSection = post.cat;
  return ld;
}

/**
 * `seo.js` 가 아는 모양으로 돌려준다.
 * @returns {null|{slot,title,desc,image,bodyHTML,jsonLd}}
 */
export async function loadPostDetail(env, url, canonical, opt) {
  if (!env || !env.DB) return null;
  if (!/^\/news(?:\.html)?$/.test(url.pathname)) return null;
  const id = url.searchParams.get('id');
  if (!id) return null;

  try {
    const post = await loadPost(env, id);
    if (!post) return null;

    const site = SITE_NAME;
    const image = `${url.origin}/assets/logo.png`;
    return {
      slot: 'post-ssr',
      title: `${post.title} · ${site}`,
      desc: plainText(post.html) || `${site} 소식마당`,
      image: null,                    // 글에는 대표 사진이 따로 없다 — 페이지 기본 og:image 를 쓴다
      bodyHTML: bodyHTML(post),
      jsonLd: [jsonLd(post, canonical, image, site)],
    };
  } catch {
    return null;                      // 못 읽어도 소식마당은 그대로 나가야 한다
  }
}

/* ── 소식마당 목록 (/news) ────────────────────────────────────
   목록도 `board.js` 가 그린다. 크롤러가 받는 HTML 은 187자뿐이라 **글 제목이 하나도
   없었다** — 사이트맵으로 글 주소를 내고는 있지만, 목록에서 글로 가는 링크가 HTML 에
   없으면 검색엔진이 글을 '외딴 문서'로 본다. 제목과 링크를 실어 길을 놓는다. */

/** 최근 글. 견본 글은 뺀다 — sitemap 과 같은 기준이어야 한다. */
async function loadRecent(env, limit) {
  const { results } = await env.DB.prepare(
    `SELECT id, cat, title, html, badge, created_at FROM posts
      WHERE sample = 0 ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return results || [];
}

function listBodyHTML(rows) {
  return '<div class="wrap legal"><article class="card card-pad"><h2>최근 소식</h2><ul>' +
    rows.map((r) => {
      const when = String(r.created_at || '').slice(0, 10).replace(/-/g, '.');
      return `<li><a href="/news?id=${encodeURIComponent(r.id)}">${attr(r.title)}</a>` +
        ` <span class="muted">${attr(r.badge || r.cat || '')} · ${attr(when)}</span></li>`;
    }).join('') +
    '</ul></article></div>';
}

/**
 * `/news` (글 하나가 아닌 목록)이면 최근 글 목록을 실어 보낸다.
 * @returns {null|{slot,bodyHTML}}
 */
export async function loadPostListDetail(env, url) {
  if (!env || !env.DB) return null;
  if (!/^\/news(?:\.html)?$/.test(url.pathname)) return null;
  if (url.searchParams.get('id')) return null;      // 글 하나를 보는 중이면 그쪽이 처리한다
  try {
    const rows = await loadRecent(env, 30);
    if (!rows.length) return null;
    return { slot: 'post-ssr', bodyHTML: listBodyHTML(rows) };
  } catch {
    return null;                                    // 못 읽어도 소식마당은 그대로 나간다
  }
}
