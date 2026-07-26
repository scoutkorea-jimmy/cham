/**
 * cham · 관리자 화면 서버 차단
 *
 * 관리자 화면은 서버가 세션 없는 요청을 돌려보낸다.
 * 사용 설명서는 관리자 콘솔 안의 한 메뉴이므로 이 차단에 함께 걸린다.
 *
 * 로그인 화면은 별도 페이지(login.html)로 두어야 순환이 생기지 않는다.
 * (admin.html 을 막아 두고 그 안에서 로그인시키면, 막힌 페이지에 들어가야 로그인할 수 있다.)
 */
import { getSession } from './_shared/auth.js';

/* 설명서 본문(assets/manual.html)도 함께 막는다.
   화면은 관리자 콘솔 안에 있지만 본문은 **정적 파일**이라, 주소를 아는 사람은
   로그인 없이 51KB 짜리 운영 설명서를 통째로 읽을 수 있었다.
   admin.js 는 `credentials: 'same-origin'` 으로 받으므로 세션이 있으면 그대로 열린다.
   확장자 없는 주소(/assets/manual)로도 닿는다 — Pages 가 .html 을 떼어 주기 때문이다. */
const PROTECTED = [/^\/admin(?:\.html)?$/, /^\/assets\/manual(?:\.html)?$/];
// 사람이 보는 화면이 아닌 것은 로그인 화면으로 보내 봐야 소용없다 — 없는 것처럼 답한다
const AS_NOT_FOUND = [/^\/assets\//];

export async function onRequest(context) {
  const { request, env } = context;

  let path = '';
  try { path = new URL(request.url).pathname; } catch { return context.next(); }
  if (!PROTECTED.some((re) => re.test(path))) return context.next();

  // D1/시크릿이 아직 연결되지 않은 환경에서는 막지 않는다 —
  // 설정 누락 때문에 운영자가 자기 사이트에서 잠기는 편이 더 나쁘다.
  // (배포 전 체크리스트에서 바인딩을 확인한다 → docs/migration-cloudflare.md)
  if (!env || !env.ADMIN_SECRET || !env.DB) return context.next();

  const session = await getSession(request, env);
  if (session) return context.next();

  if (AS_NOT_FOUND.some((re) => re.test(path))) {
    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const to = new URL(request.url);
  to.pathname = '/login.html';
  to.search = `?next=${encodeURIComponent(path)}`;
  return Response.redirect(to.toString(), 302);
}
