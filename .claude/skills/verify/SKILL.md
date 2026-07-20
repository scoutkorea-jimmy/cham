---
name: verify
description: cham(한국참전통발효식품협동조합 정적 사이트) 변경을 실제 브라우저로 검증하는 방법
---

# cham 검증 레시피

순수 정적 사이트(HTML/CSS/바닐라 JS, 빌드 없음). 서버 띄우고 Playwright(Python)로 실제 화면을 구동해 확인한다.

## 서버

```bash
cd /Users/jimmy/Desktop/VS_Code/cham && python3 -m http.server 8777 --bind 127.0.0.1
```

## Playwright

시스템 python은 PEP 668로 pip 설치 불가 → venv 사용:

```bash
python3 -m venv venv && ./venv/bin/pip install playwright && ./venv/bin/python -m playwright install chromium
```

## 관리자(admin.html) 진입

로그인은 순수 클라이언트 데모 게이트(SHA-256, 상태 미저장). 테스트에서는 페이지 로드 후:

```js
window.Site.verifyLogin = () => Promise.resolve({ok:true})
```

로 스텁하고 `#loginId`/`#loginPw`에 아무 값이나 넣고 submit → `#adminApp` 표시됨.
사이드바 메뉴는 라벨 텍스트로 클릭(예: `text=페이지 이미지`).

## 확인 포인트

- 공개 페이지는 `site.js`가 헤더/푸터 주입 + `renderSlotImages()`로 IndexedDB(`simg`) 이미지 반영.
- 데이터는 전부 localStorage(`kach_*`) + IndexedDB(`kach_db`) — 페이지 간 상태 공유는 same-origin이면 동작.
- 반응형 브레이크포인트: 960px(g-4/g-5 → 2열), 640px(1열).
- `삭제/내리기` 버튼은 `confirm()` 사용 → Playwright `page.on("dialog", d => d.accept())` 필요.
- 관리자 '페이지 이미지'의 미리보기 iframe(`#simgFrame`)은 1280px 렌더 후 scale 축소. iframe 안에서는 방문집계·팝업이 꺼짐(`window.self !== window.top`).
