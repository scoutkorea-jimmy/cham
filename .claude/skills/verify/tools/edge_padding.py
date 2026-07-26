"""픽셀 단위 여백 전수 검사 — 색·테두리를 가진 '보이는 상자' 안에서
   글이 모서리에 붙어 있는 곳을 찾는다.

   거짓이 나오는 이유는 늘 같다 — **요소의 상자를 쟀기 때문**이다.
   .wrap · th · dt · tr 은 폭을 꽉 채우고 여백을 자기 padding 으로 만든다 → 늘 0 으로 보인다.
   Range 로 **글자가 실제로 그려진 자리**를 재면 이 거짓이 전부 사라진다."""
from playwright.sync_api import sync_playwright
from collections import Counter
import time

def goto(pg, url, tries=3):
    """운영은 가끔 networkidle 까지 30초를 넘긴다 — 한 번 실패로 검사를 접지 않는다"""
    for i in range(tries):
        try:
            pg.goto(url, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_load_state("networkidle", timeout=20000)
            return True
        except Exception as e:
            if i == tries-1: print(f"  ! 실패 {url} — {str(e)[:60]}"); return False
            time.sleep(3)
B="https://cham-3ef.pages.dev"
PUB=["/","/about.html","/ferments.html","/vinegar.html","/nuruk.html","/instructor.html",
     "/products.html","/news.html","/contact.html","/terms.html","/privacy.html",
     "/product.html?id=p_vin_omija"]
ADMIN=["dashboard","manual","g_sales","products","orders","sales","g_customer","cohorts","apps","inq",
       "g_content","posts","images","popups","partners","g_site","settings","accounts","members",
       "roles","g_system","backup","consents","kms"]
MIN=12   # 이보다 가까우면 '모서리에 붙었다'

JS=r"""(MIN) => {
  const s=document.createElement('style');
  s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(s);
  document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));

  const R=e=>e.getBoundingClientRect(), out=[];
  const nm=e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).filter(c=>c!=='in'&&c!=='reveal').slice(0,2).join('.'):'');
  /* '보이는 상자' = 내용을 **감싸는** 것. 한 변짜리 테두리는 구분선이지 상자가 아니다 —
     .footer-bottom(border-top) · .facts dt(border-bottom) · .pd-opts(border-top) 가 그렇다.
     구분선을 상자로 세면 "글이 모서리에 붙었다"가 무더기로 잡히는데 전부 거짓이다. */
  const visible=cs=>{
    const b=cs.backgroundColor;
    if(b&&b!=='rgba(0, 0, 0, 0)'&&b!=='transparent') return true;
    const sides=['Top','Right','Bottom','Left']
      .filter(x=>parseFloat(cs['border'+x+'Width'])>0&&cs['border'+x+'Style']!=='none').length;
    return sides>=3;
  };
  const CONTENT='h1,h2,h3,h4,h5,p,li,dt,dd,td,th,blockquote,label,span,b,a,button';
  // 글자가 실제로 그려진 자리 — 요소 상자가 아니라 글자 상자를 잰다
  const textBox=e=>{
    let box=null;
    [...e.childNodes].forEach(n=>{
      if(n.nodeType!==3||!n.textContent.trim()) return;
      const rg=document.createRange(); rg.selectNodeContents(n);
      const r=rg.getBoundingClientRect(); rg.detach&&rg.detach();
      if(r.width<1||r.height<1) return;
      box = box ? {left:Math.min(box.left,r.left), right:Math.max(box.right,r.right),
                   width:1, height:1} : {left:r.left, right:r.right, width:1, height:1};
    });
    return box;
  };
  const inScroller=(e,stop)=>{ for(let p=e.parentElement;p&&p!==stop;p=p.parentElement){
      const c=getComputedStyle(p); if(/auto|scroll|hidden/.test(c.overflowX+' '+c.overflow)) return true; }
    return false; };
  const root=document.querySelector('#adminView')||document.querySelector('main')||document.body;

  [root, ...root.querySelectorAll('*')].forEach(box=>{
    const br=R(box); if(br.width<120||br.height<40) return;
    const cs=getComputedStyle(box);
    if(!visible(cs)) return;
    if(cs.position==='fixed'||cs.position==='sticky') return;
    // 스크롤 상자 안은 넘치는 것이 정상이다
    if(/auto|scroll|hidden/.test(cs.overflowX+' '+cs.overflow)) return;
    // 자기 안에 또 다른 '보이는 상자'가 글을 감싸고 있으면 그쪽이 책임진다
    let L=1e9, Rr=1e9, who='';
    box.querySelectorAll(CONTENT).forEach(e=>{
      if(getComputedStyle(e).position==='absolute') return;
      if(inScroller(e, box)) return;            // 가로 스크롤 상자 안은 넘쳐도 정상이다
      // 이 글을 감싸는 더 안쪽 '보이는 상자'가 있으면 그쪽이 책임진다
      for(let p=e.parentElement; p&&p!==box; p=p.parentElement){
        if(visible(getComputedStyle(p))) return;
      }
      const r=textBox(e); if(!r) return;
      const l=Math.round(r.left-br.left), rr=Math.round(br.right-r.right);
      if(l<L){L=l; who=nm(e);}
      if(rr<Rr) Rr=rr;
    });
    if(L===1e9) return;
    if(L<MIN||Rr<MIN) out.push({box:nm(box), L, R:Rr, who, w:Math.round(br.width)});
  });
  return out;
}"""
rows=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,tag in [(1280,"pc"),(390,"mb")]:
        ctx=br.new_context(viewport={"width":w,"height":900}); pg=ctx.new_page()
        for path in PUB:
            if not goto(pg, B+path): continue
            pg.wait_for_timeout(800); pg.keyboard.press("Escape")
            pg.wait_for_timeout(400)
            for x in pg.evaluate(JS, MIN): rows.append((f"[{tag}]{path}", x))
        print(f"[{tag}] 공개 {len(PUB)}페이지"); ctx.close()
    for w,tag in [(1500,"pc"),(390,"mb")]:
        ctx=br.new_context(viewport={"width":w,"height":1000}); a=ctx.new_page()
        a.on("dialog", lambda d: d.accept())
        goto(a, B+"/admin.html"); a.wait_for_timeout(800)
        if "/login" in a.url:
            a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(3500)
        a.wait_for_selector("#adminApp", state="visible", timeout=20000)
        for nav in ADMIN:
            a.evaluate("""(id)=>{const g=document.querySelector(`[data-navgroup="${id}"]`);
              if(g){g.click();return;} const b=document.querySelector(`[data-nav="${id}"]`);
              if(b)b.click(); else{[...document.querySelectorAll('.nav-gh')].forEach(x=>x.click());
                setTimeout(()=>{const c=document.querySelector(`[data-nav="${id}"]`);if(c)c.click();},60);}}""", nav)
            a.wait_for_timeout(1400)
            for x in a.evaluate(JS, MIN): rows.append((f"[관리자:{tag}:{nav}]", x))
        print(f"[{tag}] 관리자 {len(ADMIN)}화면"); ctx.close()
    br.close()
print(f"\n모서리에 붙은 곳: {len(rows)}건")
c=Counter(f"{x['box']}  좌{x['L']} 우{x['R']}  (글: {x['who']})" for _,x in rows)
for m,n in c.most_common(25): print(f"  ×{n:<3} {m}")
where=Counter(w for w,_ in rows)
print("\n페이지별:", dict(where.most_common(12)))
