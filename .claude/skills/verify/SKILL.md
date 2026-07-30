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
(cd public && python3 -m http.server 8777 --bind 127.0.0.1)   # 로컬로 볼 때만 (public/ 안에서)
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
| `./venv/bin/python .claude/skills/verify/tools/word_break.py` | **한글이 어절 단위로 꺾이는가** — `word-break` 를 덮어쓴 선택자를 찾는다 |
| `./venv/bin/python .claude/skills/verify/tools/rhythm_public.py` | 공개 페이지 블록 간격이 허용 값인가 |
| `./venv/bin/python .claude/skills/verify/tools/rhythm_admin.py` | 관리자 화면 최상위 블록 간격 + 빈 화면·콘솔 오류 |
| `./venv/bin/python .claude/skills/verify/tools/clicks.py` | **클릭이 실제로 먹는가** — 렌더링만 보는 검사로는 못 잡는다 |
| `./venv/bin/python .claude/skills/verify/tools/fixed_overlap.py` | 고정 버튼(챗봇·맨위로)이 눌러야 할 것을 덮는가 |
| `./venv/bin/python .claude/skills/verify/tools/list_scale.py` | 목록 건수 상한 — 몇 건부터 저장이 실패하는가 |
| `./venv/bin/python .claude/skills/verify/tools/concurrent_edit.py` | 두 사람이 동시에 저장하면 앞 사람 작업이 남는가 |
| `./venv/bin/python .claude/skills/verify/tools/data_window.py` | **1년 이전 자료가 살아남는가** — 구조를 건드리면 반드시 돌린다 |
| `./venv/bin/python .claude/skills/verify/tools/payload_size.py` | 시작 적재량·저장 1회 전송량 실측 |

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
6. **그려지는 것과 눌리는 것은 다르다.** 전 화면이 멀쩡히 그려지는데 **모든 클릭이 죽어** 있던
   적이 있다 — 쪽 이동 버튼에 `data-page` 를 썼는데 `<body data-page="admin">` 이 이미 있어서
   `closest('[data-page]')` 가 모든 클릭에서 body 를 잡았다. 렌더링 검사는 이걸 못 잡는다.
   **흔한 속성 이름을 새 선택자로 쓰기 전에 이미 쓰이는지 본다.**
7. **관리자 화면을 자동으로 돌아다닐 때 두 가지를 조심한다.**
   `data-nav` 는 사이드바 말고 대시보드 바로가기에도 붙어 있어 선택자가 여러 개를 잡는다
   → `.admin-nav` 로 좁힌다. 접힌 메뉴도 DOM 에는 남아 있어 `query_selector` 로는 '있다'가
   된다 → **보이는지**를 봐야 한다. 그룹 헤더를 누르면 사이드바가 다시 그려져 DOM 참조가 끊긴다.
8. **배포 직후 검증은 옛 코드를 볼 수 있다.** 배포 성공 뒤에도 잠깐은 이전 자산이 온다 —
   고친 것이 안 고쳐진 것처럼 보이면 **한 번 더 돌려** 확인한다.
9. **`curl` 로 `.html` 을 확인할 때는 반드시 `-L` 을 붙인다.** Pages 가 `/products.html` 을
   **308 로 `/products` 에 넘긴다.** `-L` 이 없으면 본문이 0바이트로 오는데, `grep -c` 는
   조용히 `0` 을 돌려준다 — **"안 바뀌었다"가 아니라 "아무것도 안 읽었다"** 이다.
   실제로 이것 때문에 배포가 반영됐는데도 반영이 안 된 줄 알고 5분을 헤맸다.
   `grep -c` 로 없음을 확인할 때는 **있어야 할 것도 함께 세어** 도구가 살아 있는지 본다.

## 최소 확인

**390px · 1280px** 두 폭 / 가로 스크롤 0건 / 표의 마지막 열이 화면 안에 있을 것 /
블록 간격이 허용 값(8 · 16 · 24 · `--gap-group` · `--gap-sub`)을 벗어나지 않을 것.

**숫자만 보지 말고 화면을 본다.** 절 수·앵커·넘침이 모두 정상인데 화면이 통째로
비어 있던 적이 있다(`.reveal` 이 해제되지 않아 투명하게 남았다).

**검증하며 만든 데이터는 지운다.** 시험 주문이 매출로 잡힌다.
관리자 화면과 `login.html` 은 방문 집계에서 빠져 있어 그쪽 검증은 안전하다.
