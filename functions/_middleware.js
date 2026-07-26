/**
 * cham · 관리자 화면 서버 차단
 *
 * 지금까지 admin.html · manual.html 은 브라우저 안에서만 가렸다 —
 * 페이지 소스를 직접 열면 내용이 보였다. 여기서 **서버가** 세션 없는 요청을 돌려보낸다.
 *
 * 로그인 화면은 별도 페이지(login.html)로 두어야 순환이 생기지 않는다.
 * (admin.html 을 막아 두고 그 안에서 로그인시키면, 막힌 페이지에 들어가야 로그인할 수 있다.)
 */
import { getSession } from './_shared/auth.js';

const PROTECTED = [/^\/admin(?:\.html)?$/, /^\/manual(?:\.html)?$/];

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

  const to = new URL(request.url);
  to.pathname = '/login.html';
  to.search = `?next=${encodeURIComponent(path)}`;
  return Response.redirect(to.toString(), 302);
}
