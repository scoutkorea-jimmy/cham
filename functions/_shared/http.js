/** cham · API 공용 응답 도우미 */

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const [k, v] of Object.entries(extraHeaders || {})) {
    // Set-Cookie 는 여러 줄이라 set 이 아니라 append 여야 한다
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export const badRequest = (msg = '잘못된 요청입니다.') => json({ error: msg, code: 'bad_request' }, 400);
export const unauthorized = (msg = '로그인이 필요합니다.') => json({ error: msg, code: 'unauthorized' }, 401);
export const forbidden = (msg = '권한이 없습니다.') => json({ error: msg, code: 'forbidden' }, 403);
export const notFound = (msg = '찾을 수 없습니다.') => json({ error: msg, code: 'not_found' }, 404);
export const methodNotAllowed = () => json({ error: '잘못된 요청입니다.', code: 'bad_request' }, 405);

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
