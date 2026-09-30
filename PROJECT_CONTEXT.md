# cham 프로젝트 맥락

- 목적: 한국참전통발효식품협동조합 홈페이지.
- 기술: 정적 HTML/CSS/JS, Cloudflare Pages Functions, D1, private R2, Wrangler 4.
- 현재 상태: 운영 중. JSON 백업은 첫 bootstrap 요청으로 매일 생성, 30일 보관.
  2026-09-30 실제 최신 파일과 D1 성공 표식 확인, 격리된 SQLite 복원·전체 행 비교·무결성 통과. Actions SQL 백업은 Secrets 누락으로 47회 실패.
- 이번 변경: SQL 업로드 후 R2 다운로드·바이트 비교, 운영자 설정 절차와 회귀 검사.
- 다음 작업: 승인된 운영자가 GitHub Secrets 직접 입력 후 Actions 1회 실행·검증.
- 주의: main push는 production 자동 배포. 이번 작업은 draft PR만, merge/배포/DB 복원 금지.
- 원본/작업 복사본: Mac mini Desktop/VS_Code/cham / Codex 2026-09-30/task-2/cham-review.
- 시작 문서: CLAUDE.md, docs/handoff.md, docs/deploy.md.
