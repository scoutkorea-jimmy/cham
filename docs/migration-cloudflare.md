# Cloudflare Pages 이전 계획 — 서버 인증 · 서버 데이터

정적(GitHub Pages · localStorage) → Cloudflare Pages Functions + D1 + R2.

이전 이유는 두 가지다.

1. **인증** — 지금은 `site.js` 안에서 SHA-256 해시를 비교한다. 자격증명이 공개 소스에 있고,
   브라우저 개발자도구로 우회할 수 있다. 계정을 여러 개 두어도 클라이언트 검증인 한 보안이 아니다.
2. **데이터** — 주문·신청·문의의 고객 이름·전화·주소가 localStorage 에 평문으로 있다.
   그 컴퓨터를 만질 수 있으면 **로그인 없이** 읽힌다. 동시에 기기를 바꾸거나 캐시를 지우면 사라진다.
   즉 지금 구조는 보안과 보존이 동시에 취약하다.

기준 구현은 같은 저자의 `gilwell-media` 다 — PBKDF2 비밀번호 해시, HMAC 세션 토큰,
HttpOnly 쿠키, `admin_users` 역할/상태. 새로 설계하지 않고 그 관례를 따른다.
단 조합 규모에 맞춰 Turnstile · TOTP · 권한 프리셋 · 감사로그는 넣지 않는다(필요해지면 그때).

---

## 단계

| 단계 | 내용 | 기존 사이트 영향 |
|---|---|---|
| **1. 서버 인증 · 계정** | wrangler · D1 스키마 · `functions/_shared/auth.js` · 로그인/세션/계정 API · admin·manual 서버 차단 · 관리자 콘솔 '계정 관리' | 없음 — 로컬 `wrangler pages dev` 에서만 동작. 배포 전까지 현행 사이트 그대로 |
| **2. 데이터 이전** | 주문·신청·문의·상품·게시글·설정·기수·팝업·파트너·동의문 D1 이전, 이미지 R2 이전. 기존 **백업 JSON** 을 그대로 넣는 가져오기 스크립트 | 클라이언트 스토어를 async 로 교체 — 큰 변경 |
| **3. 배포 전환** | 파일을 `public/` 로 옮겨 배포 대상 분리, Cloudflare Pages 연결, GitHub Pages 중단 | **외부 공개 경로 변경 — 반드시 사전 확인** |
| **4. 정리** | 도메인 확정 후 SEO 파일 절대 URL, 샘플 데이터 제거, 매뉴얼 '자료 백업' 절 재작성 | 매뉴얼 개정 |

각 단계는 앞 단계가 검증된 뒤에만 시작한다. 3단계는 되돌리기 어려우므로 별도 승인을 받는다.

---

## 1단계 — 서버 인증 · 계정

### 왜 이 순서인가
데이터를 옮기려면 "누가 접근하는가"가 먼저 정해져야 한다. 인증이 없는 상태로 API 를 열면
그 순간부터 고객정보가 인터넷에 노출된다.

### 구성

```
wrangler.toml                 Pages 설정 · D1(DB) · R2(MEDIA) 바인딩
.dev.vars.example             로컬 개발 비밀값 서식 (.dev.vars 는 커밋하지 않음)
db/0001_auth.sql              admin_users · admin_login_attempts
functions/
  _shared/auth.js             토큰 생성·검증 · PBKDF2 해시 · 세션 쿠키
  _shared/admin-users.js      계정 조회 · 정규화
  _shared/http.js             json() 응답 · 공용 오류 형태
  _middleware.js              admin.html · manual.html 서버 차단
  api/admin/
    login.js                  POST 로그인 → HttpOnly 쿠키
    logout.js                 POST 로그아웃 (쿠키 만료)
    session.js                GET 현재 세션 확인
    password.js               POST 본인 비밀번호 변경
    users/index.js            GET 목록 · POST 생성      (owner 전용)
    users/[id].js             PATCH 수정 · DELETE 비활성 (owner 전용)
```

### 계정 모델

- `owner` — 전체 권한. 계정을 만들고 지운다.
- `staff` — 일상 운영(주문·신청·문의·게시글). 계정 관리와 설정은 못 한다.

첫 로그인은 `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_PASSWORD` 시크릿으로 들어가고,
그 순간 `admin_users` 에 owner 행이 생성된다(lazy bootstrap). 생성된 계정은
`must_change_password=1` 이라 첫 로그인 직후 비밀번호를 바꿔야 한다.

