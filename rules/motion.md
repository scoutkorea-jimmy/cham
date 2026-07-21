# 모션 규칙

목표는 **깔끔하되 적당히 화려함**입니다. 화려함은 개수가 아니라 **타이밍과 절제**에서 나옵니다.

---

## 1. 원칙

1. **모든 모션은 `prefers-reduced-motion: no-preference` 안에서만 켠다.**
   모션을 끈 사용자에게는 정적인 화면이 그대로 보여야 하고, 그 상태에서도 정보가 완전해야 합니다.
2. **`transform` 과 `opacity` 만 애니메이션한다.** `width` · `top` · `background-position` 등은
   레이아웃/페인트를 다시 유발합니다. 배경 사진을 움직여야 하면 `::before` 레이어로 분리해 `transform` 을 씁니다.
3. **한 화면에 주연은 하나.** 같은 화면에서 여러 요소가 동시에 튀지 않게 합니다.
4. **등장은 1회.** 스크롤을 오르내릴 때마다 다시 재생되면 산만해집니다 (`IntersectionObserver` 후 `unobserve`).
5. **정보를 모션에 의존시키지 않는다.** JS가 없거나 실패해도 `.reveal` 요소는 보입니다.
6. **길이 기준** — 미세 인터랙션 150~240ms · 등장 420~820ms · 배경 연출 20초 이상.
   그 사이의 어중간한 1~3초짜리 연출은 기다림으로 느껴집니다.

## 2. 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `--dur-fast` | `150ms` | 색·테두리 등 즉각 반응 |
| `--dur` | `240ms` | 기본 호버·상승 |
| `--dur-slow` | `420ms` | 등장(reveal) |
| `--ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | 기본 — 빠르게 나와 부드럽게 멈춤 |
| `--ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | 사진 줌·배경 드리프트처럼 느린 것 |

## 3. 현재 들어가 있는 연출

| 연출 | 대상 | 구현 |
|---|---|---|
| 등장(fade + rise) | `.reveal` 전체 | `site.js` `revealScan()` + `revealIn` 키프레임. 형제 순서로 60ms 스태거 |
| 방향 지정 등장 | `[data-reveal="left\|right\|scale"]` | 같은 관찰자, 시작 transform만 다름 |
| 히어로 드리프트 | `index` `.hero::before` · `vinegar` `.vin-hero::before` | 26초에 걸쳐 `scale(1.08)→1`. 첫 화면에서만 |
| 숫자 카운트업 | `.t-num` (조합 현황) | `site.js` `initCountUp()`. easeOut 1초. **연도(≥1000)는 제외** |
| 읽기 진행 바 | 페이지 상단 3px | `site.js` `initReadBar()` → `.read-bar` 의 `--p` 갱신 (`scaleX`) |
| 키커 막대 드로잉 | `.eyebrow::before` | 섹션이 등장할 때 좌→우 `scaleX` |
| 공정 레일 | `.rail` (식초 4단계 · 발효 5단계) | 점선이 그어진 뒤 번호 원이 160ms 간격으로 팝인 |
| 사진 줌 | `.card-hover img` · `.pillar img` · `.lineup-item img` | 호버 시 `scale(1.06)`, 필러는 `brightness(0.9)` 동반 |
| CTA 광택 | `.btn-point` | 호버 시 흰 띠가 한 번 지나감 |
| 카드 상승 | `.card-hover` | `translateY(-3px)` + 그림자, 아이콘 배지 `scale(1.08) rotate(-3deg)` |
| 내비 그림자 | `#site-nav .nav.scrolled` | 스크롤 8px 이상에서 그림자·반투명 배경 |
| 파트너 마키 | `.partners-track` | 무한 슬라이드, 호버 시 정지, reduced-motion에서는 줄바꿈 정렬로 대체 |
| 2열 좌우 등장 | `.split > .reveal` 첫/마지막 열 | 좌우 26px에서 모여든다. **861px 이상에서만** — 1열로 접히면 방향이 의미를 잃고 가로 스크롤을 만든다 |
| 서브페이지 히어로 문양 | `.page-hero.deep::before` | 30초에 걸쳐 `scale(1.07)→1`. 홈·식초 히어로와 같은 결 |
| 정보표 순차 등장 | `.facts.reveal .fact` | 행이 위에서부터 60ms 간격으로. 항목이 많아 통째로 뜨면 읽는 순서를 잃는다 |
| 모바일 메뉴 슬라이드 | `.mobile-menu.open .mm-body` | 오른쪽에서 밀려 들어온다 — 햄버거를 누른 방향과 같다 |
| 메뉴 캐럿 회전 | `.nav-item:hover > a i` | 하위 목록이 열리는 방향 |

## 4. 새 연출을 추가하기 전에

- **이 목록에 이미 비슷한 것이 있는지 확인합니다.** 같은 역할의 연출을 두 벌 만들지 않습니다.
- **어떤 정보를 전달하는 연출인지 한 문장으로 말할 수 있어야 합니다.**
  ("섹션이 열린다", "여기까지 읽었다", "이 수치가 쌓인 결과다") 설명이 안 되면 장식일 뿐입니다.
- 스크롤에 반응하는 연출은 `IntersectionObserver` 를 쓰고, `scroll` 이벤트를 직접 쓸 때는
  `requestAnimationFrame` 으로 throttle 합니다 (`initReadBar()` 참고).
- 동적으로 추가되는 요소는 `Site.revealScan(root)` 으로 등록합니다.

## 5. 검증

```
- prefers-reduced-motion: reduce 로 전환 후 전 페이지 확인 — 모션 없이도 완전할 것
- JS를 끈 상태에서 .reveal 요소가 보일 것
- 스크롤 중 프레임 드랍이 없을 것 (transform/opacity 외 속성을 애니메이션하지 않았는지)
- **시작 위치의 transform 이 지면 밖으로 나가 가로 스크롤을 만들지 않을 것**
  (translateX 계열은 전 폭에서 `scrollWidth - innerWidth == 0` 을 실측해 확인한다)
- 모바일에서 배경 드리프트가 발열/배터리 문제를 일으키지 않을 것 — 1회 재생만, 무한 반복 금지
```
