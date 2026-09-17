/**
 * GET /api/images/:id — R2 에 있는 이미지를 그대로 흘려보낸다.
 *
 * 공개 경로다. 상품·페이지 사진은 어차피 공개 화면에 실리고,
 * id 는 추측이 어려운 무작위 문자열이라 목록을 훑을 수는 없다.
 * (게시글 첨부처럼 비공개로 둘 것이 생기면 scope 로 걸러야 한다.)
 */
export async function onRequestGet({ params, env, request }) {
  if (!env || !env.DB || !env.MEDIA) return new Response('not available', { status: 503 });

  const id = String(params.id || '');
  const row = await env.DB.prepare(`SELECT r2_key, mime FROM images WHERE id = ?`).bind(id).first();
  if (!row) return new Response('not found', { status: 404 });

  const obj = await env.MEDIA.get(row.r2_key);
  if (!obj) return new Response('not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', row.mime || headers.get('Content-Type') || 'application/octet-stream');
  headers.set('etag', obj.httpEtag);
  // 이미지는 교체 시 새 id 를 받으므로(덮어쓰지 않는다) 길게 캐시해도 안전하다
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // 브라우저가 이미 같은 파일을 갖고 있으면 본문을 보내지 않는다
  if (request.headers.get('If-None-Match') === obj.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(obj.body, { headers });
}

/* HEAD 도 받는다 — 링크 검사기·일부 수집기는 그림을 HEAD 로 확인한다. 없으면 정적 자산 404 로 떨어져
   '그림이 깨졌다'로 보인다(2026-09-17 전수 검사에서 15장 전부 404 로 나와 놀란 적이 있다 — GET 은 200).
   런타임이 본문을 떼고 머리만 보낸다. */
export const onRequestHead = onRequestGet;
