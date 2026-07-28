"""동시 편집 — 두 사람이 같은 목록을 다루면 나중 저장이 앞 사람 것을 덮는가?
   비어 있는 팝업 목록으로 시험하고 끝나면 원래대로(빈 목록) 돌린다."""
from playwright.sync_api import sync_playwright
B="https://charmjt.org"
def login(ctx):
    pg=ctx.new_page()
    pg.goto(B+"/admin.html", wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
    if "/login" in pg.url:
        pg.fill("#lgId","admin"); pg.fill("#lgPw","admin"); pg.click("#lgBtn"); pg.wait_for_timeout(3500)
    pg.wait_for_selector("#adminApp", state="visible", timeout=20000)
    return pg

with sync_playwright() as p:
    br=p.chromium.launch()
    c1=br.new_context(); c2=br.new_context()
    a=login(c1); b=login(c2)

    start=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/popups',{credentials:'same-origin'});return (await x.json()).items||[];}")
    print(f"시작 팝업 수: {len(start)}")

    # 두 사람이 같은 시점의 목록을 각자 읽는다
    a.evaluate("()=>{window.__mine=JSON.parse(JSON.stringify(Site.getJSON('kach_popups_v1',[])));}")
    b.evaluate("()=>{window.__mine=JSON.parse(JSON.stringify(Site.getJSON('kach_popups_v1',[])));}")

    # A 가 팝업 하나를 추가하고 저장
    a.evaluate("""()=>{const list=window.__mine.slice();
      list.push({id:'TESTA', title:'A가 만든 공지', body:'', active:false});
      Site.setJSON('kach_popups_v1', list);}""")
    a.wait_for_timeout(2500)
    mid=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/popups',{credentials:'same-origin'});return (await x.json()).items||[];}")
    print(f"A 저장 후 서버: {[o.get('id') for o in mid]}")

    # B 는 A 의 저장을 모른 채(자기가 읽은 목록 기준) 다른 팝업을 추가하고 저장
    b.evaluate("""()=>{const list=window.__mine.slice();
      list.push({id:'TESTB', title:'B가 만든 공지', body:'', active:false});
      Site.setJSON('kach_popups_v1', list);}""")
    b.wait_for_timeout(2500)
    end=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/popups',{credentials:'same-origin'});return (await x.json()).items||[];}")
    ids=[o.get('id') for o in end]
    print(f"B 저장 후 서버: {ids}")

    if 'TESTA' in ids and 'TESTB' in ids:
        print("\n  → 둘 다 남았다. 덮어쓰기 없음.")
    elif 'TESTB' in ids and 'TESTA' not in ids:
        print("\n  ✘ A 가 만든 것이 사라졌다 — 나중 저장이 앞 사람 작업을 덮는다(lost update)")
    else:
        print(f"\n  ? 예상 밖: {ids}")

    # 원래대로
    a.evaluate("""async ()=>{await fetch('/api/admin/data/popups',{method:'PUT',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[]})});}""")
    a.wait_for_timeout(1500)
    fin=a.evaluate("async ()=>{const x=await fetch('/api/admin/data/popups',{credentials:'same-origin'});return (await x.json()).items||[];}")
    print(f"정리 후 팝업 수: {len(fin)}")
    c1.close(); c2.close(); br.close()
