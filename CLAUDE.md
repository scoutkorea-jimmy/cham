# CLAUDE.md — 저장소 지도

한국참전통발효식품협동조합 공식 홈페이지. **순수 HTML · CSS · 바닐라 JS**, 빌드 도구 없음.
Cloudflare Pages(Functions + D1 + R2)로 이전 중이며, 배포 전까지 GitHub Pages 에서도
그대로 돌아갑니다 — 아래 '저장소 — 지금은 두 모드' 참조.

이 문서는 **지도**입니다. 상세 규칙은 [`rules/`](rules/) 에 있습니다.

---

## 저장소 구조

```
index.html          홈
about.html          협동조합 소개        ferments.html   전통발효식품
vinegar.html        식초(서련 瑞蓮)      nuruk.html      누룩이야기
instructor.html     체험지도사 과정      products.html   제품 목록
product.html        상품 상세(?id=)      news.html       소식마당
contact.html        문의                admin.html      관리자 콘솔
login.html          관리자 로그인 — 서버 세션(functions/api/admin/login)

functions/          Cloudflare Pages Functions. 정적 호스팅에서는 동작하지 않는다
  _shared/auth.js     세션 토큰(HMAC) · PBKDF2 비밀번호 · 쿠키
  _shared/store.js    D1 ↔ 클라이언트 객체 변환 (읽기 API·가져오기가 공유)
  _middleware.js      admin.html · manual.html 서버 차단 → login.html
  api/bootstrap.js    공개 페이지가 첫 렌더 전에 받는 묶음(상품·소식·설정·이미지)
  api/submit.js       주문·신청·문의 접수 — 주문번호와 금액을 서버가 정한다
  api/order-lookup.js 비회원 주문 조회 (서버 대조)
  api/images/…        R2 이미지 서빙·목록
  api/admin/…         login · logout · session · password · users · data · images · import · export
db/0001_auth.sql    admin_users · admin_login_attempts
db/0002_data.sql    orders · applications · inquiries · products · posts · collections ·
                    documents · images · visits
wrangler.toml       Pages 설정 · D1(DB) · R2(MEDIA) 바인딩
docs/migration-cloudflare.md   서버 이전 계획 — 단계·스키마
docs/deploy.md      배포 절차 — Cloudflare 설정 · 확인 · 정리 · 되돌리기
docs/handoff.md     **요청 추적** — 받은 요청·상태·검증 도구. 작업 시작 전에 여기부터 본다
terms.html / privacy.html                robots.txt / sitemap.xml / llms.txt

assets/
  site.css   디자인 시스템 + 전 컴포넌트 스타일 (모든 색·간격·글꼴 토큰의 원본)
  site.js    공통 셸(내비/푸터 주입) · 모달 · 스토어 · 비회원 주문 · 동의 게이팅 · reveal
  shop.js    제품 목록 · 상품 상세     board.js  게시판(Tiptap) · 첨부 · 갤러리
  admin.js   관리자 콘솔 로직          jump.js   긴 페이지 목차 바
  manual.html 사용 설명서 본문 — 관리자 콘솔 '사용 설명서' 메뉴가 읽어 표시(단일 원본)
  *.jpg      실사 사진                 logo.png

rules/       규칙집 (아래 참조)
Basic_Infomation/   고객사 원본 자료(pptx·jpg) — 콘텐츠 근거. 편집하지 않음
.claude/skills/verify/   브라우저 검증 레시피
```

내비게이션·푸터는 `site.js` 가 각 페이지의 `<header id="site-nav">` / `<footer id="site-footer">`
자리에 주입합니다. 메뉴는 `site.js` 상단 `NAV` 배열에서 고칩니다.

## 규칙집 — 무엇을 할 때 무엇을 읽는가

| 상황 | 문서 |
|---|---|
| **모든 작업 시작 전** | [docs/handoff.md](docs/handoff.md) — 받은 요청과 상태. 새 요청은 여기 먼저 적는다 |
| 작업 절차 | [rules/workflow.md](rules/workflow.md) — 외부 변경 감지 · 조사 · 계획 · 검증 · 보고 |
| 코드를 쓰거나 고칠 때 | [rules/code-quality.md](rules/code-quality.md) — 중복 · 책임 분리 · 타입 · 오류 · 네이밍 |
| 색 · 글꼴 · 그림자 · 모션 | [rules/design-tokens.md](rules/design-tokens.md) |
| 여백 · 간격 · 리듬 | [rules/spacing-rhythm.md](rules/spacing-rhythm.md) |
| 애니메이션 · 인터랙션 | [rules/motion.md](rules/motion.md) |
| 모바일 · 브레이크포인트 | [rules/responsive.md](rules/responsive.md) |
| 버튼 · 카드 · 표 · 섹션 형태 | [rules/components.md](rules/components.md) |

---

## 절대 규칙

1. **편집 전에 현재 코드를 확인한다.** 여러 사람과 AI 도구가 같은 저장소를 고칩니다.
   이전 이해가 아직 유효하다고 가정하지 않습니다.
