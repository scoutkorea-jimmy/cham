"""클릭이 실제로 먹는가 — 렌더링만 보는 검사로는 못 잡는 종류다.
   data-page 충돌로 모든 클릭이 삼켜졌던 적이 있다."""
from playwright.sync_api import sync_playwright
B="https://charmjt.org"
bad=[]
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={"width":1500,"height":1000}); a=ctx.new_page()
    a.on("dialog", lambda d: d.dismiss())
    a.goto(B+"/admin.html", wait_until="domcontentloaded"); a.wait_for_timeout(2000)
    if "/login" in a.url:
        a.fill("#lgId","admin"); a.fill("#lgPw","admin"); a.click("#lgBtn"); a.wait_for_timeout(4000)
    a.wait_for_selector("#adminApp", state="visible", timeout=20000)

    GROUP = {"products":"g_sales","orders":"g_sales","sales":"g_sales",
             "cohorts":"g_customer","apps":"g_customer","inq":"g_customer",
             "posts":"g_content","images":"g_content","popups":"g_content","partners":"g_content",
             "settings":"g_site","seo":"g_site","accounts":"g_site",
             "backup":"g_system","consents":"g_system","kms":"g_system"}
    def openNav(nav):
        """그룹 헤더를 누르면 사이드바가 다시 그려져 DOM 참조가 끊긴다 —
           속한 그룹을 직접 지정하고, 매번 새로 찾는다.
           data-nav 는 대시보드 바로가기에도 붙어 있으므로 사이드바로 좁힌다."""
        sel = f'.admin-nav [data-nav="{nav}"]'
        el = a.query_selector(sel)
        # 항목은 접혀 있어도 DOM 에 남아 있다 — query_selector 로는 '있다'가 되므로
        # **보이는지**를 봐야 한다. 안 보이면 속한 그룹을 먼저 연다.
        if el is None or not el.is_visible():
            g = GROUP.get(nav)
            if g:
                a.click(f'[data-navgroup="{g}"]'); a.wait_for_timeout(900)
        a.wait_for_selector(sel, state="visible", timeout=8000)
        a.click(sel)

    def check(name, fn, verify):
        try:
            fn(); a.wait_for_timeout(1300)
            ok = a.evaluate(verify)
            print(f"  {'✔' if ok else '✘'} {name}")
            if not ok: bad.append(name)
        except Exception as e:
            print(f"  ✘ {name} — {str(e)[:70]}"); bad.append(name)

    # 1) 사이드바 이동
    check("사이드바 — 주문 관리로 이동",
          lambda: openNav("orders"),
          "()=>!!document.querySelector('.otabs')")
    # 2) 주문 탭 전환
    check("주문 탭 — 결제완료",
          lambda: a.click('[data-otab="결제완료"]'),
          "()=>{const b=document.querySelector('[data-otab=\"결제완료\"]');return b&&b.classList.contains('on');}")
    # 3) 그룹 요약
    check("그룹 이름 — 판매 관리 요약",
          lambda: a.click('[data-navgroup="g_sales"]'),
          "()=>!!document.querySelector('.gs-head')")
    # 4) 챗봇 열기/닫기
    check("챗봇 열기", lambda: a.click("#cbFab"),
          "()=>document.getElementById('cbPanel').classList.contains('open')")
    check("챗봇 닫기", lambda: a.click("#cbClose"),
          "()=>!document.getElementById('cbPanel').classList.contains('open')")
    # 5) 설명서 탭
    check("설명서 열기", lambda: a.click('.admin-nav [data-nav="manual"]'),
          "()=>!!document.querySelector('.man-tabs')")
    check("설명서 탭 이동", lambda: a.evaluate("()=>document.querySelectorAll('.man-tabs a')[3].click()"),
          "()=>window.scrollY>200")
    # 6) 설정 화면의 입력·버튼
    check("설정 화면 열기",
          lambda: openNav("settings"),
          "()=>!!document.getElementById('settingsForm')")
    check("검색 노출 화면", lambda: openNav("seo"),
          "()=>!!document.getElementById('seoForm')")
    # 7) 상품 화면에서 삭제 버튼(확인창은 취소) — 클릭이 도달하는지만
    check("상품 화면 열기",
          lambda: openNav("products"),
          "()=>document.querySelectorAll('.admin-table tbody tr').length>0")
    # 8) 재렌더가 남발되지 않는지 — 아무 데나 눌렀을 때 화면이 안 바뀌어야
    a.evaluate("()=>{window.__before=document.querySelector('#adminView').innerHTML.length;}")
    a.click("h1")  # 상단 제목
    a.wait_for_timeout(800)
    same=a.evaluate("()=>document.querySelector('#adminView').innerHTML.length===window.__before")
    print(f"  {'✔' if same else '✘'} 빈 곳 클릭이 화면을 다시 그리지 않는다")
    if not same: bad.append("빈 곳 클릭에 재렌더")
    ctx.close(); br.close()
print("\n문제:", len(bad), "건")
for x in bad: print("  ✘", x)
