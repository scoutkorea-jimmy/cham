"""한글 줄바꿈 회귀 검사 — 어절이 아니라 글자 단위로 꺾이는 곳이 있는가.

rules/design-tokens.md '줄바꿈은 어절 단위': word-break 는 site.css 의 body 한 곳에서만
keep-all 로 정하고, 다른 선택자에서 다시 선언하지 않는다. 여기서 keep-all 이 아닌 값이
잡히면 어딘가에서 word-break 를 덮어썼다는 뜻이다(break-word · break-all · normal 전부).

  ./venv/bin/python .claude/skills/verify/tools/word_break.py                    # 운영
  ./venv/bin/python .claude/skills/verify/tools/word_break.py http://127.0.0.1:8777  # 로컬(공개 페이지만)
"""
import sys
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "https://charmjt.org").rstrip("/")
PUBLIC = ["/", "/about.html", "/ferments.html", "/vinegar.html", "/nuruk.html",
          "/instructor.html", "/products.html", "/news.html", "/contact.html",
          "/terms.html", "/privacy.html", "/signup.html", "/mypage.html",
          "/login.html", "/404.html"]
# admin.js 의 NAV 와 같은 목록(그룹 요약 화면 제외). 메뉴가 늘면 여기도 늘린다.
ADMIN = ["dashboard", "products", "orders", "sales", "cohorts", "apps", "inq",
         "posts", "texts", "images", "partners", "popups", "consents", "kms",
         "accounts", "settings", "seo", "backup", "manual"]

# 한글을 직접 담은 요소만 훑는다. white-space 가 nowrap/pre 면 애초에 줄바꿈이 없다.
#
# [hidden] 을 먼저 풀고 본다 — 로그인 전/후, 빈 목록, 탈퇴 안내처럼 조건이 맞아야
# 나오는 패널이 많다. 숨은 채로 두면 그 안의 word-break 를 영영 못 본다.
# 여기서 재는 것은 계산된 스타일뿐이라 화면을 건드려도 결과가 흔들리지 않는다.
SCAN = r"""(root) => {
  const HANGUL = /[가-힣]/;
  const out = [], seen = new Set();
  (root || document).querySelectorAll('[hidden]').forEach(el => { el.hidden = false; });
  (root || document).querySelectorAll('*').forEach(el => {
    if (el.closest('script,style,head,noscript')) return;
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim();
    if (!own || !HANGUL.test(own)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') return;
    if (cs.wordBreak === 'keep-all') return;
    let path = el.tagName.toLowerCase();
    if (el.id) path += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim())
      path += '.' + el.className.trim().split(/\s+/).join('.');
    const key = path + '|' + cs.wordBreak;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ path, wb: cs.wordBreak, text: own.slice(0, 34) });
  });
  return out;
}"""

bad = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, tag in [(390, "mb"), (1280, "pc")]:
        ctx = br.new_context(viewport={"width": w, "height": 900})
        a = ctx.new_page()
        a.on("dialog", lambda d: d.accept())
        for path in PUBLIC:
            a.goto(B + path, wait_until="networkidle")
            a.wait_for_timeout(400)
            for r in a.evaluate(SCAN, None):
                bad.append(f"[{tag}:{path}] word-break:{r['wb']}  {r['path']}  “{r['text']}”")

        # 관리자 콘솔 — 서버 세션이 없으면(로컬 정적 서버) 건너뛴다
        a.goto(B + "/admin.html", wait_until="networkidle")
        a.wait_for_timeout(800)
        if "/login" in a.url:
            a.fill("#lgId", "admin"); a.fill("#lgPw", "admin")
            a.click("#lgBtn"); a.wait_for_timeout(3500)
        try:
            a.wait_for_selector("#adminApp", state="visible", timeout=15000)
        except Exception:
            print(f"[{tag}] 관리자 콘솔 진입 실패 — 공개 페이지만 검사했다")
            ctx.close()
            continue
        for nav in ADMIN:
            a.evaluate("""(id)=>{const b=document.querySelector(`.admin-nav [data-nav="${id}"]`);
              if(b){b.click();return;} [...document.querySelectorAll('.nav-gh')].forEach(x=>x.click());
              setTimeout(()=>{const c=document.querySelector(`.admin-nav [data-nav="${id}"]`);
                if(c)c.click();},60);}""", nav)
            a.wait_for_timeout(1300)
            for r in a.evaluate(SCAN, a.query_selector("#adminView")):
                bad.append(f"[{tag}:admin/{nav}] word-break:{r['wb']}  {r['path']}  “{r['text']}”")
        ctx.close()
    br.close()

print(f"\n글자 단위로 꺾이는 곳: {len(bad)} 건")
for x in bad[:40]:
    print("  ✘", x)
if len(bad) > 40:
    print(f"  … 외 {len(bad)-40} 건")
