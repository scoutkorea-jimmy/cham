"""관리자 콘솔이 **로컬에서** 뜨는가 — 운영에 올리기 전 관문.

clicks.py 는 운영에 로그인해 클릭까지 보지만, 배포한 뒤에만 쓸 수 있다.
admin.js 를 크게 건드릴 때(모듈 분리 같은) 배포 전에 한 번 걸러야 한다.

**로그인 칸 id 를 조심한다.** 로컬 모드의 관문은 `#loginId`·`#loginPw`(admin.html 안)이고,
`#lgId`·`#lgPw` 는 서버 모드의 `login.html` 이다. 틀린 id 로 검사하면 "콘솔이 안 뜬다"가
나오는데 원인은 화면이 아니라 검사기다 — 실제로 한 번 그렇게 헤맸다.

    (cd public && python3 -m http.server 8777 --bind 127.0.0.1)
    ./venv/bin/python .claude/skills/verify/tools/admin_local.py
"""
from playwright.sync_api import sync_playwright

B = 'http://127.0.0.1:8777'
# 로컬 모드에는 /api 가 없다 — 이 404 는 정상이고 모드를 정하는 신호다
IGNORE = ('bootstrap', 'favicon')


def noisy(m):
    """무시할 것인지 판정. **주소는 m.text 가 아니라 m.location 에 있다** —
    404 메시지 본문은 'Failed to load resource…' 뿐이라 텍스트만 걸러서는
    /api/bootstrap 을 못 알아본다. 이것 때문에 멀쩡한 화면이 '실패'로 나왔다."""
    if m.type != 'error':
        return False
    where = (m.location or {}).get('url', '') if hasattr(m, 'location') else ''
    blob = f'{m.text} {where}'
    return not any(k in blob for k in IGNORE)


errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 1500, 'height': 1000})
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'console: {m.text} @ {(m.location or {}).get("url","")}')
          if noisy(m) else None)
    pg.on('dialog', lambda d: d.dismiss())

    pg.goto(B + '/admin.html', wait_until='domcontentloaded')
    pg.wait_for_timeout(2500)
    if pg.query_selector('#loginId'):
        pg.fill('#loginId', 'admin')
        pg.fill('#loginPw', 'admin')
        pg.press('#loginPw', 'Enter')
        pg.wait_for_timeout(2500)

    app = pg.query_selector('#adminApp')
    shown = bool(app and app.is_visible())
    navs = len(pg.query_selector_all('.admin-nav [data-nav]'))
    body = pg.eval_on_selector('#adminView', 'e=>e.innerHTML.length') if pg.query_selector('#adminView') else 0

    print('콘솔 보임 :', shown)
    print('사이드바  :', navs, '항목')
    print('본문 길이 :', body)
    # 화면이 그려졌는지는 숫자만으로 못 믿는다 — 눈으로도 한 번 본다
    pg.screenshot(path='/tmp/admin-local.png')
    print('그림      : /tmp/admin-local.png')
    br.close()

print('\n=== 오류 ===')
print('\n'.join(errs) if errs else '0건')

ok = shown and navs > 0 and body > 1000 and not errs
print('\n판정:', '통과' if ok else '실패 — 운영에 올리지 않는다')
raise SystemExit(0 if ok else 1)
