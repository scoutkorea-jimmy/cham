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
// 비밀번호를 바꿔야 하는 계정이 그 전에 쓸 수 있는 창구
const BEFORE_PW_CHANGE = [/\/api\/admin\/password$/, /\/api\/admin\/session$/, /\/api\/admin\/logout$/];

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
  /* 만들어 준 비밀번호(또는 재설정한 비밀번호)로는 바꾸기 전까지 아무것도 못 한다.
     화면이 먼저 바꾸라고 띄우지만, 화면을 거치지 않는 요청도 같은 규칙이어야 한다. */
  if (session.user && session.user.must_change_password && !BEFORE_PW_CHANGE.some((re) => re.test(path))) {
    return json({ error: '비밀번호를 먼저 바꿔 주세요.', code: 'must_change_password' }, 403);
  }

  // 핸들러가 다시 조회하지 않도록 넘겨 준다
  context.data = { ...(context.data || {}), session };
  return context.next();
}
