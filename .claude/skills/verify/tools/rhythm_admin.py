"""세로 리듬 회귀 검사 — 관리자 전 화면의 최상위 블록 간격이 허용 값인가.
   rules/spacing-rhythm.md '회귀 검사': 허용(8·16·24·44·64) 밖 숫자가 나오면 인라인이 돌아온 것."""
from playwright.sync_api import sync_playwright
from collections import Counter
B="https://cham-3ef.pages.dev"
SH="/private/tmp/claude-501/-Users-jimmy-macmini-Desktop-VS-Code-cham/a1f12cd2-a589-4ea5-80b7-abf08d8dbb30/scratchpad"
ADMIN=["dashboard","g_sales","products","orders","sales","g_customer","cohorts","apps","inq",
       "g_content","posts","images","popups","partners","g_site","settings","accounts","members",
       "roles","g_system","backup","consents","kms","manual"]
OK={8,16,24,44,64}
bad=[]; vals=Counter(); errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,tag in [(1500,"pc"),(390,"mb")]:
        ctx=br.new_context(viewport={"width":w,"height":1000}); a=ctx.new_page()
        a.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        a.on("dialog", lambda d: d.accept())
        a.goto(B+"/admin.html", wait_until="networkidle"); a.wait_for_timeout(800)
        if "/login" in a.url:
            a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(3500)
        a.wait_for_selector("#adminApp", state="visible", timeout=20000)
        for nav in ADMIN:
            a.evaluate("""(id)=>{const g=document.querySelector(`[data-navgroup="${id}"]`);
              if(g){g.click();return;} const b=document.querySelector(`[data-nav="${id}"]`);
              if(b)b.click(); else{[...document.querySelectorAll('.nav-gh')].forEach(x=>x.click());
                setTimeout(()=>{const c=document.querySelector(`[data-nav="${id}"]`);if(c)c.click();},60);}}""", nav)
            a.wait_for_timeout(1500)
            r=a.evaluate("""()=>{const v=document.getElementById('adminView');
              const k=[...v.children].filter(e=>e.getBoundingClientRect().height>4);
              const out=[]; for(let i=0;i<k.length-1;i++){
                const g=Math.round(k[i+1].getBoundingClientRect().top-k[i].getBoundingClientRect().bottom);
                out.push({g, a:k[i].className.slice(0,20), b:k[i+1].className.slice(0,20)});}
              // 렌더 실패 · 빈 화면 확인
              return {gaps:out, h:Math.round(v.getBoundingClientRect().height),
                      kids:k.length, txt:(v.textContent||'').trim().length};}""")
            if r["kids"]==0 or r["txt"]<20: bad.append(f"[{tag}:{nav}] 화면이 비었다 (자식 {r['kids']}, 글자 {r['txt']})")
            for x in r["gaps"]:
                vals[x["g"]]+=1
                if x["g"] not in OK: bad.append(f"[{tag}:{nav}] 간격 {x['g']}px  .{x['a']} → .{x['b']}")
        if tag=="pc":
            for nav in ["posts","settings","accounts"]:
                a.evaluate("""(id)=>{const b=document.querySelector(`[data-nav="${id}"]`);
                  if(b)b.click();}""", nav); a.wait_for_timeout(1400)
                a.screenshot(path=f"{SH}/rh_{nav}.png", full_page=True)
        ctx.close()
    br.close()
real=[e for e in errs if "favicon" not in e and "unpkg" not in e]
print("최상위 블록 간격 분포:", dict(sorted(vals.items())))
if real: bad.append("콘솔 오류: "+real[0][:120])
print("\n문제:", len(bad), "건")
for x in bad[:25]: print("  ✘", x)
