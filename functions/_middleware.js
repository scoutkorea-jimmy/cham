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

// 사람이 보는 화면이 아닌 것은 로그인 화면으로 보내 봐야 소용없다 — 없는 것처럼 답한다
const AS_NOT_FOUND = [/^\/assets\//];

function notFound() {
  return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

/* 검색 노출 태그를 붙일 대상.
   관리자·로그인은 noindex 라 손댈 이유가 없고, api·자원은 HTML 이 아니다. */
const NO_SEO = [/^\/api\//, /^\/assets\//, /^\/admin/, /^\/login/, /\.(css|js|png|jpe?g|svg|ico|txt|xml|webmanifest)$/i];

/* 색인·수집을 거부하는 주소. **응답 헤더로** 말한다.
   `<meta name="robots">` 는 HTML 을 파싱해야 보이므로 JSON·리다이렉트에는 실을 수 없고,
   robots.txt 는 "가져가지 마라"일 뿐 이미 가져간 것을 지우게 하지 못한다.
   헤더는 응답마다 붙어 둘 다 해결한다 — 302 로 돌려보내는 관리자 주소에도 실린다.
   noarchive·nosnippet 까지 넣는 이유는, 색인을 지워도 캐시와 미리보기가 남기 때문이다. */
const NO_ROBOTS = [/^\/admin/, /^\/login/, /^\/mypage/, /^\/api\//, /^\/assets\/manual/];
const NO_ROBOTS_VALUE = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

/* 응답은 불변일 수 있어(정적 자산) 헤더를 바로 못 쓴다 — 복사본에 붙인다. */
function withNoRobots(res) {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', NO_ROBOTS_VALUE);
  return out;
}

async function withSeo(context, url) {
  const res = await context.next();
  if (NO_ROBOTS.some((re) => re.test(url.pathname))) return withNoRobots(res);
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
  /* 홈페이지가 아닌 파일(docs · rules · db · wrangler.toml …)을 여기서 404 로 막던
     목록이 있었다. 이제 그것들은 배포 대상(public/) 밖이라 **주소 자체가 없다**
     → wrangler.toml 참조. 덮개를 걷어냈다. */
  if (!PROTECTED.some((re) => re.test(path))) return withSeo(context, url);

  // D1/시크릿이 아직 연결되지 않은 환경에서는 막지 않는다 —
  // 설정 누락 때문에 운영자가 자기 사이트에서 잠기는 편이 더 나쁘다.
  // (배포 전 체크리스트에서 바인딩을 확인한다 → docs/migration-cloudflare.md)
  if (!env || !env.ADMIN_SECRET || !env.DB) return withNoRobots(await context.next());

  const session = await getSession(request, env);
  if (session) return withNoRobots(await context.next());

  if (AS_NOT_FOUND.some((re) => re.test(path))) return withNoRobots(notFound());

  /* 돌려보내는 응답에도 붙인다 — 크롤러는 302 의 Location 을 따라가 로그인 화면을
     색인하고, 원래 주소를 '옮겨간 페이지'로 기억한다.
     Response.redirect() 를 감싸지 않고 직접 만든다 — 그 응답은 불변이라
     헤더를 더하려면 어차피 새로 만들어야 한다. */
  const to = new URL(request.url);
  to.pathname = '/login.html';
  to.search = `?next=${encodeURIComponent(path)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: to.toString(), 'X-Robots-Tag': NO_ROBOTS_VALUE },
  });
}
