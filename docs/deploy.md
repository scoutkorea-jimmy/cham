# 배포 절차 — Cloudflare Pages

**현재 상태: 배포 완료** — https://cham-3ef.pages.dev · Git 연결(`scoutkorea-jimmy/cham` main).
아래 1~4는 이미 끝난 절차이며, 다시 만들 때를 위한 기록이다.

| | |
|---|---|
| Pages 프로젝트 | `cham` (Git 연결 · main push 시 자동 배포) |
| D1 | `cham-db` `34892062-1509-430c-baf8-9269aa859ca6` (APAC) |
| R2 | `cham-media` |
| 바인딩 | `DB` → cham-db · `MEDIA` → cham-media (production·preview 모두) |
| 시크릿 | `ADMIN_SECRET` · `ADMIN_BOOTSTRAP_USER` · `ADMIN_BOOTSTRAP_PASSWORD` |
| 옛 주소 | https://scoutkorea-jimmy.github.io/cham/ — 계속 동작, 검색만 차단 |

> 프로젝트는 **Git 연결**이라 `main` 에 push 하면 자동 배포된다.
> 시크릿·바인딩을 바꾸면 **다음 배포부터** 반영된다 — 바꾼 뒤 재배포할 것.

---

## 배포하며 걸렸던 것 (다시 겪지 않도록)

**PBKDF2 반복 상한.** Workers 의 Web Crypto 는 PBKDF2 를 **100,000 회로 제한**한다.
넘기면 `deriveBits` 가 예외를 던지는데, **로컬 `wrangler pages dev` 는 강제하지 않아**
개발 중에는 멀쩡하고 운영에서만 로그인이 깨진다(부트스트랩은 조용한 401, 기존 계정은 500/1101).

**서버의 `null` 과 기본값.** `/api/bootstrap` 은 '한 번도 저장한 적 없음'을 `null` 로 답한다.
빈 DB 로 처음 배포하면 기수·파트너·팝업이 모두 null 이라, 이걸 그대로 화면에 넘기면
`.length` 에서 죽는다. 로컬에 데이터가 있으면 드러나지 않는다.

→ **빈 DB 로 한 번 배포해서 관리자 화면까지 열어 보는 것**이 두 문제를 모두 잡는 방법이다.

---

## 1. 저장소 만들기 (최초 1회)

```bash
npx wrangler login

npx wrangler d1 create cham-db
#  → 출력된 database_id 를 wrangler.toml 의 REPLACE_WITH_D1_DATABASE_ID 자리에 넣는다

npx wrangler r2 bucket create cham-media
```

스키마를 운영 D1 에 적용한다.

```bash
npx wrangler d1 execute cham-db --remote --file=db/0001_auth.sql
npx wrangler d1 execute cham-db --remote --file=db/0002_data.sql
```

## 2. 시크릿

Cloudflare 대시보드 > Workers & Pages > cham > **Settings > Variables and Secrets** 에
아래 셋을 **Secret** 으로 넣는다(일반 변수로 넣으면 대시보드에 값이 보인다).

| 이름 | 값 |
|---|---|
| `ADMIN_SECRET` | `openssl rand -base64 48` 로 만든 긴 무작위 문자열 |
| `ADMIN_BOOTSTRAP_USER` | 최초 관리자 아이디 (예: `owner`) |
| `ADMIN_BOOTSTRAP_PASSWORD` | 최초 1회용 강한 비밀번호 |

`ADMIN_SECRET` 을 나중에 바꾸면 **모든 로그인이 한꺼번에 끊긴다**(그게 정상 동작이다).

## 3. Pages 프로젝트 연결

대시보드 > Workers & Pages > Create > **Pages** > Connect to Git > 이 저장소 선택.

> CLI 로는 Git 연결 프로젝트를 만들 수 없다(`wrangler pages project create` 는 direct-upload 전용).
> API 로는 된다 — `POST /accounts/{acc}/pages/projects` 에 `source.type = "github"` 과
> `source.config.{owner,repo_name,production_branch}` 를 넣으면 Git 연결로 생성된다.
> (이 프로젝트는 그 방법으로 만들었다.)