2. **다른 사람의 변경을 말없이 덮어쓰거나 되돌리지 않는다.** 동작·구조·데이터·의존성에
   영향을 주는 외부 변경을 발견하면 멈추고 보고합니다 → [workflow.md](rules/workflow.md) 1절
3. **나쁜 구조를 확장하지 않는다.** "기존이 이래서 따랐다"는 이유가 되지 않습니다.
4. **중복은 결함이다.** 새로 만들기 전에 같은 역할의 기존 구현을 찾습니다.
5. **증상을 패치하지 않는다.** 하드코딩된 예외, 예외 삼키기, 우회 경로를 만들지 않습니다.
6. **오류·타입·린트를 숨기지 않는다.** `any` · `@ts-ignore` · 빈 catch 금지.
7. **값을 하드코딩하지 않는다.** 색·간격·글꼴은 `site.css` 의 `:root` 토큰만 씁니다.
   HTML에 인라인 `margin` 을 쓰지 않습니다 — 미디어쿼리를 이겨 반응형을 막습니다.
8. **범위를 넘지 않는다.** 요청하지 않은 재디자인·이름변경·의존성 업그레이드를 하지 않습니다.
9. **작은 수정에 파일 전체를 다시 쓰지 않는다.**
10. **하지 않은 테스트를 했다고 하지 않는다.** 검증하지 못했으면 그 사실을 밝힙니다.
11. **`new` · `v2` · `final` · `copy` · `temp` 같은 이름을 쓰지 않는다.**

## 멈추고 물어봐야 하는 때

타인의 변경과 충돌 · 같은 기능의 구현이 둘 · 데이터 손실 가능 · 인증/인가 동작 변경 ·
공개 API 계약 파손 · 주요 의존성 교체 · 광범위한 구조 재작성 필요

멈출 때는 막연히 묻지 말고 **구체적인 충돌과 선택지**를 제시합니다.

## 판단이 갈릴 때의 우선순위

사용자 데이터·기존 동작 보호 → 외부 변경 보존 → 명시적 요구사항 충족 → 단일 원본 유지 →
아키텍처 일관성 → 중복 제거 → 책임 분리 → 타입 안전성 → 테스트 가능성 →
최소한의 올바른 변경 범위 → 컨텍스트 절약 → 구현 속도

**속도는 구조적 부채를 만들 이유가 되지 않습니다.**

---

## 검증

정적 사이트라 실제 브라우저 구동이 주 검증 수단입니다.

```bash
python3 -m http.server 8777 --bind 127.0.0.1     # 서버
./venv/bin/python <script>.py                     # Playwright (venv에 설치돼 있음)
```

최소 확인: **390px · 1280px** 두 폭 / 가로 스크롤 0건 / 표의 마지막 열이 화면 안에 있을 것 /
간격이 허용 값(8 · 16 · 24 · 44 · 64px)을 벗어나지 않을 것.
자세한 절차는 [.claude/skills/verify](.claude/skills/verify/SKILL.md) 와
[rules/responsive.md](rules/responsive.md) 4절.

## 운영 전 남은 항목

무통장입금 실제 계좌번호(**관리자 > 설정**에서 입력 — 기본값은 placeholder) ·
도메인 연결 · 약관·개인정보처리방침 법무 검토 ·
GitHub Pages 병행 종료 후 로컬 어댑터 정리([docs/deploy.md](docs/deploy.md) 5절)

완료: 서버 인증(계정별 로그인 · owner/staff 권한 · 실패 시 잠금) ·
데이터 D1/R2 이전 · Cloudflare Pages 배포(https://cham-3ef.pages.dev · main push 시 자동) ·
예시 데이터 제거(코드·운영 DB 모두)

> 운영 정보(계좌·연락처·사업자정보·약도 좌표)는 `site.js` 의 `SETTINGS_DEFAULTS` 가 기본값이고,
> **관리자 > 설정**에서 덮어씁니다. 반영: 전 페이지 푸터·결제 안내·모바일 메뉴·약도.

## 저장소 — 지금은 두 모드

Cloudflare Pages 이전 중이라 `site.js` 가 부팅 때 `/api/bootstrap` 을 불러 모드를 정합니다.

| | 서버 모드 (Cloudflare) | 로컬 모드 (GitHub Pages) |
|---|---|---|
| 데이터 | D1 | localStorage `kach_*` |
| 이미지 | R2 | IndexedDB `kach_db` |
| 관리자 인증 | 서버 세션 쿠키 + 계정별 권한 | `site.js` 안의 해시 비교 |

**읽기는 동기 그대로**입니다 — 서버 모드는 부팅 때 받은 값을 메모리에서 읽으므로
`getProducts()` 같은 기존 호출부가 바뀌지 않습니다. 쓰기는 낙관적(메모리 먼저, 저장은 뒤에서)입니다.
이미지는 `Site.Media` 로 감싸 화면 코드가 항상 `rec.url` 만 씁니다.

배포가 끝나면 로컬 모드를 **지웁니다** → [docs/deploy.md](docs/deploy.md) 5절.
