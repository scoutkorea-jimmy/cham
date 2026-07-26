"""기간창 검증 — 가장 중요한 것은 '1년 이전 자료가 살아남는가'다.
   문의 표에 옛 자료 40건 + 최근 20건을 넣고, 최근 것을 고쳤을 때 옛 것이 남는지 본다."""
from playwright.sync_api import sync_playwright
import datetime, json
B="https://cham-3ef.pages.dev"
bad=[]
now = datetime.datetime.now(datetime.timezone.utc)
old_at = (now - datetime.timedelta(days=800)).isoformat()
new_at = (now - datetime.timedelta(days=10)).isoformat()

with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={"width":1500,"height":1000}); a=ctx.new_page()
    errs=[]; a.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    a.goto(B+"/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(2000)
    if "/login" in a.url:
        a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(4000)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)

    n0=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}")
    if n0: print(f"실제 문의 {n0}건이 있어 중단"); raise SystemExit
    print("문의 0건 확인 — 시험 자료 투입")

    a.evaluate("""async ([oldAt,newAt])=>{
      const g=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'}); const j=await g.json();
      const items=[];
      for(let i=1;i<=40;i++) items.push({id:'OLD'+String(i).padStart(3,'0'),name:'옛문의'+i,
        phone:'010-1111-'+String(i).padStart(4,'0'),type:'제품',memo:'2년 전',status:'신규',at:oldAt});
      for(let i=1;i<=20;i++) items.push({id:'NEW'+String(i).padStart(3,'0'),name:'최근문의'+i,
        phone:'010-2222-'+String(i).padStart(4,'0'),type:'제품',memo:'최근',status:'신규',at:newAt});
      await fetch('/api/admin/data/inquiries',{method:'PUT',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({items,version:j.version})});}""",
      [old_at, new_at])
    a.wait_for_timeout(2000)

    total=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}")
    print(f"서버 전체: {total}건 (기대 60)")
    if total!=60: bad.append(f"투입 실패 {total}")

    # 새로고침 → 화면은 1년치만 들고 있어야
    a.evaluate("()=>location.reload()"); a.wait_for_timeout(5000)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)
    w=a.evaluate("()=>({loaded:Site.getJSON('kach_inquiries',[]).length, info:Site.windowInfo('inquiries')})")
    print("화면 적재:", w)
    if w["loaded"]!=20: bad.append(f"1년치만 올라와야 하는데 {w['loaded']}건")
    if w["info"]["older"]!=40: bad.append(f"창 밖 건수가 40이어야 하는데 {w['info']['older']}")

    # 최근 건 하나를 고친다 → 옛 40건이 살아남아야 한다
    r=a.evaluate("""async ()=>{
      const ok = await Site.patchItem('inquiries','NEW005',{status:'처리중', adminMemo:'검증'});
      await new Promise(r=>setTimeout(r,1200));
      const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});
      const all=(await x.json()).items||[];
      return {ok, total:all.length, olds:all.filter(o=>o.id.startsWith('OLD')).length,
              changed:(all.find(o=>o.id==='NEW005')||{}).status};}""")
    print("한 건 수정 후:", r)
    if r["total"]!=60: bad.append(f"★ 자료가 사라졌다 — 전체 {r['total']}건 (60이어야)")
    if r["olds"]!=40: bad.append(f"★ 1년 이전 자료가 지워졌다 — {r['olds']}건 남음 (40이어야)")
    if r["changed"]!="처리중": bad.append(f"수정이 반영 안 됨 ({r['changed']})")

    # 한 건 삭제도 같은지
    r2=a.evaluate("""async ()=>{
      await Site.removeItem('inquiries','NEW010');
      await new Promise(r=>setTimeout(r,1200));
      const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});
      const all=(await x.json()).items||[];
      return {total:all.length, olds:all.filter(o=>o.id.startsWith('OLD')).length};}""")
    print("한 건 삭제 후:", r2)
    if r2["olds"]!=40: bad.append(f"★ 삭제가 옛 자료까지 지웠다 — {r2['olds']}건")
    if r2["total"]!=59: bad.append(f"삭제 결과 이상 {r2['total']}")

    # 지난 자료 불러오기
    r3=a.evaluate("""async ()=>{ await Site.loadOlder('inquiries');
      return {loaded:Site.getJSON('kach_inquiries',[]).length, info:Site.windowInfo('inquiries')};}""")
    print("지난 자료 불러오기:", r3)
    if r3["loaded"]!=59: bad.append(f"전체를 못 불러왔다 {r3['loaded']}")

    # 정리
    a.evaluate("""async ()=>{const g=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});
      const j=await g.json();
      await fetch('/api/admin/data/inquiries',{method:'PUT',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[],version:j.version})});}""")
    a.wait_for_timeout(1800)
    fin=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/inquiries',{credentials:'same-origin'});return ((await x.json()).items||[]).length;}")
    print("정리 후:", fin, "건")
    if fin: bad.append(f"시험 자료가 남았다 {fin}")
    real=[e for e in errs if "favicon" not in e and "unpkg" not in e and "compute-pressure" not in e]
    if real: bad.append("콘솔 오류: "+real[0][:110])
    ctx.close(); br.close()
print("\n문제:", len(bad), "건")
for x in bad: print("  ✘", x)
