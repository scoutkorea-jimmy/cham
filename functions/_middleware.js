/**
 * cham · 관리자 화면 서버 차단 + 검색 노출 태그 주입
 *
 * 관리자 화면은 서버가 세션 없는 요청을 돌려보낸다.
 * 사용 설명서는 관리자 콘솔 안의 한 메뉴이므로 이 차단에 함께 걸린다.
 *
 * 로그인 화면은 별도 페이지(login.html)로 두어야 순환이 생기지 않는다.
 * (admin.html 을 막아 두고 그 안에서 로그인시키면, 막힌 페이지에 들어가야 로그인할 수 있다.)
 *
 * 공개 HTML 은 내보내기 전에 `<head>` 를 손본다 → _shared/seo.js
 */
import { getSession } from './_shared/auth.js';
import { readDoc } from './_shared/store.js';
import { rewriteHead } from './_shared/seo.js';

/* 설명서 본문(assets/manual.html)도 함께 막는다.
   화면은 관리자 콘솔 안에 있지만 본문은 **정적 파일**이라, 주소를 아는 사람은
   로그인 없이 51KB 짜리 운영 설명서를 통째로 읽을 수 있었다.
   admin.js 는 `credentials: 'same-origin'` 으로 받으므로 세션이 있으면 그대로 열린다.
   확장자 없는 주소(/assets/manual)로도 닿는다 — Pages 가 .html 을 떼어 주기 때문이다. */
const PROTECTED = [/^\/admin(?:\.html)?$/, /^\/assets\/manual(?:\.html)?$/];

/* 홈페이지가 아닌 것들 — 로그인해도 열어 줄 이유가 없어 **누구에게나** 404 다.
   배포 대상이 저장소 루트(wrangler.toml `pages_build_output_dir = "."`)라
   저장소에 있는 것이 전부 주소를 갖는다. 실제로 이런 것들이 열려 있었다:
     /docs/handoff.md   — '관리자 비밀번호가 admin/admin' 이라고 적힌 문서
     /wrangler.toml     — D1 database_id
     /db/0001_auth.sql  — 계정·세션 표 스키마
     /CLAUDE.md /rules/ — 내부 작업 규칙
   근본 해결은 공개 파일만 `public/` 으로 분리하는 것이다(→ docs/handoff.md T7).
   그 전까지 여기서 막는다. 목록에 없는 새 문서가 또 열리지 않도록 **확장자로도** 막는다. */
const NOT_PUBLIC = [
  /^\/(?:docs|rules|db|scripts|node_modules)\//i,
  /^\/\.[^/]+/,                                   // .dev.vars.example · .githooks 등 숨김 파일
  /\.(?:md|toml|sql|py|sh|yml|yaml|lock)$/i,
  /^\/(?:package(?:-lock)?\.json|venv)\b/i,
];

// 사람이 보는 화면이 아닌 것은 로그인 화면으로 보내 봐야 소용없다 — 없는 것처럼 답한다
const AS_NOT_FOUND = [/^\/assets\//];

function notFound() {
  return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

/* 검색 노출 태그를 붙일 대상.
   관리자·로그인은 noindex 라 손댈 이유가 없고, api·자원은 HTML 이 아니다. */
const NO_SEO = [/^\/api\//, /^\/assets\//, /^\/admin/, /^\/login/, /\.(css|js|png|jpe?g|svg|ico|txt|xml|webmanifest)$/i];

async function withSeo(context, url) {
  const res = await context.next();
  if (NO_SEO.some((re) => re.test(url.pathname))) return res;
  if (!context.env || !context.env.DB) return res;      // D1 없이도 페이지는 그대로 나가야 한다
  try {
    const st = (await readDoc(context.env, 'settings')) || {};
    return rewriteHead(res, url, {
      google: st.seoGoogle, naver: st.seoNaver, image: st.seoImage,
    });
  } catch {
    return res;     // 설정을 못 읽는다고 페이지를 못 보게 만들지 않는다
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  let url = null;
  try { url = new URL(request.url); } catch { return context.next(); }
  const path = url.pathname;
  // 홈페이지가 아닌 파일은 세션을 보기 전에 잘라낸다 — 로그인해도 열 이유가 없다
  if (NOT_PUBLIC.some((re) => re.test(path))) return notFound();
  if (!PROTECTED.some((re) => re.test(path))) return withSeo(context, url);

  // D1/시크릿이 아직 연결되지 않은 환경에서는 막지 않는다 —
  // 설정 누락 때문에 운영자가 자기 사이트에서 잠기는 편이 더 나쁘다.
  // (배포 전 체크리스트에서 바인딩을 확인한다 → docs/migration-cloudflare.md)
  if (!env || !env.ADMIN_SECRET || !env.DB) return context.next();

  const session = await getSession(request, env);
  if (session) return context.next();

  if (AS_NOT_FOUND.some((re) => re.test(path))) return notFound();

  const to = new URL(request.url);
  to.pathname = '/login.html';
  to.search = `?next=${encodeURIComponent(path)}`;
  return Response.redirect(to.toString(), 302);
}