### 보안 기준

- 비밀번호는 **PBKDF2-SHA256** 로 해시해 저장한다. 평문·단순 SHA-256 을 쓰지 않는다.
- 세션은 **HttpOnly · Secure · SameSite=Lax 쿠키**. JS 에서 토큰을 읽지 못한다.
- 실패는 **IP 단위 지수 백오프**(3회까지 무제한 → 60s → 120s → …, 상한 24h, 72h 무시도 시 초기화).
- 오류 응답은 **모두 같은 문구**. 비밀번호 오류·비활성 계정·권한 없음을 구분해 알려주지 않는다.
- 비밀번호를 바꾸면 `token_min_iat` 이 올라가 **기존 세션이 모두 끊긴다**.

### 검증 방법

```bash
npm install
npx wrangler d1 execute cham-db --local --file=db/0001_auth.sql
npx wrangler pages dev            # http://localhost:8788
```

`.dev.vars` 에 `ADMIN_SECRET` · `ADMIN_BOOTSTRAP_USER` · `ADMIN_BOOTSTRAP_PASSWORD` 를 넣는다.

---

## 2단계 — 데이터 이전 (설계 메모)

### 표

구조가 깊은 값(상품의 `option`·`gosi`·`related`, 게시글 `html`)은 정규화하지 않고 **JSON 열**에 둔다.
클라이언트가 지금 쓰는 객체 모양을 그대로 유지해 이전 위험을 줄이기 위해서다.
검색·집계에 쓰는 값(상태·날짜·금액)만 열로 뽑는다.

```
orders(id, order_no, kind, status, name, phone, email, address, product_id,
       product_name, option_label, qty, unit_price, total, depositor, pay_method,
       ship_method, courier, tracking, cancel_reason, rma_reason, pickup_addr,
       payload JSON, created_at, updated_at)
applications(id, name, phone, region, course, memo, status, admin_memo, handled_at, created_at)
inquiries(id, name, phone, type, memo, status, admin_memo, handled_at, created_at)
products(id, name, cat, price, sale_price, unit, status, stock, summary,
         price_on_request, doc JSON, created_at, updated_at)
posts(id, cat, title, html, badge, important, pinned, created_at, updated_at)
post_files(id, post_id, name, size, r2_key, created_at)
cohorts / partners / popups / consents / settings / kms_docs
page_images(slot_id, r2_key, pcx, pcy, mbx, mby, updated_at)
visits(day, pv, uv) / visit_sources(kind, n)
```

이미지는 R2(`MEDIA`)에 두고 D1 에는 키만 저장한다. localStorage 5MB 한계가 사라진다.

### 이전 절차

관리자 **데이터 백업**이 뽑는 JSON 이 이미 localStorage 전체 + IndexedDB blob(dataURL)을 담고 있다.
이 파일을 그대로 먹는 일회성 가져오기 엔드포인트를 만들어 옮긴다 — 손으로 옮길 것이 없다.

### 클라이언트 변경

`getJSON`/`setJSON`/`idb.*` 가 전부 **동기**다. 이걸 async fetch 로 바꾸면
`site.js` · `admin.js` · `shop.js` · `board.js` 의 호출부가 전부 영향을 받는다.
같은 이름의 async 어댑터(`Store.getOrders()` …)를 먼저 만들고 화면 단위로 옮긴다.
**한 번에 다 바꾸지 않는다.**

---

## 3단계 — 배포 전환 (승인 필요)

- 배포 대상만 `public/` 으로 옮긴다. 지금 `pages_build_output_dir = "."` 이라
  `rules/` · `CLAUDE.md` · `docs/` 까지 배포에 포함된다 — 이전과 함께 정리한다.
- GitHub Pages 와 Cloudflare Pages 를 잠시 병행한 뒤 전환한다.
- 도메인이 확정되면 그때 DNS 를 붙인다.

---

## 하지 않기로 한 것

- **Turnstile · TOTP** — 운영자가 1~3명이고 로그인 빈도가 낮다. 백오프와 강한 비밀번호로 충분하다.
  공개 로그인 시도가 실제로 관측되면 그때 넣는다.
- **권한 프리셋** — 역할 두 개(owner·staff)로 충분하다. 세분화는 사람이 늘면 한다.
- **감사 로그(operational_events)** — 2단계에서 주문 상태 변경 이력과 함께 설계한다.
