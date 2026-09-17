#!/usr/bin/env python3
"""권한 그룹이 **서버에서** 막히는가 — 화면 메뉴만 감추는 검사로는 못 잡는다.

2026-09-17 검토에서 권한 그룹이 관리자 자료 창구(data/[kind]·images)에 전혀 적용되지 않는 것이
잡혔다. 화면은 메뉴를 감추고 있어 눈으로는 멀쩡했다. 이 도구는 '조회 전용' 계정을 잠깐 만들어
읽기는 되고 쓰기는 403 인지 창구마다 두드려 본 뒤 그 계정을 지운다.

쓰기:
  ./venv/bin/python .claude/skills/verify/tools/perms.py                      # 운영
  ./venv/bin/python .claude/skills/verify/tools/perms.py http://127.0.0.1:8788

owner 계정(admin/admin — 운영자가 바꾸면 여기도 바꾼다)으로 만든 시험 계정은 끝나면 반드시 지운다.
"""
import http.cookiejar
import json
import sys
import urllib.request

B = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://charmjt.org'
OWNER = ('admin', 'admin')
TEST_USER = 'perm-check'
TEST_PW = 'PermCheck#2026!'

EXPECT = [
    ('GET', '/api/admin/data/orders', None, 200),
    ('GET', '/api/admin/data/products', None, 200),
    ('GET', '/api/admin/data/applications', None, 200),
    ('PUT', '/api/admin/data/products', {'items': []}, 403),
    ('PATCH', '/api/admin/data/products/p_nope', {'patch': {}}, 403),
    ('DELETE', '/api/admin/data/orders/nope', None, 403),
    ('DELETE', '/api/admin/images', {'id': 'nope'}, 403),
    ('PATCH', '/api/admin/images', {'id': 'nope', 'role': 'main'}, 403),
    ('GET', '/api/admin/members', None, 403),
    ('GET', '/api/admin/users', None, 403),
    ('GET', '/api/admin/export', None, 403),
    ('GET', '/api/admin/backups', None, 403),
]


def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(op, method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(B + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'perms-check'})
    try:
        with op.open(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def main():
    owner = client()
    code, body = call(owner, 'POST', '/api/admin/login', {'username': OWNER[0], 'password': OWNER[1]})
    if code != 200:
        print('owner 로그인 실패', code, body[:120]); return 1
    code, body = call(owner, 'GET', '/api/admin/roles')
    roles = json.loads(body).get('roles', [])
    viewer = [r for r in roles if r['name'] == '조회 전용']
    if not viewer:
        print("'조회 전용' 그룹이 없다"); return 1

    # 남아 있던 시험 계정이 있으면 먼저 지운다
    code, body = call(owner, 'GET', '/api/admin/users')
    for u in json.loads(body).get('users', []):
        if u['username'] == TEST_USER:
            call(owner, 'DELETE', '/api/admin/users/%s' % u['id'])

    code, body = call(owner, 'POST', '/api/admin/users',
                      {'username': TEST_USER, 'displayName': '권한 검사', 'role': 'staff',
                       'password': TEST_PW, 'roleId': viewer[0]['id']})
    if code != 201:
        print('시험 계정 생성 실패', code, body[:160]); return 1
    uid = json.loads(body)['user']['id']
    problems = []
    try:
        staff = client()
        code, _ = call(staff, 'POST', '/api/admin/login', {'username': TEST_USER, 'password': TEST_PW})
        if code != 200:
            problems.append('시험 계정 로그인 실패 %s' % code)
        else:
            # 새 계정은 비밀번호를 먼저 바꿔야 한다 — 그 전에는 다른 창구가 403 이어야 한다
            code, _ = call(staff, 'GET', '/api/admin/data/orders')
            print('%-8s %-36s %s (비밀번호 변경 전 → 403 이어야)' % ('GET', '/api/admin/data/orders', code))
            if code != 403: problems.append('비밀번호 변경 전 차단 안 됨')
            code, body = call(staff, 'POST', '/api/admin/password',
                              {'currentPassword': TEST_PW, 'newPassword': TEST_PW + 'x'})
            if code != 200:
                problems.append('비밀번호 변경 실패 %s %s' % (code, body[:100]))
            for method, path, payload, want in EXPECT:
                code, _ = call(staff, method, path, payload)
                ok = code == want
                print('%-8s %-36s %s (%s)' % (method, path, code, '✔' if ok else '✘ 기대 %s' % want))
                if not ok: problems.append('%s %s → %s' % (method, path, code))
    finally:
        code, _ = call(owner, 'DELETE', '/api/admin/users/%s' % uid)
        print('시험 계정 삭제:', code)
        call(owner, 'POST', '/api/admin/logout')
    print('\n문제:', len(problems), '건')
    for p in problems: print('  -', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
