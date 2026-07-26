"""효과 측정 — 시작 적재량과 저장 1회 전송량이 얼마나 줄었나"""
from playwright.sync_api import sync_playwright
import datetime
B="https://cham-3ef.pages.dev"
now = datetime.datetime.now(datetime.timezone.utc)
old_at=(now-datetime.timedelta(days=800)).isoformat()
new_at=(now-datetime.timedelta(days=30)).isoformat()
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(); a=ctx.new_page()
    a.goto(B+"/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(2000)
    if "/login" in a.url:
        a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(4000)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)
    if a.evaluate("async ()=>{const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}"):
        print("문의가 비어 있지 않아 중단"); raise SystemExit

    # 3년치 900건(옛 600 + 최근 300) 투입
    a.evaluate("""async ([o,n])=>{
      const g=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'}); const j=await g.json();
      const items=[];
      for(let i=1;i<=600;i++) items.push({id:'O'+i,name:'옛문의'+i,phone:'010-1111-0000',
        type:'제품',memo:'2년 전 문의 내용입니다. 실제와 비슷한 길이로 채웁니다.',status:'신규',at:o});
      for(let i=1;i<=300;i++) items.push({id:'N'+i,name:'최근문의'+i,phone:'010-2222-0000',
        type:'제품',memo:'최근 문의 내용입니다. 실제와 비슷한 길이로 채웁니다.',status:'신규',at:n});
      await fetch('/api/admin/data/inquiries',{method:'PUT',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({items,version:j.version})});}""",
      [old_at,new_at])
    a.wait_for_timeout(3000)

    r=a.evaluate("""async ()=>{
      const t0=performance.now();
      const full=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});
      const fullTxt=await full.text(); const tFull=performance.now()-t0;
      const since=new Date(Date.now()-365*24*3600*1000).toISOString();
      const t1=performance.now();
      const win=await fetch('/api/admin/data/inquiries?since='+encodeURIComponent(since),{credentials:'same-origin'});
      const winTxt=await win.text(); const tWin=performance.now()-t1;
      const winJson=JSON.parse(winTxt);
      // 저장 1회: 예전엔 목록 전체, 지금은 한 건
      const oneItem=JSON.stringify({patch:{status:'처리중'}});
      return {fullBytes:new Blob([fullTxt]).size, fullMs:Math.round(tFull),
              winBytes:new Blob([winTxt]).size, winMs:Math.round(tWin),
              winCount:(winJson.items||[]).length, older:winJson.older,
              saveOld:new Blob([fullTxt]).size, saveNew:new Blob([oneItem]).size};}""")
    kb=lambda b: f"{b/1024:,.0f} KB"
    print(f"\n자료 900건(최근 1년 300 · 그 이전 600) 기준\n")
    print(f"  {'':22}{'예전':>14}{'지금':>14}")
    print(f"  {'시작 적재량':22}{kb(r['fullBytes']):>14}{kb(r['winBytes']):>14}")
    print(f"  {'적재 시간':22}{str(r['fullMs'])+' ms':>14}{str(r['winMs'])+' ms':>14}")
    print(f"  {'적재 건수':22}{'900건':>14}{str(r['winCount'])+'건':>14}   (창 밖 {r['older']}건은 부를 때)")
    print(f"  {'저장 1회 전송량':22}{kb(r['saveOld']):>14}{str(r['saveNew'])+' B':>14}")
    print(f"\n  줄어든 비율 — 적재 {100-100*r['winBytes']/r['fullBytes']:.0f}% · 저장 {100-100*r['saveNew']/r['saveOld']:.2f}%")

    a.evaluate("""async ()=>{const g=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});
      const j=await g.json();
      await fetch('/api/admin/data/inquiries',{method:'PUT',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[],version:j.version})});}""")
    a.wait_for_timeout(2000)
    print("\n정리 후:", a.evaluate("async ()=>{const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}"), "건")
    ctx.close(); br.close()
