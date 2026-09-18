"""도움말 챗봇이 **어떤 종류의 답**을 내는가 — 질문 55개를 실제 화면에 넣어 본다.

2026-09-18 챗봇을 '낱개 항목·지금 상황·화면 이동' 으로 넓힐 때 만들었다. 처음 돌렸을 때 8건이
엉뚱한 항목으로 갔고(동의어가 제목 가산을 부풀림, 조사 붙은 낱말이 제목과 안 맞음 …), 점수 규칙은
이 배터리로 맞춘 결과다. 설명서(manual.html)나 admin.js 의 cb* 를 고치면 다시 돌린다.

읽는 법 — 줄마다 [종류] 가 기대와 맞는지 본다:
  [답]    인사·잡담·이동 완료 등 짧은 답
  [단추]  낱개 항목(FAQ 카드·용어·문제 해결)·지금 상황 — '○○ 열기'/'설명서에서 열기' 단추가 붙는다
  [절]    절 통째 + 모델(로컬에는 /api 가 없어 "○○ 부분에 나와 있습니다" 로 끝난다)
못 찾음 질문(점심 뭐 먹지 · asdf)은 [단추] 로 '자주 묻는 질문·문제 해결' 이 나와야 한다.

    (cd public && python3 -m http.server 8777 --bind 127.0.0.1)
    ./venv/bin/python .claude/skills/verify/tools/chatbot.py            # 로컬(admin/admin, #loginId)
    ./venv/bin/python .claude/skills/verify/tools/chatbot.py https://<배포id>.cham-3ef.pages.dev
운영에 대고 돌려도 읽기만 한다(자료를 만들지 않는다). 다만 모델 경로는 질문마다 몇 초씩 걸린다.
"""

import sys
from playwright.sync_api import sync_playwright

B = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://127.0.0.1:8777'
IGNORE = ('bootstrap', 'favicon', 'assist')

QS = [
    # 인사·잡담
    '안녕하세요', '고마워요', '너 뭐 할 수 있어?',
    # 지금 상황
    '오늘 주문 몇 건이에요?', '입금 대기 몇 건이야?', '발송할 주문 있어요?', '반품 요청 들어온 거 있어?',
    '신규 문의 있나요?', '품절 상품 뭐야?', '상품 몇 개 등록돼 있어?', '회원 몇 명이야?', '백업 언제 됐어?',
    '오늘 방문자 몇 명?', '내 권한이 뭐야?',
    # 화면 이동
    '주문 관리 열어줘', '설정은 어디야?', '계정 관리 어디 있어', '사진 관리 보러 가자',
    # 용어
    '대표 사진이 뭐예요?', '권한 그룹은 뭐예요', '저장 충돌이 뭐야', '재고 뜻이 뭐야', '강력 새로고침이 뭔가요', 'KMS 가 뭐죠',
    # 자주 묻는 질문 (제목과 다른 말로)
    '입금 확인은 어떻게 하나요?', '택배 보낸 뒤엔 뭘 눌러요?', '계좌번호는 어디서 바꿔요?', '재고는 언제 줄어요?',
    '선물세트 잠깐만 팔고 싶은데', '택배비 바꾸는 법', '구글에 안 나와요', '카톡 링크 그림 바꾸기',
    '직원이 비번 잊어버렸대', '손님 비밀번호 초기화', '홈 화면 배경 사진 교체', '휴대폰으로 관리자 되나요',
    '상품 지우면 사진도 지워져?', '용량별로 재고 따로 두려면', '주문 엑셀로 받기', '공지 첫 화면에 띄우기',
    # 문제 해결
    '비밀번호를 먼저 바꿔 주세요 라고 떠요', '권한이 없습니다 라고 나와요', '먼저 저장했습니다 뜸', '자르기 창이 떠요',
    '손님이 품절이래요 재고는 있는데', '주문 조회가 막혔대요', '로그인이 자꾸 풀려요', '사진이 안 올라가요',
    # 절 검색 + 모델
    '발송처리 누르면 어떻게 돼요?', '기수 등록하는 법', '약도 핀 옮기기', '팝업 기간 정하기',
    # 못 찾음
    '점심 뭐 먹지', 'asdf',
]


def noisy(m):
    if m.type != 'error':
        return False
    where = (m.location or {}).get('url', '') if hasattr(m, 'location') else ''
    return not any(k in f'{m.text} {where}' for k in IGNORE)


errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'console: {m.text}') if noisy(m) else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(B + '/admin.html', wait_until='domcontentloaded')
    pg.wait_for_timeout(2500)
    if pg.query_selector('#loginId'):
        pg.fill('#loginId', 'admin'); pg.fill('#loginPw', 'admin'); pg.press('#loginPw', 'Enter')
        pg.wait_for_timeout(2500)
    if pg.query_selector('#lgId'):
        pg.fill('#lgId', 'admin'); pg.fill('#lgPw', 'admin'); pg.press('#lgPw', 'Enter')
        pg.wait_for_timeout(3000)
    pg.click('#cbFab'); pg.wait_for_timeout(600)
    print('예시 알약:', pg.eval_on_selector_all('#cbQuick button', 'b=>b.length'))

    for q in QS:
        n0 = pg.eval_on_selector_all('.cb-msg.bot', 'b=>b.length')
        pg.fill('#cbInput', q); pg.press('#cbInput', 'Enter')
        # 답이 도착할 때까지(점 세 개가 사라질 때까지)
        for _ in range(60):
            pg.wait_for_timeout(200)
            n1 = pg.eval_on_selector_all('.cb-msg.bot', 'b=>b.length')
            dots = pg.eval_on_selector_all('.cb-msg.bot:last-child .cb-dots', 'b=>b.length')
            if n1 > n0 and dots == 0:
                break
        last = pg.query_selector('.cb-msg.bot:last-child')
        text = last.inner_text().replace('\n', ' ').strip()
        kind = ('절' if last.query_selector('.cb-doc') else
                '단추' if last.query_selector('.cb-acts') else '답')
        acts = [b.inner_text() for b in last.query_selector_all('.cb-acts button')]
        chips = pg.eval_on_selector_all('.cb-msg.bot:last-child .cb-src button', 'b=>b.map(x=>x.textContent)')
        print(f'■ {q:<28} [{kind}] {text[:52]} | {acts}')
        # 화면 이동으로 패널이 닫혔으면 다시 연다
        if not pg.eval_on_selector('#cbPanel', 'e=>e.classList.contains("open")'):
            pg.click('#cbFab'); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/cb-panel.png')
    br.close()
print('\n=== 오류 ===')
print('\n'.join(errs) if errs else '0건')
