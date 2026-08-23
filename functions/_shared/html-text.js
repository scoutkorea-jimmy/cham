/**
 * HTML ↔ 평문 손질 — 서버가 `<head>` 와 피드에 글자를 실을 때 쓰는 것들.
 *
 * 소식 글(post-seo)·상품(product-seo)·RSS 가 같은 손질을 필요로 한다.
 * 세 곳에 같은 함수를 두면 한 곳만 고쳐지는 날이 온다 → 여기 하나뿐이다.
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

/** 속성값·본문에 평문으로 넣을 문자열을 안전하게. */
export function attr(s) {
  return String(s == null ? '' : s).replace(/[<>"'&]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 12345 → '12,345'. 화면(`site.js` 의 fmtWon)과 같은 모양이어야 한다. */
export function wonText(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-US') : '';
}
