# cham 프로젝트 현황

한국참전통발효식품협동조합 공식 홈페이지. 운영 주소 https://charmjt.org.
정적 HTML/CSS/바닐라 JS와 Cloudflare Pages Functions, D1, R2 사용. Node.js ESM 및 npm lockfile 기준이며 빌드 단계는 없다.

요청·구현·운영 확인 상태의 정본은 [docs/handoff.md](docs/handoff.md), 저장소 지도는 [CLAUDE.md](CLAUDE.md), 배포 절차는 [docs/deploy.md](docs/deploy.md).

2026-10-23: Search Console 상품 구조화 데이터 개선을 커밋 `cec5579`로 푸시·운영 배포했다. 공개 상품 15개 HTML 및 Chrome 390·1280px 운영 화면 검증 통과. 실제 후기 데이터가 없어 review·aggregateRating을 만들지 않는다. Google 재수집·Search Console 경고 해소 판정은 대기이며, category의 메일 경고 원인은 영향 URL과 Google 재검사 전 미확정이다.

관련 검사: `node --test scripts/product-seo.test.mjs`, `npx wrangler pages functions build --outdir /tmp/cham-functions-check`.
로컬 개발: `npm ci`, `npm run dev`. 환경변수 이름·안전한 예시는 `.dev.vars.example`이며 실제 `.dev.vars`는 Git 제외 대상이다.
