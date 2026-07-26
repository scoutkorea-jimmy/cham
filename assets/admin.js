/* ============================================================
   admin.js — 관리자 콘솔 (localStorage + IndexedDB 데모)
   대시보드(방문·주문 통계) · 상품 관리(등록/수정 · Tiptap 상세설명 · 이미지 미리보기 · 관련상품 드롭다운)
   주문 관리(직관적 단계별 버튼 + 처리 안내) · 지도사 신청 · 문의 · 게시글
   파트너(가로형 로고) · 팝업(이미지) · 동의문(서브탭) · KMS(서브탭)
   인증: 상태 미저장(새로고침 시 재인증) · SHA-256 · 5회 실패 5분 잠금
   ============================================================ */
(function () {
  'use strict';
  var S = window.Site || {};
  // 저장소는 site.js 한 곳을 통한다(서버 모드면 D1, 아니면 localStorage).
  // 여기서 localStorage 를 직접 읽으면 서버 모드에서 빈 화면이 된다.
  function gj(k, d){ return S.getJSON(k, d); }
  function sj(k, v){ return S.setJSON(k, v); }
  var esc = S.esc, fmtWon = S.fmtWon, stTag = S.stTag, uid = S.uid;
  function icons(){ if (window.lucide) window.lucide.createIcons(); }
  function fmtDate(iso){ if(!iso) return '-'; var d = new Date(iso); if(isNaN(d)) return esc(iso); return d.getFullYear()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+('0'+d.getDate()).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function toast(msg){ if (S.toast) S.toast(msg); }

  // ObjectURL 수명 관리 — 재렌더 시 이전 URL 회수(메모리 누수 방지)
  var objUrls = [];
  function mkURL(blob){ var u = URL.createObjectURL(blob); objUrls.push(u); return u; }
  function revokeURLs(){ objUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); objUrls = []; }

  var K = {
    orders: 'kach_orders', apps: 'kach_applications', inq: 'kach_inquiries',
    popups: (S.POPUP_KEY || 'kach_popups_v1'), posts: (S.POSTS_KEY || 'kach_posts_v1'),
    consents: (S.CONSENT_KEY || 'kach_consents_v1'), kms: 'kach_kms_v1',
  };
  var OSTAT = S.OSTAT; // ['주문접수','결제완료','배송준비중','배송중','배송완료']
  var CRX = ['취소', '반품요청', '반품완료', '교환요청', '교환완료'];
  var TRACKED = ['택배', '소포', '등기'];
  var COURIERS = ['CJ대한통운', '우체국택배', '롯데택배', '한진택배', '로젠택배', '기타'];

  /* ---------- 구버전 데이터 마이그레이션 ---------- */
  function migrate() {
    var map = { '신규': '주문접수', '입금대기': '주문접수', '확인': '결제완료', '완료': '배송완료' };
    var a = gj(K.orders, []), dirty = false;
    a.forEach(function (r) {
      if (map[r.status]) { r.status = map[r.status]; dirty = true; }
      if (!r.orderNo) { r.orderNo = (r.at || '').slice(0, 10).replace(/-/g, '') + ('0000' + Math.floor(Math.random() * 100000)).slice(-5); dirty = true; }
      if (!r.payMethod) { r.payMethod = '무통장입금'; dirty = true; }
    });
    if (dirty) sj(K.orders, a);
    try { localStorage.removeItem('kach_members'); localStorage.removeItem('kach_admin'); } catch (e) {}
  }


  /* ---------- KMS 기본 문서 ---------- */
  var KMS_DEFAULTS = {
    standard: [
      '■ 표준 KMS — 개발 관련 규칙 및 원칙',
      '한국참전통발효식품협동조합 홈페이지 · 지식관리 문서',
      '',
      '[1. 기술 스택]',
      '- 순수 HTML + CSS + 바닐라 JavaScript (빌드 도구 없음)',
      '- 정적 호스팅(GitHub Pages/Netlify/Nginx)에 그대로 배포',
      '- 외부 의존: Lucide 아이콘, Pretendard·페이북 글꼴, Tiptap v2(esm.sh · 에디터), Leaflet+OSM(약도)',
      '',
      '[2. 파일 구조 원칙]',
      '- 페이지 1개 = HTML 1개. 공통 헤더/푸터는 site.js가 #site-nav / #site-footer에 주입',
      '- assets/site.js 공통 셸·스토어·모달 / shop.js 제품 / board.js 게시판 / editor.js 공용 에디터 / admin.js 관리자',
      '- 페이지 전용 스타일은 해당 HTML의 <style id="page-style"> 안에만 작성',
      '',
      '[3. 데이터 계층 (데모 → 운영 전환 지점)]',
      '- 텍스트 데이터: localStorage (kach_* 키) / 파일·이미지: IndexedDB kach_db(files·gallery·pimg)',
      '- 운영 전환 시 site.js submitModal(), admin.js 각 저장 호출을 서버 API(fetch)로 교체',
      '',
      '[4. 개인정보 원칙]',
      '- 회원 계정·아이디·이메일을 수집/관리하지 않음 (비회원 구조, 이메일은 주문 조회용 선택 입력만)',
      '- 모든 수집 양식은 개인정보 동의 체크 후에만 제출 버튼 활성화. 동의문은 관리자 > 동의문 관리에서 수정',
      '',
      '[5. 인증·보안 원칙]',
      '- 로그인 상태를 저장하지 않음(localStorage/sessionStorage 미사용) → 새로고침/이동 시 재인증',
      '- 관리 버튼은 클릭 시점에 인증을 요구하며, 자격증명은 평문이 아닌 SHA-256 해시로 비교',
      '- 무작위 대입 방지: 5회 실패 시 5분 잠금(시도 카운터만 저장)',
      '- 데모 한계: 클라이언트 검증이므로 운영 시 반드시 서버 세션/토큰 인증 + HTTPS + 서버측 레이트리밋으로 교체',
      '- 비밀번호·계정 정보를 화면/문서/README/소스에 평문으로 노출하지 않음',
      '',
      '[6. 주문 상태 표준]',
      '- 정상 흐름: 주문접수 → 결제완료 → 배송준비중 → 배송중 → 배송완료',
      '- 예외 상태: 취소 / 반품요청 / 반품완료 / 교환요청 / 교환완료',
      '- 되돌리기는 이전 단계로만 허용. 입금확인은 무통장입금 주문(주문접수)에만 적용',
      '- 운송장 필수: 택배·소포·등기 / 추적불가 수단은 강제 배송완료로 마감',
      '- 반품·교환은 배송중·배송완료에서만 접수 → 수거·검수 후 완료로 마감',
      '',
      '[7. SEO / AI 검색 최적화 원칙]',
      '- 전 페이지: title·description·og 메타 + JSON-LD(Organization·BreadcrumbList·Product)',
      '- robots.txt / sitemap.xml / llms.txt 유지 — 도메인 확정 시 절대 URL로 교체',
      '- 시맨틱 마크업, 이미지 alt 필수, lang="ko" 명시, admin.html은 noindex',
      '',
      '[8. 코드 컨벤션]',
      '- 공통 스크립트는 ES5 호환 스타일, IIFE로 전역 오염 방지, window.Site 단일 공개 API',
      '- 색상·간격·글꼴은 디자인 룰북의 CSS 변수 토큰만 사용 — 하드코딩 금지',
      '- 사용자 입력은 esc()로 이스케이프 후 렌더 (게시글·상품설명 본문은 관리자 작성 HTML만 허용)',
    ].join('\n'),
    design: [
      '■ 디자인 룰북 — 디자인 표준 관리 · 기록',
      '모든 디자인 항목은 본 룰북 기준으로 관리한다. 변경 시 assets/site.css :root 토큰과 본 문서를 함께 갱신한다.',
      '',
      '[1. 컬러 팔레트] — KB금융그룹 톤앤매너 기반 + 전통 발효 보조색',
      '- 배경 --bg #FFFFFF(화이트) / 표면 --surface #FFFFFF / 인셋 --surface-2 #F5F3EF',
      '- 메인 --main #60584C(KB 그레이) · deep #4B443A · deeper #33302A · tint #F2F0EB',
      '- 포인트 --point #FFBC00(KB 옐로우) · deep #EBA900 · tint #FFF3D2 · ink #33302A',
      '- 보조 --olive #6E8252(올리브·발효) · deep #56683E · tint #EDF0E4',
      '- 서브 --sub #E2D9BE(오트밀) · soft #F0EBD7 · deep #CFC49E',
      '- 텍스트 --ink #2A2723 / soft #5C564C / mute #706859 / faint #B4AD9E',
      '- 규칙 ⑤: 어두운 패널(.band-deep/.page-hero.deep) 위 라벨(.eyebrow)은 옐로우로 반전한다(올리브는 2.2:1로 판독 불가).',
      '- 시맨틱 ok #3E7D4F · warn #C9912F · danger #C0492E · info #4A6E86',
      '- 규칙 ①: 옐로우는 "면(배경)" 전용. 옐로우를 글자색으로 쓰지 않는다(흰 바탕 대비 1.7:1로 판독 불가).',
      '- 규칙 ②: 옐로우 면 위 글자·아이콘은 반드시 --point-ink(#33302A) 사용.',
      '- 규칙 ③: 강조 텍스트(링크·라벨·가격)는 --olive-deep 또는 --ink. 필수표시(*)만 --danger.',
      '- 규칙 ④: 포인트는 CTA·강조 한정, 대면적 사용 금지.',
      '',
      '[2. 타이포그래피]',
      '- 제목·본문: PayboocFont(페이북) → Pretendard Variable 폴백 / 보조 손글씨: Gaegu',
      '- 스케일: display 40~76 · h1 32~48 · h2 26~36 · h3 26 · h4 21 · h5 18 · 본문 16 · sm 14 · caption 13 · micro 11 (px)',
      '- 행간: 제목 1.12~1.3 / 본문 1.6 / 여유 본문 1.8 — 키커는 자간 0.22em + 대문자',
      '',
      '[3. 간격 · 리듬]',
      '- 4px 그리드: --s1(4) ~ --s32(128) / 섹션 상하 여백 --sec-pad 80px',
      '- 콘텐츠 폭: 기본 1200px(--maxw), 좁은 본문 880px, 내비 높이 76px',
      '',
      '[4. 모서리 · 그림자]',
      '- 라운드: xs4 / sm8 / md12 / lg18(카드 기본) / xl26 / pill 999',
      '- 그림자: y축 오프셋만(sh-xs~sh-lg), CTA 호버 시 sh-point(대추 글로우)',
      '',
      '[5. 모션 · 인터랙션]',
      '- 기본 240ms / fast 150ms / slow 420ms · cubic-bezier(0.22, 0.61, 0.36, 1)',
      '- reveal: 요소가 처음 보일 때 1회만 등장(상승+페이드+미세 스케일). 동적 요소는 revealScan()으로 등록',
      '- 미세 인터랙션: 내비 스크롤 시 그림자, 카드 호버 시 상승·아이콘 배지 회전, 파트너 마키 호버 일시정지',
      '- prefers-reduced-motion 존중',
      '',
      '[6. 전통 문양]',
      '- 단색 배경면에 칠보문(七寶紋) 겹원 패턴을 은은하게 (--pat-dark/--pat-light, 54px). 강도 pat-off/기본/pat-strong',
      '',
      '[7. 컴포넌트 표준]',
      '- 버튼: pill형. btn-point(대추)=핵심 CTA / btn-primary(메인) / btn-ghost(보조) / btn-on-dark(짙은 배경)',
      '- 카드: surface + 1px line-soft + r-lg + sh-sm, 호버 시 3px 상승 + sh-md',
      '- 태그: sub-soft(기본) / point(강조) / sample(점선=예시) / solid(메인)',
      '- 모달: 중앙 dialog(r-xl) + dim blur. 폼은 form-grid 2열(모바일 1열)',
      '- 동의 박스: 체크 시에만 제출 활성화 / 결제 안내: 오트밀 배경',
      '- 주문 상태 색: 주문접수 warn / 결제완료 info / 배송준비중 main / 배송중 point / 배송완료 ok / 취소·반품 mute·danger',
      '- 관리자 콘솔: 멀티 항목 섹션(KMS·동의문)은 상단 서브탭으로 구성',
      '',
      '[8. 아이콘]',
      '- Lucide 단일 패밀리. 본문 17px · 배지 26px · 캡션 14~16px',
      '',
      '[9. 반응형 기준점]',
      '- 1080px: 내비 햄버거 / 960·900px: 4열→2열 / 880px: 상품상세 1열+하단 구매바 / 640px: 1열',
    ].join('\n'),
  };
  function getKMS() {
    var k = gj(K.kms, {}) || {};
    return { standard: k.standard || KMS_DEFAULTS.standard, design: k.design || KMS_DEFAULTS.design };
  }

  /* ---------- 공통 행 조작 ---------- */
  var STATUS = { apps: ['신규', '상담', '확정', '수료', '취소'], inq: ['신규', '답변완료', '보류'] };
  function updateField(key, id, field, val) { var a = gj(key, []); a.forEach(function(r){ if(r.id===id) r[field]=val; }); sj(key, a); }
  function removeRow(key, id) { sj(key, gj(key, []).filter(function(r){ return r.id !== id; })); }
  function statusSelect(key, sk, r) {
    return '<select class="st-sel" data-act="status" data-key="' + key + '" data-id="' + r.id + '">' +
      STATUS[sk].map(function(o){ return '<option' + (o === r.status ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
  }
  function delBtn(key, id) { return '<button class="icon-btn" data-act="del" data-key="' + key + '" data-id="' + id + '" title="삭제"><i data-lucide="trash-2"></i></button>'; }
  function emptyRow(cols, msg) { return '<tr><td colspan="' + cols + '"><div class="admin-empty"><i data-lucide="inbox"></i><div>' + msg + '</div></div></td></tr>'; }

  /* ---------- 서브탭 (KMS · 동의문 공용) ---------- */
  function subtabs(items, active) {
    return '<div class="subtabs">' + items.map(function (it) {
      return '<button data-subtab="' + it.id + '" class="' + (it.id === active ? 'on' : '') + '">' +
        (it.icon ? '<i data-lucide="' + it.icon + '"></i>' : '') + it.label + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- 문서 렌더러 (KMS · 동의문 보기 모드) ----------
     규칙: ■ 제목 / [N. 섹션] / - 불릿 / 빈 줄(문단 구분) / 인라인 #RRGGBB 색상칩 */
  function colorize(s) {
    return s.replace(/#([0-9A-Fa-f]{6})\b/g, function (m, hex) {
      return '<span class="kms-swatch" style="background:#' + hex + '"></span>' + m;
    });
  }
  function renderKMS(text) {
    var lines = String(text || '').split('\n');
    var html = '', ul = false;
    function closeUL() { if (ul) { html += '</ul>'; ul = false; } }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      var t = line.trim();
      var mSec = t.match(/^\[(\d+)\.\s*(.+?)\]$/);
      if (t === '') { closeUL(); return; }
      if (t.charAt(0) === '■') {            // ■ 문서 제목
        closeUL();
        html += '<h2 class="kms-title">' + colorize(esc(t.slice(1).trim())) + '</h2>';
      } else if (mSec) {                          // [N. 섹션]
        closeUL();
        html += '<h3 class="kms-sec"><span class="kms-num">' + esc(mSec[1]) + '</span>' + colorize(esc(mSec[2])) + '</h3>';
      } else if (t.charAt(0) === '-') {           // - 불릿
        if (!ul) { html += '<ul class="kms-ul">'; ul = true; }
        html += '<li>' + colorize(esc(t.replace(/^-\s?/, ''))) + '</li>';
      } else {                                     // 일반 문단(부제·번호줄 등)
        closeUL();
        html += '<p class="kms-p">' + colorize(esc(t)) + '</p>';
      }
    });
    closeUL();
    return '<div class="kms-view rich">' + html + '</div>';
  }
  // 보기/편집 토글 패널 (KMS·동의문 공용)
  function docPanel(opts) {
    // opts: { mode, dataAttr, key, body, label, hint, saveAct, resetAct, editAct, cancelAct, monospace }
    var head = '<div class="panel-head"><h3>' + opts.label + '</h3><span class="ph-sub">' + opts.hint + '</span>' +
      (opts.mode === 'view'
        ? '<button class="btn btn-ghost" style="padding:9px 16px;margin-left:auto" data-act="' + opts.editAct + '"><i data-lucide="pen-line"></i>편집</button>'
        : '') + '</div>';
    var bodyHtml = opts.mode === 'view'
      ? '<div style="padding:8px 22px 22px">' + renderKMS(opts.body) + '</div>'
      : '<div style="padding:22px"><textarea ' + opts.dataAttr + '="' + opts.key + '" rows="' + (opts.monospace ? 22 : 14) + '" style="width:100%;' +
          (opts.monospace ? 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:#FFFEF9;' : 'font:inherit;font-size:13.5px;') +
          'line-height:1.7;padding:16px 18px;border:1.5px solid var(--line);border-radius:10px;resize:vertical">' + esc(opts.body) + '</textarea>' +
          '<div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-point" data-act="' + opts.saveAct + '"><i data-lucide="check"></i>저장</button>' +
          '<button class="btn btn-ghost" data-act="' + opts.cancelAct + '"><i data-lucide="x"></i>취소</button>' +
          '<button class="btn btn-ghost" data-act="' + opts.resetAct + '" style="margin-left:auto"><i data-lucide="rotate-ccw"></i>표준안 복원</button></div>' +
        '</div>';
    return '<div class="panel">' + head + bodyHtml + '</div>';
  }

  /* ============================================================
     대시보드
     ============================================================ */
  function viewDashboard() {
    var orders = gj(K.orders, []), apps = gj(K.apps, []), inq = gj(K.inq, []);
    var visits = gj(S.VISITS_KEY, {});
    var today = S.todayStr();
    var tv = visits[today] || { pv: 0, uv: 0 };
    var totalUV = 0; Object.keys(visits).forEach(function (d) { totalUV += (visits[d].uv || 0); });
    var todayOrders = orders.filter(function (o) { return (o.at || '').slice(0, 10) === today; });
    var todayRevenue = todayOrders.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var newOrders = orders.filter(function (o) { return o.status === '주문접수'; }).length;
    var newEtc = apps.filter(function (r) { return r.status === '신규'; }).length + inq.filter(function (r) { return r.status === '신규'; }).length;

    var stats = [
      { i: 'users', v: tv.uv, l: '오늘 방문자', sub: '페이지뷰 ' + tv.pv + ' · 누적 방문 ' + totalUV },
      { i: 'shopping-cart', v: todayOrders.length, l: '오늘 주문', sub: todayRevenue ? fmtWon(todayRevenue) + '원' : '결제금액 0원' },
      { i: 'banknote', v: newOrders, l: '입금 확인 대기', sub: '전체 주문 ' + orders.length + '건' },
      { i: 'bell-ring', v: newEtc, l: '신규 신청 · 문의', sub: '지도사 신청 ' + apps.length + ' · 문의 ' + inq.length },
    ];
    var cards = stats.map(function(s){
      return '<div class="stat"><div class="si"><i data-lucide="' + s.i + '"></i></div><div class="sv">' + s.v + '</div><div class="sl">' + s.l + '</div><div class="ss">' + s.sub + '</div></div>';
    }).join('');

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      days.push({ label: (d.getMonth() + 1) + '.' + d.getDate(), uv: (visits[key] || {}).uv || 0, pv: (visits[key] || {}).pv || 0 });
    }
    var maxUv = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.uv; })));
    var chart = '<div class="vchart">' + days.map(function (d) {
      var h = Math.max(4, Math.round(d.uv / maxUv * 100));
      return '<div class="vc-col" title="' + d.label + ' · 방문 ' + d.uv + ' · 뷰 ' + d.pv + '"><span class="vc-val">' + d.uv + '</span><div class="vc-bar" style="height:' + h + 'px"></div><span class="vc-day">' + d.label + '</span></div>';
    }).join('') + '</div>';

    var recent = orders.concat(apps).concat(inq).sort(function(a,b){ return (b.at||'').localeCompare(a.at||''); }).slice(0, 7);
    var rows = recent.length ? recent.map(function(r){
      var label = r.kind === 'order' ? '주문' : r.kind === 'seedjang' ? '씨장분양' : r.course ? '지도사신청' : r.type ? '문의' : '신청';
      var detail = r.product || r.amount || r.course || r.type || '-';
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td><span class="tag">' + label + '</span></td><td>' + esc(r.name || '-') + '</td><td>' + esc(detail) + '</td><td>' + stTag(r.status || '신규') + '</td></tr>';
    }).join('') : emptyRow(5, '아직 접수된 내역이 없습니다.');

    // 방문자 유입 분석(유입 경로별 그래프)
    var srcData = gj(S.SOURCES_KEY, {});
    var srcOrder = ['직접 방문', '검색엔진', '소셜·블로그', '기타 사이트'];
    var srcTotal = srcOrder.reduce(function (s, k) { return s + (srcData[k] || 0); }, 0);
    var srcMeta = { '직접 방문': { c: 'var(--main)', i: 'link' }, '검색엔진': { c: 'var(--info)', i: 'search' }, '소셜·블로그': { c: 'var(--point)', i: 'share-2' }, '기타 사이트': { c: 'var(--ink-mute)', i: 'globe' } };
    var srcBars = srcTotal ? srcOrder.map(function (k) {
      var n = srcData[k] || 0, pct = Math.round(n / srcTotal * 100), m = srcMeta[k];
      return '<div class="src-row"><div class="src-top"><span class="src-name"><i data-lucide="' + m.i + '"></i>' + k + '</span><span class="src-num">' + n + '명 <em>' + pct + '%</em></span></div><div class="src-track"><div class="src-fill" style="width:' + Math.max(2, pct) + '%;background:' + m.c + '"></div></div></div>';
    }).join('') : '<div class="admin-empty" style="padding:30px 10px"><i data-lucide="route"></i><div>아직 유입 데이터가 없습니다.<br>방문이 쌓이면 경로별로 표시됩니다.</div></div>';

    // 주문 상태 분포 그래프
    var stMap = {}; orders.forEach(function (o) { var s = o.status || '기타'; stMap[s] = (stMap[s] || 0) + 1; });
    var stKeys = Object.keys(stMap).sort(function (a, b) { return stMap[b] - stMap[a]; });
    var stMax = stKeys.length ? Math.max.apply(null, stKeys.map(function (k) { return stMap[k]; })) : 1;
    var stBars = stKeys.length ? stKeys.map(function (k) {
      var n = stMap[k], c = (S.ST_COLOR && S.ST_COLOR[k]) || '#6E8252', w = Math.round(n / stMax * 100);
      return '<div class="src-row"><div class="src-top"><span class="src-name">' + stTag(k) + '</span><span class="src-num">' + n + '건</span></div><div class="src-track"><div class="src-fill" style="width:' + Math.max(3, w) + '%;background:' + c + '"></div></div></div>';
    }).join('') : '<div class="admin-empty" style="padding:30px 10px"><i data-lucide="inbox"></i><div>주문이 없습니다.</div></div>';

    // 오늘 해야 할 일(실무 처리 대기 항목 — 누르면 해당 화면으로 이동)
    var needPay = orders.filter(function (o) { return o.status === '주문접수'; }).length;
    var needShip = orders.filter(function (o) { return o.status === '결제완료' || o.status === '배송준비중'; }).length;
    var needRma = orders.filter(function (o) { return o.status === '반품요청' || o.status === '교환요청'; }).length;
    var needApp = apps.filter(function (r) { return r.status === '신규'; }).length;
    var needInq = inq.filter(function (r) { return r.status === '신규'; }).length;
    var todos = [
      { n: needPay, label: '결제(입금) 확인', i: 'banknote', nav: 'orders', otab: '주문접수' },
      { n: needShip, label: '발송 처리', i: 'truck', nav: 'orders', otab: '결제완료' },
      { n: needRma, label: '취소·반품·교환', i: 'undo-2', nav: 'orders', otab: 'crx' },
      { n: needApp, label: '지도사 신청', i: 'user-plus', nav: 'apps' },
      { n: needInq, label: '문의 답변', i: 'message-square', nav: 'inq' },
    ];
    var totalTodo = todos.reduce(function (s, t) { return s + t.n; }, 0);
    var todoCards = todos.map(function (t) {
      var on = t.n > 0;
      return '<button class="todo' + (on ? ' on' : '') + '" data-nav="' + t.nav + '"' + (t.otab ? ' data-otab="' + t.otab + '"' : '') + '>' +
        '<span class="todo-i"><i data-lucide="' + t.i + '"></i></span>' +
        '<span class="todo-n">' + t.n + '<em>건</em></span>' +
        '<span class="todo-l">' + t.label + '</span>' +
        (on ? '<span class="todo-go">처리하러 가기 <i data-lucide="arrow-right"></i></span>' : '<span class="todo-go done">처리 완료</span>') +
      '</button>';
    }).join('');
    var todoPanel = '<div class="panel todo-panel"><div class="panel-head"><h3>오늘 해야 할 일</h3><span class="ph-sub">' + (totalTodo ? '처리 대기 ' + totalTodo + '건 — 항목을 누르면 해당 화면으로 바로 이동합니다' : '밀린 일이 없습니다 👍') + '</span></div><div class="todo-grid">' + todoCards + '</div></div>';

    // 홈 팝업 빠른 게시/중지 — 대시보드에서 바로 올리고 내림
    var pops = gj(K.popups, []);
    var popRows = pops.length ? pops.map(function (p) {
      return '<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line-soft)">' +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(p.title) + '</b>' +
        '<span class="pc-sub" style="margin-left:10px">' + (p.startsAt || '상시') + (p.endsAt ? ' ~ ' + p.endsAt : '') + '</span></span>' +
        '<span class="pc-sub">' + (p.active ? '게시 중' : '중지됨') + '</span>' +
        '<button class="toggle ' + (p.active ? 'on' : '') + '" data-act="poptoggle" data-id="' + p.id + '" title="게시/중지"><i></i></button></div>';
    }).join('') : '<div class="admin-empty" style="padding:20px 10px"><i data-lucide="bell-off"></i><div>등록된 팝업이 없습니다. ‘팝업 관리’에서 추가하세요.</div></div>';
    var popPanel = '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>홈 팝업 게시/중지</h3><button class="btn btn-ghost" data-nav="popups" style="padding:8px 16px"><i data-lucide="bell"></i>팝업 관리로 이동</button></div><div style="padding:8px 22px 14px">' + popRows + '</div></div>';

    /* ── 판매 현황 (주간 · 월간) ──────────────────────────────
       매출은 '결제완료 이후'만 센다(매출·정산 화면과 같은 기준) — 입금 확인이 안 된
       주문을 팔린 것으로 세면 통장과 어긋난다. 지난 기간 대비 증감을 함께 보여
       '이번 주가 좋은가'를 숫자 하나로 판단하지 않게 한다. */
    function sum(list){ return list.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0); }
    function delta(now, prev) {
      if (!prev) return now ? { txt: '새로 발생', cls: 'up' } : { txt: '지난 기간도 0', cls: 'flat' };
      var r = Math.round((now - prev) / prev * 100);
      if (r === 0) return { txt: '지난 기간과 같음', cls: 'flat' };
      return { txt: (r > 0 ? '▲ ' : '▼ ') + Math.abs(r) + '%', cls: r > 0 ? 'up' : 'down' };
    }
    var wNow = salesOrders('week'), wPrev = salesOrders('lastweek');
    var mNow = salesOrders('month'), mPrev = salesOrders('last');
    var wSum = sum(wNow), wPrevSum = sum(wPrev), mSum = sum(mNow), mPrevSum = sum(mPrev);
    var wD = delta(wSum, wPrevSum), mD = delta(mSum, mPrevSum);
    var wR = periodRange('week'), mR = periodRange('month');

    // 최근 7일 일별 매출 — 요일별 흐름을 보려면 합계 하나로는 부족하다
    var paid = gj(K.orders, []).filter(function (o) { return PAID_STATES.indexOf(o.status) > -1; });
    var byDay = {};
    paid.forEach(function (o) { var d = (o.at || '').slice(0, 10); byDay[d] = (byDay[d] || 0) + (Number(o.total) || 0); });
    var sdays = [];
    for (var si = 6; si >= 0; si--) {
      var sd = new Date(); sd.setDate(sd.getDate() - si);
      var sk = ymd(sd);
      sdays.push({ label: (sd.getMonth() + 1) + '.' + sd.getDate(), amt: byDay[sk] || 0,
                   dow: ['일','월','화','수','목','금','토'][sd.getDay()] });
    }
    var sMax = Math.max.apply(null, sdays.map(function (d) { return d.amt; })) || 1;
    var salesBars = '<div class="vchart">' + sdays.map(function (d) {
      var h = d.amt ? Math.max(6, Math.round(d.amt / sMax * 100)) : 3;
      return '<div class="vc-col" title="' + d.label + ' · ' + fmtWon(d.amt) + '원">' +
        '<span class="vc-val">' + (d.amt ? Math.round(d.amt / 10000) + '만' : '-') + '</span>' +
        '<div class="vc-bar' + (d.amt ? '' : ' zero') + '" style="height:' + h + 'px"></div>' +
        '<span class="vc-day">' + d.label + '<em>' + d.dow + '</em></span></div>';
    }).join('') + '</div>';

    function saleCard(title, range, amount, count, dd, prevLabel, prevAmount) {
      return '<div class="sale-card">' +
        '<div class="sc-top"><b>' + title + '</b><span class="sc-range">' + range + '</span></div>' +
        '<div class="sc-amt">' + fmtWon(amount) + '<em>원</em></div>' +
        '<div class="sc-sub">주문 ' + count + '건' + (count ? ' · 건당 평균 ' + fmtWon(Math.round(amount / count)) + '원' : '') + '</div>' +
        '<div class="sc-delta ' + dd.cls + '">' + dd.txt + ' <span>(' + prevLabel + ' ' + fmtWon(prevAmount) + '원)</span></div>' +
      '</div>';
    }
    var salesPanel = '<div class="panel"><div class="panel-head"><h3>판매 현황</h3>' +
        '<span class="ph-sub">입금이 확인된 주문만 셉니다 — 통장과 맞습니다</span>' +
        '<button class="btn btn-ghost" data-nav="sales" style="padding:8px 16px;margin-left:auto"><i data-lucide="trending-up"></i>자세히 보기</button></div>' +
      '<div class="sale-grid">' +
        saleCard('주간 판매', wR.from.slice(5).replace('-', '.') + ' ~ ' + wR.to.slice(5).replace('-', '.'), wSum, wNow.length, wD, '지난 주', wPrevSum) +
        saleCard('월간 판매', wR.from.slice(0, 4) + '년 ' + String(Number(mR.from.slice(5, 7))) + '월', mSum, mNow.length, mD, '지난 달', mPrevSum) +
      '</div>' +
      '<div style="padding:4px 22px 22px"><div class="ph-sub" style="margin-bottom:10px">최근 7일 일별 매출</div>' + salesBars + '</div>' +
    '</div>';

    var visitPanel = '<div class="panel"><div class="panel-head"><h3>최근 7일 방문 추이</h3><span class="ph-sub">방문자 수 기준 · 데모 집계</span></div><div style="padding:22px">' + chart + '</div></div>';
    var sourcePanel = '<div class="panel"><div class="panel-head"><h3>방문자 유입 분석</h3><span class="ph-sub">총 ' + srcTotal + '회 방문</span></div><div style="padding:20px 22px 24px"><div class="src-list">' + srcBars + '</div></div></div>';
    var recentPanel = '<div class="panel"><div class="panel-head"><h3>최근 접수 내역</h3><span class="ph-sub">주문 · 신청 · 문의 통합</span></div><table class="admin-table"><thead><tr><th>일시</th><th>구분</th><th>이름</th><th>내용</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    var statusPanel = '<div class="panel"><div class="panel-head"><h3>주문 상태 분포</h3><span class="ph-sub">전체 ' + orders.length + '건</span></div><div style="padding:20px 22px 24px"><div class="src-list">' + stBars + '</div></div></div>';

    return '<div class="dash">' +
      todoPanel +
      salesPanel +
      '<div class="stat-grid">' + cards + '</div>' +
      popPanel +
      '<div class="dash-2col">' + visitPanel + sourcePanel + '</div>' +
      '<div class="dash-2col">' + recentPanel + statusPanel + '</div>' +
    '</div>';
  }

  /* ============================================================
     상품 관리
     ============================================================ */
  var prodEditing = null;      // null=목록, 'new'=신규, id=수정
  var pImgState = { main: null, extra: [], detail: [], removed: [] };
  var descEditor = null, prodDescInit = '';

  function viewProducts() {
    if (prodEditing !== null) return productFormHTML(prodEditing === 'new' ? null : S.getProduct(prodEditing));
    var a = S.getProducts();
    var rows = a.length ? a.map(function (p) {
      var stock = p.option && p.option.values ? p.option.values.reduce(function (s, v) { return s + (Number(v.stock) || 0); }, 0) : (Number(p.stock) || 0);
      var priceTxt = p.salePrice != null && p.salePrice !== ''
        ? '<span style="text-decoration:line-through;color:var(--ink-faint);font-size:12px">' + fmtWon(p.price) + '</span> <b>' + fmtWon(p.salePrice) + '원</b>'
        : '<b>' + fmtWon(p.price) + '원</b>';
      // 업로드 사진이 없으면 상품에 지정된 정적 사진(p.photo)을, 그것도 없으면 아이콘을 보여준다
      var thumb = p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '<i data-lucide="image"></i>';
      return '<tr><td style="width:64px"><div class="pthumb" data-pthumb="' + p.id + '">' + thumb + '</div></td>' +
        '<td><b>' + esc(p.name) + '</b><div class="pc-sub">' + esc(p.unit || '') + (p.option ? ' · 옵션 ' + p.option.values.length + '종' : '') + '</div></td>' +
        '<td><span class="tag">' + esc(p.cat) + '</span></td><td>' + priceTxt + '</td><td>' + stock + '</td>' +
        '<td><select class="st-sel" data-act="pstatus" data-id="' + p.id + '">' + ['판매중', '품절', '숨김'].map(function (s) { return '<option' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
        '<td style="white-space:nowrap"><div style="display:inline-flex;gap:6px;align-items:center">' +
        '<button class="btn btn-point" data-act="pedit" data-id="' + p.id + '" style="padding:8px 15px"><i data-lucide="pen-line"></i>수정</button>' +
        '<a class="btn btn-ghost" href="product.html?id=' + p.id + '" target="_blank" title="새 창에서 상세페이지 보기" style="padding:8px 13px;text-decoration:none"><i data-lucide="external-link"></i>보기</a>' +
        '<button class="icon-btn" data-act="pdel" data-id="' + p.id + '" title="삭제"><i data-lucide="trash-2"></i></button>' +
        '</div></td></tr>';
    }).join('') : emptyRow(7, '등록된 상품이 없습니다.');
    setTimeout(loadListThumbs, 20);
    return '<div class="panel" style="max-width:none"><div class="panel-head"><h3>상품 목록</h3><button class="btn btn-point" data-act="pnew" style="padding:10px 18px"><i data-lucide="plus"></i>상품 등록</button></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>사진</th><th>상품명</th><th>분류</th><th>판매가</th><th>재고</th><th>판매 상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function loadListThumbs() {
    document.querySelectorAll('[data-pthumb]').forEach(function (box) {
      S.Media.list('product', box.dataset.pthumb).then(function (imgs) {
        imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
        var main = imgs.filter(function (i) { return i.role === 'main'; })[0] || imgs[0];
        if (main) box.innerHTML = '<img src="' + main.url + '" alt="">';
      });
    });
  }

  function gosiField(name, label, val, req) {
    return '<div class="field"><label>' + label + (req ? '<span style="color:var(--point)"> *</span>' : '') + '</label><input name="gosi_' + name + '" value="' + esc(val || '') + '"' + (req ? ' required' : '') + '></div>';
  }

  function productFormHTML(p) {
    var isEdit = !!p;
    var g = (p && p.gosi) || S.gosiBase({});
    var opt = p && p.option;
    var optRows = opt ? opt.values.map(function (v) { return optRowHTML(v); }).join('') : '';
    prodDescInit = p ? (p.descHtml || '') : '';
    var allP = S.getProducts();
    var relItems = allP.filter(function (x) { return !p || x.id !== p.id; }).map(function (x) {
      var on = p && (p.related || []).indexOf(x.id) > -1;
      return '<label class="ms-opt"><input type="checkbox" name="rel" value="' + x.id + '" data-name="' + esc(x.name) + '"' + (on ? ' checked' : '') + '><span>' + esc(x.name) + '</span><span class="ms-cat">' + esc(x.cat) + '</span></label>';
    }).join('');
    setTimeout(loadProductImages, 30);
    return '<div class="panel" style="max-width:none"><div class="panel-head"><h3>' + (isEdit ? '상품 수정 — ' + esc(p.name) : '새 상품 등록') + '</h3>' +
      '<button class="btn btn-ghost" data-act="pback" style="padding:9px 16px"><i data-lucide="arrow-left"></i>목록으로</button></div>' +
      '<form class="admin-form" id="productForm" data-pid="' + (isEdit ? p.id : '') + '">' +
        '<div class="field"><label>상품명 <span style="color:var(--point)">*</span></label><input name="name" required value="' + esc(p ? p.name : '') + '"></div>' +
        '<div class="field"><label>분류</label><select name="cat">' + S.PRODUCT_CATS.map(function (c) { return '<option' + (p && p.cat === c.name ? ' selected' : '') + '>' + c.name + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>판매가 (원) <span style="color:var(--point)">*</span></label><input name="price" type="number" min="0" required value="' + (p ? p.price : '') + '"></div>' +
        '<div class="field"><label>할인가 (원 · 비우면 할인 없음)</label><input name="salePrice" type="number" min="0" value="' + (p && p.salePrice != null ? p.salePrice : '') + '"></div>' +
        '<div class="field"><label>단위 (예: 1kg, 세트)</label><input name="unit" value="' + esc(p ? p.unit : '') + '"></div>' +
        '<div class="field"><label>기본 재고 (옵션 없을 때)</label><input name="stock" type="number" min="0" value="' + (p ? p.stock : 30) + '"></div>' +
        '<div class="field"><label>판매 상태</label><select name="status">' + ['판매중', '품절', '숨김'].map(function (s) { return '<option' + (p && p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>간단 설명</label><input name="summary" value="' + esc(p ? p.summary : '') + '"></div>' +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px"><b>상세 설명</b><div class="pc-sub" style="margin-top:2px">판매자 직접 관리 — Tiptap 에디터(이미지·표·영상 등 전체 기능)</div></div>' +
        '<div class="field full"><div class="tt-toolbar" id="pdescBar"></div><div class="tt-body"><div id="pdescEditor"></div></div></div>' +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px"><b>이미지</b><div class="pc-sub" style="margin-top:2px">대표 1장 · 추가 갤러리 · 상세 이미지 — 선택 즉시 미리보기 (IndexedDB 저장)</div></div>' +
        '<div class="field"><label>대표 이미지</label><input type="file" accept="image/*" id="pImgMain"></div>' +
        '<div class="field"><label>추가 이미지 (여러 장)</label><input type="file" accept="image/*" multiple id="pImgExtra"></div>' +
        '<div class="field"><label>상세 이미지 (여러 장)</label><input type="file" accept="image/*" multiple id="pImgDetail"></div>' +
        '<div class="full"><div class="pc-sub" style="margin-bottom:6px">미리보기</div><div id="pImgList" class="pimg-grid"></div><div id="pImgNew" class="pimg-grid"></div></div>' +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px;display:flex;align-items:center;gap:12px"><b>옵션</b>' +
          '<label style="display:inline-flex;gap:7px;align-items:center;font-size:13.5px;cursor:pointer"><input type="checkbox" id="optUse"' + (opt ? ' checked' : '') + ' style="accent-color:var(--main)">옵션 사용</label></div>' +
        '<div class="full" id="optWrap" style="' + (opt ? '' : 'display:none') + '">' +
          '<div class="field" style="max-width:280px;margin-bottom:10px"><label>옵션명 (예: 포장, 용량)</label><input id="optName" value="' + esc(opt ? opt.name : '') + '"></div>' +
          '<div id="optRows">' + optRows + '</div>' +
          '<button type="button" class="btn btn-ghost" data-act="optadd" style="padding:8px 14px;margin-top:8px"><i data-lucide="plus"></i>옵션값 추가</button>' +
        '</div>' +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px"><b>상품정보고시</b><div class="pc-sub" style="margin-top:2px">식품 필수 항목: 원재료 · 소비기한 · 보관방법</div></div>' +
        gosiField('pname', '품명 및 모델명', g.pname) + gosiField('maker', '제조사', g.maker) +
        gosiField('country', '제조국', g.country) + gosiField('origin', '원산지', g.origin) +
        gosiField('volume', '용량 · 중량', g.volume) + gosiField('ingredients', '원재료명 및 함량', g.ingredients, true) +
        gosiField('expiry', '소비기한', g.expiry, true) + gosiField('storage', '보관방법', g.storage, true) +
        gosiField('phone', '소비자상담 전화번호', g.phone) + gosiField('warranty', '품질보증 기준', g.warranty) +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px"><b>배송 / 교환·반품·환불 안내</b></div>' +
        '<div class="field full"><label>배송안내 <button type="button" class="btn-text" data-act="tpl-ship" style="font-size:12px;margin-left:8px">기본 템플릿 불러오기</button></label><textarea name="ship" rows="4">' + esc(p ? p.ship : S.SHIP_TPL) + '</textarea></div>' +
        '<div class="field full"><label>교환·반품·환불 안내 <button type="button" class="btn-text" data-act="tpl-refund" style="font-size:12px;margin-left:8px">기본 템플릿 불러오기</button></label><textarea name="refund" rows="4">' + esc(p ? p.refund : S.REFUND_TPL) + '</textarea></div>' +

        '<div class="full" style="border-top:1px solid var(--line-soft);padding-top:18px"><b>관련 상품</b><div class="pc-sub" style="margin-top:2px">상세페이지 하단에 노출 · 드롭다운에서 여러 개 선택</div></div>' +
        '<div class="full"><div class="ms" id="relMS">' +
          '<button type="button" class="ms-toggle" data-act="msopen"><span class="ms-label">관련 상품 선택</span><i data-lucide="chevron-down"></i></button>' +
          '<div class="ms-panel" id="relPanel" hidden><input type="text" class="ms-search" id="relSearch" placeholder="상품 검색…"><div class="ms-list">' + (relItems || '<div class="pc-sub" style="padding:10px">다른 상품이 없습니다.</div>') + '</div></div>' +
          '<div class="ms-chips" id="relChips"></div>' +
        '</div></div>' +

        '<div class="full" style="display:flex;gap:10px;border-top:1px solid var(--line-soft);padding-top:18px">' +
          '<button class="btn btn-point" type="submit"><i data-lucide="check"></i>' + (isEdit ? '수정 저장' : '상품 등록') + '</button>' +
          '<button class="btn btn-ghost" type="button" data-act="pback">취소</button>' +
        '</div>' +
      '</form></div>';
  }
  function optRowHTML(v) {
    return '<div class="opt-row" style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">' +
      '<input placeholder="옵션값 (예: 전통 보자기 포장)" class="ov-label" value="' + esc(v ? v.label : '') + '" style="flex:2;min-width:160px">' +
      '<input placeholder="추가금액" type="number" class="ov-add" value="' + (v ? v.add : 0) + '" style="flex:1;min-width:90px">' +
      '<input placeholder="재고" type="number" class="ov-stock" value="' + (v ? v.stock : 10) + '" style="flex:1;min-width:70px">' +
      '<button type="button" class="icon-btn" data-act="optdel" title="옵션값 삭제"><i data-lucide="x"></i></button></div>';
  }
  function loadProductImages() {
    var box = document.getElementById('pImgList');
    var form = document.getElementById('productForm');
    if (!box || !form || !form.dataset.pid) return;
    S.Media.list('product', form.dataset.pid).then(function (imgs) {
      imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
      box.innerHTML = imgs.map(function (im) {
        if (pImgState.removed.indexOf(im.id) > -1) return '';
        return '<div class="pimg-cell"><img src="' + im.url + '"><span class="pimg-role">' + (im.role === 'main' ? '대표' : im.role === 'detail' ? '상세' : '추가') + '</span>' +
          '<button type="button" class="gal-del" data-act="pimgdel" data-id="' + im.id + '"><i data-lucide="x"></i></button></div>';
      }).join('');
      icons();
    });
  }
  function renderNewPreviews() {
    var box = document.getElementById('pImgNew');
    if (!box) return;
    var html = '';
    if (pImgState.main) html += previewCell(pImgState.main, '대표(신규)');
    pImgState.extra.forEach(function (f) { html += previewCell(f, '추가(신규)'); });
    pImgState.detail.forEach(function (f) { html += previewCell(f, '상세(신규)'); });
    box.innerHTML = html;
    icons();
  }
  function previewCell(file, label) {
    return '<div class="pimg-cell new"><img src="' + mkURL(file) + '"><span class="pimg-role">' + label + '</span></div>';
  }
  function updateRelChips() {
    var ms = document.getElementById('relMS'); if (!ms) return;
    var checked = Array.prototype.slice.call(ms.querySelectorAll('input[name=rel]:checked'));
    ms.querySelector('#relChips').innerHTML = checked.map(function (c) {
      return '<span class="ms-chip">' + esc(c.dataset.name) + '<button type="button" data-relx="' + c.value + '"><i data-lucide="x"></i></button></span>';
    }).join('');
    ms.querySelector('.ms-label').textContent = checked.length ? ('관련 상품 ' + checked.length + '개 선택') : '관련 상품 선택';
    icons();
  }

  function bindProductForm() {
    var form = document.getElementById('productForm');
    if (!form) return;
    pImgState = { main: null, extra: [], detail: [], removed: pImgState.removed || [] };

    var mi = document.getElementById('pImgMain');
    if (mi) mi.addEventListener('change', function(){ pImgState.main = mi.files[0] || null; renderNewPreviews(); });
    var ei = document.getElementById('pImgExtra');
    if (ei) ei.addEventListener('change', function(){ pImgState.extra = Array.prototype.slice.call(ei.files || []); renderNewPreviews(); });
    var di = document.getElementById('pImgDetail');
    if (di) di.addEventListener('change', function(){ pImgState.detail = Array.prototype.slice.call(di.files || []); renderNewPreviews(); });
    var ou = document.getElementById('optUse');
    if (ou) ou.addEventListener('change', function(){ document.getElementById('optWrap').style.display = ou.checked ? '' : 'none'; });

    // 관련상품 드롭다운
    var relMS = document.getElementById('relMS');
    if (relMS) {
      updateRelChips();
      relMS.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="msopen"]')) { document.getElementById('relPanel').toggleAttribute('hidden'); icons(); return; }
        var rx = e.target.closest('[data-relx]');
        if (rx) { var cb = relMS.querySelector('input[value="' + rx.dataset.relx + '"]'); if (cb) { cb.checked = false; updateRelChips(); } }
      });
      var rs = document.getElementById('relSearch');
      if (rs) rs.addEventListener('input', function () {
        var q = rs.value.trim().toLowerCase();
        relMS.querySelectorAll('.ms-opt').forEach(function (o) {
          o.style.display = o.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none';
        });
      });
    }

    // 상세 설명 에디터
    if (window.RichEditor && document.getElementById('pdescEditor')) {
      window.RichEditor.mount({
        toolbarEl: document.getElementById('pdescBar'),
        editorEl: document.getElementById('pdescEditor'),
        content: prodDescInit,
        placeholder: '상품 상세 설명을 입력하세요…',
      }).then(function (ed) { descEditor = ed; }).catch(function () {
        var h = document.getElementById('pdescEditor');
        if (h) h.innerHTML = '<div style="padding:14px;color:var(--danger)">에디터를 불러오지 못했습니다. 네트워크를 확인해 주세요.</div>';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var products = S.getProducts();
      var pid = form.dataset.pid;
      var rec = pid ? products.filter(function (x) { return x.id === pid; })[0] : null;
      if (!rec) { rec = { id: 'p_' + uid(), icon: 'package', tone: 'tone-oat', related: [] }; products.push(rec); }
      rec.name = fd.get('name'); rec.cat = fd.get('cat');
      rec.price = Number(fd.get('price')) || 0;
      rec.salePrice = fd.get('salePrice') === '' ? null : Number(fd.get('salePrice'));
      rec.unit = fd.get('unit'); rec.stock = Number(fd.get('stock')) || 0;
      rec.status = fd.get('status'); rec.summary = fd.get('summary');
      rec.descHtml = descEditor ? descEditor.getHTML() : prodDescInit;
      rec.ship = fd.get('ship'); rec.refund = fd.get('refund');
      rec.gosi = {
        pname: fd.get('gosi_pname'), maker: fd.get('gosi_maker'), country: fd.get('gosi_country'), origin: fd.get('gosi_origin'),
        volume: fd.get('gosi_volume'), ingredients: fd.get('gosi_ingredients'), expiry: fd.get('gosi_expiry'), storage: fd.get('gosi_storage'),
        phone: fd.get('gosi_phone'), warranty: fd.get('gosi_warranty'),
      };
      if (!rec.gosi.ingredients || !rec.gosi.expiry || !rec.gosi.storage) { alert('상품정보고시의 원재료·소비기한·보관방법은 필수 입력입니다.'); return; }
      if (document.getElementById('optUse').checked) {
        var vals = [];
        document.querySelectorAll('#optRows .opt-row').forEach(function (row) {
          var label = row.querySelector('.ov-label').value.trim();
          if (!label) return;
          vals.push({ label: label, add: Number(row.querySelector('.ov-add').value) || 0, stock: Number(row.querySelector('.ov-stock').value) || 0 });
        });
        rec.option = vals.length ? { name: document.getElementById('optName').value.trim() || '옵션', values: vals } : null;
      } else rec.option = null;
      rec.related = Array.prototype.slice.call(form.querySelectorAll('input[name=rel]:checked')).map(function (c) { return c.value; });
      if (!S.setProducts(products)) { toast('저장 공간이 부족합니다. 상세 설명의 첨부 이미지를 줄이거나 데이터를 백업·정리해 주세요.'); return; }

      var jobs = [];
      pImgState.removed.forEach(function (iid) { jobs.push(S.Media.del('product', iid)); });
      if (pImgState.main) {
        // 대표는 한 장뿐이라 새로 올리기 전에 기존 대표를 지운다
        jobs.push(S.Media.list('product', rec.id).then(function (imgs) {
          return Promise.all(imgs.filter(function (i) { return i.role === 'main'; }).map(function (i) { return S.Media.del('product', i.id); }));
        }).then(function () { return S.Media.put('product', rec.id, pImgState.main, { role: 'main', ord: 0 }); }));
      }
      pImgState.extra.forEach(function (f, i) { jobs.push(S.Media.put('product', rec.id, f, { role: 'extra', ord: i + 1 })); });
      pImgState.detail.forEach(function (f, i) { jobs.push(S.Media.put('product', rec.id, f, { role: 'detail', ord: i })); });
      Promise.all(jobs).then(function (results) {
        prodEditing = null;
        pImgState = { main: null, extra: [], detail: [], removed: [] };
        render();
        // 이미지 올리기는 실패해도 null 로 끝난다 — 저장됐다고만 알리면 사진이 빠진 걸 나중에 안다
        var fail = results.filter(function (r) { return r === null || r === false; }).length;
        toast('상품이 저장되었습니다.' + (fail ? ' (사진 ' + fail + '건은 처리하지 못했습니다 — 다시 확인해 주세요)' : ''));
      });
    });
  }

  /* ============================================================
     주문 관리 — 단계별 직관 버튼 + 처리 안내
     ============================================================ */
  var orderTab = 'all';
  var OACT = {
    paid:    { label: '입금확인', from: ['주문접수'], kind: 'simple', to: '결제완료',
               desc: '무통장입금 주문의 입금을 확인하여 「결제완료」로 변경합니다. 입금자명과 입금액을 먼저 확인하세요. (주문접수 상태에만 적용)' },
    prep:    { label: '배송준비', from: ['결제완료'], kind: 'simple', to: '배송준비중',
               desc: '결제완료 주문을 「배송준비중」으로 변경합니다. 이때부터 구매자는 임의로 취소할 수 없고, 취소하려면 판매자 승인이 필요합니다.' },
    ship:    { label: '발송처리', from: ['결제완료', '배송준비중'], kind: 'ship',
               desc: '운송장 번호를 입력하고 배송을 시작해 「배송중」으로 변경합니다. (택배·소포·등기는 운송장 필수)' },
    cancel:  { label: '판매취소', from: ['주문접수', '결제완료', '배송준비중'], kind: 'reason', to: '취소',
               desc: '재고 부족 등으로 판매자가 주문을 취소·환불합니다. (배송 전 단계에서만 가능)' },
    ret:     { label: '반품 접수', from: ['배송중', '배송완료'], kind: 'rma', to: '반품요청',
               desc: '배송된 상품의 반품을 접수합니다. 사유와 수거지를 입력하세요. (배송중·배송완료에서만 가능)' },
    exch:    { label: '교환 접수', from: ['배송중', '배송완료'], kind: 'rma', to: '교환요청',
               desc: '배송된 상품의 교환을 접수합니다. 사유와 수거지를 입력하세요. (배송중·배송완료에서만 가능)' },
    retdone: { label: '반품 완료', from: ['반품요청'], kind: 'simple', to: '반품완료',
               desc: '반품 상품 수거·검수 및 환불까지 마친 주문을 「반품완료」로 마감합니다.' },
    exchdone:{ label: '교환 완료', from: ['교환요청'], kind: 'simple', to: '교환완료',
               desc: '교환 상품 발송까지 마친 주문을 「교환완료」로 마감합니다.' },
    force:   { label: '강제 배송완료', from: ['배송중'], kind: 'simple', to: '배송완료',
               desc: '배송 추적이 불가한 수단(직접배송·방문수령·퀵서비스 등)의 배송을 수동으로 완료 처리합니다.' },
  };
  function revertAct(target) {
    return { label: '「' + target + '」(으)로 되돌리기', kind: 'simple', to: target, revert: true,
      from: OSTAT.slice(OSTAT.indexOf(target) + 1),
      desc: '주문 상태를 이전 단계(' + target + ')로 되돌립니다. 이후 단계로의 진행은 각 처리 버튼을 사용하세요.' };
  }

  function ordersOf(tab) {
    var a = gj(K.orders, []);
    if (tab === 'all') return a;
    if (tab === 'crx') return a.filter(function (o) { return CRX.indexOf(o.status) > -1; });
    return a.filter(function (o) { return o.status === tab; });
  }
  function obtn(key, primary) {
    var d = OACT[key];
    return '<button class="obtn' + (primary ? ' primary' : '') + '" data-oact="' + key + '" title="' + esc(d.desc) + '">' + d.label + '</button>';
  }
  function orderGuide() {
    var flow = ['주문접수', '결제완료', '배송준비중', '배송중', '배송완료'];
    var chips = flow.map(function (s, i) {
      return stTag(s) + (i < flow.length - 1 ? '<i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--ink-faint)"></i>' : '');
    }).join('');
    return '<details class="oguide"><summary><i data-lucide="help-circle"></i>주문 처리 안내 — 단계와 버튼 설명 (펼치기)</summary>' +
      '<div class="oguide-body">' +
        '<div class="oflow">' + chips + '</div>' +
        '<ul>' +
          '<li><b>입금확인</b> — 무통장입금 주문의 입금 확인 → 결제완료 <span class="muted">(주문접수에만)</span></li>' +
          '<li><b>배송준비</b> — 상품 준비 시작 → 배송준비중 <span class="muted">(이후 구매자 임의취소 불가)</span></li>' +
          '<li><b>발송처리</b> — 운송장 입력 → 배송중 <span class="muted">(택배·소포·등기는 운송장 필수, 그 외 수단은 강제 배송완료로 마감)</span></li>' +
          '<li><b>강제 배송완료</b> — 추적 불가 배송수단을 수동으로 배송완료</li>' +
          '<li><b>판매취소</b> — 배송 전 주문을 취소·환불</li>' +
          '<li><b>반품/교환 접수 → 완료</b> — 배송중·배송완료 주문만 접수, 수거·검수 후 완료로 마감</li>' +
          '<li><b>되돌리기</b> — 상태를 이전 단계로만 되돌림 <span class="muted">(이후 단계로는 각 처리 버튼 사용)</span></li>' +
        '</ul>' +
      '</div></details>';
  }

  function viewOrders() {
    var all = gj(K.orders, []);
    var tabMeta = { '주문접수': '입금 대기' };
    var tabs = [{ id: 'all', label: '전체', n: all.length }]
      .concat(OSTAT.map(function (s) { return { id: s, label: s, n: all.filter(function (o) { return o.status === s; }).length, hint: tabMeta[s] }; }))
      .concat([{ id: 'crx', label: '취소·반품·교환', n: all.filter(function (o) { return CRX.indexOf(o.status) > -1; }).length }]);
    var tabHtml = '<div class="otabs">' + tabs.map(function (t) {
      return '<button data-otab="' + t.id + '" class="' + (orderTab === t.id ? 'on' : '') + '"' + (t.hint ? ' title="' + t.hint + '"' : '') + '>' + t.label + (t.n ? '<span class="cnt">' + t.n + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    var revertBtns = OSTAT.slice(0, 4).map(function (s) { return '<button data-oact="rv:' + s + '">「' + s + '」(으)로</button>'; }).join('');
    var bar = '<div class="obar">' +
      '<div class="ogrp"><span class="ogrp-l">결제 · 배송 진행</span>' +
        obtn('paid', true) + obtn('prep') + obtn('ship', true) +
      '</div>' +
      '<div class="ogrp"><span class="ogrp-l">취소 · 반품 · 교환</span>' +
        obtn('cancel') + obtn('ret') + obtn('exch') + obtn('retdone') + obtn('exchdone') +
      '</div>' +
      '<div class="ogrp"><span class="ogrp-l">상태 조정</span>' +
        '<div class="odrop"><button class="obtn" id="odropBtn" title="상태를 이전 단계로 되돌립니다">이전 단계로 되돌리기 ▾</button><div class="odrop-menu" id="odropMenu">' + revertBtns + '</div></div>' +
        obtn('force') +
      '</div>' +
    '</div>';

    var list = ordersOf(orderTab);
    var rows = list.length ? list.map(function (o) {
      var item = o.kind === 'seedjang' ? (o.amount || '씨장 분양') : (o.product || '-');
      var shipInfo = o.tracking ? '<div class="pc-sub" style="margin-top:3px">' + esc(o.courier || '') + ' ' + esc(o.tracking) + '</div>'
        : (o.shipMethod ? '<div class="pc-sub" style="margin-top:3px">' + esc(o.shipMethod) + '</div>' : '');
      var reason = o.cancelReason || o.rmaReason ? '<div class="pc-sub" style="margin-top:3px">사유: ' + esc(o.cancelReason || o.rmaReason) + '</div>' : '';
      return '<tr><td><input type="checkbox" class="osel" data-id="' + o.id + '" style="width:16px;height:16px;accent-color:var(--main)"></td>' +
        '<td><b style="font-variant-numeric:tabular-nums">' + esc(o.orderNo || '-') + '</b><div class="dt">' + fmtDate(o.at) + '</div></td>' +
        '<td>' + (o.kind === 'seedjang' ? '<span class="tag point">씨장분양</span>' : '<span class="tag">제품</span>') + '</td>' +
        '<td><b>' + esc(item) + '</b>' + (o.optionLabel ? '<div class="pc-sub">' + esc(o.optionLabel) + '</div>' : '') + '</td>' +
        '<td>' + esc(o.qty || '-') + '</td>' +
        '<td style="white-space:nowrap">' + (o.total ? fmtWon(o.total) + '원' : '-') + '</td>' +
        '<td>' + esc(o.name || '-') + '<div class="pc-sub">' + esc(o.phone || '') + '</div></td>' +
        '<td>' + esc(o.depositor || '-') + '<div class="pc-sub">' + esc(o.payMethod || '') + '</div></td>' +
        '<td style="max-width:170px">' + esc(o.address || o.region || '-') + '</td>' +
        '<td>' + stTag(o.status) + shipInfo + reason + '</td>' +
        '<td>' + delBtn(K.orders, o.id) + '</td></tr>';
    }).join('') : emptyRow(11, '해당 상태의 주문이 없습니다.');

    return '<div class="panel" style="max-width:none"><div class="panel-head"><h3>주문 관리</h3><span class="ph-sub">주문을 선택한 뒤 단계 버튼으로 처리 · 자동 알림(메일/SMS)은 운영 연동 시 발송</span><div class="panel-tools">' + csvBtn('orders') + '</div></div>' +
      '<div style="padding:16px 22px 0">' + orderGuide() + tabHtml + bar +
        '<div style="margin-top:12px"><input id="oSearch" type="search" autocomplete="off" placeholder="주문번호 · 주문자 · 연락처 · 입금자명 · 상품 검색" style="width:380px;max-width:100%;padding:12px 15px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:16px;background:var(--surface)"></div>' +
      '</div>' +
      '<div style="overflow-x:auto"><table class="admin-table" style="font-size:13px"><thead><tr>' +
        '<th><input type="checkbox" id="oselAll" style="width:16px;height:16px;accent-color:var(--main)"></th>' +
        '<th>주문번호 / 시각</th><th>구분</th><th>주문상품</th><th>수량</th><th>금액</th><th>주문자</th><th>입금자명</th><th>배송지</th><th>상태</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function selectedOrderIds() {
    return Array.prototype.slice.call(document.querySelectorAll('.osel:checked')).map(function (c) { return c.dataset.id; });
  }

  function procOrders(actKey) {
    var def = actKey.indexOf('rv:') === 0 ? revertAct(actKey.slice(3)) : OACT[actKey];
    if (!def) return;
    var ids = selectedOrderIds();
    if (!ids.length) { alert('처리할 주문을 먼저 선택해 주세요. (주문 왼쪽 체크박스)'); return; }
    var all = gj(K.orders, []);
    var sel = all.filter(function (o) { return ids.indexOf(o.id) > -1; });
    var elig = sel.filter(function (o) { return def.from.indexOf(o.status) > -1; });
    if (!elig.length) {
      alert('선택하신 ' + sel.length + '개의 주문 중 「' + def.label + '」 가능한 주문이 없습니다.\n· 처리 가능 상태: ' + def.from.join(', '));
      return;
    }
    var info = '<div class="proc-info">선택하신 <b>' + sel.length + '개</b>의 주문 중 처리 가능한 주문은 <b style="color:var(--point)">' + elig.length + '건</b>입니다.</div>' +
      '<div class="modal-note" style="margin-bottom:14px"><i data-lucide="info"></i><span>' + esc(def.desc) + '</span></div>';
    var table = '<div style="overflow-x:auto;border:1px solid var(--line-soft);border-radius:10px"><table class="admin-table" style="font-size:13px"><thead><tr><th>주문번호</th><th>현재 상태</th><th>상품명</th>' +
      (def.kind === 'ship' ? '<th>운송장번호</th>' : '') + '</tr></thead><tbody>' +
      elig.map(function (o) {
        return '<tr><td style="font-variant-numeric:tabular-nums">' + esc(o.orderNo) + '</td><td>' + stTag(o.status) + '</td><td>' + esc(o.product || o.amount || '-') + '</td>' +
          (def.kind === 'ship' ? '<td><input class="otrk" data-id="' + o.id + '" placeholder="운송장번호" style="width:150px;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:12.5px"></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';

    var extra = '';
    if (def.kind === 'ship') {
      extra = '<div class="form-grid" style="margin-top:14px">' +
        '<div class="field"><label>배송수단</label><select id="procMethod">' +
          ['택배', '소포', '등기', '기타택배', '직접배송(화물)', '방문수령', '퀵서비스', '배송없음'].map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>택배사</label><select id="procCourier">' + COURIERS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="modal-note" style="margin-top:12px"><i data-lucide="info"></i><span>택배·소포·등기는 운송장번호가 필수입니다(미입력 시 처리 불가). ‘배송없음’ 상품은 즉시 배송완료됩니다. 추적 불가 수단은 발송 후 ‘강제 배송완료’로 마감하세요.</span></div>';
    } else if (def.kind === 'reason') {
      extra = '<div class="form-grid" style="margin-top:14px">' +
        '<div class="field"><label>판매취소 사유</label><select id="procReason"><option>구매자 요청</option><option>재고 없음</option><option>주문 오류</option><option>기타</option></select></div>' +
        '<div class="field"><label>상세 메모 (선택)</label><input id="procMemo" placeholder="구매자 안내 메모"></div></div>' +
        '<div class="modal-note" style="margin-top:12px"><i data-lucide="info"></i><span>무통장입금 주문은 입금 여부를 확인한 뒤 환불 계좌를 구매자와 협의해 주세요.</span></div>';
    } else if (def.kind === 'rma') {
      extra = '<div class="form-grid" style="margin-top:14px">' +
        '<div class="field"><label>' + (def.to === '반품요청' ? '반품' : '교환') + ' 사유</label><select id="procReason"><option>단순 변심</option><option>상품 하자</option><option>오배송</option><option>기타</option></select></div>' +
        '<div class="field"><label>수거 주소</label><input id="procPickup" placeholder="기본: 주문 배송지" value="' + esc(elig.length === 1 ? (elig[0].address || '') : '') + '"></div></div>' +
        '<div class="modal-note" style="margin-top:12px"><i data-lucide="info"></i><span>수거 완료 후 「' + (def.to === '반품요청' ? '반품 완료' : '교환 완료') + '」로 마감하세요.</span></div>';
    }

    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">주문 관리</div><h3>' + def.label + '</h3></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body">' + info + table + extra +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
        '<button type="button" class="btn btn-point" id="procConfirm"><i data-lucide="check"></i>' + def.label + ' 실행</button></div>' +
      '</div>', 680);

    document.getElementById('procConfirm').addEventListener('click', function () {
      var orders = gj(K.orders, []);
      var eligIds = elig.map(function (o) { return o.id; });
      if (def.kind === 'ship') {
        var method = document.getElementById('procMethod').value;
        var courier = document.getElementById('procCourier').value;
        var tracked = TRACKED.indexOf(method) > -1;
        var trks = {};
        var missing = false;
        document.querySelectorAll('.otrk').forEach(function (i) { trks[i.dataset.id] = i.value.trim(); if (tracked && !i.value.trim()) missing = true; });
        if (missing) { alert('택배·소포·등기 발송은 모든 주문의 운송장번호 입력이 필수입니다.'); return; }
        orders.forEach(function (o) {
          if (eligIds.indexOf(o.id) === -1) return;
          o.shipMethod = method;
          if (tracked) { o.courier = courier; o.tracking = trks[o.id]; }
          o.status = method === '배송없음' ? '배송완료' : '배송중';
        });
      } else if (def.kind === 'reason') {
        var r = document.getElementById('procReason').value;
        var m = document.getElementById('procMemo').value.trim();
        orders.forEach(function (o) { if (eligIds.indexOf(o.id) > -1) { o.status = def.to; o.cancelReason = r + (m ? ' — ' + m : ''); } });
      } else if (def.kind === 'rma') {
        var rr = document.getElementById('procReason').value;
        var pk = document.getElementById('procPickup').value.trim();
        orders.forEach(function (o) { if (eligIds.indexOf(o.id) > -1) { o.status = def.to; o.rmaReason = rr; o.pickupAddr = pk || o.address || ''; } });
      } else {
        orders.forEach(function (o) {
          if (eligIds.indexOf(o.id) === -1) return;
          o.status = def.to;
          if (def.revert && OSTAT.indexOf(def.to) < OSTAT.indexOf('배송중')) { delete o.tracking; delete o.courier; delete o.shipMethod; }
        });
      }
      sj(K.orders, orders);
      S.closeModal();
      render();
      toast(elig.length + '건의 주문을 「' + def.label + '」 처리했습니다.');
    });
  }

  /* ============================================================
     지도사 신청 · 문의
     ============================================================ */
  function cohortStatusSel(c) {
    return '<select class="st-sel" data-act="cstatus" data-id="' + c.id + '">' +
      ['모집중', '예정', '상시', '마감'].map(function (s) { return '<option' + (c.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
  }
  // 기수 이름 → 신청 인원. 신청서의 '신청 기수'는 '31기 (2026.05.15 ~ 07.24)' 형태로
  // 저장되므로 기수명으로 시작하는지로 센다.
  function applicantsPerCohort() {
    var apps = gj(K.apps, []);
    var map = {};
    S.getCohorts().forEach(function (c) {
      map[c.id] = apps.filter(function (r) { return String(r.course || '').indexOf(c.name) === 0; }).length;
    });
    return map;
  }
  function cohortPanel() {
    var list = S.getCohorts();
    var per = applicantsPerCohort();
    var rows = list.length ? list.map(function (c) {
      var nApp = per[c.id] || 0;
      return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.period || '-') + '</td><td>' + esc(c.schedule || '-') + '</td><td>' + esc(c.place || '-') + '</td>' +
        '<td>' + (nApp ? '<b>' + nApp + '명</b>' : '<span class="pc-sub">0명</span>') + '</td>' +
        '<td>' + cohortStatusSel(c) +
        '</td><td><button class="icon-btn" data-act="cdel" data-id="' + c.id + '" title="기수 삭제"><i data-lucide="trash-2"></i></button></td></tr>';
    }).join('') : emptyRow(7, '등록된 기수가 없습니다. 아래에서 추가하세요.');
    return '<div class="panel"><div class="panel-head"><h3>모집 기수</h3><span class="ph-sub">여기서 추가·수정한 기수가 지도사 과정 페이지와 신청서에 그대로 반영됩니다</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>기수명</th><th>교육 기간</th><th>요일·시간</th><th>장소</th><th>신청 인원</th><th>모집 상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<form class="admin-form" id="cohortForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field"><label>기수명 <span style="color:var(--point)">*</span></label><input name="name" required placeholder="예) 2026년 3기"></div>' +
        '<div class="field"><label>교육 기간</label><input name="period" placeholder="예) 2026.09.05 ~ 09.26"></div>' +
        '<div class="field"><label>요일 · 시간</label><input name="schedule" placeholder="예) 토 10:00–16:00"></div>' +
        '<div class="field"><label>장소</label><input name="place" placeholder="예) 구로 본원"></div>' +
        '<div class="field"><label>모집 상태</label><select name="status">' + ['모집중', '예정', '상시', '마감'].map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="field full"><button class="btn btn-point" type="submit" style="padding:10px 18px"><i data-lucide="plus"></i>기수 추가</button></div>' +
      '</form></div>';
  }
  // 목록 검색창 — 해당 테이블 행을 클라이언트에서 즉시 필터(input 위임 처리)
  function listSearch(targetId, ph) {
    return '<input class="list-search" data-target="' + targetId + '" type="search" autocomplete="off" placeholder="' + ph + '">';
  }
  // 처리 상태 뱃지(관리자 메모가 있으면 '처리됨' 표시)
  function handledMark(r) {
    return r.adminMemo ? '<span class="hd-dot" title="처리 메모 있음 · ' + esc(fmtDate(r.handledAt)) + '"></span>' : '';
  }
  /* 교육과정(기수) 관리 — 신청자 명단과 하는 일이 다르다.
     기수를 짜는 일과 신청자에게 연락하는 일은 시점도 사람도 다르므로 화면을 나눈다. */
  function viewCohorts() {
    var list = S.getCohorts();
    var per = applicantsPerCohort();
    var open = list.filter(function (c) { return c.status === '모집중' || c.status === '상시'; });
    var total = Object.keys(per).reduce(function (s, k) { return s + per[k]; }, 0);
    return '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="info"></i><span>' +
        '여기서 만든 기수가 <b>지도사 과정 페이지의 일정표</b>와 <b>신청서의 기수 선택칸</b>에 그대로 나옵니다. ' +
        '일정이 확정되기 전에는 <b>예정</b>으로 두세요 — <b>모집중</b>으로 두면 홈페이지에 잘못된 일정이 안내됩니다.</span></div>' +
      '<div class="stat-grid">' +
        kpi(list.length + '개', '등록된 기수', '') +
        kpi(open.length + '개', '접수 중', open.length ? open.map(function (c) { return esc(c.name); }).join(' · ') : '신청서에 선택지가 없습니다') +
        kpi(total + '명', '기수별 신청 합계', '') +
        kpi(list.filter(function (c) { return c.status === '마감'; }).length + '개', '마감', '') +
      '</div>' +
      '<div style="margin-top:24px">' + cohortPanel() + '</div>';
  }

  function viewApps() {
    var a = gj(K.apps, []);
    var rows = a.length ? a.map(function(r){
      var tel = String(r.phone || '').replace(/[^0-9+]/g, '');
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + handledMark(r) + '<b>' + esc(r.name||'-') + '</b></td>' +
        '<td>' + (tel ? '<a href="tel:' + tel + '" class="tel-link">' + esc(r.phone) + '</a>' : '-') + '</td>' +
        '<td>' + esc(r.region||'-') + '</td><td>' + esc(r.course||'-') + '</td><td>' + statusSelect(K.apps,'apps',r) + '</td>' +
        '<td><button class="btn btn-ghost" data-detail="apps" data-id="' + r.id + '" style="padding:7px 12px"><i data-lucide="pen-line"></i>상세·처리</button></td><td>' + delBtn(K.apps, r.id) + '</td></tr>';
    }).join('') : emptyRow(8, '신청 내역이 없습니다.');
    var byStatus = {};
    STATUS.apps.forEach(function (st) { byStatus[st] = a.filter(function (r) { return r.status === st; }).length; });
    var per = applicantsPerCohort();
    var cohorts = S.getCohorts();
    var cMax = Math.max.apply(null, cohorts.map(function (c) { return per[c.id] || 0; }).concat([1]));
    var cBars = cohorts.length
      ? cohorts.map(function (c) {
          return bar(esc(c.name) + ' <span class="pc-sub">' + esc(c.status) + '</span>',
                     (per[c.id] || 0) + '명', Math.round((per[c.id] || 0) / cMax * 100),
                     c.status === '모집중' || c.status === '상시' ? 'var(--point)' : 'var(--ink-faint)');
        }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="calendar"></i><div>등록된 기수가 없습니다.<br>‘교육과정 관리’에서 먼저 기수를 만드세요.</div></div>';

    var stBars = STATUS.apps.map(function (st) {
      var c = { '신규': 'var(--point)', '상담': 'var(--info)', '확정': 'var(--main)', '수료': 'var(--ok)', '취소': 'var(--ink-faint)' }[st];
      return bar(st, byStatus[st] + '명', a.length ? Math.round(byStatus[st] / a.length * 100) : 0, c);
    }).join('');

    var recent = a.slice(0, 5).map(function (r) {
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td><b>' + esc(r.name || '-') + '</b></td>' +
        '<td>' + esc(r.phone || '-') + '</td><td>' + esc(r.region || '-') + '</td>' +
        '<td>' + esc(r.course || '-') + '</td><td>' + stTag(r.status || '신규') + '</td></tr>';
    });

    return '<div class="stat-grid">' +
        kpi(a.length + '명', '전체 신청자', '누적') +
        kpi(byStatus['신규'] + '명', '연락 안 한 신청', byStatus['신규'] ? '먼저 전화해 주세요' : '모두 연락함') +
        kpi(byStatus['확정'] + '명', '수강 확정', '') +
        kpi(byStatus['수료'] + '명', '수료', '') +
      '</div>' +
      '<div class="dash-2col">' +
        panelWrap('기수별 신청 현황', cohorts.length + '개 기수', '<div class="src-list">' + cBars + '</div>') +
        panelWrap('처리 상태', '전체 ' + a.length + '명', '<div class="src-list">' + stBars + '</div>') +
      '</div>' +
      '<div style="margin-top:24px">' + miniTable('최근 신청', '최신 5명', ['일시', '이름', '연락처', '지역', '신청 기수', '상태'], recent, '아직 신청이 없습니다.') + '</div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>신청자 명단</h3><span class="ph-sub">총 ' + a.length + '명 — 연락처를 눌러 전화할 수 있습니다</span>' +
        '<div class="panel-tools">' + listSearch('appsTable', '이름 · 연락처 · 지역 검색') + csvBtn('apps') + '</div></div>' +
      '<div style="overflow-x:auto"><table class="admin-table" id="appsTable"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>지역</th><th>신청 기수</th><th>상태</th><th>처리</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function viewInq() {
    var a = gj(K.inq, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + handledMark(r) + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td><span class="tag">' + esc(r.type||'문의') + '</span></td><td class="cell-clip">' + esc(r.memo||'-') + '</td><td>' + statusSelect(K.inq,'inq',r) + '</td>' +
        '<td><button class="btn btn-ghost" data-detail="inq" data-id="' + r.id + '" style="padding:7px 12px"><i data-lucide="pen-line"></i>상세·답변</button></td><td>' + delBtn(K.inq, r.id) + '</td></tr>';
    }).join('') : emptyRow(8, '문의 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>문의 내역 관리</h3><span class="ph-sub">총 ' + a.length + '건</span>' +
        '<div class="panel-tools">' + listSearch('inqTable', '이름 · 연락처 · 내용 검색') + csvBtn('inq') + '</div></div>' +
      '<div style="overflow-x:auto"><table class="admin-table" id="inqTable"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>유형</th><th>내용</th><th>상태</th><th>처리</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ---------- 신청·문의 상세·처리 모달 (전체 내용 열람 + 관리자 처리 메모·상태) ---------- */
  var DETAIL_META = {
    apps: { sk: 'apps', title: '지도사 신청 상세', memoLabel: '관리자 처리 메모', fields: [['이름','name'],['연락처','phone'],['지역','region'],['신청 기수','course']], custLabel: '신청자 메모' },
    inq:  { sk: 'inq',  title: '문의 상세',      memoLabel: '관리자 답변 · 처리 메모', fields: [['이름','name'],['연락처','phone'],['유형','type']], custLabel: '문의 내용' },
  };
  function openRecordDetail(kindKey, id) {
    if (!S.rawModal) return;
    var meta = DETAIL_META[kindKey], storeKey = K[kindKey];
    var r = gj(storeKey, []).filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var info = meta.fields.map(function (f) {
      return '<div class="dl-row"><span class="dl-k">' + f[0] + '</span><span class="dl-v">' + esc(r[f[1]] || '-') + '</span></div>';
    }).join('') + '<div class="dl-row"><span class="dl-k">접수일시</span><span class="dl-v">' + esc(fmtDate(r.at)) + '</span></div>';
    var opts = STATUS[meta.sk].map(function (o) { return '<option' + (o === r.status ? ' selected' : '') + '>' + o + '</option>'; }).join('');
    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">처리</div><h3>' + meta.title + '</h3></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><div class="rec-detail" data-rec-key="' + kindKey + '" data-rec-id="' + esc(id) + '">' +
        '<div class="dl">' + info + '</div>' +
        '<div class="field full"><label>' + meta.custLabel + '</label><div class="rec-cust">' + (esc(r.memo || '') || '<span class="pc-sub">(없음)</span>') + '</div></div>' +
        '<div class="field full"><label>상태</label><select class="rec-status st-sel">' + opts + '</select></div>' +
        '<div class="field full"><label>' + meta.memoLabel + '</label><textarea class="rec-memo" rows="4" placeholder="처리 내용·통화 결과·답변 요지를 기록하세요">' + esc(r.adminMemo || '') + '</textarea></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>닫기</button><button type="button" class="btn btn-point" data-act="recSave"><i data-lucide="check"></i>처리 저장</button></div>' +
      '</div></div>', 620);
  }
  function saveRecordDetail() {
    var box = document.querySelector('.rec-detail'); if (!box) return;
    var kindKey = box.dataset.recKey, id = box.dataset.recId, storeKey = K[kindKey];
    var status = box.querySelector('.rec-status').value;
    var memo = box.querySelector('.rec-memo').value.trim();
    var a = gj(storeKey, []);
    a.forEach(function (x) { if (x.id === id) { x.status = status; x.adminMemo = memo; x.handledAt = new Date().toISOString(); } });
    sj(storeKey, a);
    if (S.closeModal) S.closeModal();
    render(); toast('처리 내용이 저장되었습니다.');
  }

  /* ============================================================
     게시글 관리
     ============================================================ */
  function viewPosts() {
    var a = gj(K.posts, []).slice().sort(function (x, y) { return (y.at || '').localeCompare(x.at || ''); });
    var rows = a.length ? a.map(function (p) {
      return '<tr><td><b>' + esc(p.title) + '</b></td>' +
        '<td><span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.cat) + '</span></td>' +
        '<td class="dt">' + fmtDate(p.at) + '</td><td>' + delBtn(K.posts, p.id) + '</td></tr>';
    }).join('') : emptyRow(4, '등록된 게시글이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>게시글 관리</h3><a class="btn btn-point" href="news.html" target="_blank" style="padding:10px 18px"><i data-lucide="pen-line"></i>소식마당에서 글쓰기</a></div>' +
      '<div class="modal-note" style="margin:16px 22px 0"><i data-lucide="info"></i><span>글 작성·수정(Tiptap 에디터, 첨부파일)은 소식마당의 ‘글쓰기’ 버튼에서 진행합니다.</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>제목</th><th>분류</th><th>등록일</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ============================================================
     파트너 · 팝업
     ============================================================ */
  function viewPartners() {
    var a = S.getPartners ? S.getPartners() : gj('kach_partners_v1', []);
    var cards = a.length ? a.map(function(p){
      var logo = p.logo ? '<img src="' + esc(p.logo) + '" alt="">' : esc(p.name);
      return '<div class="pcard"><div class="pc-logo">' + logo + '</div>' +
        '<div><div class="pc-name">' + esc(p.name) + '</div><div class="pc-sub">' + esc(p.url || '') + '</div></div>' +
        '<div class="pc-row"><span class="pc-sub">' + (p.logo ? '로고 등록됨' : '로고 없음 (텍스트 표시)') + '</span>' + delBtn('PARTNER', p.id) + '</div></div>';
    }).join('') : '<div class="admin-empty" style="grid-column:1/-1"><i data-lucide="handshake"></i><div>등록된 파트너가 없습니다.</div></div>';
    return '<div class="panel"><div class="panel-head"><h3>파트너 관리</h3><span class="ph-sub">홈 화면에서 좌측으로 무한 슬라이드 · 총 ' + a.length + '곳</span></div>' +
      '<div class="card-list">' + cards + '</div>' +
      '<form class="admin-form" id="partnerForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field"><label>파트너명 (로고 없을 때 표시)</label><input name="name" required placeholder="예) 정선만장대"></div>' +
        '<div class="field"><label>링크 (선택)</label><input name="url" placeholder="https://"></div>' +
        '<div class="field full"><label>가로형 로고 이미지 <b style="color:var(--point)">권장</b> — 가로로 긴 워드마크/로고 (PNG 투명배경 권장, 세로 54px 자동 맞춤)</label><input name="logo" type="file" accept="image/*"></div>' +
        '<div class="full" style="display:flex;gap:10px"><button class="btn btn-point" type="submit"><i data-lucide="plus"></i>파트너 추가</button><button class="btn btn-ghost" type="button" id="partnerReset"><i data-lucide="rotate-ccw"></i>기본값 복원</button></div>' +
      '</form></div>';
  }

  function viewPopups() {
    var a = gj(K.popups, []);
    var rows = a.length ? a.map(function(p){
      return '<tr><td style="width:74px">' + (p.img ? '<img src="' + esc(p.img) + '" style="width:64px;height:44px;object-fit:cover;border-radius:7px">' : '<span class="pc-sub">없음</span>') + '</td>' +
        '<td><b>' + esc(p.title) + '</b><div class="pc-sub" style="margin-top:3px">' + esc((p.body||'').replace(/\n/g,' ')).slice(0,50) + '</div></td>' +
        '<td class="dt">' + (p.startsAt||'상시') + (p.endsAt?(' ~ '+p.endsAt):'') + '</td>' +
        '<td><button class="toggle ' + (p.active?'on':'') + '" data-act="poptoggle" data-id="' + p.id + '"><i></i></button></td>' +
        '<td>' + delBtn(K.popups, p.id) + '</td></tr>';
    }).join('') : emptyRow(5, '등록된 팝업이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>팝업 관리</h3><span class="ph-sub">활성 팝업은 홈 첫 화면에 노출됩니다</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>이미지</th><th>제목 · 내용</th><th>노출 기간</th><th>활성</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<form class="admin-form" id="popupForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field full"><label>제목</label><input name="title" required placeholder="예) 2026 봄학기 지도사 과정 모집"></div>' +
        '<div class="field full"><label>내용</label><textarea name="body" placeholder="팝업에 표시할 안내 문구"></textarea></div>' +
        '<div class="field full"><label>팝업 이미지 (선택 — 상단 표시, 가로 900px 이하 자동 최적화)</label><input name="img" type="file" accept="image/*" id="popImgInput"></div>' +
        '<div class="field"><label>링크 (선택)</label><input name="link" placeholder="instructor.html"></div>' +
        '<div class="field"><label>버튼 문구</label><input name="linkLabel" placeholder="자세히 보기"></div>' +
        '<div class="field"><label>시작일 (선택)</label><input name="startsAt" type="date"></div>' +
        '<div class="field"><label>종료일 (선택)</label><input name="endsAt" type="date"></div>' +
        '<div class="full"><button class="btn btn-point" type="submit"><i data-lucide="plus"></i>팝업 추가</button></div>' +
      '</form></div>';
  }

  /* ============================================================
     페이지 이미지 관리 — 각 페이지의 사진 슬롯 교체 + 위치(초점) 조정
       · 왼쪽: 슬롯 목록(올리기/내리기) + 선택 슬롯의 위치 편집기
       · 오른쪽: 실제 페이지 미리보기(iframe) — 기기 토글로 PC/모바일 폭 전환
       · 위치는 모바일·PC 각각 저장(simg 레코드의 pcx/pcy/mbx/mby, 0~100%)
     ============================================================ */
  var imgPageTab = null;
  var imgDevice = 'pc';   // 'pc' | 'mb' — 미리보기 폭 + 위치 조정 대상 화면
  var imgSel = null;      // 위치 편집 중인 슬롯 id
  var posState = null;    // { id, dev, x, y, rec } — 위치 편집기 활성 상태
  var IMG_PAGE_FILES = { '홈': 'index.html', '협동조합 소개': 'about.html', '전통발효식품': 'ferments.html', '식초': 'vinegar.html', '체험지도사': 'instructor.html', '누룩이야기': 'nuruk.html', '제품': 'products.html' };
  function slotById(id) { return (S.IMG_SLOTS || []).filter(function (s) { return s.id === id; })[0]; }

  function viewImages() {
    var slots = S.IMG_SLOTS || [];
    var pages = [], byPage = {};
    slots.forEach(function (s) { if (!byPage[s.page]) { byPage[s.page] = []; pages.push(s.page); } byPage[s.page].push(s); });
    if (!imgPageTab || !byPage[imgPageTab]) imgPageTab = pages[0];
    var list = byPage[imgPageTab] || [];
    if (imgSel && !list.some(function (s) { return s.id === imgSel; })) imgSel = null;

    var cells = list.map(function (s) {
      var sel = s.id === imgSel ? ' sel' : '';
      var canpos = s.crop !== false ? ' can-pos' : '';
      return '<div class="pcard' + sel + '" data-slot-card="' + s.id + '">' +
        '<div class="pc-logo' + canpos + '" data-slot-cell="' + s.id + '" data-slot-sel="' + s.id + '" style="height:96px"><span class="pc-sub">사진 없음</span></div>' +
        '<div><div class="pc-name">' + esc(s.label) + '</div></div>' +
        '<div class="pc-row">' +
          '<label class="btn btn-ghost" style="padding:8px 14px;cursor:pointer"><i data-lucide="upload"></i>사진 올리기<input type="file" accept="image/*" data-simg-up="' + s.id + '" style="display:none"></label>' +
          '<button class="btn btn-ghost" data-act="simgdel" data-id="' + s.id + '" style="padding:8px 14px;color:var(--point)"><i data-lucide="trash-2"></i>내리기</button>' +
        '</div></div>';
    }).join('');

    var file = IMG_PAGE_FILES[imgPageTab] || 'index.html';
    var devLabel = imgDevice === 'mb' ? '모바일' : 'PC';
    return '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="image"></i><span>사진을 올리면 오른쪽 <b>미리보기에 즉시 반영</b>됩니다. 올린 뒤 왼쪽 미리보기 칸을 눌러 <b>상하좌우 위치</b>를 맞추세요 — <b>모바일·PC 각각 따로</b> 저장됩니다. 사진은 이 브라우저에 저장되니 <b>데이터 백업</b>으로 주기적으로 백업하세요.</span></div>' +
      subtabs(pages.map(function (pg) { return { id: pg, label: pg }; }), imgPageTab) +
      '<div class="simg-devbar" style="display:flex;align-items:center;gap:12px;margin:0 0 16px;flex-wrap:wrap">' +
        '<div class="dev-toggle">' +
          '<button data-imgdev="pc" class="' + (imgDevice === 'pc' ? 'on' : '') + '"><i data-lucide="monitor"></i>PC 화면</button>' +
          '<button data-imgdev="mb" class="' + (imgDevice === 'mb' ? 'on' : '') + '"><i data-lucide="smartphone"></i>모바일 화면</button>' +
        '</div>' +
        '<span class="ph-sub" style="font-size:13px;color:var(--ink-mute)">지금 <b>' + devLabel + ' 화면</b> 기준으로 미리보고, 사진 위치도 ' + devLabel + ' 화면에 맞춰 조정합니다.</span>' +
      '</div>' +
      '<div class="simg-split">' +
        '<div class="panel">' +
          '<div class="panel-head"><h3>' + esc(imgPageTab) + '</h3><span class="ph-sub">' + list.length + '개 자리</span></div>' +
          '<div id="posEditor"></div>' +
          '<div class="card-list">' + cells + '</div>' +
        '</div>' +
        '<div class="panel simg-preview">' +
          '<div class="panel-head"><h3>실제 페이지 미리보기 · ' + devLabel + '</h3><a class="btn btn-ghost" href="' + file + '" target="_blank" rel="noopener" style="padding:8px 14px"><i data-lucide="external-link"></i>새 탭에서 열기</a></div>' +
          '<div class="simg-frame-wrap' + (imgDevice === 'mb' ? ' dev-mb' : '') + '" id="simgFrameWrap"><iframe id="simgFrame" src="' + file + '" title="' + esc(imgPageTab) + ' 페이지 미리보기"></iframe></div>' +
        '</div>' +
      '</div>';
  }

  // 미리보기 iframe을 기기 폭(PC 1280 / 모바일 390)으로 렌더한 뒤 패널 폭에 맞춰 축소 표시
  function fitSimgPreview() {
    var wrap = document.getElementById('simgFrameWrap'), fr = document.getElementById('simgFrame');
    if (!wrap || !fr) return;
    var mb = imgDevice === 'mb';
    var W = mb ? 390 : 1280;
    var pad = mb ? 28 : 0;
    var sc = Math.min(1, wrap.clientWidth / W);
    fr.style.width = W + 'px';
    fr.style.transform = 'scale(' + sc + ')';
    fr.style.height = Math.round((wrap.clientHeight - pad) / sc) + 'px';
  }
  window.addEventListener('resize', fitSimgPreview);

  // 선택 슬롯으로 미리보기 스크롤(같은 출처 iframe)
  function scrollFrameToSel() {
    if (!imgSel) return;
    var fr = document.getElementById('simgFrame'); if (!fr) return;
    try {
      var doc = fr.contentDocument, win = fr.contentWindow;
      var el = doc && doc.querySelector('[data-img-slot="' + imgSel + '"]');
      if (el) win.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + win.pageYOffset - 40));
    } catch (e) {}
  }

  // 위치 변경을 미리보기 iframe에 즉시 반영(reload 없이) — renderSlotImages 와 같은 규칙
  function pokePreview(id, dev, x, y) {
    var fr = document.getElementById('simgFrame'), doc;
    try { doc = fr && fr.contentDocument; } catch (e) { doc = null; }
    if (!doc) return;
    var el = doc.querySelector('[data-img-slot="' + id + '"]'); if (!el) return;
    var val = x + '% ' + y + '%';
    if (el.tagName === 'IMG') el.style.setProperty(dev === 'mb' ? '--op-mb' : '--op-pc', val);
    else if (el.classList.contains('ph')) { var im = el.querySelector('.slot-img'); if (im) im.style.setProperty(dev === 'mb' ? '--op-mb' : '--op-pc', val); }
    else el.style.setProperty(dev === 'mb' ? '--bg-mb' : '--bg-pc', val);
  }

  function clampPct(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function setPos(x, y, persist) {
    if (!posState) return;
    posState.x = x; posState.y = y;
    var img = document.getElementById('peImg');
    if (img) img.style.backgroundPosition = x + '% ' + y + '%';
    pokePreview(posState.id, posState.dev, x, y);
    if (persist) {
      if (posState.dev === 'mb') { posState.rec.mbx = x; posState.rec.mby = y; }
      else { posState.rec.pcx = x; posState.rec.pcy = y; }
      S.Media.setPos(posState.rec, { pcx: posState.rec.pcx, pcy: posState.rec.pcy, mbx: posState.rec.mbx, mby: posState.rec.mby });
    }
  }
  function nudgePos(dir) {
    if (!posState) return;
    var STEP = 4, x = posState.x, y = posState.y;
    // 사진을 화살표 방향으로 민다(드래그와 같은 감각): ↑ 위로 밀면 아래가 드러남 → y 증가
    if (dir === 'up') y = clampPct(y + STEP);
    else if (dir === 'down') y = clampPct(y - STEP);
    else if (dir === 'left') x = clampPct(x + STEP);
    else if (dir === 'right') x = clampPct(x - STEP);
    else { x = 50; y = 50; }
    setPos(x, y, true);
  }

  // 선택 슬롯의 위치 편집기 채우기(사진이 있을 때만) — render 후·슬롯 선택 후 호출
  function fillPosEditor() {
    var box = document.getElementById('posEditor'); if (!box) return;
    posState = null;
    if (!imgSel) { box.innerHTML = ''; return; }
    var meta = slotById(imgSel); if (!meta) { box.innerHTML = ''; return; }
    if (meta.crop === false) {
      box.innerHTML = '<div class="pos-editor"><div class="pe-head"><b>' + esc(meta.label) + '</b></div>' +
        '<div class="pe-nocrop"><i data-lucide="info"></i> 이 자리는 사진 원본 전체를 그대로 보여 줍니다. 위치 조정이 필요 없습니다.</div></div>';
      icons(); return;
    }
    S.Media.list('page').then(function (recs) {
      var rec = recs.filter(function (r) { return r.id === imgSel; })[0];
      if (!rec || !rec.url) {
        box.innerHTML = '<div class="pos-editor"><div class="pe-head"><b>' + esc(meta.label) + '</b></div>' +
          '<div class="pe-nocrop">먼저 <b>사진 올리기</b>로 사진을 올리면, 여기서 상하좌우 위치를 맞출 수 있습니다.</div></div>';
        return;
      }
      var pos = S.slotPos(rec);
      var cur = (imgDevice === 'mb' ? pos.mb : pos.pc).split(' ');
      var x = parseFloat(cur[0]), y = parseFloat(cur[1]);
      posState = { id: imgSel, dev: imgDevice, x: x, y: y, rec: rec };
      var devLabel = imgDevice === 'mb' ? '모바일' : 'PC';
      box.innerHTML = '<div class="pos-editor">' +
        '<div class="pe-head"><b>' + esc(meta.label) + '</b><span class="pe-dev">' + devLabel + ' 화면 위치</span></div>' +
        '<div class="pe-stage" id="peStage" style="aspect-ratio:' + (meta.ar || '4/3') + '">' +
          '<div class="pe-img" id="peImg" style="background-image:url(' + rec.url + ');background-position:' + x + '% ' + y + '%"></div>' +
        '</div>' +
        '<div class="pe-ctrls">' +
          '<button class="pe-up" data-pe-nudge="up" title="사진을 위로"><i data-lucide="chevron-up"></i></button>' +
          '<button class="pe-left" data-pe-nudge="left" title="사진을 왼쪽으로"><i data-lucide="chevron-left"></i></button>' +
          '<button class="pe-center" data-pe-nudge="center" title="가운데로">가운데</button>' +
          '<button class="pe-right" data-pe-nudge="right" title="사진을 오른쪽으로"><i data-lucide="chevron-right"></i></button>' +
          '<button class="pe-down" data-pe-nudge="down" title="사진을 아래로"><i data-lucide="chevron-down"></i></button>' +
        '</div>' +
        '<p class="pe-hint">사진을 <b>드래그</b>하거나 화살표로 옮겨 <b>' + devLabel + ' 화면</b>에서 잘 보이도록 맞추세요.<br>모바일과 PC 위치는 따로 저장됩니다.</p>' +
      '</div>';
      icons();
      bindPosDrag();
    });
  }
  // 위치 편집기 드래그 — 사진을 잡아 끄는 느낌(오른쪽으로 끌면 왼쪽이 드러남)
  function bindPosDrag() {
    var stage = document.getElementById('peStage'); if (!stage) return;
    var on = false, sx, sy, ox, oy, rect;
    stage.addEventListener('pointerdown', function (e) {
      if (!posState) return;
      on = true; stage.classList.add('drag');
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      rect = stage.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = posState.x; oy = posState.y;
    });
    stage.addEventListener('pointermove', function (e) {
      if (!on) return;
      setPos(clampPct(ox - (e.clientX - sx) / rect.width * 100), clampPct(oy - (e.clientY - sy) / rect.height * 100), false);
    });
    function end() { if (!on) return; on = false; stage.classList.remove('drag'); setPos(posState.x, posState.y, true); }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  /* 왼쪽 자리 목록의 미리보기.
     올린 사진이 있으면 그것을, 없으면 **그 자리에 지금 실제로 보이는 기본 사진**을 띄운다.
     예전에는 올린 것이 없으면 '사진 없음'만 보여 줬는데, 오른쪽 미리보기에는 사진이
     떡하니 있어서 운영자가 "왜 없다고 하지?" 하게 된다. 기본 사진도 사진이다.
     기본 사진 목록을 따로 들고 있지 않고 미리보기 iframe 에서 읽는다 — 페이지가 바뀌면
     그 목록이 어긋나지만, 실제로 그려진 것을 읽으면 언제나 맞는다. */
  function fillSlotPreviews() {
    S.Media.list('page').then(function (recs) {
      var have = {};
      recs.forEach(function (r) {
        have[r.id] = true;
        var cell = document.querySelector('[data-slot-cell="' + r.id + '"]');
        if (cell && r.url) cell.innerHTML = '<img src="' + r.url + '" alt="" style="width:100%;height:100%;object-fit:cover">';
      });
      document.querySelectorAll('[data-slot-card]').forEach(function (card) {
        if (have[card.getAttribute('data-slot-card')]) card.classList.add('has-photo');
      });
      fillDefaultPreviews(have);
    });
  }

  // 올린 사진이 없는 자리 — 미리보기에서 지금 그려진 사진을 가져다 보여 준다
  function fillDefaultPreviews(have) {
    var fr = document.getElementById('simgFrame');
    var doc;
    try { doc = fr && fr.contentDocument; } catch (e) { doc = null; }
    if (!doc || !doc.body) return;

    document.querySelectorAll('[data-slot-cell]').forEach(function (cell) {
      var id = cell.getAttribute('data-slot-cell');
      if (have[id]) return;
      var el = doc.querySelector('[data-img-slot="' + id + '"]');
      if (!el) return;
      var src = '';
      if (el.tagName === 'IMG') src = el.currentSrc || el.src;
      else {
        var inner = el.querySelector('img');
        if (inner) src = inner.currentSrc || inner.src;
        else {
          // 히어로처럼 CSS 배경으로 깔린 자리. 배경이 요소 자신이 아니라
          // ::before 에 얹힌 경우가 있어(홈 히어로) 의사요소까지 살핀다.
          var win = doc.defaultView;
          var cands = [null, '::before', '::after'];
          for (var ci = 0; ci < cands.length && !src; ci++) {
            var bg = win.getComputedStyle(el, cands[ci]).backgroundImage || '';
            var m = /url\(["']?(.*?)["']?\)/.exec(bg);
            if (m && m[1] && m[1] !== 'none') src = m[1];
          }
        }
      }
      if (!src) return;   // 정말 자리표시(아이콘)만 있는 자리는 '사진 없음' 그대로
      cell.innerHTML = '<img src="' + esc(src) + '" alt="" style="width:100%;height:100%;object-fit:cover">' +
        '<span class="slot-default">기본 사진</span>';
      var card = cell.closest('[data-slot-card]');
      if (card) card.classList.add('has-photo', 'is-default');
    });
  }

  /* ============================================================
     동의문 관리 — 서브탭
     ============================================================ */
  var consentTab = 'privacy', consentMode = 'view';
  function viewConsents() {
    var c = S.getConsents();
    var defs = { privacy: { label: '개인정보 수집·이용', icon: 'shield-check', hint: '체험지도사 신청 · 제품 주문 · 문의 양식에 표시' },
                 third: { label: '제3자 제공', icon: 'share-2', hint: '제품 주문 · 씨장 분양 양식에 표시' } };
    var cur = defs[consentTab];
    return subtabs([{ id: 'privacy', label: '개인정보 수집·이용', icon: 'shield-check' }, { id: 'third', label: '제3자 제공', icon: 'share-2' }], consentTab) +
      docPanel({ mode: consentMode, dataAttr: 'data-consent', key: consentTab, body: c[consentTab].body,
        label: cur.label + ' 동의문', hint: cur.hint, monospace: false,
        editAct: 'consentEdit', saveAct: 'consentsave', cancelAct: 'consentCancel', resetAct: 'consentreset' });
  }

  /* ============================================================
     KMS — 서브탭 (표준 KMS · 디자인 룰북)
     ============================================================ */
  var kmsTab = 'standard', kmsMode = 'view';
  function viewKMS() {
    var k = getKMS();
    var defs = { standard: { label: '표준 KMS', icon: 'book-text', hint: '개발 관련 규칙 및 원칙' },
                 design: { label: '디자인 룰북', icon: 'palette', hint: '홈페이지 디자인 표준 기록·관리' } };
    var cur = defs[kmsTab];
    return '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="book-open"></i><span><b>KMS(지식관리시스템)</b> — 표준 KMS는 개발 규칙·원칙을, 디자인 룰북은 홈페이지의 모든 디자인 표준을 기록·관리합니다. 디자인 변경 시 site.css 토큰과 룰북을 함께 갱신하세요.</span></div>' +
      subtabs([{ id: 'standard', label: '표준 KMS', icon: 'book-text' }, { id: 'design', label: '디자인 룰북', icon: 'palette' }], kmsTab) +
      docPanel({ mode: kmsMode, dataAttr: 'data-kms', key: kmsTab, body: k[kmsTab],
        label: cur.label, hint: cur.hint, monospace: true,
        editAct: 'kmsEdit', saveAct: 'kmssave', cancelAct: 'kmsCancel', resetAct: 'kmsreset' });
  }

  /* ============================================================
     데이터 백업 · 복원 (localStorage + IndexedDB 이미지)
     ============================================================ */
  function blobToDataURL(blob) {
    return new Promise(function (res) { var rd = new FileReader(); rd.onload = function () { res(rd.result); }; rd.onerror = function () { res(''); }; rd.readAsDataURL(blob); });
  }
  function dataURLToBlob(durl) { return fetch(durl).then(function (r) { return r.blob(); }); }
  var IDB_STORES = ['files', 'gallery', 'pimg', 'simg'];

  function viewBackup() {
    var orders = gj(K.orders, []).length, posts = gj(K.posts, []).length, prods = S.getProducts().length;
    return '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="info"></i><span>이 사이트의 데이터(주문·신청·문의·게시글·상품·파트너·팝업·동의문·KMS)와 <b>이미지(게시글 첨부·갤러리·상품 이미지)</b>는 이 브라우저에만 저장됩니다. 기기 변경·캐시 삭제 시 사라지므로, 아래 내보내기로 주기적으로 백업하세요.</span></div>' +
      '<div class="panel"><div class="panel-head"><h3>전체 내보내기</h3><span class="ph-sub">주문 ' + orders + ' · 게시글 ' + posts + ' · 상품 ' + prods + ' + 전체 이미지</span></div>' +
        '<div style="padding:22px"><p class="muted" style="margin:0 0 16px">모든 데이터와 이미지를 JSON 파일 하나로 내려받습니다.</p>' +
        '<button class="btn btn-point" data-act="exportAll"><i data-lucide="download"></i>백업 파일 내려받기</button></div></div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>가져오기 (복원)</h3><span class="ph-sub">백업 JSON으로 현재 데이터를 덮어씁니다</span></div>' +
        '<div style="padding:22px"><div class="modal-note" style="margin-bottom:14px"><i data-lucide="alert-triangle"></i><span>현재 브라우저의 데이터가 백업 내용으로 <b>모두 교체</b>됩니다. 되돌릴 수 없으니 필요하면 먼저 내보내기로 백업하세요.</span></div>' +
        '<button class="btn btn-ghost" data-act="importPick"><i data-lucide="upload"></i>백업 파일 선택</button></div></div>';
  }

  function doExport() {
    if (S.isServer && S.isServer()) {
      toast('백업 파일을 만드는 중…');
      fetch('/api/admin/export', { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('export failed');
        return r.json();
      }).then(function (dump) {
        if (dump.skippedImages && dump.skippedImages.length) {
          alert('사진 ' + dump.skippedImages.length + '장은 용량이 커서 이번 백업에 담기지 않았습니다.\n' +
                '나머지 자료는 정상적으로 내려받았습니다.');
        }
        saveBlob(new Blob([JSON.stringify(dump)], { type: 'application/json' }), backupName());
        toast('백업 파일을 내려받았습니다.');
      }).catch(function () { toast('백업 파일을 만들지 못했습니다.'); });
      return;
    }
    var local = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('kach_') === 0) local[k] = localStorage.getItem(k); }
    Promise.all(IDB_STORES.map(function (st) {
      return S.idb.all(st).then(function (recs) {
        return Promise.all(recs.map(function (r) {
          if (!r.blob) return r;
          return blobToDataURL(r.blob).then(function (durl) { var c = Object.assign({}, r); c.blob = durl; c._blob = 1; return c; });
        })).then(function (out) { return [st, out]; });
      });
    })).then(function (pairs) {
      var idbDump = {}; pairs.forEach(function (p) { idbDump[p[0]] = p[1]; });
      var dump = { app: 'kach', version: 1, exportedAt: new Date().toISOString(), local: local, idb: idbDump };
      saveBlob(new Blob([JSON.stringify(dump)], { type: 'application/json' }), backupName());
      toast('백업 파일을 내려받았습니다.');
    });
  }
  function backupName() {
    var d = new Date(), p2 = function (x) { return ('0' + x).slice(-2); };
    return 'kach-backup-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.json';
  }
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  function doImport(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try { data = JSON.parse(rd.result); } catch (e) { alert('백업 파일을 읽을 수 없습니다.'); return; }
      if (!data || data.app !== 'kach') { alert('이 사이트의 백업 파일이 아닙니다.'); return; }
      if (!confirm('현재 데이터를 백업 내용으로 덮어씁니다. 계속할까요?')) return;
      if (S.isServer && S.isServer()) {
        toast('불러오는 중…');
        fetch('/api/admin/import', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            if (!res.ok) { alert('불러오지 못했습니다: ' + (res.d.error || '서버 오류')); return; }
            alert('복원이 완료되었습니다. 페이지를 새로고침합니다.');
            location.reload();
          }).catch(function () { alert('불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
        return;
      }
      var rm = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('kach_') === 0) rm.push(k); }
      rm.forEach(function (k) { localStorage.removeItem(k); });
      Object.keys(data.local || {}).forEach(function (k) { try { localStorage.setItem(k, data.local[k]); } catch (e) {} });
      Promise.all(IDB_STORES.map(function (st) {
        return S.idb.all(st).then(function (old) { return Promise.all(old.map(function (r) { return S.idb.del(st, r.id); })); })
          .then(function () {
            var recs = (data.idb && data.idb[st]) || [];
            return Promise.all(recs.map(function (r) {
              var rec = Object.assign({}, r);
              if (r._blob && typeof r.blob === 'string') { return dataURLToBlob(r.blob).then(function (b) { rec.blob = b; delete rec._blob; return S.idb.put(st, rec); }); }
              delete rec._blob; return S.idb.put(st, rec);
            }));
          });
      })).then(function () { alert('복원이 완료되었습니다. 페이지를 새로고침합니다.'); location.reload(); });
    };
    rd.readAsText(file);
  }

  /* ============================================================
     CSV 내보내기 — 한글 안 깨지게 UTF-8 BOM, 셀 이스케이프(따옴표·쉼표·줄바꿈)
     ============================================================ */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCSV(filename, headers, rows) {
    var lines = [headers.map(csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
    toast('CSV 파일을 내려받았습니다.');
  }
  function stamp() { var d = new Date(); function p(n){ return ('0'+n).slice(-2); } return '' + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()); }
  // 내보내기 버튼(목록 우측 상단 공용)
  function csvBtn(kind) { return '<button class="btn btn-ghost" data-csv="' + kind + '" style="padding:9px 15px"><i data-lucide="download"></i>CSV 내보내기</button>'; }

  function exportCSV(kind) {
    if (kind === 'orders') {
      var a = gj(K.orders, []);
      downloadCSV('주문내역_' + stamp() + '.csv',
        ['주문번호', '일시', '구분', '상태', '주문자', '연락처', '상품/내용', '옵션', '수량', '금액', '입금자', '결제수단', '배송지', '운송장'],
        a.map(function (o) {
          return [o.orderNo || '', o.at || '', o.kind === 'seedjang' ? '씨장분양' : '제품주문', o.status || '',
            o.name || '', o.phone || '', o.product || o.amount || '', o.optionLabel || '', o.qty || '',
            o.total != null ? o.total : '', o.depositor || '', o.payMethod || '', o.address || o.region || '',
            (o.courier ? o.courier + ' ' : '') + (o.tracking || '')];
        }));
    } else if (kind === 'apps') {
      var ap = gj(K.apps, []);
      downloadCSV('지도사신청_' + stamp() + '.csv',
        ['일시', '이름', '연락처', '지역', '신청기수', '고객메모', '상태', '처리메모', '처리일시'],
        ap.map(function (r) { return [r.at || '', r.name || '', r.phone || '', r.region || '', r.course || '', r.memo || '', r.status || '', r.adminMemo || '', r.handledAt || '']; }));
    } else if (kind === 'inq') {
      var iq = gj(K.inq, []);
      downloadCSV('문의내역_' + stamp() + '.csv',
        ['일시', '이름', '연락처', '유형', '문의내용', '상태', '처리메모', '처리일시'],
        iq.map(function (r) { return [r.at || '', r.name || '', r.phone || '', r.type || '', r.memo || '', r.status || '', r.adminMemo || '', r.handledAt || '']; }));
    } else if (kind === 'sales') {
      var so = salesOrders(salesPeriod);
      downloadCSV('매출_' + salesPeriod + '_' + stamp() + '.csv',
        ['주문번호', '일시', '상품/내용', '수량', '금액', '상태', '결제수단', '주문자'],
        so.map(function (o) { return [o.orderNo || '', o.at || '', o.product || o.amount || '', o.qty || '', o.total != null ? o.total : '', o.status || '', o.payMethod || '', o.name || '']; }));
    }
  }

  /* ============================================================
     사이트 설정 — 운영 정보(계좌·연락처·사업자정보·약도) 셀프 편집
     값은 kach_settings 에 저장되고, 전 페이지 푸터·결제 안내·모바일 메뉴·약도에 반영된다.
     ============================================================ */
  function viewSettings() {
    var st = (S.getSettings ? S.getSettings() : {});
    function field(name, label, hint, ph) {
      return '<div class="field"><label>' + label + (hint ? ' <span class="pc-sub" style="font-weight:400">' + hint + '</span>' : '') +
        '</label><input name="' + name + '" value="' + esc(st[name] != null ? st[name] : '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
    }
    function areaField(name, label, hint, rows) {
      return '<div class="field full"><label>' + label + (hint ? ' <span class="pc-sub" style="font-weight:400">' + hint + '</span>' : '') +
        '</label><textarea name="' + name + '" rows="' + (rows || 2) + '">' + esc(st[name] != null ? st[name] : '') + '</textarea></div>';
    }
    return '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="info"></i><span>여기서 바꾼 값은 <b>전 페이지 푸터 · 무통장입금 결제 안내 · 모바일 메뉴 · 문의 페이지 · 협동조합 소개(등록 정보)</b>에 모두 반영됩니다(저장 후 공개 페이지 새로고침 시). 약도 좌표는 오시는 길 지도에 적용됩니다.</span></div>' +
      '<form class="admin-form set-form" id="settingsForm">' +
        '<div class="set-sec full"><i data-lucide="banknote"></i><b>무통장입금 계좌</b> <span class="pc-sub">— 주문 시 안내되는 입금 계좌입니다. 실제 계좌로 반드시 교체하세요.</span></div>' +
        field('bank', '입금 계좌', '(은행 + 계좌번호)', '농협 123-4567-8901-23') +
        field('holder', '예금주', '', '한국참전통발효식품협동조합') +
        '<div class="set-sec full"><i data-lucide="phone"></i><b>연락처 · 주소</b></div>' +
        field('phone', '대표 전화', '', '02-855-8806') +
        field('phone2', '보조 전화', '(휴대폰 등)', '010-0000-0000') +
        field('email', '이메일', '', 'name@example.com') +
        '<div class="field full"><label>주소</label><input name="address" value="' + esc(st.address || '') + '" placeholder="서울특별시 …"></div>' +
        field('hours', '운영 시간', '', '평일 09:00 – 18:00 (주말·공휴일 휴무)') +
        '<div class="set-sec full"><i data-lucide="building-2"></i><b>사업자 정보</b> <span class="pc-sub">— 푸터와 소개 페이지 ‘공식 등록 사항’에 표시됩니다.</span></div>' +
        field('corpName', '법인명', '', '한국참전통발효식품 협동조합 (법인사업자)') +
        field('ceo', '대표자', '', '김필연') +
        field('founded', '설립일', '', '2021년 11월 1일') +
        field('bizNo', '사업자등록번호', '', '869-81-02406') +
        field('mailOrderNo', '통신판매업 신고번호', '', '2025-서울구로-1345') +
        areaField('bizType', '업태 · 종목', '(여러 줄 입력 가능)', 2) +
        areaField('eduCert', '교육 인증', '', 2) +
        areaField('productTest', '제품 시험 · 검사', '', 2) +
        '<div class="set-sec full"><i data-lucide="map-pin"></i><b>약도 위치</b> <span class="pc-sub">— 지도에서 <b>핀을 끌거나 지도를 클릭</b>해 위치를 맞추세요. 좌표가 자동으로 채워집니다.</span></div>' +
        '<div class="full"><div id="setMap" class="set-map"></div>' +
          '<div class="set-map-tools"><button class="btn btn-ghost" type="button" data-act="geocode" style="padding:8px 14px"><i data-lucide="search"></i>위 주소로 찾기</button>' +
          '<span class="pc-sub">주소를 입력한 뒤 눌러 지도를 이동한 다음, 핀으로 정확히 맞추세요.</span></div></div>' +
        field('lat', '위도(latitude)', '', '37.50331') +
        field('lng', '경도(longitude)', '', '126.88262') +
        '<div class="full" style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--line-soft);padding-top:18px;margin-top:6px">' +
          '<button class="btn btn-point" type="submit"><i data-lucide="check"></i>설정 저장</button>' +
          '<button class="btn btn-ghost" type="button" data-act="settingsReset" style="margin-left:auto"><i data-lucide="rotate-ccw"></i>기본값 복원</button>' +
        '</div>' +
      '</form>';
  }
  // 설정 화면의 약도 위치 지도 — 핀 드래그/클릭으로 좌표 입력(Leaflet). 없으면 좌표 숫자 입력으로 대체.
  var settingsMap = null;
  function initSettingsMap() {
    var el = document.getElementById('setMap');
    if (!el) return;
    var latI = document.querySelector('#settingsForm input[name=lat]');
    var lngI = document.querySelector('#settingsForm input[name=lng]');
    if (!window.L) { el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--ink-mute);text-align:center;padding:20px;line-height:1.6"><span>지도를 불러올 수 없습니다.<br>아래 위도·경도를 직접 입력해 주세요.</span></div>'; return; }
    // 컨테이너 레이아웃이 잡힌 뒤 초기화(0크기 상태에서 만들면 마커 위치 계산이 실패한다)
    requestAnimationFrame(function () {
      if (el._leaflet_id) return;                       // 이미 초기화됨
      try {
        var lat = parseFloat(latI && latI.value) || 37.50331, lng = parseFloat(lngI && lngI.value) || 126.88262;
        var map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
        settingsMap = map;
        map.setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
        var marker = L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(map);
        function writeLL(ll) { if (latI) latI.value = ll.lat.toFixed(5); if (lngI) lngI.value = ll.lng.toFixed(5); dirty = true; }
        marker.on('dragend', function () { writeLL(marker.getLatLng()); });
        map.on('click', function (e) { marker.setLatLng(e.latlng); writeLL(e.latlng); map.scrollWheelZoom.enable(); });
        function fromInputs() { var a = parseFloat(latI && latI.value), b = parseFloat(lngI && lngI.value); if (!isNaN(a) && !isNaN(b)) { marker.setLatLng([a, b]); map.panTo([a, b]); } }
        if (latI) latI.addEventListener('change', fromInputs);
        if (lngI) lngI.addEventListener('change', fromInputs);
        map.whenReady(function () { setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 60); });
      } catch (err) {
        el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--ink-mute);text-align:center;padding:20px;line-height:1.6"><span>지도를 표시할 수 없습니다.<br>아래 위도·경도를 직접 입력해 주세요.</span></div>';
      }
    });
  }
  // '위 주소로 찾기' — 입력한 주소를 좌표로(OpenStreetMap Nominatim). 실패 시 안내만.
  function geocodeAddress() {
    var addrI = document.querySelector('#settingsForm input[name=address]');
    var q = addrI ? addrI.value.trim() : '';
    if (!q) { toast('먼저 주소를 입력해 주세요.'); return; }
    toast('주소를 찾는 중…');
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'ko' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.length) { toast('주소를 찾지 못했습니다. 지도에서 직접 핀을 옮겨 주세요.'); return; }
        var la = parseFloat(d[0].lat), lo = parseFloat(d[0].lon);
        var latI = document.querySelector('#settingsForm input[name=lat]'), lngI = document.querySelector('#settingsForm input[name=lng]');
        if (latI) latI.value = la.toFixed(5); if (lngI) lngI.value = lo.toFixed(5);
        if (latI) latI.dispatchEvent(new Event('change'));
        dirty = true; toast('지도를 주소 위치로 옮겼습니다. 핀으로 정확히 맞춰 주세요.');
      })
      .catch(function () { toast('주소 검색에 실패했습니다(네트워크). 지도에서 직접 핀을 옮겨 주세요.'); });
  }

  /* ============================================================
     매출 · 정산 리포트 — 기간별 결제 매출, 상품별 판매, 결제수단 분포
     매출 인정: 결제완료 이후(결제완료·배송준비중·배송중·배송완료). 취소·반품은 제외.
     ============================================================ */
  var salesPeriod = 'month';   // today | month | last | all
  var PAID_STATES = ['결제완료', '배송준비중', '배송중', '배송완료'];
  function ymd(dt){ return dt.getFullYear() + '-' + ('0'+(dt.getMonth()+1)).slice(-2) + '-' + ('0'+dt.getDate()).slice(-2); }
  function periodRange(p) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
    if (p === 'today') { var d = S.todayStr(); return { from: d, to: d, label: '오늘' }; }
    // 주는 월요일 시작 — 국내 업무 주간 기준. getDay()는 일=0이라 (+6)%7 로 월=0 으로 옮긴다.
    if (p === 'week' || p === 'lastweek') {
      var back = (now.getDay() + 6) % 7 + (p === 'lastweek' ? 7 : 0);
      var s0 = new Date(y, m, day - back);
      var e0 = new Date(y, m, day - back + 6);
      return { from: ymd(s0), to: ymd(e0), label: p === 'week' ? '이번 주' : '지난 주' };
    }
    if (p === 'month') return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m+1, 0)), label: '이번 달' };
    if (p === 'last') return { from: ymd(new Date(y, m-1, 1)), to: ymd(new Date(y, m, 0)), label: '지난 달' };
    return { from: '0000-00-00', to: '9999-99-99', label: '전체 기간' };
  }
  function salesOrders(p) {
    var r = periodRange(p);
    return gj(K.orders, []).filter(function (o) {
      if (PAID_STATES.indexOf(o.status) < 0) return false;
      var d = (o.at || '').slice(0, 10);
      return d >= r.from && d <= r.to;
    });
  }
  function viewSales() {
    var periods = [{ id: 'today', label: '오늘' }, { id: 'month', label: '이번 달' }, { id: 'last', label: '지난 달' }, { id: 'all', label: '전체' }];
    var rng = periodRange(salesPeriod);
    var list = salesOrders(salesPeriod);
    var revenue = list.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var qty = list.reduce(function (s, o) { return s + (Number(o.qty) || 0); }, 0);
    var avg = list.length ? Math.round(revenue / list.length) : 0;
    var allOrders = gj(K.orders, []);
    var pendingPay = allOrders.filter(function (o) { return o.status === '주문접수'; });
    var pendingAmt = pendingPay.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);

    var kpis = [
      { i: 'wallet', v: fmtWon(revenue) + '원', l: rng.label + ' 매출', sub: '결제완료 이후 기준' },
      { i: 'receipt', v: list.length + '건', l: '결제 완료 주문', sub: '판매 수량 ' + qty + '개' },
      { i: 'calculator', v: fmtWon(avg) + '원', l: '평균 주문액', sub: list.length ? '건당 평균' : '주문 없음' },
      { i: 'hourglass', v: fmtWon(pendingAmt) + '원', l: '입금 대기 금액', sub: '미확인 ' + pendingPay.length + '건' },
    ];
    var kpiCards = kpis.map(function (s) {
      return '<div class="stat"><div class="si"><i data-lucide="' + s.i + '"></i></div><div class="sv" style="font-size:24px">' + s.v + '</div><div class="sl">' + s.l + '</div><div class="ss">' + s.sub + '</div></div>';
    }).join('');

    // 상품별 판매 순위
    var byProd = {};
    list.forEach(function (o) {
      var name = o.product || o.amount || '기타';
      if (!byProd[name]) byProd[name] = { q: 0, amt: 0 };
      byProd[name].q += (Number(o.qty) || 0); byProd[name].amt += (Number(o.total) || 0);
    });
    var prodKeys = Object.keys(byProd).sort(function (a, b) { return byProd[b].amt - byProd[a].amt; });
    var prodMax = prodKeys.length ? byProd[prodKeys[0]].amt : 1;
    var prodBars = prodKeys.length ? prodKeys.map(function (k) {
      var d = byProd[k], w = Math.round(d.amt / prodMax * 100);
      return '<div class="src-row"><div class="src-top"><span class="src-name" style="max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(k) + '</span><span class="src-num">' + fmtWon(d.amt) + '원 <em>' + d.q + '개</em></span></div><div class="src-track"><div class="src-fill" style="width:' + Math.max(3, w) + '%;background:var(--olive)"></div></div></div>';
    }).join('') : '<div class="admin-empty" style="padding:30px 10px"><i data-lucide="inbox"></i><div>해당 기간 매출이 없습니다.</div></div>';

    // 결제수단별 분포
    var byPay = {};
    list.forEach(function (o) { var k = o.payMethod || '기타'; byPay[k] = (byPay[k] || 0) + (Number(o.total) || 0); });
    var payKeys = Object.keys(byPay).sort(function (a, b) { return byPay[b] - byPay[a]; });
    var payBars = payKeys.length ? payKeys.map(function (k) {
      var pct = revenue ? Math.round(byPay[k] / revenue * 100) : 0;
      return '<div class="src-row"><div class="src-top"><span class="src-name"><i data-lucide="credit-card"></i>' + esc(k) + '</span><span class="src-num">' + fmtWon(byPay[k]) + '원 <em>' + pct + '%</em></span></div><div class="src-track"><div class="src-fill" style="width:' + Math.max(3, pct) + '%;background:var(--main)"></div></div></div>';
    }).join('') : '<div class="admin-empty" style="padding:20px 10px"><i data-lucide="credit-card"></i><div>데이터 없음</div></div>';

    var tabs = '<div class="subtabs">' + periods.map(function (p) {
      return '<button data-speriod="' + p.id + '" class="' + (salesPeriod === p.id ? 'on' : '') + '">' + p.label + '</button>';
    }).join('') + '</div>';

    return '<div class="sales-head" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">' + tabs +
        '<span class="ph-sub" style="font-size:13px;color:var(--ink-mute)">' + rng.label + (salesPeriod !== 'all' && salesPeriod !== 'today' ? ' (' + rng.from + ' ~ ' + rng.to + ')' : '') + ' · 매출은 <b>결제완료 이후</b>만 집계(취소·반품 제외)</span>' +
        '<span style="margin-left:auto">' + csvBtn('sales') + '</span>' +
      '</div>' +
      '<div class="stat-grid">' + kpiCards + '</div>' +
      '<div class="dash-2col" style="margin-top:24px">' +
        '<div class="panel"><div class="panel-head"><h3>상품별 판매 순위</h3><span class="ph-sub">' + prodKeys.length + '개 상품 · 금액순</span></div><div style="padding:20px 22px 24px"><div class="src-list">' + prodBars + '</div></div></div>' +
        '<div class="panel"><div class="panel-head"><h3>결제수단별 매출</h3><span class="ph-sub">총 ' + fmtWon(revenue) + '원</span></div><div style="padding:20px 22px 24px"><div class="src-list">' + payBars + '</div></div></div>' +
      '</div>';
  }

  /* ============================================================
     계정 관리 — owner 전용. 서버(D1 admin_users)에만 존재하므로
     정적 호스팅에서는 메뉴 자체를 띄우지 않는다.
     ============================================================ */
  var accounts = null;      // 서버에서 받은 목록. null = 아직 못 받음
  var roles = null, permDefs = null, members = null, memberQ = '';
  var acctTab = 'admin';    // admin | member | role
  var ROLE_LABEL = { owner: '관리자(owner)', staff: '직원(staff)' };
  var myPerms = null;       // 세션에서 받은 내 권한 목록
  function iCan(k) { return !myPerms || myPerms.indexOf(k) > -1; }

  function acctTabs() {
    var t = [{ id: 'member', label: '일반 계정', icon: 'users-round' },
             { id: 'admin',  label: '관리자 계정', icon: 'shield' },
             { id: 'role',   label: '권한 그룹', icon: 'key-square' }];
    return '<div class="subtabs">' + t.map(function (x) {
      return '<button data-accttab="' + x.id + '" class="' + (acctTab === x.id ? 'on' : '') + '">' +
        '<i data-lucide="' + x.icon + '"></i>' + x.label + '</button>';
    }).join('') + '</div>';
  }

  /* ── 일반 계정(회원) ── 개인정보를 다루므로 목록에는 주소를 뿌리지 않는다 */
  function viewMembers() {
    if (members === null) {
      loadMembers();
      return acctTabs() + '<div class="panel"><div class="admin-empty"><i data-lucide="loader"></i><div>불러오는 중…</div></div></div>';
    }
    var live = members.filter(function (m) { return m.status === 'active'; }).length;
    var rows = members.length ? members.map(function (m) {
      var tel = String(m.phone || '').replace(/[^0-9+]/g, '');
      return '<tr' + (m.status !== 'active' ? ' style="opacity:.55"' : '') + '>' +
        '<td><b>' + esc(m.name) + '</b>' + (m.status !== 'active' ? ' <span class="tag">중지</span>' : '') + '</td>' +
        '<td>' + (tel ? '<a href="tel:' + tel + '" class="tel-link">' + esc(m.phone) + '</a>' : '-') + '</td>' +
        '<td>' + esc(m.username) + '</td>' +
        '<td>' + esc(m.email || '-') + '</td>' +
        '<td class="dt">' + (m.createdAt ? fmtDate(m.createdAt) : '-') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-ghost" data-act="memEdit" data-id="' + m.id + '" style="padding:7px 13px"><i data-lucide="pen-line"></i>상세</button></td></tr>';
    }) : [];
    return acctTabs() +
      '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="shield-check"></i><span>' +
        '<b>개인정보입니다.</b> 이름·연락처·주소는 수집·이용 동의를 받은 범위에서만 쓰고, 화면을 켜 둔 채 자리를 비우지 마세요. ' +
        '필요 없어진 계정은 지우지 말고 <b>사용 중지</b>로 두면 주문 기록의 주인은 남습니다.</span></div>' +
      '<div class="stat-grid">' +
        kpi(members.length + '명', '전체 회원', '') +
        kpi(live + '명', '사용 중', '') +
        kpi((members.length - live) + '명', '중지', '') +
        kpi(members.filter(function (m) { return m.marketingOptin; }).length + '명', '광고 수신 동의', '선택 항목') +
      '</div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>일반 계정</h3>' +
        '<span class="ph-sub">총 ' + members.length + '명</span>' +
        '<div class="panel-tools"><input class="list-search" id="memSearch" type="search" autocomplete="off" placeholder="이름 · 연락처 · 아이디 검색" value="' + esc(memberQ) + '">' +
        (iCan('members.manage') ? '<button class="btn btn-point" data-act="memNew" style="padding:9px 16px"><i data-lucide="user-plus"></i>회원 등록</button>' : '') + '</div></div>' +
        '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>이름</th><th>휴대전화</th><th>아이디</th><th>이메일</th><th>가입일</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.join('') : emptyRow(6, memberQ ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.')) +
        '</tbody></table></div></div>';
  }

  /* ── 권한 그룹 ── */
  function viewRoles() {
    if (roles === null) {
      loadRoles();
      return acctTabs() + '<div class="panel"><div class="admin-empty"><i data-lucide="loader"></i><div>불러오는 중…</div></div></div>';
    }
    var groups = {};
    (permDefs || []).forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    var cards = roles.map(function (r) {
      var have = {}; r.perms.forEach(function (k) { have[k] = 1; });
      return '<div class="role-card">' +
        '<div class="rc-head"><b>' + esc(r.name) + '</b>' +
          (r.isSystem ? '<span class="tag">기본</span>' : '') +
          '<span class="rc-n">' + r.memberCount + '명</span></div>' +
        '<p class="rc-desc">' + esc(r.description || '') + '</p>' +
        '<div class="rc-perms">' + Object.keys(groups).map(function (g) {
          var on = groups[g].filter(function (d) { return have[d.key]; });
          if (!on.length) return '';
          return '<span class="rc-chip"><b>' + esc(g) + '</b> ' + on.map(function (d) { return esc(d.label); }).join(' · ') + '</span>';
        }).join('') + (r.perms.length ? '' : '<span class="pc-sub">권한 없음</span>') + '</div>' +
        (iCan('accounts.manage') ? '<div class="rc-foot">' +
          '<button class="btn btn-ghost" data-act="roleEdit" data-id="' + r.id + '" style="padding:7px 13px"><i data-lucide="pen-line"></i>수정</button>' +
          (r.isSystem ? '' : '<button class="icon-btn" data-act="roleDel" data-id="' + r.id + '" title="삭제"><i data-lucide="trash-2"></i></button>') +
        '</div>' : '') +
      '</div>';
    }).join('');
    return acctTabs() +
      '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="key-square"></i><span>' +
        '권한 그룹으로 <b>누가 무엇까지 할 수 있는지</b>를 정합니다. 계정은 그룹 하나에 속합니다. ' +
        '<b>기본</b> 그룹은 지우거나 권한을 바꿀 수 없습니다 — 필요하면 새 그룹을 만들어 쓰세요.</span></div>' +
      '<div class="role-grid">' + cards + '</div>' +
      (iCan('accounts.manage')
        ? '<div style="margin-top:20px"><button class="btn btn-point" data-act="roleNew"><i data-lucide="plus"></i>권한 그룹 만들기</button></div>' : '');
  }

  function viewAccounts() {
    if (acctTab === 'member') return viewMembers();
    if (acctTab === 'role') return viewRoles();
    if (!accounts) {
      loadAccounts();
      return acctTabs() + '<div class="panel"><div class="admin-empty"><i data-lucide="loader"></i><div>계정을 불러오는 중…</div></div></div>';
    }
    var rows = accounts.length ? accounts.map(function (u) {
      var off = u.status !== 'active';
      return '<tr' + (off ? ' style="opacity:.55"' : '') + '>' +
        '<td><b>' + esc(u.username) + '</b>' + (u.mustChangePassword ? ' <span class="tag point" style="font-size:11px">비밀번호 변경 필요</span>' : '') + '</td>' +
        '<td>' + esc(u.displayName) + '</td>' +
        '<td><span class="tag' + (u.role === 'owner' ? ' solid' : '') + '">' + esc(u.roleName || ROLE_LABEL[u.role] || '-') + '</span></td>' +
        '<td>' + (off ? '<span class="tag">사용 중지</span>' : '<span class="tag olive">사용 중</span>') + '</td>' +
        '<td class="dt">' + (u.lastLoginAt ? fmtDate(u.lastLoginAt) : '기록 없음') + '</td>' +
        '<td style="white-space:nowrap"><div style="display:inline-flex;gap:6px">' +
          '<button class="btn btn-ghost" data-act="acctEdit" data-id="' + u.id + '" style="padding:8px 13px"><i data-lucide="pen-line"></i>수정</button>' +
          (off
            ? '<button class="btn btn-ghost" data-act="acctOn" data-id="' + u.id + '" style="padding:8px 13px">다시 사용</button>'
            : '<button class="icon-btn" data-act="acctOff" data-id="' + u.id + '" title="사용 중지"><i data-lucide="user-x"></i></button>') +
        '</div></td></tr>';
    }).join('') : emptyRow(6, '계정이 없습니다.');

    return acctTabs() +
      '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="users"></i><span>' +
        '사이트를 운영하는 사람의 계정입니다. 할 수 있는 일은 <b>권한 그룹</b>에서 정합니다. ' +
        '새로 만든 계정은 <b>첫 로그인 때 본인이 비밀번호를 바꿔야</b> 합니다.</span></div>' +
      '<div class="panel"><div class="panel-head"><h3>관리자 계정</h3><span class="ph-sub">총 ' + accounts.length + '개</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>아이디</th><th>이름</th><th>권한 그룹</th><th>상태</th><th>마지막 로그인</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<form class="admin-form" id="acctForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field"><label>아이디 <span style="color:var(--point)">*</span> <span class="pc-sub" style="font-weight:400">(영문 소문자·숫자·_·- 3~32자)</span></label>' +
          '<input name="username" required autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="예) staff01"></div>' +
        '<div class="field"><label>이름 <span style="color:var(--point)">*</span></label><input name="displayName" required placeholder="예) 이직원"></div>' +
        '<div class="field"><label>권한</label><select name="role"><option value="staff">직원(staff)</option><option value="owner">관리자(owner)</option></select></div>' +
        '<div class="field"><label>처음 비밀번호 <span style="color:var(--point)">*</span> <span class="pc-sub" style="font-weight:400">(10자 이상)</span></label>' +
          '<input name="password" type="password" required autocomplete="new-password"></div>' +
        '<div class="full"><button class="btn btn-point" type="submit"><i data-lucide="user-plus"></i>계정 만들기</button></div>' +
      '</form></div>';
  }

  /* 내 비밀번호 변경 — 권한과 무관하게 누구나 자기 것은 바꿀 수 있어야 한다.
     계정 관리(owner 전용)에 넣으면 직원이 자기 비밀번호를 못 바꾼다. */
  function openMyPassword() {
    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">내 계정</div><h3>비밀번호 변경</h3>' +
        '<p>본인만 아는 것으로 바꿔 주세요. 10자 이상, 영문·숫자·기호 중 두 가지 이상.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="myPwForm" autocomplete="off">' +
        '<div class="form-grid">' +
          '<div class="field full"><label for="mpCur">현재 비밀번호</label>' +
            '<input id="mpCur" type="password" autocomplete="current-password" required></div>' +
          '<div class="field full"><label for="mpNew">새 비밀번호</label>' +
            '<input id="mpNew" type="password" autocomplete="new-password" required></div>' +
          '<div class="field full"><label for="mpNew2">새 비밀번호 확인</label>' +
            '<input id="mpNew2" type="password" autocomplete="new-password" required></div>' +
        '</div>' +
        '<div class="login-msg" id="mpMsg"></div>' +
        '<div class="modal-note"><i data-lucide="info"></i><span>바꾸면 <b>다른 기기에 남아 있던 로그인이 모두 끊깁니다.</b> 지금 쓰는 이 창은 그대로 이어집니다.</span></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
        '<button type="submit" class="btn btn-point" id="mpBtn"><i data-lucide="check"></i>비밀번호 바꾸기</button></div>' +
      '</form></div>', 480);

    var f = document.getElementById('myPwForm');
    var msg = document.getElementById('mpMsg');
    var btn = document.getElementById('mpBtn');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var cur = document.getElementById('mpCur').value;
      var a1 = document.getElementById('mpNew').value;
      var a2 = document.getElementById('mpNew2').value;
      if (a1 !== a2) { msg.className = 'login-msg err'; msg.textContent = '두 번 입력한 새 비밀번호가 서로 다릅니다.'; return; }
      btn.disabled = true; msg.className = 'login-msg'; msg.textContent = '바꾸는 중…';
      S.api('/api/admin/password', { method: 'POST', body: { currentPassword: cur, newPassword: a1 } })
        .then(function (r) {
          if (r.ok && r.data.ok) { S.closeModal(); toast('비밀번호를 바꿨습니다.'); return; }
          btn.disabled = false;
          msg.className = 'login-msg err';
          msg.textContent = r.data.error || '바꾸지 못했습니다.';
        })
        .catch(function () { btn.disabled = false; msg.className = 'login-msg err'; msg.textContent = '서버에 연결할 수 없습니다.'; });
    });
    setTimeout(function () { document.getElementById('mpCur').focus(); }, 60);
  }

  function loadAccounts() {
    S.api('/api/admin/users').then(function (r) {
      if (!r.ok) { accounts = []; toast(r.data.error || '계정을 불러오지 못했습니다.'); }
      else accounts = r.data.users || [];
      if (current === 'accounts') render();
    });
  }

  function loadMembers() {
    S.api('/api/admin/members' + (memberQ ? '?q=' + encodeURIComponent(memberQ) : '')).then(function (r) {
      members = (r.ok && r.data.members) || [];
      if (!r.ok) toast(r.data.error || '회원을 불러오지 못했습니다.');
      if (current === 'accounts') render();
    });
  }
  function loadRoles() {
    S.api('/api/admin/roles').then(function (r) {
      roles = (r.ok && r.data.roles) || [];
      permDefs = (r.ok && r.data.defs) || [];
      if (!r.ok) toast(r.data.error || '권한 그룹을 불러오지 못했습니다.');
      if (current === 'accounts') render();
    });
  }

  function memberField(id, label, val, opts) {
    var o = opts || {};
    return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + label +
      (o.req ? '<span class="req">*</span>' : ' <span class="pc-sub" style="font-weight:400">(선택)</span>') + '</label>' +
      '<input id="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.ro ? ' readonly' : '') + '></div>';
  }

  function openMemberEdit(m) {
    var isNew = !m;
    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">일반 계정</div><h3>' + (isNew ? '회원 등록' : esc(m.name)) + '</h3>' +
        '<p>필수 항목은 이름과 휴대전화번호입니다.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><div class="mem-form" data-mem-id="' + (isNew ? '' : m.id) + '">' +
        '<div class="form-grid">' +
          memberField('mfId', '아이디', isNew ? '' : m.username, { req: true, ro: !isNew, ph: '영문 소문자·숫자 4자 이상 또는 이메일' }) +
          memberField('mfPw', isNew ? '비밀번호' : '비밀번호 재설정', '', { req: isNew, type: 'password', ph: isNew ? '10자 이상' : '비우면 그대로 둡니다' }) +
          memberField('mfName', '이름', isNew ? '' : m.name, { req: true, ph: '홍길동' }) +
          memberField('mfPhone', '휴대전화번호', isNew ? '' : m.phone, { req: true, type: 'tel', ph: '010-0000-0000' }) +
          memberField('mfEmail', '이메일', isNew ? '' : (m.email || ''), { type: 'email', ph: 'name@example.com' }) +
          memberField('mfPost', '우편번호', isNew ? '' : (m.postcode || ''), { ph: '00000' }) +
          memberField('mfAddr', '주소', isNew ? '' : (m.address || ''), { full: true, ph: '도로명 주소' }) +
          memberField('mfAddr2', '상세주소', isNew ? '' : (m.addressDetail || ''), { full: true, ph: '동·호수 등' }) +
          '<div class="field full"><label for="mfMemo">관리자 메모 <span class="pc-sub" style="font-weight:400">(본인에게 보이지 않습니다)</span></label>' +
            '<textarea id="mfMemo" rows="2">' + esc(isNew ? '' : (m.memo || '')) + '</textarea></div>' +
          '<div class="field full"><label style="display:inline-flex;gap:8px;align-items:center;cursor:pointer">' +
            '<input type="checkbox" id="mfMk"' + (!isNew && m.marketingOptin ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--main)">' +
            '광고성 정보 수신에 동의함 <span class="pc-sub">(선택 — 본인 동의를 받은 경우에만 체크)</span></label></div>' +
        '</div>' +
        '<div class="login-msg" id="mfMsg"></div>' +
        '<div class="modal-foot">' +
          (isNew ? '' : '<button type="button" class="btn btn-ghost" data-act="memToggle" data-id="' + m.id + '" style="margin-right:auto">' +
            (m.status === 'active' ? '사용 중지' : '다시 사용') + '</button>') +
          '<button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
          '<button type="button" class="btn btn-point" data-act="memSave"><i data-lucide="check"></i>저장</button>' +
        '</div>' +
      '</div></div>', 620);
    setTimeout(function () { var f = document.getElementById(isNew ? 'mfId' : 'mfName'); if (f) f.focus(); }, 60);
  }

  function saveMember() {
    var box = document.querySelector('[data-mem-id]'); if (!box) return;
    var id = box.dataset.memId;
    var v = function (x) { var e = document.getElementById(x); return e ? e.value.trim() : ''; };
    var body = {
      name: v('mfName'), phone: v('mfPhone'), email: v('mfEmail'),
      postcode: v('mfPost'), address: v('mfAddr'), addressDetail: v('mfAddr2'),
      memo: document.getElementById('mfMemo').value.trim(),
      marketingOptin: document.getElementById('mfMk').checked,
    };
    if (v('mfPw')) body.password = v('mfPw');
    if (!id) { body.username = v('mfId'); if (!body.password) { showMsg('mfMsg', '비밀번호를 입력해 주세요.'); return; } }
    S.api('/api/admin/members' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: body })
      .then(function (r) {
        if (!r.ok) { showMsg('mfMsg', r.data.error || '저장하지 못했습니다.'); return; }
        S.closeModal(); members = null; render(); toast(id ? '회원 정보를 저장했습니다.' : '회원을 등록했습니다.');
      });
  }
  function showMsg(id, t) { var e = document.getElementById(id); if (e) { e.className = 'login-msg err'; e.textContent = t; } }

  function openRoleEdit(r) {
    var isNew = !r;
    var groups = {};
    (permDefs || []).forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    var have = {}; if (r) r.perms.forEach(function (k) { have[k] = 1; });
    var locked = r && r.isSystem;
    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">권한 그룹</div><h3>' + (isNew ? '새 권한 그룹' : esc(r.name)) + '</h3>' +
        '<p>' + (locked ? '기본 그룹은 권한을 바꿀 수 없습니다. 이름·설명만 고칠 수 있습니다.' : '이 그룹에 속한 계정이 할 수 있는 일을 고릅니다.') + '</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><div data-role-id="' + (isNew ? '' : r.id) + '">' +
        '<div class="form-grid">' +
          '<div class="field full"><label for="rfName">그룹 이름<span class="req">*</span></label><input id="rfName" value="' + esc(isNew ? '' : r.name) + '" placeholder="예) 주말 주문 담당"></div>' +
          '<div class="field full"><label for="rfDesc">설명</label><input id="rfDesc" value="' + esc(isNew ? '' : (r.description || '')) + '" placeholder="이 그룹이 무엇을 하는지"></div>' +
        '</div>' +
        '<div class="perm-list">' + Object.keys(groups).map(function (g) {
          return '<div class="perm-group"><b>' + esc(g) + '</b>' + groups[g].map(function (d) {
            return '<label class="perm-row' + (locked ? ' lock' : '') + '">' +
              '<input type="checkbox" class="perm-chk" value="' + d.key + '"' + (have[d.key] ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
              '<span><b>' + esc(d.label) + '</b><span>' + esc(d.desc) + '</span></span></label>';
          }).join('') + '</div>';
        }).join('') + '</div>' +
        '<div class="login-msg" id="rfMsg"></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
        '<button type="button" class="btn btn-point" data-act="roleSave"><i data-lucide="check"></i>저장</button></div>' +
      '</div></div>', 620);
    setTimeout(function () { var f = document.getElementById('rfName'); if (f) f.focus(); }, 60);
  }

  function saveRole() {
    var box = document.querySelector('[data-role-id]'); if (!box) return;
    var id = box.dataset.roleId;
    var name = document.getElementById('rfName').value.trim();
    if (!name) { showMsg('rfMsg', '그룹 이름을 입력해 주세요.'); return; }
    var perms = [].slice.call(box.querySelectorAll('.perm-chk:checked')).map(function (c) { return c.value; });
    var body = { name: name, description: document.getElementById('rfDesc').value.trim() };
    if (!box.querySelector('.perm-chk[disabled]')) body.perms = perms;
    S.api('/api/admin/roles' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: body })
      .then(function (r) {
        if (!r.ok) { showMsg('rfMsg', r.data.error || '저장하지 못했습니다.'); return; }
        S.closeModal(); roles = null; accounts = null; render(); toast('권한 그룹을 저장했습니다.');
      });
  }

  function openAccountEdit(id) {
    var u = (accounts || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!u) return;
    S.rawModal(
      '<div class="modal-head"><div><div class="eyebrow">계정</div><h3>' + esc(u.username) + '</h3></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><div class="rec-detail" data-acct-id="' + u.id + '">' +
        '<div class="field full"><label>이름</label><input class="acct-name" value="' + esc(u.displayName) + '" style="width:100%;min-height:46px;padding:11px 14px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:15px"></div>' +
        '<div class="field full"><label>권한 그룹</label><select class="acct-roleid rec-status st-sel">' +
          (roles || []).map(function (r) { return '<option value="' + r.id + '"' + (u.roleId === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') +
        '</select><p class="note">그룹을 바꾸면 <b>다음 요청부터 바로</b> 적용됩니다.</p></div>' +
        '<div class="field full"><label>비밀번호 재설정 <span class="pc-sub" style="font-weight:400">— 비우면 그대로 둡니다</span></label>' +
          '<input class="acct-pw" type="password" autocomplete="new-password" placeholder="새 비밀번호 (10자 이상)" style="width:100%;min-height:46px;padding:11px 14px;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:15px"></div>' +
        '<div class="modal-note"><i data-lucide="info"></i><span>비밀번호를 재설정하면 그 계정의 <b>기존 로그인이 모두 끊기고</b>, 다음 로그인 때 본인이 다시 바꿔야 합니다.</span></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button>' +
        '<button type="button" class="btn btn-point" data-act="acctSave"><i data-lucide="check"></i>저장</button></div>' +
      '</div></div>', 520);
  }

  function saveAccount() {
    var box = document.querySelector('[data-acct-id]'); if (!box) return;
    var body = { displayName: box.querySelector('.acct-name').value.trim() };
    var rsel = box.querySelector('.acct-roleid');
    if (rsel) body.roleId = Number(rsel.value);
    var pw = box.querySelector('.acct-pw').value;
    if (pw) body.password = pw;
    S.api('/api/admin/users/' + box.dataset.acctId, { method: 'PATCH', body: body }).then(function (r) {
      if (!r.ok) { alert(r.data.error || '저장하지 못했습니다.'); return; }
      S.closeModal(); accounts = null; render(); toast('계정을 저장했습니다.');
    });
  }

  function setAccountStatus(id, status) {
    S.api('/api/admin/users/' + id, { method: 'PATCH', body: { status: status } }).then(function (r) {
      if (!r.ok) { alert(r.data.error || '변경하지 못했습니다.'); return; }
      accounts = null; render();
      toast(status === 'active' ? '계정을 다시 사용합니다.' : '계정 사용을 중지했습니다.');
    });
  }

  /* ============================================================
     사용 설명서 — 본문은 assets/manual.html 한 곳에만 둔다.
     여기서 읽어 화면에 넣으므로, 설명서를 고칠 때 그 파일만 고치면 된다.
     ============================================================ */
  var manualHTML = null;   // 한 번 받아 두고 재사용

  function viewManual() {
    if (manualHTML === null) {
      loadManual();
      return '<div class="panel"><div class="admin-empty"><i data-lucide="book-open"></i><div>설명서를 불러오는 중…</div></div></div>';
    }
    if (manualHTML === false) {
      return '<div class="panel"><div class="admin-empty"><i data-lucide="alert-circle"></i>' +
        '<div>설명서를 불러오지 못했습니다.<br>인터넷 연결을 확인하고 새로고침해 주세요.</div></div></div>';
    }
    // 설명서 안의 목차(.jump)를 상단 탭 모양으로 바꾼다. 관리 화면에서는
    // 알약 모양보다 탭이 '지금 어느 절'인지 읽기 쉽다.
    var html = manualHTML
      .replace(/<nav class="jump"[^>]*>\s*<div class="wrap"><div class="jump-inner">/,
               '<nav class="man-tabs" aria-label="설명서 목차"><div class="mt-row">')
      .replace(/<\/div><\/div>\s*<\/nav>/, '</div></nav>');
    return '<div class="man-body">' + html + '</div>';
  }

  /* 설명서 탭 — 스크롤에 따라 현재 절을 표시.
     공개 페이지의 jump.js 는 여기서 돌지 않으므로 관리자용으로 따로 건다. */
  var manTabIO = null;
  function bindManualTabs() {
    var bar = document.querySelector('.man-tabs'); if (!bar) return;
    if (manTabIO) { try { manTabIO.disconnect(); } catch (e) {} manTabIO = null; }
    var links = [].slice.call(bar.querySelectorAll('a[href^="#"]'));
    var pairs = links.map(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      return el ? { a: a, el: el } : null;
    }).filter(Boolean);
    if (!pairs.length) return;
    manTabIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        var hit = pairs.filter(function (x) { return x.el === en.target; })[0];
        if (!hit) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        hit.a.classList.add('on');
        var row = hit.a.parentElement;
        if (row && row.scrollWidth > row.clientWidth) {
          row.scrollTo({ left: hit.a.offsetLeft - (row.clientWidth - hit.a.offsetWidth) / 2, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    pairs.forEach(function (x) { manTabIO.observe(x.el); });
  }

  function loadManual() {
    fetch('assets/manual.html', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('load failed'); return r.text(); })
      .then(function (t) { manualHTML = t; if (current === 'manual') render(); })
      .catch(function () { manualHTML = false; if (current === 'manual') render(); });
  }

  /* ============================================================
     그룹 요약 화면 — 사이드바의 그룹 이름을 누르면 나온다.
     그 묶음에서 지금 무엇을 봐야 하는지 숫자로 먼저 보여 주고, 하위 화면으로 보낸다.
     ============================================================ */
  var pageImgs = null;   // 페이지 사진 목록 — 한 번 받아 두고 재사용
  function loadPageImgs(onDone) {
    S.Media.list('page').then(function (recs) { pageImgs = recs || []; onDone && onDone(); });
  }
  // 표 한 덩어리 — 그룹 요약에서 되풀이해 쓴다
  function miniTable(title, sub, head, rows, emptyMsg, foot) {
    return '<div class="panel"><div class="panel-head"><h3>' + title + '</h3>' +
      (sub ? '<span class="ph-sub">' + sub + '</span>' : '') + (foot || '') + '</div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr>' +
        head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rows.length ? rows.join('') : emptyRow(head.length, emptyMsg)) +
      '</tbody></table></div></div>';
  }
  // 가로 막대 한 줄 (유입·상태 분포와 같은 모양)
  function bar(label, num, pct, color) {
    return '<div class="src-row"><div class="src-top"><span class="src-name">' + label + '</span>' +
      '<span class="src-num">' + num + '</span></div>' +
      '<div class="src-track"><div class="src-fill" style="width:' + Math.max(3, pct) + '%;background:' + color + '"></div></div></div>';
  }
  function panelWrap(title, sub, body) {
    return '<div class="panel"><div class="panel-head"><h3>' + title + '</h3>' +
      (sub ? '<span class="ph-sub">' + sub + '</span>' : '') + '</div>' +
      '<div style="padding:20px 22px 24px">' + body + '</div></div>';
  }

  function shortcut(id, icon, label, desc, note) {
    return '<button class="gs-card" data-nav="' + id + '">' +
      '<span class="gs-i"><i data-lucide="' + icon + '"></i></span>' +
      '<span class="gs-b"><b>' + label + '</b><span>' + desc + '</span></span>' +
      (note ? '<span class="gs-n">' + note + '</span>' : '') +
      '<i data-lucide="chevron-right" class="gs-go"></i></button>';
  }
  function groupHead(title, desc) {
    return '<div class="gs-head"><h2>' + title + '</h2><p>' + desc + '</p></div>';
  }
  function kpi(v, l, sub) {
    return '<div class="stat"><div class="sv">' + v + '</div><div class="sl">' + l + '</div>' +
      (sub ? '<div class="ss">' + sub + '</div>' : '') + '</div>';
  }

  function viewGroupSales() {
    var orders = gj(K.orders, []);
    var prods = S.getProducts();
    var wk = salesOrders('week'), mo = salesOrders('month');
    var sum = function (a) { return a.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0); };
    var wait = orders.filter(function (o) { return o.status === '주문접수'; }).length;
    var ship = orders.filter(function (o) { return o.status === '결제완료' || o.status === '배송준비중'; }).length;
    var rma  = orders.filter(function (o) { return CRX.indexOf(o.status) > -1; }).length;
    var soldout = prods.filter(function (p) { return p.status === '품절'; }).length;
    var low = prods.filter(function (p) {
      if (p.status !== '판매중') return false;
      var st = p.option && p.option.values ? p.option.values.reduce(function (s, v) { return s + (Number(v.stock) || 0); }, 0) : Number(p.stock) || 0;
      return st > 0 && st <= 5;
    }).length;
    // 상품별 판매 순위 (이번 달)
    var byProd = {};
    mo.forEach(function (o) {
      var k = o.product || o.amount || '기타';
      if (!byProd[k]) byProd[k] = { q: 0, amt: 0 };
      byProd[k].q += Number(o.qty) || 0; byProd[k].amt += Number(o.total) || 0;
    });
    var pk = Object.keys(byProd).sort(function (x, y) { return byProd[y].amt - byProd[x].amt; }).slice(0, 5);
    var pMax = pk.length ? byProd[pk[0]].amt : 1;
    var rankBody = pk.length
      ? pk.map(function (k) { return bar(esc(k), fmtWon(byProd[k].amt) + '원 <em>' + byProd[k].q + '개</em>',
          Math.round(byProd[k].amt / pMax * 100), 'var(--olive)'); }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="inbox"></i><div>이번 달 판매가 아직 없습니다.</div></div>';

    // 주문 상태 분포
    var stMap = {}; orders.forEach(function (o) { var st = o.status || '기타'; stMap[st] = (stMap[st] || 0) + 1; });
    var sk = Object.keys(stMap).sort(function (x, y) { return stMap[y] - stMap[x]; });
    var sMax2 = sk.length ? stMap[sk[0]] : 1;
    var stBody = sk.length
      ? sk.map(function (k) { return bar(stTag(k), stMap[k] + '건', Math.round(stMap[k] / sMax2 * 100),
          (S.ST_COLOR && S.ST_COLOR[k]) || '#6E8252'); }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="inbox"></i><div>주문이 없습니다.</div></div>';

    // 재고 주의 — 품절이거나 5개 이하
    var careRows = prods.filter(function (p) {
      if (p.status === '숨김') return false;
      var st = p.option && p.option.values ? p.option.values.reduce(function (a, v) { return a + (Number(v.stock) || 0); }, 0) : Number(p.stock) || 0;
      return p.status === '품절' || st <= 5;
    }).slice(0, 8).map(function (p) {
      var st = p.option && p.option.values ? p.option.values.reduce(function (a, v) { return a + (Number(v.stock) || 0); }, 0) : Number(p.stock) || 0;
      return '<tr><td><b>' + esc(p.name) + '</b><div class="pc-sub">' + esc(p.cat || '') + '</div></td>' +
        '<td>' + (p.status === '품절' ? '<span class="tag" style="background:var(--danger);color:#fff">품절</span>' : '<span class="tag point">재고 ' + st + '</span>') + '</td>' +
        '<td style="text-align:right"><button class="btn btn-ghost" data-act="pedit" data-id="' + p.id + '" style="padding:7px 13px">수정</button></td></tr>';
    });

    // 최근 주문
    var recent = orders.slice(0, 6).map(function (o) {
      return '<tr><td class="dt">' + fmtDate(o.at) + '</td>' +
        '<td><b style="font-variant-numeric:tabular-nums">' + esc(o.orderNo || '-') + '</b></td>' +
        '<td>' + esc(o.product || o.amount || '-') + (o.optionLabel ? '<div class="pc-sub">' + esc(o.optionLabel) + '</div>' : '') + '</td>' +
        '<td>' + esc(o.name || '-') + '</td>' +
        '<td style="white-space:nowrap">' + (o.total ? fmtWon(o.total) + '원' : '-') + '</td>' +
        '<td>' + stTag(o.status) + '</td></tr>';
    });

    return groupHead('판매 관리', '상품을 올리고, 주문을 처리하고, 얼마나 팔렸는지 봅니다.') +
      '<div class="stat-grid">' +
        kpi(fmtWon(sum(wk)) + '원', '이번 주 매출', '주문 ' + wk.length + '건') +
        kpi(fmtWon(sum(mo)) + '원', '이번 달 매출', '주문 ' + mo.length + '건') +
        kpi(wait + '건', '입금 확인 대기', wait ? '먼저 처리하세요' : '밀린 것 없음') +
        kpi(ship + '건', '발송 대기', ship ? '포장·운송장 입력' : '밀린 것 없음') +
      '</div>' +
      '<div class="gs-grid">' +
        shortcut('orders', 'shopping-cart', '주문 관리', '입금 확인 · 발송 · 반품/교환',
                 (wait + ship + rma) ? '처리 대기 ' + (wait + ship + rma) + '건' : '') +
        shortcut('products', 'package', '상품 관리', '상품 등록 · 가격 · 재고 · 사진',
                 soldout || low ? (soldout ? '품절 ' + soldout : '') + (soldout && low ? ' · ' : '') + (low ? '재고 적음 ' + low : '') : '전체 ' + prods.length + '개') +
        shortcut('sales', 'trending-up', '매출 · 정산', '기간별 매출 · 상품별 순위 · CSV', '') +
      '</div>' +
      '<div class="dash-2col">' +
        panelWrap('이번 달 상품별 판매', pk.length ? pk.length + '개 상품 · 금액순' : '', '<div class="src-list">' + rankBody + '</div>') +
        panelWrap('주문 상태 분포', '전체 ' + orders.length + '건', '<div class="src-list">' + stBody + '</div>') +
      '</div>' +
      '<div class="dash-2col">' +
        miniTable('재고 주의', '품절이거나 5개 이하', ['상품', '상태', ''], careRows, '재고가 넉넉합니다.') +
        miniTable('최근 주문', '', ['일시', '주문번호', '상품', '주문자', '금액', '상태'], recent, '아직 주문이 없습니다.') +
      '</div>';
  }

  function viewGroupCustomer() {
    var apps = gj(K.apps, []), inq = gj(K.inq, []);
    var na = apps.filter(function (r) { return r.status === '신규'; }).length;
    var ni = inq.filter(function (r) { return r.status === '신규'; }).length;
    var cohorts = S.getCohorts();
    var openC = cohorts.filter(function (c) { return c.status === '모집중' || c.status === '상시'; });
    var per = applicantsPerCohort();
    var cMax = Math.max.apply(null, cohorts.map(function (c) { return per[c.id] || 0; }).concat([1]));

    var cBars = cohorts.length
      ? cohorts.slice(0, 6).map(function (c) {
          return bar(esc(c.name) + ' <span class="pc-sub">' + esc(c.status) + '</span>', (per[c.id] || 0) + '명',
            Math.round((per[c.id] || 0) / cMax * 100),
            (c.status === '모집중' || c.status === '상시') ? 'var(--point)' : 'var(--ink-faint)');
        }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="calendar"></i><div>등록된 기수가 없습니다.</div></div>';

    var tMap = {}; inq.forEach(function (r) { var t = r.type || '일반 문의'; tMap[t] = (tMap[t] || 0) + 1; });
    var tk = Object.keys(tMap).sort(function (x, y) { return tMap[y] - tMap[x]; });
    var tMax = tk.length ? tMap[tk[0]] : 1;
    var tBars = tk.length
      ? tk.map(function (k) { return bar(esc(k), tMap[k] + '건', Math.round(tMap[k] / tMax * 100), 'var(--info)'); }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="message-square"></i><div>문의가 없습니다.</div></div>';

    var appRows = apps.slice(0, 5).map(function (r) {
      var tel = String(r.phone || '').replace(/[^0-9+]/g, '');
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td><b>' + esc(r.name || '-') + '</b></td>' +
        '<td>' + (tel ? '<a href="tel:' + tel + '" class="tel-link">' + esc(r.phone) + '</a>' : '-') + '</td>' +
        '<td>' + esc(r.course || '-') + '</td><td>' + stTag(r.status || '신규') + '</td></tr>';
    });
    var inqRows = inq.slice(0, 5).map(function (r) {
      var tel = String(r.phone || '').replace(/[^0-9+]/g, '');
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td><b>' + esc(r.name || '-') + '</b></td>' +
        '<td>' + (tel ? '<a href="tel:' + tel + '" class="tel-link">' + esc(r.phone) + '</a>' : '-') + '</td>' +
        '<td class="cell-clip">' + esc(r.memo || '-') + '</td><td>' + stTag(r.status || '신규') + '</td></tr>';
    });

    return groupHead('고객 관리', '교육과정을 열고, 신청자에게 연락하고, 문의에 답합니다.') +
      '<div class="stat-grid">' +
        kpi(na + '명', '연락 안 한 신청', '전체 ' + apps.length + '명') +
        kpi(ni + '건', '답변 안 한 문의', '전체 ' + inq.length + '건') +
        kpi(openC.length + '개', '접수 중인 기수', openC.length ? openC.map(function (c) { return esc(c.name); }).join(' · ') : '신청서에 선택지가 없습니다') +
        kpi(apps.filter(function (r) { return r.status === '확정' || r.status === '수료'; }).length + '명', '확정 · 수료', '') +
      '</div>' +
      '<div class="gs-grid">' +
        shortcut('cohorts', 'calendar-days', '교육과정 관리', '기수 등록 · 모집 상태',
                 cohorts.length ? cohorts.length + '개 기수' : '기수 없음') +
        shortcut('apps', 'user-plus', '신청자 관리', '신청자 명단 · 연락처 · 처리 기록', na ? '새 신청 ' + na + '명' : '') +
        shortcut('inq', 'message-square', '문의 내역', '문의 확인 · 답변 기록', ni ? '미답변 ' + ni + '건' : '') +
      '</div>' +
      '<div class="dash-2col">' +
        panelWrap('기수별 신청 현황', cohorts.length + '개 기수', '<div class="src-list">' + cBars + '</div>') +
        panelWrap('문의 유형', '전체 ' + inq.length + '건', '<div class="src-list">' + tBars + '</div>') +
      '</div>' +
      '<div class="dash-2col">' +
        miniTable('최근 신청자', '', ['일시', '이름', '연락처', '신청 기수', '상태'], appRows, '아직 신청이 없습니다.') +
        miniTable('최근 문의', '', ['일시', '이름', '연락처', '내용', '상태'], inqRows, '아직 문의가 없습니다.') +
      '</div>';
  }

  function viewGroupContent() {
    var posts = gj(K.posts, []);
    var pops = gj(K.popups, []) || [];
    var live = pops.filter(function (p) { return p.active; }).length;
    var partners = (S.getPartners() || []).length;
    if (pageImgs === null) loadPageImgs(function () { if (current === 'g_content') render(); });
    var slots = S.IMG_SLOTS || [];
    var upl = {}; (pageImgs || []).forEach(function (r) { upl[r.id] = true; });
    var byPage = {}, pageOrder = [];
    slots.forEach(function (sl) {
      if (!byPage[sl.page]) { byPage[sl.page] = { all: 0, up: 0 }; pageOrder.push(sl.page); }
      byPage[sl.page].all += 1;
      if (upl[sl.id]) byPage[sl.page].up += 1;
    });
    var upTotal = Object.keys(upl).length;
    var imgBars = pageImgs === null
      ? '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="loader"></i><div>사진 현황을 불러오는 중…</div></div>'
      : pageOrder.map(function (pg) {
          var d = byPage[pg];
          return bar(esc(pg), d.up + ' / ' + d.all + '자리', Math.round(d.up / d.all * 100),
                     d.up ? 'var(--main)' : 'var(--line)');
        }).join('');

    var catMap = {}; posts.forEach(function (x) { var c = x.cat || '공지'; catMap[c] = (catMap[c] || 0) + 1; });
    var ck = Object.keys(catMap);
    var cMaxP = ck.length ? Math.max.apply(null, ck.map(function (k) { return catMap[k]; })) : 1;
    var catBars = ck.length
      ? ck.map(function (k) { return bar(esc(k), catMap[k] + '건', Math.round(catMap[k] / cMaxP * 100), 'var(--olive)'); }).join('')
      : '<div class="admin-empty" style="padding:26px 10px"><i data-lucide="file-text"></i><div>등록된 글이 없습니다.</div></div>';

    var postRows = posts.slice().sort(function (x, y) { return (y.at || '').localeCompare(x.at || ''); })
      .slice(0, 6).map(function (x) {
        return '<tr><td><b>' + esc(x.title) + '</b></td><td><span class="tag">' + esc(x.cat) + '</span></td>' +
          '<td class="dt">' + fmtDate(x.at) + '</td></tr>';
      });
    var popRows = pops.slice(0, 6).map(function (x) {
      return '<tr><td>' + (x.img ? '<img src="' + esc(x.img) + '" style="width:52px;height:34px;object-fit:cover;border-radius:6px">' : '<span class="pc-sub">없음</span>') + '</td>' +
        '<td><b>' + esc(x.title) + '</b></td>' +
        '<td>' + (x.active ? '<span class="tag olive">게시 중</span>' : '<span class="tag">중지</span>') + '</td>' +
        '<td class="dt">' + (x.startsAt || '상시') + (x.endsAt ? ' ~ ' + x.endsAt : '') + '</td></tr>';
    });

    return groupHead('콘텐츠 관리', '홈페이지에 보이는 글·사진·알림을 관리합니다.') +
      '<div class="stat-grid">' +
        kpi(posts.length + '건', '게시글', ck.length ? ck.map(function (k) { return k + ' ' + catMap[k]; }).join(' · ') : '없음') +
        kpi(live + '개', '게시 중인 팝업', '전체 ' + pops.length + '개') +
        kpi(upTotal + '장', '올린 사진', '전체 ' + slots.length + '자리') +
        kpi(partners + '곳', '파트너', '홈 하단 로고 띠') +
      '</div>' +
      '<div class="gs-grid">' +
        shortcut('posts', 'file-text', '게시글 관리', '소식마당 글 목록 · 삭제', posts.length ? posts.length + '건' : '없음') +
        shortcut('images', 'image', '페이지 이미지', '홈페이지 사진 교체 · 위치 조정', upTotal + ' / ' + slots.length) +
        shortcut('popups', 'bell', '팝업 관리', '홈 첫 화면 알림', live ? '게시 중 ' + live + '개' : '없음') +
        shortcut('partners', 'handshake', '파트너 관리', '로고 띠', partners ? partners + '곳' : '없음') +
      '</div>' +
      '<div class="dash-2col">' +
        panelWrap('페이지별 사진 채움', '올린 사진이 없으면 기본 사진이 나옵니다', '<div class="src-list">' + imgBars + '</div>') +
        panelWrap('게시글 분류', '전체 ' + posts.length + '건', '<div class="src-list">' + catBars + '</div>') +
      '</div>' +
      '<div class="dash-2col">' +
        miniTable('최근 게시글', '', ['제목', '분류', '등록일'], postRows, '등록된 글이 없습니다.') +
        miniTable('팝업', '', ['이미지', '제목', '상태', '기간'], popRows, '등록된 팝업이 없습니다.') +
      '</div>';
  }

  function viewGroupSite() {
    var st = S.getSettings ? S.getSettings() : {};
    var D = S.SETTINGS_DEFAULTS || {};
    // 기본값 그대로면 아직 손대지 않은 것 — 계좌는 그대로 두면 손님이 엉뚱한 곳에 입금한다
    var isDefault = function (k) { return String(st[k] || '') === String(D[k] || ''); };
    var checks = [
      { k: 'bank',        label: '입금 계좌',      crit: true },
      { k: 'holder',      label: '예금주',        crit: true },
      { k: 'phone',       label: '대표 전화',      crit: false },
      { k: 'email',       label: '이메일',        crit: false },
      { k: 'address',     label: '주소',          crit: false },
      { k: 'bizNo',       label: '사업자등록번호', crit: false },
      { k: 'mailOrderNo', label: '통신판매업 신고', crit: false },
    ];
    var todo = checks.filter(function (c) { return c.crit && isDefault(c.k); });
    var rows = checks.map(function (c) {
      var def = isDefault(c.k);
      return '<tr><td><b>' + c.label + '</b></td>' +
        '<td class="cell-clip">' + esc(String(st[c.k] || '-')) + '</td>' +
        '<td>' + (def
          ? (c.crit ? '<span class="tag" style="background:var(--danger);color:#fff">기본값 — 꼭 바꾸세요</span>'
                    : '<span class="tag">기본값</span>')
          : '<span class="tag olive">설정함</span>') + '</td></tr>';
    });

    var acctNote = '';
    if (accounts === null && myRole === 'owner' && S.isServer && S.isServer()) {
      loadAccounts();
    } else if (accounts) {
      var own = accounts.filter(function (u) { return u.role === 'owner' && u.status === 'active'; }).length;
      var stf = accounts.filter(function (u) { return u.role === 'staff' && u.status === 'active'; }).length;
      acctNote = '관리자 ' + own + ' · 직원 ' + stf;
    }

    return groupHead('운영 설정', '계좌·연락처 같은 운영 정보와 관리자 계정을 관리합니다.') +
      (todo.length
        ? '<div class="modal-note" style="border-color:var(--danger);background:var(--surface);margin-bottom:18px">' +
          '<i data-lucide="alert-triangle"></i><span><b>' + todo.map(function (c) { return c.label; }).join(' · ') +
          '</b>가 아직 기본값입니다. 이대로 두면 <b>손님이 예시 계좌로 입금합니다.</b> ' +
          '아래 ‘설정’에서 실제 값으로 바꿔 주세요.</span></div>'
        : '') +
      '<div class="gs-grid">' +
        shortcut('settings', 'settings', '설정', '계좌 · 연락처 · 사업자정보 · 약도',
                 todo.length ? '확인 필요 ' + todo.length + '건' : '설정 완료') +
        (myRole === 'owner' && S.isServer && S.isServer()
          ? shortcut('accounts', 'users', '계정 관리', '직원 계정 · 권한 · 사용 중지', acctNote) : '') +
      '</div>' +
      '<div class="dash-2col">' +
        miniTable('지금 설정된 운영 정보', '푸터 · 결제 안내 · 문의 페이지에 그대로 나갑니다',
                  ['항목', '현재 값', '상태'], rows, '') +
        (myRole === 'owner' && S.isServer && S.isServer()
          ? miniTable('관리자 계정', accounts ? accounts.length + '개' : '불러오는 중…',
              ['아이디', '이름', '권한', '마지막 로그인'],
              (accounts || []).map(function (u) {
                return '<tr' + (u.status !== 'active' ? ' style="opacity:.55"' : '') + '>' +
                  '<td><b>' + esc(u.username) + '</b>' + (u.status !== 'active' ? ' <span class="tag">중지</span>' : '') + '</td>' +
                  '<td>' + esc(u.displayName) + '</td>' +
                  '<td>' + (u.role === 'owner' ? '<span class="tag solid">관리자</span>' : '<span class="tag">직원</span>') + '</td>' +
                  '<td class="dt">' + (u.lastLoginAt ? fmtDate(u.lastLoginAt) : '기록 없음') + '</td></tr>';
              }), '계정을 불러오지 못했습니다.')
          : panelWrap('약도 위치', '오시는 길 지도에 찍히는 자리',
              '<p class="muted" style="margin:0">위도 ' + esc(String(st.lat)) + ' · 경도 ' + esc(String(st.lng)) + '</p>' +
              '<p class="note">설정 화면의 지도에서 핀을 끌어 맞춥니다.</p>')) +
      '</div>' +
      '<div style="margin-top:24px">' +
        panelWrap('바꾸면 어디에 반영되나',
          '저장 후 공개 페이지를 새로고침하면 보입니다',
          '<ul class="iconlist">' +
            '<li class="il"><i data-lucide="landmark"></i><div><b>입금 계좌 · 예금주</b><p class="note">주문할 때 보이는 무통장입금 안내와 주문 완료 화면</p></div></li>' +
            '<li class="il"><i data-lucide="phone"></i><div><b>연락처 · 주소 · 운영 시간</b><p class="note">전 페이지 맨 아래(푸터) · 휴대폰 메뉴의 전화 걸기 · 문의 페이지</p></div></li>' +
            '<li class="il"><i data-lucide="building-2"></i><div><b>사업자 정보</b><p class="note">푸터의 사업자 정보 · 협동조합 소개의 ‘공식 등록 사항’ 표</p></div></li>' +
            '<li class="il"><i data-lucide="map-pin"></i><div><b>약도 좌표</b><p class="note">협동조합 소개 · 문의 페이지의 오시는 길 지도</p></div></li>' +
          '</ul>') +
      '</div>';
  }

  function viewGroupSystem() {
    if (pageImgs === null) loadPageImgs(function () { if (current === 'g_system') render(); });
    var orders = gj(K.orders, []), apps = gj(K.apps, []), inq = gj(K.inq, []);
    var posts = gj(K.posts, []), prods = S.getProducts();
    var cRaw = gj(K.consents, {}) || {}, kRaw = gj(K.kms, {}) || {};
    var rows = [
      ['주문',        orders.length + '건'],
      ['지도사 신청', apps.length + '명'],
      ['문의',        inq.length + '건'],
      ['상품',        prods.length + '개'],
      ['게시글',      posts.length + '건'],
      ['올린 사진',   (pageImgs === null ? '…' : Object.keys(pageImgs).length + '장') + ' (페이지 자리)'],
    ].map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; });

    var docs = [
      ['개인정보 수집·이용 동의문', !!(cRaw.privacy && cRaw.privacy.body)],
      ['제3자 제공 동의문',        !!(cRaw.third && cRaw.third.body)],
      ['표준 KMS',                 !!kRaw.standard],
      ['디자인 룰북',              !!kRaw.design],
    ].map(function (d) {
      return '<tr><td><b>' + d[0] + '</b></td><td>' +
        (d[1] ? '<span class="tag olive">수정함</span>' : '<span class="tag">표준안 그대로</span>') + '</td></tr>';
    });

    return groupHead('시스템', '평소에는 손대지 않는 항목입니다. 담당자와 상의해 바꾸세요.') +
      '<div class="modal-note" style="margin-bottom:18px"><i data-lucide="database"></i><span>' +
        '자료는 서버에 저장되지만 <b>실수로 지우거나 잘못 덮어쓴 것은 되돌릴 수 없습니다.</b> ' +
        '<b>데이터 백업</b>으로 주기적으로 내려받아 보관하세요.</span></div>' +
      '<div class="gs-grid">' +
        shortcut('backup', 'database', '데이터 백업', '자료 내려받기 · 되살리기', '주기적으로') +
        shortcut('consents', 'shield-check', '동의문 관리', '개인정보 수집·이용 · 제3자 제공', '') +
        shortcut('kms', 'book-open', 'KMS', '개발 규칙 · 디자인 룰북', '') +
      '</div>' +
      '<div class="dash-2col">' +
        miniTable('지금 담긴 자료', '백업 한 번이면 이 전부가 파일 하나로 저장됩니다', ['항목', '수량'], rows, '') +
        miniTable('문서 상태', '표준안을 고쳤는지', ['문서', '상태'], docs, '') +
      '</div>' +
      '<div class="dash-2col">' +
        panelWrap('권장 백업 주기', '정해 두고 지키는 편이 낫습니다',
          '<ul class="iconlist">' +
            '<li class="il"><i data-lucide="calendar-check"></i><div><b>주문이 있는 달 — 매주 금요일</b><p class="note">한 주 동안 들어온 주문·신청을 그날 저장합니다.</p></div></li>' +
            '<li class="il"><i data-lucide="calendar"></i><div><b>주문이 없는 달 — 매월 1일</b><p class="note">바뀐 것이 적어도 기록은 남깁니다.</p></div></li>' +
            '<li class="il"><i data-lucide="image-plus"></i><div><b>사진을 여러 장 바꾼 날</b><p class="note">사진은 용량이 커서 다시 올리기 번거롭습니다.</p></div></li>' +
            '<li class="il"><i data-lucide="hard-drive-download"></i><div><b>보관은 컴퓨터 밖에</b><p class="note">USB나 클라우드(구글 드라이브 등)에 옮겨 두세요.</p></div></li>' +
          '</ul>') +
        panelWrap('연결 상태', '서버가 제대로 붙어 있는지',
          '<ul class="iconlist">' +
            '<li class="il"><i data-lucide="' + (S.isServer && S.isServer() ? 'check-circle' : 'alert-circle') + '"></i>' +
              '<div><b>자료 저장</b><p class="note">' + (S.isServer && S.isServer()
                ? '서버에 저장 중 — 어느 기기에서나 같은 자료가 보입니다.'
                : '이 브라우저에만 저장 중 — 기기를 바꾸면 사라집니다.') + '</p></div></li>' +
            '<li class="il"><i data-lucide="' + (S.isServer && S.isServer() ? 'shield-check' : 'shield-alert') + '"></i>' +
              '<div><b>로그인</b><p class="note">' + (S.isServer && S.isServer()
                ? '서버 세션 — 계정별로 나뉘고 12시간 유지됩니다.'
                : '이 브라우저 안에서만 확인합니다.') + '</p></div></li>' +
            '<li class="il"><i data-lucide="images"></i><div><b>사진 저장소</b><p class="note">' +
              (S.isServer && S.isServer() ? '서버 파일 저장소(R2)' : '이 브라우저(IndexedDB)') + '</p></div></li>' +
          '</ul>') +
      '</div>';
  }

  /* ---------- nav ---------- */
  var NAV = [
    { id: 'dashboard', label: '대시보드', icon: 'layout-dashboard', view: viewDashboard, title: '대시보드' },
    { id: 'products', label: '상품 관리', icon: 'package', view: viewProducts, title: '상품 관리' },
    { id: 'orders', label: '주문 관리', icon: 'shopping-cart', view: viewOrders, title: '주문 관리', countKey: K.orders },
    { id: 'sales', label: '매출 · 정산', icon: 'trending-up', view: viewSales, title: '매출 · 정산 리포트' },
    { id: 'cohorts', label: '교육과정 관리', icon: 'calendar-days', view: viewCohorts, title: '교육과정(기수) 관리' },
    { id: 'apps', label: '신청자 관리', icon: 'user-plus', view: viewApps, title: '지도사 과정 신청자 관리', countKey: K.apps },
    { id: 'inq', label: '문의 내역', icon: 'message-square', view: viewInq, title: '문의 내역 관리', countKey: K.inq },
    { id: 'posts', label: '게시글 관리', icon: 'file-text', view: viewPosts, title: '게시글 관리', countKey: K.posts },
    { id: 'images', label: '페이지 이미지', icon: 'image', view: viewImages, title: '페이지 이미지 관리' },
    { id: 'partners', label: '파트너 관리', icon: 'handshake', view: viewPartners, title: '파트너 관리' },
    { id: 'popups', label: '팝업 관리', icon: 'bell', view: viewPopups, title: '팝업 관리', countKey: K.popups },
    { id: 'consents', label: '동의문 관리', icon: 'shield-check', view: viewConsents, title: '개인정보 동의문 관리' },
    { id: 'kms', label: 'KMS', icon: 'book-open', view: viewKMS, title: 'KMS — 표준 KMS · 디자인 룰북' },
    { id: 'accounts', label: '계정 관리', icon: 'users', view: viewAccounts, title: '관리자 계정 관리', serverOnly: true, ownerOnly: true },
    { id: 'settings', label: '설정', icon: 'settings', view: viewSettings, title: '사이트 설정 — 운영 정보' },
    { id: 'backup', label: '데이터 백업', icon: 'database', view: viewBackup, title: '데이터 백업 · 복원' },
    { id: 'manual', label: '사용 설명서', icon: 'book-open-check', view: viewManual, title: '사용 설명서' },
    // 그룹 요약 — 사이드바 그룹 이름을 눌렀을 때 나오는 화면
    { id: 'g_sales',    label: '판매 관리',   icon: 'shopping-bag',    view: viewGroupSales,    title: '판매 관리' },
    { id: 'g_customer', label: '고객 관리',   icon: 'users-round',     view: viewGroupCustomer, title: '고객 관리' },
    { id: 'g_content',  label: '콘텐츠 관리', icon: 'layout-template', view: viewGroupContent,  title: '콘텐츠 관리' },
    { id: 'g_site',     label: '운영 설정',   icon: 'sliders-horizontal', view: viewGroupSite,  title: '운영 설정' },
    { id: 'g_system',   label: '시스템',      icon: 'server-cog',      view: viewGroupSystem,   title: '시스템' },
  ];

  /* 사이드바 구조. 평평한 목록 15개는 눈으로 훑기 어렵다 —
     하는 일이 같은 것끼리 묶고, 그룹 이름을 누르면 그 묶음 요약을 보여 준다.
     '시스템'은 평소 손댈 일이 없으므로 기본으로 접어 둔다. */
  var NAV_TREE = [
    { solo: 'manual' },
    { solo: 'dashboard' },
    { group: 'g_sales',    items: ['products', 'orders', 'sales'] },
    { group: 'g_customer', items: ['cohorts', 'apps', 'inq'] },
    { group: 'g_content',  items: ['posts', 'images', 'popups', 'partners'] },
    { group: 'g_site',     items: ['settings', 'accounts'] },
    { group: 'g_system',   items: ['backup', 'consents', 'kms'], collapsed: true },
  ];
  var navOpen = null;   // 열려 있는 그룹 id. null = 아직 정하지 않음(현재 화면 따라 자동)
  var current = 'dashboard';

  /* ---------- 저장하지 않은 변경 경고 ---------- */
  var dirty = false;
  function isEditingForm() {
    return prodEditing !== null || kmsMode === 'edit' || consentMode === 'edit'
      || !!document.getElementById('partnerForm') || !!document.getElementById('popupForm')
      || !!document.getElementById('settingsForm');
  }
  // 이동/취소 전 호출 — 변경이 있으면 확인, 사용자가 취소하면 false 반환(이동 중단)
  function confirmLeave() {
    return !dirty || confirm('저장하지 않은 변경 내용이 있습니다.\n저장하지 않고 이동하시겠습니까?');
  }

  // 지금 환경·권한에서 쓸 수 있는 메뉴만. 서버가 403 으로 막더라도
  // 못 쓰는 메뉴를 보여 주는 것 자체가 혼란이다.
  function visibleNav() {
    var server = !!(S.isServer && S.isServer());
    return NAV.filter(function (n) {
      if (n.serverOnly && !server) return false;
      if (n.ownerOnly && myRole !== 'owner') return false;
      return true;
    });
  }
  function navItem(id) {
    var v = visibleNav();
    for (var i = 0; i < v.length; i++) if (v[i].id === id) return v[i];
    return null;
  }
  // 지금 보고 있는 화면이 속한 그룹
  function groupOf(id) {
    for (var i = 0; i < NAV_TREE.length; i++) {
      var t = NAV_TREE[i];
      if (!t.group) continue;
      if (t.group === id || t.items.indexOf(id) > -1) return t.group;
    }
    return null;
  }
  function isOpen(t) {
    if (navOpen !== null) return navOpen === t.group;
    // 아직 아무 그룹도 펼치지 않았으면, 보고 있는 화면이 속한 그룹만 연다.
    // '시스템'은 평소 쓸 일이 없어 기본으로 접어 둔다.
    var cur = groupOf(current);
    if (cur) return cur === t.group;
    return !t.collapsed;
  }

  function renderNav() {
    var html = '';
    NAV_TREE.forEach(function (t) {
      if (t.solo) {
        var it = navItem(t.solo);
        if (!it) return;
        html += '<button data-nav="' + it.id + '" class="nav-solo ' +
          (it.id === 'manual' ? 'nav-manual ' : '') + (it.id === current ? 'on' : '') + '">' +
          '<i data-lucide="' + it.icon + '"></i>' + it.label + '</button>';
        return;
      }
      var items = t.items.map(navItem).filter(Boolean);
      if (!items.length) return;
      var g = navItem(t.group);
      var open = isOpen(t);
      // 접힌 그룹의 대기 건수는 그룹 이름 옆에 모아 보여 준다 — 접혀 있어도 놓치지 않게
      var total = items.reduce(function (s, it) { return s + (it.countKey ? gj(it.countKey, []).length : 0); }, 0);
      html += '<div class="nav-group' + (open ? ' open' : '') + '">' +
        '<button class="nav-gh ' + (current === t.group ? 'on' : '') + '" data-navgroup="' + t.group + '">' +
          '<i data-lucide="' + (g ? g.icon : 'folder') + '"></i>' +
          '<span>' + (g ? g.label : t.group) + '</span>' +
          (!open && total ? '<span class="badge">' + total + '</span>' : '') +
          '<i data-lucide="chevron-down" class="nav-caret"></i>' +
        '</button>' +
        '<div class="nav-sub">' + items.map(function (it) {
          var cnt = it.countKey ? gj(it.countKey, []).length : 0;
          return '<button data-nav="' + it.id + '" class="' + (it.id === current ? 'on' : '') + '">' +
            '<i data-lucide="' + it.icon + '"></i>' + it.label +
            (cnt ? '<span class="badge">' + cnt + '</span>' : '') + '</button>';
        }).join('') + '</div></div>';
    });
    document.getElementById('adminNav').innerHTML = html;
    icons();
  }
  function render() {
    dirty = false;
    revokeURLs();
    if (descEditor) { try { descEditor.destroy(); } catch (e) {} descEditor = null; }
    if (settingsMap) { try { settingsMap.remove(); } catch (e) {} settingsMap = null; }
    var n = visibleNav().filter(function(x){ return x.id === current; })[0] || visibleNav()[0];
    document.getElementById('adminTitle').textContent = n.title;
    var av = document.getElementById('adminView');
    av.innerHTML = n.view();
    av.classList.toggle('view-full', current === 'dashboard' || current === 'manual');
    renderNav();
    icons();
    bindForms();
    if (current === 'manual') bindManualTabs();
  }

  /* ---------- 이미지 리사이즈 ----------
     팝업·파트너 로고는 문서 안에 dataURL 로 들어가므로 resizeToDataURL,
     상품·페이지 사진은 R2/IndexedDB 에 파일로 들어가므로 resizeToFile 을 쓴다. */
  function resizeToFile(file, maxW, cb) {
    resizeToDataURL(file, maxW, function (durl) {
      if (!durl) { cb(null); return; }
      dataURLToBlob(durl).then(function (blob) {
        cb(new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
      }).catch(function () { cb(null); });
    });
  }
  function resizeToDataURL(file, maxW, cb) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var sc = Math.min(1, maxW / img.width);
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(''); };
    img.src = url;
  }

  /* ---------- form bindings ---------- */
  var pendingLogo = '', pendingPopImg = '';
  function bindForms() {
    var pf = document.getElementById('partnerForm');
    if (pf) {
      pendingLogo = '';
      var fileIn = pf.querySelector('input[name=logo]');
      // 로고도 축소 후 저장(가로형 로고 — 가로 400px 기준) → localStorage 쿼터 압력↓
      if (fileIn) fileIn.addEventListener('change', function () {
        var f = fileIn.files[0]; if (!f) return;
        resizeToDataURL(f, 400, function (durl) {
          // 읽지 못하면 알려 준다 — 조용히 넘어가면 로고 없이 저장된 걸 나중에 알게 된다
          if (!durl) { toast('이미지를 읽을 수 없습니다. 사진 파일(JPG·PNG)인지 확인해 주세요.'); fileIn.value = ''; return; }
          pendingLogo = durl;
        });
      });
      pf.addEventListener('submit', function(e){
        e.preventDefault();
        var fd = new FormData(pf);
        var p = { id: uid(), name: fd.get('name'), url: fd.get('url'), logo: pendingLogo };
        var a = S.getPartners(); a.push(p);
        if (!S.setPartners(a)) { toast('저장 공간이 부족합니다. 로고 용량을 줄이거나 데이터를 백업·정리해 주세요.'); return; }
        render();
        toast('파트너가 추가되었습니다.');
      });
      var rs = document.getElementById('partnerReset');
      if (rs) rs.addEventListener('click', function(){ if(confirm('파트너 목록을 기본값으로 되돌릴까요?')){ S.setPartners(S.partnerDefaults.slice()); render(); } });
    }

    var pop = document.getElementById('popupForm');
    if (pop) {
      pendingPopImg = '';
      var pin = document.getElementById('popImgInput');
      if (pin) pin.addEventListener('change', function () {
        var f = pin.files[0]; if (!f) return;
        resizeToDataURL(f, 900, function (durl) {
          if (!durl) { toast('이미지를 읽을 수 없습니다. 사진 파일(JPG·PNG)인지 확인해 주세요.'); pin.value = ''; return; }
          pendingPopImg = durl;
        });
      });
      pop.addEventListener('submit', function(e){
        e.preventDefault();
        var d = {}; new FormData(pop).forEach(function(v,k){ if(k!=='img') d[k]=v; });
        d.id = uid(); d.active = true; d.img = pendingPopImg;
        var a = gj(K.popups, []); a.unshift(d);
        if (!sj(K.popups, a)) { toast('저장 공간이 부족합니다. 이미지 용량을 줄이거나 데이터를 백업·정리해 주세요.'); return; }
        render();
        toast('팝업이 추가되었습니다.');
      });
    }

    var cf = document.getElementById('cohortForm');
    if (cf) {
      cf.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(cf);
        var name = (fd.get('name') || '').trim();
        if (!name) return;
        var list = S.getCohorts();
        list.push({ id: uid(), name: name, period: (fd.get('period') || '').trim(), schedule: (fd.get('schedule') || '').trim(), place: (fd.get('place') || '').trim(), status: fd.get('status') || '모집중' });
        if (!S.setCohorts(list)) { toast('저장 공간이 부족합니다.'); return; }
        render();
        toast('기수가 추가되었습니다. 지도사 페이지·신청서에 반영됩니다.');
      });
    }

    var af = document.getElementById('acctForm');
    if (af) {
      af.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(af), body = {};
        fd.forEach(function (v, k) { body[k] = String(v).trim(); });
        S.api('/api/admin/users', { method: 'POST', body: body }).then(function (r) {
          if (!r.ok) { alert(r.data.error || '계정을 만들지 못했습니다.'); return; }
          accounts = null; dirty = false; render();
          toast('계정을 만들었습니다. 첫 로그인 때 본인이 비밀번호를 바꿉니다.');
        });
      });
    }

    var sf = document.getElementById('settingsForm');
    if (sf) {
      sf.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(sf), obj = {};
        fd.forEach(function (v, k) { obj[k] = String(v).trim(); });
        // 좌표는 숫자 검증(빈 값이면 기본값으로 되돌아감)
        ['lat', 'lng'].forEach(function (k) { if (obj[k] && isNaN(Number(obj[k]))) obj[k] = ''; });
        if (S.setSettings && !S.setSettings(obj)) { toast('저장 공간이 부족합니다.'); return; }
        dirty = false; render();
        toast('설정을 저장했습니다. 공개 페이지 새로고침 시 반영됩니다.');
      });
      initSettingsMap();
    }

    bindProductForm();
    if (document.querySelector('.simg-split')) {
      fillSlotPreviews();
      fillPosEditor();
      var fr = document.getElementById('simgFrame');
      // iframe 은 비동기로 뜬다 — 다 뜬 뒤 기본 사진 미리보기를 한 번 더 채운다
      if (fr) fr.addEventListener('load', function () {
        fitSimgPreview(); scrollFrameToSel();
        S.Media.list('page').then(function (recs) {
          var have = {}; recs.forEach(function (r) { have[r.id] = true; });
          fillDefaultPreviews(have);
        });
      });
      fitSimgPreview();
    }
  }

  /* ---------- delegation ---------- */
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t.dataset && t.dataset.simgUp) {
      var f = t.files && t.files[0]; if (!f) return;
      var slotId = t.dataset.simgUp;
      resizeToFile(f, 1600, function (file) {
        if (!file) { toast('이미지를 읽을 수 없습니다.'); return; }
        // 재업로드 시 맞춰 둔 위치(pcx/pcy/mbx/mby)는 보존한다
        S.Media.list('page', slotId).then(function (recs) {
          var prev = recs[0] || {};
          return S.Media.put('page', slotId, file, {
            keep: { pcx: prev.pcx, pcy: prev.pcy, mbx: prev.mbx, mby: prev.mby },
          });
        }).then(function (r) {
          if (!r) { toast('이미지 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'); return; }
          var meta = slotById(slotId);
          imgSel = slotId;   // 올린 뒤 바로 위치 편집기(또는 원본표시 안내) 표시
          dirty = false; render();
          toast('사진이 저장되었습니다.' + (meta && meta.crop !== false ? ' 아래에서 위치를 맞춰 보세요.' : ''));
        });
      });
      return;
    }
    if (t.dataset && t.dataset.act === 'status') { updateField(t.dataset.key, t.dataset.id, 'status', t.value); renderNav(); toast('상태가 변경되었습니다.'); }
    if (t.dataset && t.dataset.act === 'pstatus') {
      var a = S.getProducts(); a.forEach(function (p) { if (p.id === t.dataset.id) p.status = t.value; }); S.setProducts(a);
      toast('판매 상태가 변경되었습니다.');
    }
    if (t.dataset && t.dataset.act === 'cstatus') {
      var cl = S.getCohorts(); cl.forEach(function (c) { if (c.id === t.dataset.id) c.status = t.value; }); S.setCohorts(cl);
      toast('기수 모집 상태가 변경되었습니다.');
    }
    if (t.name === 'rel') updateRelChips();
    if (t.id === 'oselAll') {
      // 화면에 보이는 줄만 선택한다. 검색으로 걸러낸 상태에서 숨은 줄까지 켜면
      // 운영자가 보지 못한 주문이 이어지는 처리(입금확인·발송)에 딸려 들어간다.
      document.querySelectorAll('.osel').forEach(function (c) {
        var tr = c.closest('tr');
        if (tr && tr.style.display === 'none') { c.checked = false; return; }
        c.checked = t.checked;
      });
    }
  });

  // 주문 목록 즉시 검색(주문번호·주문자·연락처·입금자·상품 등 행 전체 텍스트 매칭)
  document.addEventListener('input', function (e) {
    if (!e.target) return;
    if (e.target.id === 'oSearch') {
      var q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.admin-table tbody tr').forEach(function (tr) {
        var chk = tr.querySelector('.osel');
        if (!chk) return;
        var hit = !q || tr.textContent.toLowerCase().indexOf(q) > -1;
        tr.style.display = hit ? '' : 'none';
        if (!hit) chk.checked = false;   // 걸러진 줄의 선택은 남기지 않는다
      });
      var all = document.getElementById('oselAll');
      if (all) all.checked = false;
      return;
    }
    if (e.target.id === 'memSearch') {
      memberQ = e.target.value.trim();
      clearTimeout(window.__memT);
      window.__memT = setTimeout(function () { members = null; render();
        var el = document.getElementById('memSearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 400);
      return;
    }
    // 신청·문의 목록 검색 — data-target 테이블 행 필터
    if (e.target.classList && e.target.classList.contains('list-search')) {
      var qq = e.target.value.trim().toLowerCase();
      var tbl = document.getElementById(e.target.dataset.target);
      if (!tbl) return;
      tbl.querySelectorAll('tbody tr').forEach(function (tr) {
        if (tr.querySelector('.admin-empty')) return;
        tr.style.display = (!qq || tr.textContent.toLowerCase().indexOf(qq) > -1) ? '' : 'none';
      });
    }
  });

  document.addEventListener('click', function(e){
    // 서브탭
    var st = e.target.closest('[data-subtab]');
    if (st) {
      if (!confirmLeave()) return;
      if (current === 'kms') kmsTab = st.dataset.subtab;
      else if (current === 'consents') consentTab = st.dataset.subtab;
      else if (current === 'images') { imgPageTab = st.dataset.subtab; imgSel = null; }
      render(); return;
    }
    // 페이지 이미지 — 위치 화살표(즉시 반영, render 없음)
    var nb = e.target.closest('[data-pe-nudge]');
    if (nb) { nudgePos(nb.dataset.peNudge); return; }
    // 페이지 이미지 — 슬롯 선택(위치 편집 대상)
    var sc = e.target.closest('[data-slot-sel]');
    if (sc) { imgSel = sc.dataset.slotSel; render(); return; }
    // 페이지 이미지 — 기기(PC/모바일) 토글
    var idev = e.target.closest('[data-imgdev]');
    if (idev) { imgDevice = idev.dataset.imgdev; render(); return; }
    // CSV 내보내기
    var csv = e.target.closest('[data-csv]');
    if (csv) { exportCSV(csv.dataset.csv); return; }
    // 매출 기간 탭
    var sp = e.target.closest('[data-speriod]');
    if (sp) { salesPeriod = sp.dataset.speriod; render(); return; }
    // 신청·문의 상세·처리 모달 열기
    var det = e.target.closest('[data-detail]');
    if (det) { openRecordDetail(det.dataset.detail, det.dataset.id); return; }
    // 주문 드롭다운
    var dbtn = e.target.closest('#odropBtn');
    var menu = document.getElementById('odropMenu');
    if (dbtn && menu) { menu.classList.toggle('open'); return; }
    if (menu && !e.target.closest('.odrop')) menu.classList.remove('open');

    var oact = e.target.closest('[data-oact]');
    if (oact) { if (menu) menu.classList.remove('open'); procOrders(oact.dataset.oact); return; }
    var otab = e.target.closest('[data-otab]');
    if (otab) { orderTab = otab.dataset.otab; render(); return; }

    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act;
    if (act === 'del') {
      if (!confirm('삭제하시겠습니까?')) return;
      if (b.dataset.key === 'PARTNER') { S.setPartners(S.getPartners().filter(function(p){ return p.id !== b.dataset.id; })); }
      else removeRow(b.dataset.key, b.dataset.id);
      render();
    } else if (act === 'cdel') {
      if (!confirm('이 기수를 삭제할까요? 지도사 페이지·신청서에서도 사라집니다.')) return;
      S.setCohorts(S.getCohorts().filter(function (c) { return c.id !== b.dataset.id; }));
      render();
    } else if (act === 'poptoggle') {
      var a = gj(K.popups, []); a.forEach(function(p){ if(p.id===b.dataset.id) p.active = !p.active; }); sj(K.popups, a); render();
      toast('팝업이 ' + (a.some(function(p){ return p.id===b.dataset.id && p.active; }) ? '게시' : '중지') + '되었습니다.');
    } else if (act === 'simgdel') {
      if (!confirm('이 자리의 사진을 내릴까요? 페이지는 기본 자리표시로 돌아갑니다.')) return;
      if (imgSel === b.dataset.id) imgSel = null;
      S.Media.del('page', b.dataset.id).then(function(){ render(); toast('사진을 내렸습니다.'); });
    } else if (act === 'pnew') { prodEditing = 'new'; pImgState.removed = []; render();
    } else if (act === 'pedit') { prodEditing = b.dataset.id; pImgState.removed = []; render();
    } else if (act === 'pback') { if (!confirmLeave()) return; prodEditing = null; pImgState = { main: null, extra: [], detail: [], removed: [] }; render();
    } else if (act === 'pdel') {
      if (!confirm('이 상품을 삭제할까요? 상품 이미지도 함께 삭제됩니다.')) return;
      S.setProducts(S.getProducts().filter(function (p) { return p.id !== b.dataset.id; }));
      S.Media.delFor('product', b.dataset.id);
      render();
    } else if (act === 'pimgdel') {
      pImgState.removed.push(b.dataset.id);
      b.closest('.pimg-cell').remove(); dirty = true;
    } else if (act === 'optadd') {
      document.getElementById('optRows').insertAdjacentHTML('beforeend', optRowHTML(null)); icons(); dirty = true;
    } else if (act === 'optdel') {
      b.closest('.opt-row').remove(); dirty = true;
    } else if (act === 'tpl-ship') {
      document.querySelector('#productForm textarea[name=ship]').value = S.SHIP_TPL; dirty = true;
    } else if (act === 'tpl-refund') {
      document.querySelector('#productForm textarea[name=refund]').value = S.REFUND_TPL; dirty = true;
    } else if (act === 'consentEdit') { consentMode = 'edit'; render();
    } else if (act === 'consentCancel') { if (!confirmLeave()) return; consentMode = 'view'; render();
    } else if (act === 'consentsave') {
      var existing = gj(K.consents, {}) || {};
      document.querySelectorAll('[data-consent]').forEach(function (t) { existing[t.dataset.consent] = { body: t.value }; });
      if (!sj(K.consents, existing)) { toast('저장 공간이 부족합니다. 데이터를 백업·정리해 주세요.'); return; }
      consentMode = 'view'; render();
      toast('동의문이 저장되었습니다. 신청·주문·문의 양식에 즉시 반영됩니다.');
    } else if (act === 'consentreset') {
      if (!confirm('현재 동의문을 표준안으로 복원할까요?')) return;
      var ex = gj(K.consents, {}) || {}; delete ex[consentTab]; sj(K.consents, ex); consentMode = 'view'; render();
    } else if (act === 'kmsEdit') { kmsMode = 'edit'; render();
    } else if (act === 'kmsCancel') { if (!confirmLeave()) return; kmsMode = 'view'; render();
    } else if (act === 'kmssave') {
      var k = gj(K.kms, {}) || {};
      document.querySelectorAll('[data-kms]').forEach(function (t) { k[t.dataset.kms] = t.value; });
      if (!sj(K.kms, k)) { toast('저장 공간이 부족합니다. 데이터를 백업·정리해 주세요.'); return; }
      kmsMode = 'view'; render();
      toast('KMS 문서가 저장되었습니다.');
    } else if (act === 'kmsreset') {
      if (!confirm('현재 문서를 기본 문서로 복원할까요?')) return;
      var kk = gj(K.kms, {}) || {}; delete kk[kmsTab]; sj(K.kms, kk); kmsMode = 'view'; render();
    } else if (act === 'myPassword') {
      openMyPassword();
    } else if (act === 'memNew') {
      openMemberEdit(null);
    } else if (act === 'memEdit') {
      S.api('/api/admin/members/' + b.dataset.id).then(function (r) {
        if (!r.ok) { alert(r.data.error || '불러오지 못했습니다.'); return; }
        openMemberEdit(r.data.member);
      });
    } else if (act === 'memSave') {
      saveMember();
    } else if (act === 'memToggle') {
      var box0 = document.querySelector('[data-mem-id]');
      var cur = b.textContent.indexOf('중지') > -1 ? 'disabled' : 'active';
      S.api('/api/admin/members/' + b.dataset.id, { method: 'PATCH', body: { status: cur } }).then(function (r) {
        if (!r.ok) { showMsg('mfMsg', r.data.error || '변경하지 못했습니다.'); return; }
        S.closeModal(); members = null; render();
        toast(cur === 'active' ? '다시 사용합니다.' : '사용을 중지했습니다.');
      });
    } else if (act === 'roleNew') {
      openRoleEdit(null);
    } else if (act === 'roleEdit') {
      openRoleEdit((roles || []).filter(function (x) { return String(x.id) === b.dataset.id; })[0]);
    } else if (act === 'roleSave') {
      saveRole();
    } else if (act === 'roleDel') {
      if (!confirm('이 권한 그룹을 지울까요?')) return;
      S.api('/api/admin/roles/' + b.dataset.id, { method: 'DELETE' }).then(function (r) {
        if (!r.ok) { alert(r.data.error || '지우지 못했습니다.'); return; }
        roles = null; render(); toast('권한 그룹을 지웠습니다.');
      });
    } else if (act === 'acctEdit') {
      openAccountEdit(b.dataset.id);
    } else if (act === 'acctSave') {
      saveAccount();
    } else if (act === 'acctOff') {
      if (!confirm('이 계정의 사용을 중지할까요? 로그인할 수 없게 되지만 지난 처리 기록은 남습니다.')) return;
      setAccountStatus(b.dataset.id, 'disabled');
    } else if (act === 'acctOn') {
      setAccountStatus(b.dataset.id, 'active');
    } else if (act === 'geocode') {
      geocodeAddress();
    } else if (act === 'recSave') {
      saveRecordDetail();
    } else if (act === 'settingsReset') {
      if (!confirm('설정을 기본값으로 되돌릴까요? 저장된 운영 정보(계좌·연락처 등)가 초기화됩니다.')) return;
      if (S.setSettings) S.setSettings({});
      dirty = false; render(); toast('설정을 기본값으로 되돌렸습니다.');
    } else if (act === 'exportAll') {
      doExport();
    } else if (act === 'importPick') {
      var fin = document.createElement('input');
      fin.type = 'file'; fin.accept = 'application/json,.json';
      fin.onchange = function () { if (fin.files[0]) doImport(fin.files[0]); };
      fin.click();
    }
  });
  /* 좁은 화면 사이드바 — 열기/닫기 */
  function setSide(open) {
    var side = document.getElementById('adminSide');
    var dim = document.getElementById('asDim');
    var btn = document.getElementById('asToggle');
    if (!side) return;
    side.classList.toggle('open', open);
    if (dim) dim.classList.toggle('on', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#asToggle')) {
      setSide(!document.getElementById('adminSide').classList.contains('open'));
      return;
    }
    if (e.target.closest('#asDim')) setSide(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSide(false); });

  document.addEventListener('click', function (e) {
    var at = e.target.closest('[data-accttab]');
    if (at) { acctTab = at.dataset.accttab; render(); return; }
    var gh = e.target.closest('[data-navgroup]');
    if (!gh) return;
    if (!confirmLeave()) return;
    var gid = gh.dataset.navgroup;
    // 이미 열려 있는 그룹의 이름을 다시 누르면 접는다
    navOpen = (navOpen === gid && current === gid) ? '' : gid;
    current = gid;
    prodEditing = null; kmsMode = 'view'; consentMode = 'view';
    render();
    // 좁은 화면에서는 여기서도 닫아야 한다 — 안 닫으면 덮개가 화면을 막는다.
    // 그룹 요약 화면 자체가 하위 바로가기를 담고 있어 메뉴를 열어 둘 이유도 없다.
    setSide(false);
    window.scrollTo(0, 0);
  });

  document.addEventListener('click', function(e){
    var nav = e.target.closest('[data-nav]'); if (!nav) return;
    if (!confirmLeave()) return;
    current = nav.dataset.nav;
    navOpen = groupOf(current);        // 고른 화면이 속한 그룹을 열어 둔다
    if (nav.dataset.otab) orderTab = nav.dataset.otab;
    prodEditing = null; kmsMode = 'view'; consentMode = 'view';
    render();
    setSide(false);          // 좁은 화면에서 메뉴를 고르면 사이드바를 닫는다
    window.scrollTo(0, 0);
  });

  // 편집 중인 폼에 입력이 생기면 '변경 있음'으로 표시
  function markDirty(e){
    if (!isEditingForm()) return;
    var v = document.getElementById('adminView');
    if (v && e.target && v.contains(e.target)) dirty = true;
  }
  document.addEventListener('input', markDirty);
  document.addEventListener('change', markDirty);
  // 새로고침·탭 닫기·홈페이지 이동·로그아웃 시 변경분 손실 경고(브라우저 기본 확인창)
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- auth (상태 미저장 · 잠금) ---------- */
  var authed = false;
  var myRole = 'owner';     // 로컬 모드에는 역할 구분이 없다 — 전부 허용
  var myName = '';
  function unlock(){
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';
    var meta = document.getElementById('adminMeta');
    if (meta && myName) meta.textContent = myName + '님 (' + (myRole === 'owner' ? '관리자' : '직원') + ')';
    render(); icons();
  }
  function initAuth() {
    if (S.isServer && S.isServer()) {
      // 서버가 이미 세션을 확인하고 들여보냈다. 여기서 또 묻지 않는다.
      S.api('/api/admin/session').then(function (r) {
        if (r.ok && r.data.authenticated && r.data.user) {
          myRole = r.data.user.role || 'staff';
          myName = r.data.user.displayName || r.data.user.username || '';
          myPerms = r.data.perms || null;
          if (r.data.roleName) myRole = (r.data.perms || []).indexOf('accounts.manage') > -1 ? 'owner' : 'staff';
        }
        authed = true; unlock();
      });
      document.getElementById('logoutBtn').addEventListener('click', function () {
        fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
          .catch(function () {})
          .then(function () { location.href = '/login.html'; });
      });
      return;
    }
    document.getElementById('loginGate').style.display = 'grid';
    icons();
    var form = document.getElementById('loginForm');
    var btn = form.querySelector('button[type=submit]');
    var err = document.getElementById('loginErr');
    var idEl = document.getElementById('loginId'), pwEl = document.getElementById('loginPw');
    setTimeout(function(){ if (idEl) idEl.focus(); }, 100);
    var timer = null;
    function refreshLock() {
      var ms = S.lockMs();
      if (ms > 0) { btn.disabled = true; err.textContent = '로그인 시도가 많아 잠시 잠겼습니다. ' + Math.ceil(ms / 1000) + '초 후 다시 시도하세요.'; timer = setTimeout(refreshLock, 1000); }
      else { btn.disabled = false; if (timer) { clearTimeout(timer); timer = null; } }
    }
    refreshLock();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (S.lockMs() > 0) { refreshLock(); return; }
      btn.disabled = true;
      S.verifyLogin(idEl.value, pwEl.value).then(function (r) {
        if (r.ok) { authed = true; unlock(); return; }
        if (r.locked) { refreshLock(); return; }
        btn.disabled = false;
        err.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.' + (r.attemptsLeft != null ? ' (남은 시도 ' + r.attemptsLeft + '회)' : '');
        pwEl.value = ''; pwEl.focus();
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', function(){ authed = false; location.reload(); });
  }


  /* ============================================================
     도움말 챗봇 — 설명서에서 관련 대목을 찾아 답한다.
     · 근거 찾기는 화면에서(설명서 본문을 이미 들고 있다)
     · 문장 다듬기는 서버의 Workers AI 에서
     · 모델이 없거나 실패하면 찾은 절을 그대로 안내한다 — 아무것도 못 주는 상황을 만들지 않는다
     ============================================================ */
  var cbSections = null;   // [{id, title, text}]
  var cbBusy = false;

  var CB_QUICK = ['입금 확인은 어떻게 하나요?', '택배 보낸 뒤엔 뭘 눌러요?',
                  '홈페이지 사진 바꾸려면?', '계좌번호는 어디서 바꿔요?', '백업은 왜 해야 하나요?'];

  function cbEl(id) { return document.getElementById(id); }
  function cbSay(who, html) {
    var b = cbEl('cbBody'); if (!b) return null;
    var d = document.createElement('div');
    d.className = 'cb-msg ' + who;
    d.innerHTML = html;
    b.appendChild(d); b.scrollTop = b.scrollHeight;
    icons();
    return d;
  }

  /* 찾은 절을 채팅 안에 '그대로' 보여 주기 위해 손질한다.
     설명서는 우리가 쓴 파일이라 내용 자체는 믿을 수 있지만, 문서에 두 번 들어가면
     곤란한 것들이 있다:
       · id — 같은 id 가 둘이 되면 '설명서에서 열기'가 엉뚱한 곳으로 간다
       · reveal — 등장 애니메이션 대기 상태다. 관리자 본문에는 해제 규칙이 있지만
                  챗봇 패널은 그 바깥이라 그대로 두면 투명한 채 남는다(빈 화면으로 보인다)
       · #앵커 링크 — 채팅 안에서 눌러도 갈 곳이 없다. 절 이동 버튼으로 바꾼다 */
  function cbClean(root) {
    [].slice.call(root.querySelectorAll('[id]')).forEach(function (e) { e.removeAttribute('id'); });
    [].slice.call(root.querySelectorAll('.reveal')).forEach(function (e) { e.classList.remove('reveal'); });
    [].slice.call(root.querySelectorAll('.jump, .page-hero')).forEach(function (e) { e.remove(); });
    [].slice.call(root.querySelectorAll('a[href^="#"]')).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-link';
      b.setAttribute('data-cbgo', a.getAttribute('href').slice(1));
      b.innerHTML = a.innerHTML;
      a.parentNode.replaceChild(b, a);
    });
    return root;
  }

  // 설명서 본문을 절 단위로 쪼갠다(한 번만). text 는 검색·모델용, html 은 화면에 그대로 보여 주는 용도
  function cbIndex() {
    if (cbSections) return Promise.resolve(cbSections);
    var build = function (htmlText) {
      var box = document.createElement('div');
      box.innerHTML = htmlText;
      cbSections = [].slice.call(box.querySelectorAll('section[id]')).map(function (sec) {
        var h = sec.querySelector('h2');
        return { id: sec.id, title: (h ? h.textContent : sec.id).trim(),
                 text: (sec.textContent || '').replace(/\s+/g, ' ').trim(),
                 html: cbClean(sec.cloneNode(true)).innerHTML };
      });
      return cbSections;
    };
    if (manualHTML && manualHTML !== false) return Promise.resolve(build(manualHTML));
    return fetch('assets/manual.html', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (t) { manualHTML = t; return build(t); })
      .catch(function () { cbSections = []; return cbSections; });
  }

  /* 질문과 겹치는 낱말이 많은 절을 고른다.
     한국어는 조사가 붙어 그대로 비교하면 잘 안 맞으므로, 2글자 이상 조각으로 나눠 센다. */
  function cbSearch(q, secs) {
    var terms = String(q).toLowerCase().replace(/[^가-힣a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length >= 2; });
    if (!terms.length) return [];
    var grams = [];
    terms.forEach(function (w) {
      grams.push(w);
      for (var i = 0; i + 2 <= w.length; i++) grams.push(w.slice(i, i + 2));
    });
    return secs.map(function (sec) {
      var hay = (sec.title + ' ' + sec.text).toLowerCase();
      var score = 0;
      grams.forEach(function (g) {
        var k = hay.split(g).length - 1;
        if (k) score += Math.min(k, 6) * (g.length >= 3 ? 3 : 1);
      });
      if (terms.some(function (t) { return sec.title.toLowerCase().indexOf(t) > -1; })) score += 25;
      return { sec: sec, score: score };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 3).map(function (x) { return x.sec; });
  }

  function cbGoto(id) {
    if (current !== 'manual') { current = 'manual'; navOpen = null; render(); }
    setTimeout(function () {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }

  /* 모델이 준 문장을 읽기 좋게 — 내용은 글자 그대로 두고(escape) 모양만 만든다.
     "1. …" 로 시작하는 줄은 단계 목록으로, **강조** 는 굵게. 모델 출력을 HTML 로
     그냥 넣지 않는다 — 설명서와 달리 우리가 쓴 글이 아니다. */
  function cbFormat(text) {
    /* 모델에 따라 단계를 줄바꿈 없이 "…합니다. 2. 다음은…" 처럼 한 줄에 붙여 준다.
       숫자 뒤에 마침표와 공백, 그 뒤에 글자가 오는 자리에서만 끊는다 — "3.5kg" 은 건드리지 않는다. */
    var lines = String(text).replace(/\r/g, '')
      .replace(/([^\n])\s+([1-9][.)]\s(?=[가-힣A-Za-z]))/g, '$1\n$2')
      .split('\n');
    var out = [], list = null;
    var inline = function (s) {
      return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
                   .replace(/\[([^\]]{1,20})\]/g, '<span class="ui">$1</span>');
    };
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m = line.match(/^(\d+)[.)]\s*(.+)$/);
      if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[2])); return; }
      list = null;
      out.push('<p>' + inline(line.replace(/^[-·•]\s*/, '')) + '</p>');
    });
    return out.map(function (x) {
      return Array.isArray(x) ? '<ol class="cb-steps"><li>' + x.join('</li><li>') + '</li></ol>' : x;
    }).join('');
  }

  // 찾은 절을 채팅 안에 펼친다 — 글자만 잘라 보여 주는 것보다 표·단계·아이콘이 그대로 보이는 편이 낫다
  function cbDocHTML(hits) {
    var top = hits[0];
    var more = hits.slice(1).map(function (h) {
      return '<button data-cbgo="' + h.id + '">' + esc(h.title) + '</button>';
    }).join('');
    return '<div class="cb-doc-wrap">' +
      '<div class="cb-doc-h"><i data-lucide="book-open"></i><b>' + esc(top.title) + '</b>' +
        '<span>사용 설명서</span></div>' +
      '<div class="cb-doc man-body man-embed" data-cbzoom="' + top.id + '">' + top.html + '</div>' +
      '<div class="cb-acts">' +
        '<button class="cb-main" data-cbzoom="' + top.id + '"><i data-lucide="maximize-2"></i>크게 보기</button>' +
        '<button data-cbgo="' + top.id + '"><i data-lucide="book-open"></i>설명서에서 열기</button>' +
      '</div>' +
      (more ? '<div class="cb-src"><span>관련된 곳</span>' + more + '</div>' : '') +
      '</div>';
  }

  /* 물어본 자리로 올린다. 맨 아래로 내리면 답 대신 버튼이 보인다 —
     답에 설명서 본문이 딸려 와 한 화면보다 길기 때문이다. */
  function cbScrollTo(el) {
    var b = cbEl('cbBody');
    if (!b || !el) return;
    b.scrollTop += el.getBoundingClientRect().top - b.getBoundingClientRect().top - 8;
  }

  function cbAsk(q) {
    if (cbBusy) return;
    cbBusy = true;
    // 예시 질문은 처음 말을 꺼내기 위한 것이다 — 한 번 물었으면 자리를 대화에 내준다
    var quick = cbEl('cbQuick');
    if (quick) quick.classList.add('hide');
    var mine = cbSay('me', esc(q));
    var wait = cbSay('bot', '<span class="cb-dots"><span></span><span></span><span></span></span>');
    cbIndex().then(function (secs) {
      var hits = cbSearch(q, secs);
      if (!hits.length) {
        wait.innerHTML = '설명서에서 관련 내용을 찾지 못했습니다.<br>다른 낱말로 다시 물어보시거나, ' +
          '<b>사용 설명서</b>를 직접 훑어봐 주세요.';
        cbBusy = false; return;
      }

      /* 모델을 기다리는 동안 빈 화면을 두지 않는다 — 근거는 이미 찾았으니 먼저 펼쳐 준다.
         모델 답은 도착하는 대로 위쪽 자리에 들어간다. 늦어도 읽을 것이 있는 상태가 된다. */
      wait.innerHTML = '<div class="cb-ans">' +
        '<span class="cb-dots"><span></span><span></span><span></span></span>' +
        '<span class="cb-wait">설명서에서 찾은 내용을 먼저 보여 드립니다</span></div>' + cbDocHTML(hits);
      var ansEl = wait.querySelector('.cb-ans');
      icons();
      cbScrollTo(mine);

      var done = function (html) {
        if (ansEl) ansEl.innerHTML = html;
        icons(); cbBusy = false;
        cbScrollTo(mine);
      };

      S.api('/api/admin/assist', { method: 'POST', body: {
        question: q,
        context: hits.map(function (h) { return { title: h.title, text: h.text.slice(0, 2200) }; }),
      } }).then(function (r) {
        var ans = r.ok && r.data && r.data.answer;
        // 모델을 못 쓰는 상황이어도 아래에 절이 펼쳐져 있다 — 한 줄만 바꿔 준다
        done(ans ? cbFormat(ans)
                 : '<p><b>' + esc(hits[0].title) + '</b> 부분에 나와 있습니다. 아래를 읽어 보세요.</p>');
      }).catch(function () {
        done('<p><b>' + esc(hits[0].title) + '</b> 부분을 확인해 보세요.</p>');
      });
    });
  }

  /* 크게 보기 — 좁은 채팅 칸에서는 표도 단계도 다 보이지 않는다.
     전체 화면으로 펼치고, 글자 크기를 단계로 키울 수 있게 한다(50~60대가 읽는다). */
  var CB_ZOOM = [1, 1.2, 1.45, 1.75, 2.1];
  var cbZoomStep = 0;

  function cbApplyZoom() {
    var body = cbEl('cbZoomBody'), pct = cbEl('cbZoomPct');
    if (!body) return;
    body.style.zoom = CB_ZOOM[cbZoomStep];
    if (pct) pct.textContent = Math.round(CB_ZOOM[cbZoomStep] * 100) + '%';
    var out = cbEl('cbZoomOut'), inn = cbEl('cbZoomIn');
    if (out) out.disabled = cbZoomStep === 0;
    if (inn) inn.disabled = cbZoomStep === CB_ZOOM.length - 1;
  }

  function cbZoomOpen(id) {
    cbIndex().then(function (secs) {
      var sec = null;
      secs.forEach(function (s) { if (s.id === id) sec = s; });
      if (!sec) return;
      var lay = cbEl('cbZoom'), body = cbEl('cbZoomBody'), title = cbEl('cbZoomTitle'), go = cbEl('cbZoomGo');
      if (!lay || !body) return;
      title.textContent = sec.title;
      body.innerHTML = sec.html;
      body.scrollTop = 0;
      if (go) go.setAttribute('data-cbgo', sec.id);
      cbZoomStep = 0; cbApplyZoom();
      lay.classList.add('open');
      document.body.classList.add('cb-locked');
      icons();
    });
  }

  function cbZoomClose() {
    var lay = cbEl('cbZoom');
    if (lay) lay.classList.remove('open');
    document.body.classList.remove('cb-locked');
    cbImgClose();
  }

  /* 사진은 한 번 더 키운다 — 설명서에 사진을 넣으면 눌러서 원본 크기로 볼 수 있어야 한다 */
  function cbImgOpen(src, alt) {
    var lay = cbEl('cbImg');
    if (!lay) return;
    var img = lay.querySelector('img');
    img.src = src; img.alt = alt || '';
    lay.classList.add('open');
    document.body.classList.add('cb-locked');
  }
  function cbImgClose() {
    var lay = cbEl('cbImg');
    if (lay && lay.classList.contains('open')) {
      lay.classList.remove('open');
      lay.querySelector('img').removeAttribute('src');
      if (!(cbEl('cbZoom') && cbEl('cbZoom').classList.contains('open'))) document.body.classList.remove('cb-locked');
    }
  }

  function cbOpen(open) {
    var panel = cbEl('cbPanel'), fab = cbEl('cbFab');
    if (!panel) return;
    panel.classList.toggle('open', open);
    if (fab) fab.classList.toggle('hide', open);
    if (open) {
      var body = cbEl('cbBody');
      if (body && !body.children.length) {
        cbSay('bot', '안녕하세요. 관리 화면에서 막히는 것을 물어보시면 <b>사용 설명서</b>에서 찾아 알려 드립니다.<br>아래 예시를 눌러 보셔도 됩니다.');
        var q = cbEl('cbQuick');
        if (q) q.innerHTML = CB_QUICK.map(function (t) { return '<button data-cbq="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
      }
      setTimeout(function () { var i = cbEl('cbInput'); if (i) i.focus(); }, 80);
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#cbFab')) { cbOpen(true); return; }
    if (e.target.closest('#cbClose')) { cbOpen(false); return; }

    // 사진은 어디에 있든(설명서 본문·챗봇·크게 보기) 눌러서 키운다
    var img = e.target.closest('.man-body img, .cb-doc img, #cbZoomBody img');
    if (img && img.getAttribute('src')) { cbImgOpen(img.getAttribute('src'), img.alt); return; }
    if (e.target.closest('#cbImg')) { cbImgClose(); return; }

    if (e.target.closest('#cbZoomClose') || e.target.id === 'cbZoom') { cbZoomClose(); return; }
    if (e.target.closest('#cbZoomIn')) { cbZoomStep = Math.min(CB_ZOOM.length - 1, cbZoomStep + 1); cbApplyZoom(); return; }
    if (e.target.closest('#cbZoomOut')) { cbZoomStep = Math.max(0, cbZoomStep - 1); cbApplyZoom(); return; }

    var q = e.target.closest('[data-cbq]');
    if (q) { cbAsk(q.dataset.cbq); return; }
    var g = e.target.closest('[data-cbgo]');
    if (g && g.dataset.cbgo) { cbZoomClose(); cbGoto(g.dataset.cbgo); cbOpen(false); return; }
    var z = e.target.closest('[data-cbzoom]');
    if (z) { cbZoomOpen(z.dataset.cbzoom); return; }
  });
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'cbForm') {
      e.preventDefault();
      var i = cbEl('cbInput');
      var v = i.value.trim();
      if (!v) return;
      i.value = '';
      cbAsk(v);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // 겹쳐 뜬 순서의 역순으로 닫는다 — 사진 → 크게 보기 → 챗봇
    if (cbEl('cbImg') && cbEl('cbImg').classList.contains('open')) { cbImgClose(); return; }
    if (cbEl('cbZoom') && cbEl('cbZoom').classList.contains('open')) { cbZoomClose(); return; }
    if (cbEl('cbPanel') && cbEl('cbPanel').classList.contains('open')) cbOpen(false);
  });

  function ready(fn){
    if (S.ready) { S.ready(fn); return; }
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    if (S.isServer && S.isServer()) {
      // 주문·신청·문의는 공개 bootstrap 에 없다 — 그리기 전에 따로 받는다
      S.loadAdminData().then(function (ok) {
        if (!ok) toast('일부 자료를 불러오지 못했습니다. 새로고침해 주세요.');
        initAuth();
      });
      return;
    }
    migrate(); initAuth();
  });
})();
