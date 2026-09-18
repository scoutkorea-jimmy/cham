"""등장 연출에 걸려 영영 안 보이는 요소가 있는가 — `.reveal` 회귀 검사.

`.reveal` 은 **등록해야 보인다**. site.js 의 revealScan() 이 IntersectionObserver 에
걸어 주어야 `.in` 이 붙고 opacity 가 1 이 된다(site.css '리치 reveal').
등록되지 않은 `.reveal` 은 화면에 자리는 차지하면서 **투명한 채로 영원히 남는다** —
손님 눈에는 그냥 빈 칸이다. 실제로 상품 상세의 '관련 상품' 이 그렇게 비어 있었다.

부팅 뒤에 innerHTML 로 넣은 요소가 특히 위험하다. 부팅 때 한 번 훑는 revealScan() 은
그때 없던 요소를 알지 못하므로, 넣은 쪽이 revealScan(root) 을 불러야 한다.

페이지를 끝까지 굴린 뒤에도 opacity 가 0 인 `.reveal` 을 찾는다.

  ./venv/bin/python .claude/skills/verify/tools/reveal_stuck.py                        # 운영
  ./venv/bin/python .claude/skills/verify/tools/reveal_stuck.py http://127.0.0.1:8777  # 로컬
"""
import sys
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "https://charmjt.org").rstrip("/")
PAGES = ["/", "/about.html", "/ferments.html", "/vinegar.html", "/nuruk.html",
         "/instructor.html", "/products.html", "/news.html", "/contact.html",
         # 상세는 부팅 뒤에 본문을 통째로 그린다 — 이 검사가 가장 필요한 곳이다
         "/product.html?id=p_vin_pine", "/product.html?id=p_vin_omija",
         "/product.html?id=p_set_vinegar", "/product.html?id=p_doenjang"]

# 자리를 차지하면서 투명한 것만 센다. 접힌 패널·숨긴 칸은 애초에 자리가 없다.
STUCK = r"""() => {
  const out = [];
  document.querySelectorAll('.reveal').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;      // 자리가 없으면 화면 문제가 아니다
    if (el.offsetParent === null) return;          // display:none 안쪽
    if (Number(getComputedStyle(el).opacity) > 0.01) return;
    let path = el.tagName.toLowerCase();
    if (el.id) path += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim())
      path += '.' + el.className.trim().split(/\s+/).join('.');
    const host = el.parentElement;
    out.push({ path, host: host ? (host.id || host.className || host.tagName) : '',
               scanned: el.dataset.revScan === '1',
               text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34) });
  });
  return out;
}"""

bad = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, tag in [(390, "mb"), (1280, "pc")]:
        ctx = br.new_context(viewport={"width": w, "height": 900})
        a = ctx.new_page()
        for path in PAGES:
            a.goto(B + path, wait_until="networkidle")
            a.wait_for_timeout(700)
            # 끝까지 굴려 관찰자를 모두 깨운다 — 그러고도 투명하면 등록되지 않은 것이다
            for _ in range(40):
                a.mouse.wheel(0, 800)
                a.wait_for_timeout(90)
            a.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            a.wait_for_timeout(1200)
            for r in a.evaluate(STUCK):
                bad.append(f"[{tag}:{path}] {r['path']}  안쪽:{r['host']}  "
                           f"등록:{'예' if r['scanned'] else '아니오'}  “{r['text']}”")
        ctx.close()
    br.close()

print(f"\n투명한 채로 남은 .reveal: {len(bad)} 건")
for x in bad[:40]:
    print("  ✘", x)
if len(bad) > 40:
    print(f"  … 외 {len(bad)-40} 건")
sys.exit(1 if bad else 0)
