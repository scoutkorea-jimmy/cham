"""고정 버튼(챗봇·맨위로)이 눌러야 하는 것을 덮고 있나 — 전 화면"""
from playwright.sync_api import sync_playwright
B="https://charmjt.org"
NAV=["dashboard","products","orders","sales","cohorts","apps","inq","posts","images",
     "popups","partners","settings","seo","accounts","members","roles","backup","consents","kms"]
JS="""() => {
  const fabs=[...document.querySelectorAll('.cb-fab,.to-top')]
    .filter(e=>getComputedStyle(e).position==='fixed' && e.getBoundingClientRect().width>0);
  if(!fabs.length) return [];
  const out=[];
  document.querySelectorAll('#adminView button, #adminView a, #adminView input, #adminView select').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.width<8||r.height<8) return;
    if(r.bottom<0||r.top>innerHeight) return;
    fabs.forEach(f=>{const b=f.getBoundingClientRect();
      if(r.left<b.right && b.left<r.right && r.top<b.bottom && b.top<r.bottom)
        out.push((el.textContent||el.value||el.tagName).trim().slice(0,18)+' ← '+f.className);});
  });
  return [...new Set(out)];
}"""
hits=[]
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={"width":1500,"height":900}); a=ctx.new_page()
    a.on("dialog", lambda d: d.accept())
    a.goto(B+"/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(1500)
    if "/login" in a.url:
        a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(3500)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)
    for nav in NAV:
        a.evaluate("""(id)=>{const b=document.querySelector(`[data-nav="${id}"]`);
          if(b)b.click(); else{[...document.querySelectorAll('.nav-gh')].forEach(x=>x.click());
            setTimeout(()=>{const c=document.querySelector(`[data-nav="${id}"]`);if(c)c.click();},60);}}""", nav)
        a.wait_for_timeout(1300)
        a.evaluate("()=>window.scrollTo(0,document.body.scrollHeight)"); a.wait_for_timeout(600)
        for m in a.evaluate(JS): hits.append(f"[{nav}] {m}")
    ctx.close(); br.close()
print("덮인 것:", len(hits), "건")
for h in hits[:15]: print("  ✘", h)
