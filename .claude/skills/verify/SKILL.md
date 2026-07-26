---
name: verify
description: cham(한국참전통발효식품협동조합) 변경을 실제 브라우저로 검증하는 방법 — 여백·리듬 전수 검사 도구 포함
---

# cham 검증 레시피

빌드 없는 HTML/CSS/바닐라 JS + Cloudflare Pages Functions. Playwright(Python)로 실제 화면을 구동해 확인한다.

**운영에서 확인한다.** 로컬 workerd 는 Workers 의 제한을 강제하지 않아, 로컬만 통과하고
운영에서 죽은 적이 있다(PBKDF2 100,000회 제한). 배포 절차는 [docs/handoff.md](../../../docs/handoff.md) 참조.

## 준비

```bash
cd /Users/jimmy_macmini/Desktop/VS_Code/cham
python3 -m venv venv && ./venv/bin/pip install playwright && ./venv/bin/python -m playwright install chromium
python3 -m http.server 8777 --bind 127.0.0.1      # 로컬로 볼 때만
```

## 관리자 진입 (서버 세션)

클라이언트 게이트가 아니라 **서버 세션**이다. `admin.html` 로 가면 `_middleware.js` 가
로그인하지 않은 요청을 `login.html` 로 돌린다.

```python
a.goto(B + "/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(1500)
if "/login" in a.url:
    a.fill("#lgId", "admin"); a.fill("#lgPw", "admin")
    a.click("#lgBtn"); a.wait_for_timeout(3500)
a.wait_for_selector("#adminApp", state="visible", timeout=20000)
```

화면 이동은 라벨이 아니라 **`data-nav` / `data-navgroup`** 으로 누른다(라벨은 바뀐다).
그룹 하위 메뉴는 접혀 있을 수 있으므로 `.nav-gh` 를 먼저 펼친다.

```python
a.evaluate("""(id)=>{const g=document.querySelector(`[data-navgroup="${id}"]`);
  if(g){g.click();return;} const b=document.querySelector(`[data-nav="${id}"]`);
  if(b)b.click(); else{[...document.querySelectorAll('.nav-gh')].forEach(x=>x.click());
    setTimeout(()=>{const c=document.querySelector(`[data-nav="${id}"]`);if(c)c.click();},60);}}""", nav)
```

`삭제 / 내리기` 는 `confirm()` 을 쓴다 → `page.on("dialog", d: d.accept())` 를 먼저 건다.

## 전수 검사 도구 — [tools/](tools/)

| 실행 | 보는 것 |
|---|---|
| `./venv/bin/python .claude/skills/verify/tools/edge_padding.py` | 색·테두리 상자 안에서 **글이 모서리에 붙은 곳** (공개 12 + 관리자 24화면 × 2폭) |
| `./venv/bin/python .claude/skills/verify/tools/rhythm_public.py` | 공개 페이지 블록 간격이 허용 값인가 |
| `./venv/bin/python .claude/skills/verify/tools/rhythm_admin.py` | 관리자 화면 최상위 블록 간격 + 빈 화면·콘솔 오류 |

## 재는 도구가 먼저 틀린다

이 검사들은 **처음 만들었을 때 거짓을 무더기로 냈다.** 같은 함정에 다시 빠지지 않도록 적어 둔다.

1. **요소의 상자가 아니라 글자를 재라.**
   `.wrap` · `th` · `dt` · `tr` 은 폭을 꽉 채우고 여백을 자기 `padding` 으로 만든다 →
   상자를 재면 늘 "0px, 모서리에 붙음"이 된다. `Range.selectNodeContents()` 로
   **글자가 실제로 그려진 자리**를 재면 이 거짓이 전부 사라진다(73건 → 1건).
2. **한 변짜리 테두리는 상자가 아니라 구분선이다.**
   `.footer-bottom`(border-top) · `.facts dt`(border-bottom) · `.pd-opts`(border-top) 를
   상자로 세면 "안쪽 여백 없음"이 22건 잡히는데 전부 거짓이다.
   → 배경색이 있거나 **테두리가 3면 이상**일 때만 '감싸는 상자'로 본다.
3. **`.reveal` 은 등장 전 `translateY` 상태다.** `.in` 만 붙이면 *전환 중*이라 중간값이 잡힌다.
   → `*{transition:none!important;animation:none!important}` 을 넣어 즉시 착지시킨다.
4. **허용 간격은 5개 고정이 아니다.** `--gap-group` 은 `clamp(28px,3.4vw,44px)`,
   `--gap-sub` 은 `clamp(40px,5vw,64px)` — **390px 에서는 28 · 40px 이 정상**이다.
   `getPropertyValue()` 는 `clamp(...)` 문자열이라 `parseFloat` 로는 `NaN` 이 된다
   → 빈 요소에 물려 계산된 px 을 받아온다.
5. **가로 스크롤·잘림 상자 안은 넘쳐도 정상이다.** 마키·지도 타일·가로 스크롤 표까지
   잡으면 진짜 문제가 묻힌다 → 조상에 `overflow: auto|scroll|hidden` 이 있으면 건너뛴다.
6. **배포 직후 검증은 옛 코드를 볼 수 있다.** 배포 성공 뒤에도 잠깐은 이전 자산이 온다 —
   고친 것이 안 고쳐진 것처럼 보이면 **한 번 더 돌려** 확인한다.

## 최소 확인

**390px · 1280px** 두 폭 / 가로 스크롤 0건 / 표의 마지막 열이 화면 안에 있을 것 /
블록 간격이 허용 값(8 · 16 · 24 · `--gap-group` · `--gap-sub`)을 벗어나지 않을 것.

**숫자만 보지 말고 화면을 본다.** 절 수·앵커·넘침이 모두 정상인데 화면이 통째로
비어 있던 적이 있다(`.reveal` 이 해제되지 않아 투명하게 남았다).

**검증하며 만든 데이터는 지운다.** 시험 주문이 매출로 잡힌다.
관리자 화면과 `login.html` 은 방문 집계에서 빠져 있어 그쪽 검증은 안전하다.
