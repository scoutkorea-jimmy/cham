/**
 * 글 본문 HTML 여과 — **저장할 때 한 번**, 허용 목록 방식.
 *
 * **왜.** 소식마당 글은 강사 회원도 쓴다(2026-07-31 글쓰기 권한). 에디터가 만든 HTML 을 그대로 저장하고
 * 그대로 내보내면(공개 화면 `board.js` · 서버 렌더 `post-seo.js` 둘 다) 스크립트 한 줄로 **방문자 전원의
 * 브라우저에서 코드가 돈다**(저장형 XSS). 계정 하나가 잘못 쓰이거나 뚫리면 사이트 전체가 위험하다.
 * 화면에서 거르면 화면을 거치지 않는 요청은 못 거른다 — 그래서 서버가 저장 직전에 거른다.
 *
 * **무엇을 남기나.** 편집기(Tiptap)가 만드는 것만: 문단·제목·굵게·밑줄·형광펜·정렬·목록·체크리스트·인용·
 * 코드·표·그림·유튜브. 모르는 태그는 **글자만 남기고** 태그를 벗기고, 위험한 태그(script·style·object·form…)는
 * 내용까지 버린다. 속성은 아는 것만, 주소는 http(s)·mailto·tel·상대 주소(그림은 data:image 도)만,
 * 인라인 style 은 색·정렬·크기 같은 것만.
 *
 * HTMLRewriter 는 워커의 내장 파서라 따로 받을 라이브러리가 없고, 200KB 본문도 스트림으로 지나간다.
 */
const KEEP = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'span', 'a', 'small', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
  'img', 'figure', 'figcaption', 'div', 'label', 'input', 'iframe', 'video', 'source',
]);
// 내용까지 버린다 — 글자로 남겨 봐야 코드 조각이다
const DROP = new Set(['script', 'style', 'noscript', 'template', 'object', 'embed', 'applet', 'meta', 'link', 'base', 'form', 'svg', 'math', 'textarea', 'select', 'button']);
const ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'style', 'colspan', 'rowspan', 'width', 'height', 'target', 'rel',
  'start', 'type', 'checked', 'disabled', 'data-type', 'data-checked', 'align', 'controls', 'poster', 'loading',
  'allow', 'allowfullscreen', 'frameborder',
]);
const STYLE_PROPS = new Set([
  'color', 'background-color', 'text-align', 'font-size', 'font-family', 'font-weight', 'font-style',
  'text-decoration', 'line-height', 'width', 'height', 'max-width', 'margin-left', 'padding-left',
  'border', 'border-collapse', 'vertical-align', 'white-space',
]);
const FRAME_SRC = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//i;
// 제어문자·공백 — 스킴 사이에 끼워 넣어 검사를 피하는 수법을 막는다 (예: java + 줄바꿈 + script:)
const CONTROL = /[\x00-\x20\x7f]/g;

/** 주소가 안전한가. */
function safeUrl(v, allowDataImage) {
  const s = String(v || '').replace(CONTROL, '').toLowerCase();
  if (!s) return false;
  if (/^(https?:|mailto:|tel:)/.test(s)) return true;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/.test(s)) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(s)) return false;     // 그 밖의 스킴(javascript: · vbscript: · data:)
  return true;                                        // 상대 주소
}

/** 인라인 style — 아는 속성만, 값에 url()·expression·꺾쇠·역슬래시가 없을 때만 */
function safeStyle(v) {
  return String(v || '').split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return null;
    const prop = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).trim();
    if (!STYLE_PROPS.has(prop)) return null;
    if (/url\s*\(|expression|javascript|[<>\\]/i.test(val)) return null;
    return prop + ': ' + val;
  }).filter(Boolean).join('; ');
}

const handler = {
  element(el) {
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) { el.remove(); return; }
    if (!KEEP.has(tag)) { el.removeAndKeepContent(); return; }

    const attrs = [];
    for (const [name, value] of el.attributes) attrs.push([name.toLowerCase(), value]);

    for (const [name, value] of attrs) {
      if (!ATTRS.has(name) || name.startsWith('on')) { el.removeAttribute(name); continue; }
      if (name === 'href' || name === 'src' || name === 'poster') {
        if (!safeUrl(value, tag === 'img' && name === 'src')) el.removeAttribute(name);
        continue;
      }
      if (name === 'style') {
        const clean = safeStyle(value);
        if (clean) el.setAttribute('style', clean); else el.removeAttribute('style');
      }
    }

    // 새 창 링크는 여는 쪽이 부모 창을 못 만지게
    if (tag === 'a' && String(el.getAttribute('target') || '').toLowerCase() === '_blank') {
      el.setAttribute('rel', 'noopener noreferrer');
    }
    // 체크리스트의 체크박스만 — 다른 입력 칸은 글에 있을 이유가 없다
    if (tag === 'input' && String(el.getAttribute('type') || '').toLowerCase() !== 'checkbox') el.remove();
    // 끼워 넣는 프레임은 영상 사이트만
    if (tag === 'iframe') {
      const src = String(el.getAttribute('src') || '');
      if (!FRAME_SRC.test(src)) { el.remove(); return; }
      el.removeAttribute('srcdoc');
      el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
      el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    }
  },
};

/** 여과된 HTML 문자열. 빈 값은 그대로 돌려준다. */
export async function sanitizeHtml(html) {
  if (html == null || html === '') return html;
  const res = new HTMLRewriter().on('*', handler)
    .transform(new Response(String(html), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
  return await res.text();
}
