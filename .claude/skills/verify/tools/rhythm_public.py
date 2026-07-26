"""공개 페이지 세로 리듬 회귀 검사 (rules/spacing-rhythm.md).

  함정 셋 — 이걸 안 피하면 멀쩡한 것이 전부 위반으로 잡힌다:
  1) .reveal 은 등장 전 translateY 상태다. .in 을 붙여도 '전환 중'이라 바로 재면 어긋난다
     → 전환·애니메이션을 꺼서 즉시 착지시킨다.
  2) --gap-group·--gap-sub 는 clamp() 다. parseFloat 로는 읽히지 않는다(nan)
     → 실제 요소에 물려 계산된 px 를 받아 온다. 390px 에서는 28·40px 이 정상이다.
  3) 재는 것은 margin 이 아니라 '보이는 간격'이다. 둘이 다르면(마진 상쇄·내부 여백)
     margin 값을 함께 찍어 어느 쪽이 문제인지 가른다.
"""
from playwright.sync_api import sync_playwright
from collections import Counter
B="https://cham-3ef.pages.dev"
PUB=["/","/about.html","/ferments.html","/vinegar.html","/nuruk.html","/instructor.html",
     "/products.html","/news.html","/contact.html","/terms.html","/privacy.html",
     "/product.html?id=p_vin_omija"]
PREP=r"""() => {
  const s=document.createElement('style');
  s.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(s);
  document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));
}"""
JS=r"""() => {
  const probe=document.createElement('div');
  probe.style.cssText='position:absolute;visibility:hidden';
  document.body.appendChild(probe);
  const px=v=>{ probe.style.marginTop='var('+v+')';
    const n=Math.round(parseFloat(getComputedStyle(probe).marginTop)); return n; };
  const OK=[8,16,24,px('--gap-group'),px('--gap-sub')];
  probe.remove();
  const out=[], R=e=>e.getBoundingClientRect();
  const nm=e=>e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).filter(c=>c!=='in'&&c!=='reveal').slice(0,2).join('.'):'');
  document.querySelectorAll('.wrap:not(.split), .stack, .card-pad').forEach(p=>{
    const k=[...p.children];
    for(let i=0;i<k.length-1;i++){
      const a=k[i], b=k[i+1], ar=R(a), br=R(b);
      if(ar.height<4||br.height<4||ar.width<40||br.width<40) continue;
      if(getComputedStyle(a).position==='absolute'||getComputedStyle(b).position==='absolute') continue;
      const g=Math.round(br.top-ar.bottom);
      if(g<=0||g>170) continue;
      out.push({g, ok:OK.some(v=>Math.abs(g-v)<=1), a:nm(a), b:nm(b), p:nm(p),
                mt:Math.round(parseFloat(getComputedStyle(b).marginTop))});
    }
  });
  return {tokens:OK, rows:out};
}"""
vals=Counter(); bad=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,tag in [(1280,"pc"),(390,"mb")]:
        ctx=br.new_context(viewport={"width":w,"height":900}); pg=ctx.new_page()
        toks=None
        for path in PUB:
            pg.goto(B+path, wait_until="networkidle"); pg.wait_for_timeout(700); pg.keyboard.press("Escape")
            pg.evaluate(PREP); pg.wait_for_timeout(400)
            r=pg.evaluate(JS); toks=r["tokens"]
            for x in r["rows"]:
                vals[x["g"]]+=1
                if not x["ok"]:
                    bad.append(f"[{tag}]{path}|{x['g']}px(마진{x['mt']})  {x['a']} → {x['b']}  안:{x['p']}")
        print(f"[{tag}] 허용 값 {toks}"); ctx.close()
    br.close()
print("\n간격 분포:", dict(sorted(vals.items())))
print(f"\n허용 밖 {len(bad)}건")
c=Counter(b.split("|",1)[1] for b in bad)
for m,n in c.most_common(40): print(f"  ×{n:<3} {m}")
open("/tmp/pub_bad.txt","w").write("\n".join(bad))
