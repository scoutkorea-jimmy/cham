# 디자인 토큰

모든 값은 `assets/site.css` 의 `:root` 에 정의됩니다. **HTML·CSS에 색상값이나 글꼴 크기를 직접 쓰지 않습니다.**

---

## 1. 컬러 — KB금융그룹 톤앤매너 + 전통 발효 보조색

| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` / `--surface` | `#FFFFFF` | 지면 · 카드 |
| `--surface-2` | `#F5F3EF` | 인셋 · 흐린 블록 |
| `--main` / `-deep` / `-deeper` / `-tint` | `#60584C` / `#4B443A` / `#33302A` / `#F2F0EB` | KB 그레이 — 구조 · 내비 · 푸터 |
| `--point` / `-deep` / `-tint` / `-ink` | `#FFBC00` / `#EBA900` / `#FFF3D2` / `#33302A` | KB 옐로우 — CTA · 강조 |
| `--olive` / `-deep` / `-tint` | `#6E8252` / `#56683E` / `#EDF0E4` | 올리브 — 발효 · 자연 |
| `--sub` / `-soft` / `-deep` | `#E2D9BE` / `#F0EBD7` / `#CFC49E` | 오트밀 — 서브 면 · 태그 |
| `--ink` / `-soft` / `-mute` / `-faint` | `#2A2723` / `#5C564C` / `#706859` / `#B4AD9E` | 텍스트 위계 |
| `--ok` / `--warn` / `--danger` / `--info` | `#3E7D4F` / `#C9912F` / `#C0492E` / `#4A6E86` | 시맨틱 |

### 색 사용 규칙

1. **옐로우는 '면' 전용.** 글자색으로 쓰지 않는다 (흰 바탕 대비 1.7:1 — 판독 불가).
2. **옐로우 면 위 글자·아이콘은 `--point-ink`** (대비 9.6:1).
3. **강조 텍스트**(링크·라벨·가격)는 `--olive-deep` 또는 `--ink`. 필수표시(`*`)만 `--danger`.
4. **포인트는 CTA·강조 한정.** 대면적 사용 금지.
5. **어두운 패널**(`.band-deep` / `.page-hero.deep`) 위 `.eyebrow` 는 옐로우로 반전한다
   (올리브는 어두운 면에서 2.2:1 — 판독 불가).

## 2. 타이포그래피

글꼴: **PayboocFont**(BC카드 페이북) → Pretendard Variable 폴백 / 보조 손글씨 `Gaegu`

| 토큰 | 값 |
|---|---|
| `--fs-display` | `clamp(40px, 5.6vw, 76px)` |
| `--fs-h1` | `clamp(32px, 3.6vw, 48px)` |
| `--fs-h2` | `clamp(26px, 2.6vw, 36px)` |
| `--fs-h3` | `clamp(21px, 2.1vw, 26px)` |
| `--fs-h4` | `clamp(18px, 1.7vw, 21px)` |
| `--fs-h5` | `18px` |
| `--fs-body-lg` | `clamp(17px, 1.5vw, 19px)` |
| `--fs-body` | `17px` |
| `--fs-sm` | `15px` |
| `--fs-caption` | `14px` |
| `--fs-micro` | `12px` |

- **본문은 일반 사이트보다 한 단계 크다.** 타깃 독자가 30~50대라 40대 이후 가독성을 고려한 값이다. 임의로 줄이지 않는다.
- 행간: `--lh-tight 1.12` / `--lh-snug 1.32` / `--lh-normal 1.72` / `--lh-relaxed 1.9`
- 키커(`.eyebrow`)는 자간 `0.22em` + 대문자
- **한국어 줄바꿈은 어절 단위**(`word-break: keep-all`)를 전역 적용한다.

## 3. 모서리 · 그림자

| 라운드 | 값 |
|---|---|
| `--r-xs` ~ `--r-xl` | 4 / 8 / 12 / 18 / 26px |
| `--r-pill` | `999px` (버튼 · 태그 · 목차 바) |
| `--r-card` | `= --r-lg (18px)` |

그림자는 **y축 오프셋만** 사용: `--sh-xs` ~ `--sh-lg`, CTA 호버 시 `--sh-point`(옐로우 글로우).

## 4. 모션

- 기본 `--dur 240ms` / 빠름 `--dur-fast 150ms`
- 이징 `--ease cubic-bezier(0.22, 0.61, 0.36, 1)`
- `.reveal` — 요소가 처음 보일 때 1회만 등장. 동적 요소는 `revealScan()` 으로 등록
- `prefers-reduced-motion` 을 반드시 존중한다

## 5. 전통 문양

단색 배경면에 **칠보문(七寶紋) 겹원 패턴**을 은은하게 얹는다.
`--pat-dark` / `--pat-light`, 타일 54px. 강도 토글: `html.pat-off` / 기본 / `html.pat-strong`.

## 6. 레이아웃 폭

| 토큰 | 값 |
|---|---|
| `--maxw` | `1200px` |
| `--maxw-narrow` | `880px` (긴 본문·표) |
| `--nav-h` | `132px` (2단 헤더) / 모바일 `80px` |

## 7. 아이콘

**Lucide 단일 패밀리.** 본문 17px · 배지 26px · 캡션 14~16px. 다른 아이콘 세트를 섞지 않는다.
