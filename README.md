# 한국참전통발효식품협동조합 — 홈페이지

전통 발효식품의 교육·판매를 위한 협동조합 공식 홈페이지. **운영 중: https://charmjt.org**

순수 **HTML · CSS · 바닐라 JS**(빌드 도구 없음) + **Cloudflare Pages Functions**(D1 · R2).
`main` 에 push 하면 자동 배포된다.

> 이 저장소의 지도는 **[CLAUDE.md](CLAUDE.md)** 다 — 구조 · 규칙집 · 검증 절차 · 운영 전 남은 항목.
> 작업을 시작하기 전에 **[docs/handoff.md](docs/handoff.md)**(요청 추적)부터 본다.

## 어디에 무엇이 있나

| 자리 | 무엇 |
|---|---|
| `public/` | 배포되는 것 전부 — 페이지 HTML · `assets/`(site.css · site.js · shop.js · admin.js …) |
| `functions/` | Pages Functions — 접수·주문조회·회원·관리자 API · 검색 노출(`_shared/seo.js`) · `robots.txt` · `sitemap.xml` · `rss.xml` · `llms.txt` · 자동 백업 |
| `db/` | D1 스키마(마이그레이션 순서대로) |
| `rules/` | 코드·디자인 규칙집 |
| `docs/` | 배포 절차 · 요청 추적 · 실패 기록부 · 개인정보 처리 기록 |
| `scripts/` | 운영 도구 — 자동 백업 JSON → SQL 복원 |
| `.claude/skills/verify/` | 브라우저 검증 레시피와 전수 검사 도구 |

## 로컬에서 보기 · 검증

```bash
(cd public && python3 -m http.server 8777 --bind 127.0.0.1)   # 화면만 (로컬 모드 — 코드 기본값을 보여 준다)
npx wrangler pages dev public --port 8788                      # 함수까지 (로컬 D1 · R2)
./venv/bin/python .claude/skills/verify/tools/crawler_view.py  # 운영을 크롤러 시점으로 잰다
```

자세한 절차: [.claude/skills/verify/SKILL.md](.claude/skills/verify/SKILL.md) · 배포와 복구: [docs/deploy.md](docs/deploy.md)

## 운영 정보의 원본

계좌 · 연락처 · 사업자 정보 · 검색엔진 인증 코드는 **관리자 > 설정**이 원본이고, `site.js` 의
`SETTINGS_DEFAULTS` 는 저장된 값이 없을 때의 기본값이다. 상품·가격은 관리자 > 상품(D1)이 원본이다 —
HTML 에 값을 손으로 적지 않는다(적으면 반드시 어긋난다 → [docs/failures.md](docs/failures.md)).
