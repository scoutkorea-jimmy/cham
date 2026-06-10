# 한국참전통발효식품협동조합 — 홈페이지

전통 발효식품의 보급·교육·판매를 위한 협동조합 공식 홈페이지입니다.
순수 **HTML · CSS · 바닐라 JS** 로 구성되어 별도 빌드 과정 없이 그대로 정적 서버에 배포할 수 있습니다.

---

## 실행 / 배포

빌드 도구가 필요 없습니다. 정적 파일 서버에 올리면 됩니다.

```bash
# 로컬 미리보기 (둘 중 아무거나)
npx serve .
python3 -m http.server 8000
```

`index.html` 이 진입점입니다. GitHub Pages / Netlify / Vercel / Nginx 등 어떤 정적 호스팅에도 그대로 배포 가능합니다.

> 외부 CDN 의존성: Pretendard·페이북 글꼴, Google Fonts(명조/정자), [Lucide](https://lucide.dev) 아이콘. 폐쇄망 배포 시 로컬 호스팅으로 교체하세요.

---

## 파일 구조

```
/
├─ index.html          메인 (Hero · 파트너 · 핵심가치 · 체험지도사 · 제품 · 소식)
├─ about.html          협동조합 소개 (인사말 · 설립목적 · 비전 · 파트너 정선만장대 · 오시는 길)
├─ ferments.html       전통발효식품 (발효 원리 · 씨장 · 종류 · 5단계 과정 · 장문화)
├─ instructor.html     전통발효식품체험지도사 과정 (커리큘럼 · 혜택 · 일정 · 신청)
├─ products.html       제품 (장류 · 발효식품 · 씨장 분양 · 선물세트)
├─ news.html           소식마당 (공지 · 교육 · 행사 게시판 · 갤러리)
├─ contact.html        문의하기
├─ admin.html          관리자 콘솔
└─ assets/
   ├─ site.css         디자인 시스템 (컬러·타입·컴포넌트 토큰) + 전 컴포넌트 스타일
   ├─ site.js          공통 헤더/푸터 주입, 모달, 파트너·팝업 렌더링
   ├─ admin.js         관리자 콘솔 로직
   ├─ logo.png         로고
   └─ partner-manjangdae-poster.jpg   파트너(정선만장대) 소개 이미지
```

공통 **네비게이션·푸터** 는 `site.js` 가 각 페이지의 `<header id="site-nav">` / `<footer id="site-footer">` 자리에 주입합니다. 메뉴를 바꾸려면 `site.js` 상단의 `NAV` 배열만 수정하세요.

---

## 디자인 시스템 커스터마이즈

모든 색·간격·폰트는 `assets/site.css` 상단 `:root` 의 CSS 변수로 관리됩니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--main` | `#6E8252` | 메인(햇살 들녘 올리브그린) |
| `--sub` | `#E2D9BE` | 서브(오트밀) |
| `--point` | `#B0473A` | 포인트(대추) |
| `--bg` | `#FCFAF3` | 배경 |
| `--font-body` / `--font-head` | PayboocFont | 본문/제목 글꼴 |

배경 단색면의 **전통 칠보문(七寶紋) 패턴** 은 `--pat-dark` / `--pat-light` 변수로 제어하며, `<html class="pat-off">` 또는 `pat-strong` 으로 강도를 조절할 수 있습니다.

---

## 동적 기능 (현재: 프런트엔드 데모)

신청·주문·문의·회원·팝업·파트너 데이터는 **데모용으로 브라우저 `localStorage`** 에 저장됩니다.
실제 운영 시 아래 지점을 **서버 API 로 교체**하세요.

| 기능 | 저장 키 | 발생 위치 |
|---|---|---|
| 체험지도사 신청 | `kach_applications` | 신청 모달 (`site.js` → `submitModal`) |
| 제품 주문 · 씨장 분양 | `kach_orders` | 주문/분양 모달 |
| 문의 | `kach_inquiries` | 문의 모달 |
| 회원 | `kach_members` | 관리자 |
| 파트너(홈 노출) | `kach_partners_v1` | 관리자 ↔ `index.html` 파트너 스트립 |
| 팝업(홈 노출) | `kach_popups_v1` | 관리자 ↔ 홈 첫 화면 팝업 |

- **모달**: `data-modal="apply|order|seedjang|inquiry"` 속성을 가진 버튼이 자동으로 모달을 엽니다. 양식 정의는 `site.js` 의 `MODALS` 객체에 있습니다.
- **백엔드 연동 포인트**: `site.js` 의 `submitModal()`, `admin.js` 의 각 `view*()` 함수에서 `localStorage` 호출을 `fetch()` API 로 바꾸면 됩니다.

---

## 관리자 콘솔 (`admin.html`)

- 푸터 우측 하단 **'관리자'** 링크 또는 `admin.html` 직접 접속.
- 데모 비밀번호: **`manjangdae`** — `assets/admin.js` 상단 `var PW` 에서 변경. (실서비스는 반드시 서버 인증으로 교체)
- 기능: 대시보드 · 상품주문관리 · 참가자신청관리 · 문의내역 · 회원정보관리 · 파트너관리 · 팝업관리.

---

## 교체가 필요한 항목 (플레이스홀더)

- [ ] 제품·교육 현장·갤러리 **실제 사진** (현재 색면 플레이스홀더 `.ph`)
- [ ] 게시판/회원/주문 **샘플 데이터** (`[샘플]` 표기) → 실제 데이터·API
- [ ] 관리자 **인증** → 서버 세션/토큰 방식
- [ ] 신청·주문·문의 **저장·발송** → 백엔드 API

---

© 2026 한국참전통발효식품협동조합