| 항목 | 값 |
|---|---|
| Build command | *(비움 — 빌드 단계가 없다)* |
| Build output directory | `.` |
| Production branch | `main` |

Settings > **Bindings** 에서 두 개를 연결한다.

| 종류 | 변수명 | 대상 |
|---|---|---|
| D1 database | `DB` | `cham-db` |
| R2 bucket | `MEDIA` | `cham-media` |

> 바인딩을 빠뜨리면 `/api/*` 가 503 을 돌려주고, 관리자 화면 차단도 동작하지 않는다
> (설정 누락으로 운영자가 자기 사이트에서 잠기는 것을 막으려고 그렇게 열어 두었다).
> **배포 직후 반드시 4번 확인을 거칠 것.**

## 4. 배포 후 확인

```bash
curl -s https://<프로젝트>.pages.dev/api/bootstrap | head -c 120
#  → {"products":[], ...}   (HTML 이 나오면 Functions 가 안 붙은 것)

curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<프로젝트>.pages.dev/admin.html
#  → 302 .../login.html?next=%2Fadmin.html
```

브라우저에서:

1. `/login.html` 에서 `ADMIN_BOOTSTRAP_*` 로 로그인 → **비밀번호 변경 화면**이 나오는지
2. 바꾼 뒤 `/admin.html` 이 열리는지
3. 관리자 > **데이터 백업 > 백업 파일 선택** 으로 기존 사이트의 백업 JSON 을 넣기
   → 주문·상품·게시글·사진이 올라오는지
4. 공개 페이지에서 상품 목록과 사진이 보이는지

## 5. 기존 사이트 정리

여기까지 정상이면 GitHub Pages 를 내린다 (저장소 Settings > Pages > Source: None).

그다음 **하나로 합치는 정리**를 한다 — 지금은 두 호스팅을 모두 지원하느라 코드가 갈라져 있다.

- `assets/site.js` 의 로컬 어댑터(localStorage·IndexedDB 경로)와 `SERVER` 분기 제거
- `assets/site.js` 의 `verifyLogin` / `requireAdmin` 모달(클라이언트 인증) 제거
- `manual.html` 의 클라이언트 게이트 폴백 제거 (서버 미들웨어가 이미 막는다)
- `assets/admin.js` 의 `migrate()` · `seed()` · 로컬 로그인 게이트 제거
- 배포 대상을 `public/` 으로 옮기고 `pages_build_output_dir = "public"` 으로 바꾸기
  (지금은 `rules/` · `docs/` · `db/` 까지 배포에 섞인다 — 비밀은 없지만 정돈되지 않았다)

## 6. 도메인 연결

Pages 프로젝트 > Custom domains > 도메인 추가 → 안내되는 DNS 레코드 등록.

`robots.txt` 와 `sitemap.xml` 은 **손볼 것이 없다** — Functions 가 요청 호스트로 주소를
만들기 때문에 도메인을 붙이는 즉시 맞는다. `llms.txt` 의 주소만 한 번 바꾸면 된다.

## 검색 노출 — 옛 주소와 새 주소

두 주소에 같은 내용이 있으면 검색엔진이 원본을 못 정해 **양쪽 순위가 함께 내려간다**.
그래서 옛 주소(GitHub Pages)만 닫아 두었다.

| | 파일 | 내용 |
|---|---|---|
| 옛 주소 | 정적 `robots.txt` | `Disallow: /` — 통째로 색인 제외 |
| 새 주소 | `functions/robots.txt.js` | 정상 허용. Functions 가 정적 파일보다 먼저 응답한다 |

옛 주소를 완전히 닫을 때는 저장소 Settings > Pages > Source 를 **None** 으로 바꾼다.

---

## 되돌리기

배포 후 문제가 생기면 **GitHub Pages 를 다시 켜면** 된다 — 코드가 서버 없이도 돌아가므로
그 시점의 브라우저 저장소 데이터로 종전처럼 동작한다.
단 **서버에 쌓인 주문은 그쪽에 남아 있으므로**, 되돌리기 전에 관리자 > 데이터 백업으로
서버 자료를 내려받아 두어야 한다.
