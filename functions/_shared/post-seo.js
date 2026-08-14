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
 * 있어야 한다. 그래서 두 가지를 한다.
 *   1. `<head>` 의 제목·설명·og 를 그 글의 것으로 바꾼다 (카톡 미리보기도 여기서 정해진다)
 *   2. `#post-ssr` 자리에 글 본문을 넣는다 (JS 가 뜨면 걷어내고 모달로 연다)
 */

/** 태그를 걷어 요약문을 만든다. description 은 글자만 들어가야 한다. */
export function plainText(html, max = 160) {
  const t = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** 속성값으로 넣을 문자열을 안전하게. */
const attr = (s) => String(s == null ? '' : s).replace(/[<>"'&]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * `/news?id=` 요청이면 그 글을 읽어 온다. 아니면 null.
 * **글이 없으면 null 을 준다** — 없는 id 로 들어와도 소식마당 목록이 그대로 보여야 한다.
 */
export async function loadPostFor(env, url) {
  if (!env || !env.DB) return null;
  if (!/^\/news(?:\.html)?$/.test(url.pathname)) return null;
  const id = url.searchParams.get('id');
  if (!id) return null;
  try {
    const r = await env.DB.prepare(
      `SELECT id, cat, title, html, badge, created_at, author_name FROM posts WHERE id = ?`
    ).bind(id).first();
    if (!r) return null;
    return {
      id: r.id, cat: r.cat, title: r.title, html: r.html || '',
      badge: r.badge, at: r.created_at, authorName: r.author_name,
    };
  } catch {
    return null;               // 못 읽어도 소식마당은 그대로 나가야 한다
  }
}

/** `<head>` 에 넣을 태그들. rewriteHead 가 자기 것과 함께 붙인다. */
export function postHeadTags(post, siteName) {
  const title = `${post.title} · ${siteName}`;
  const desc = plainText(post.html) || `${siteName} 소식마당`;
  return { title, desc };
}

/**
 * `#post-ssr` 안에 넣을 본문.
 *
 * **`p.html` 은 관리자가 에디터로 쓴 것을 그대로 담은 값이라 여기서 다시 이스케이프하지
 * 않는다** — 하면 태그가 글자로 보인다. 글을 쓸 수 있는 사람은 관리자와 권한을 받은
 * 회원뿐이고, 그 입력은 저장할 때 이미 걸러진다(functions/api/posts).
 * 제목·글쓴이처럼 **평문으로 넣을 값만** 이스케이프한다.
 */
export function postBodyHTML(post) {
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
