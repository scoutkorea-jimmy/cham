/**
 * /api/admin/* 전체에 세션을 요구한다.
 *
 * 로그인 자체와 세션 확인은 예외 — 그러지 않으면 로그인할 방법이 없다.
 * 개별 핸들러는 여기서 통과한 뒤 필요에 따라 owner 여부를 다시 본다(getOwnerSession).
 * 이 층이 있으므로 각 핸들러가 인증을 잊어도 열려 있지 않다.
 */
import { getSession } from '../../_shared/auth.js';
import { json } from '../../_shared/http.js';

const OPEN = [/\/api\/admin\/login$/, /\/api\/admin\/logout$/, /\/api\/admin\/session$/];

export async function onRequest(context) {
  const { request, env } = context;

  let path = '';
  try { path = new URL(request.url).pathname; } catch {}
  if (OPEN.some((re) => re.test(path))) return context.next();

  if (!env || !env.ADMIN_SECRET || !env.DB) {
    return json({ error: '서버 설정이 완료되지 않았습니다.', code: 'server_unavailable' }, 503);
  }

  const session = await getSession(request, env);
  if (!session) return json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, 401);

  // 핸들러가 다시 조회하지 않도록 넘겨 준다
  context.data = { ...(context.data || {}), session };
  return context.next();
}
