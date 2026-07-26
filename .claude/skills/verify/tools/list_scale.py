"""D1 바인딩 파라미터 100개 상한 — 목록이 몇 건을 넘으면 저장이 실패하는가.
   게시글(현재 0건)로 시험하고 끝나면 빈 목록으로 되돌린다."""
from playwright.sync_api import sync_playwright
B="https://cham-3ef.pages.dev"
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(); a=ctx.new_page()
    a.goto(B+"/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(1500)
    if "/login" in a.url:
        a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(3500)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)

    n0=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/posts',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}")
    print(f"시작 게시글 수: {n0}  (0 이 아니면 중단)")
    if n0 != 0:
        print("  ! 실제 게시글이 있어 시험하지 않는다"); ctx.close(); br.close(); raise SystemExit

    for n in [50, 99, 100, 101, 120, 200]:
        r=a.evaluate("""async (n)=>{
          const items=[]; for(let i=0;i<n;i++) items.push({id:'ZZTEST'+i, title:'시험'+i,
            body:'', cat:'공지', at:new Date().toISOString()});
          const x=await fetch('/api/admin/data/posts',{method:'PUT',credentials:'same-origin',
            headers:{'Content-Type':'application/json'}, body:JSON.stringify({items})});
          const t=await x.text();
          const g=await fetch('/api/admin/data/posts',{credentials:'same-origin'});
          const stored=((await g.json()).items||[]).length;
          return {status:x.status, body:t.slice(0,150), stored};}""", n)
        mark = "OK " if r["status"]==200 and r["stored"]==n else "✘ 실패"
        print(f"  {n:>4}건 → HTTP {r['status']}  저장됨 {r['stored']:>4}  {mark}  {r['body'][:90] if r['status']!=200 else ''}")

    a.evaluate("""async ()=>{await fetch('/api/admin/data/posts',{method:'PUT',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[]})});}""")
    a.wait_for_timeout(1500)
    fin=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/posts',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}")
    print(f"정리 후 게시글 수: {fin}")
    ctx.close(); br.close()
