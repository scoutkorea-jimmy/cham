#!/usr/bin/env python3
"""크롤러가 실제로 받는 문서를 잰다 — 스크린샷·클릭 검사가 못 잡는 것.

사람이 보는 화면과 검색엔진이 받는 문서는 다르다. 자바스크립트로 그리는 화면은
브라우저에서 멀쩡해도 크롤러에게는 빈 문서다. 실제로 2026-08-23 에 사이트맵이
색인해 달라고 내던 상품 상세 14건이 **본문 21자에 제목이 전부 같은 문서**였다
→ docs/failures.md

보는 것 넷:
  1. 태그를 걷어낸 **본문 글자 수** (스크립트를 돌리지 않은 상태)
  2. **제목이 서로 다른가** — 여러 주소가 같은 제목이면 구글이 중복으로 묶어 버린다
  3. JSON-LD 가 **파싱되는가**, 그 안의 주소가 **절대 주소인가**
  4. canonical 이 있는가

쓰기:
  ./venv/bin/python .claude/skills/verify/tools/crawler_view.py            # 운영
  ./venv/bin/python .claude/skills/verify/tools/crawler_view.py http://127.0.0.1:8788
"""
import json
import re
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://charmjt.org'

# 본문이 이만큼은 되어야 검색엔진이 '내용이 있는 문서'로 본다.
# 얇은 문서(thin content)는 색인에서 빠지거나 순위가 크게 밀린다.
MIN_BODY = 400

# 사이트맵이 색인해 달라고 내는 주소는 전부 여기 있어야 한다.
PATHS = ['/', '/about', '/ferments', '/vinegar', '/nuruk', '/instructor',
         '/products', '/news', '/contact']


def fetch(path):
    req = urllib.request.Request(
        BASE + path,
        # 크롤러로서 요청한다 — 서버가 수집기에 따라 다르게 답할 수 있다
        headers={'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; '
                               '+http://www.google.com/bot.html)'})
    return urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'replace')


def text_of(html):
    """스크립트·스타일을 뺀 실제 글자. 크롤러가 읽는 것과 같은 범위."""
    b = re.sub(r'<(script|style|noscript)[^>]*>.*?</\1>', '', html, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', b)).strip()


def product_paths():
    """사이트맵이 싣고 있는 상품·글 주소. 여기가 가장 자주 비어 있다."""
    try:
        # fetch() 를 쓴다 — User-Agent 없이 요청하면 Cloudflare 가 403 으로 막는다
        xml = fetch('/sitemap.xml')
    except urllib.error.URLError as e:
        print('  sitemap.xml 을 못 읽었다:', e)
        return []
    out = []
    for loc in re.findall(r'<loc>(.*?)</loc>', xml):
        if '?id=' in loc:
            out.append(loc.replace(BASE, '') or '/')
    return out


def check(path, titles, problems):
    try:
        html = fetch(path)
    except urllib.error.HTTPError as e:
        problems.append((path, 'HTTP %s' % e.code))
        print('%-34s HTTP %s' % (path, e.code))
        return

    body = text_of(html)
    m = re.search(r'<title>(.*?)</title>', html, re.S)
    title = m.group(1).strip() if m else ''
    canon = re.search(r'<link rel="canonical" href="(.*?)"', html)

    lds, ld_bad, ld_rel = [], 0, 0
    for raw in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(raw)
        except ValueError:
            ld_bad += 1
            continue
        lds.append(d.get('@type'))
        # 주소 칸에 상대 경로가 남아 있으면 구글은 그 항목을 통째로 버린다
        for key in re.findall(r'"(url|logo|image|item|@id|sameAs)"\s*:\s*"([^"]*)"', raw):
            v = key[1]
            if v and not re.match(r'^(https?:)?//', v):
                ld_rel += 1

    flags = []
    if len(body) < MIN_BODY:
        flags.append('본문 %d자 — 얇다' % len(body))
    if not title:
        flags.append('제목 없음')
    elif title in titles:
        flags.append('제목이 %s 와 같다' % titles[title])
    else:
        titles[title] = path
    if not canon:
        flags.append('canonical 없음')
    if ld_bad:
        flags.append('JSON-LD %d건 깨짐' % ld_bad)
    if ld_rel:
        flags.append('JSON-LD 상대주소 %d건' % ld_rel)

    for f in flags:
        problems.append((path, f))
    print('%-34s %6d자  %-38s %s' % (path, len(body), ','.join(t for t in lds if t),
                                     '· '.join(flags)))


def main():
    print('크롤러 시점 검사 —', BASE)
    print('%-34s %7s  %-38s %s' % ('경로', '본문', 'JSON-LD', '문제'))
    print('-' * 108)
    titles, problems = {}, []
    for p in PATHS:
        check(p, titles, problems)
    extra = product_paths()
    if extra:
        print('-- 사이트맵이 실은 상세 주소 %d건 --' % len(extra))
        for p in extra:
            check(p, titles, problems)
    print('-' * 108)
    if problems:
        print('문제 %d건' % len(problems))
        for p, f in problems:
            print('  -', p, '→', f)
        return 1
    print('문제 없음')
    return 0


if __name__ == '__main__':
    sys.exit(main())
