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
  function gj(k, d){ try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function sj(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
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

  /* ---------- 데모 시드 ---------- */
  function seed() {
    if (!localStorage.getItem(K.popups)) sj(K.popups, [
      { id: uid(), title: '[샘플] 2026 봄학기 지도사 과정 모집', body: '전통발효식품체험지도사 2026년 1기를 모집합니다.\n4월 4일 개강 · 선착순 마감.', link: 'instructor.html', linkLabel: '과정 보러가기', active: true, startsAt: '', endsAt: '', img: '' },
    ]);
    if (!localStorage.getItem(K.orders)) sj(K.orders, [
      { id: uid(), kind: 'order', orderNo: '2026030912341', product: '전통 된장 (1kg)', productId: 'p_doenjang', qty: '2', unitPrice: 25000, total: 50000, depositor: '김참살', name: '김참살', phone: '010-2241-7780', address: '서울 구로구 구로동 123', payMethod: '무통장입금', status: '주문접수', at: '2026-03-09T10:12:00' },
      { id: uid(), kind: 'order', orderNo: '2026030787720', product: '태양초 고추장 (1kg)', productId: 'p_gochujang', qty: '1', unitPrice: 28000, total: 28000, depositor: '이정선', name: '이정선', phone: '010-9930-1187', address: '강원 정선군 정선읍 45', payMethod: '무통장입금', status: '결제완료', at: '2026-03-07T15:40:00' },
      { id: uid(), kind: 'order', orderNo: '2026030554102', product: '명절 장 3종 세트 (세트)', productId: 'p_set3', optionLabel: '포장: 전통 보자기 포장', qty: '3', unitPrice: 42000, total: 126000, depositor: '박발효', name: '박발효', phone: '010-4456-2093', address: '경기 성남시 분당구 67', payMethod: '무통장입금', status: '배송준비중', at: '2026-03-05T09:05:00' },
      { id: uid(), kind: 'order', orderNo: '2026030248873', product: '전통 청국장 (500g)', productId: 'p_cheongguk', qty: '4', unitPrice: 12000, total: 48000, depositor: '최씨장', name: '최씨장', phone: '010-7788-5521', address: '서울 강서구 화곡동 89', payMethod: '무통장입금', status: '배송중', shipMethod: '택배', courier: 'CJ대한통운', tracking: '688123456789', at: '2026-03-02T11:20:00' },
      { id: uid(), kind: 'order', orderNo: '2026022633019', product: '정선 막장 (1kg)', productId: 'p_makjang', qty: '1', unitPrice: 22000, total: 22000, depositor: '정장맛', name: '정장맛', phone: '010-3322-1100', address: '인천 남동구 구월동 12', payMethod: '무통장입금', status: '배송완료', shipMethod: '택배', courier: '우체국택배', tracking: '612398745601', at: '2026-02-26T14:00:00' },
      { id: uid(), kind: 'seedjang', orderNo: '2026030411208', amount: '씨장 30kg 분양', name: '이정선', phone: '010-9930-1187', region: '강원 정선', memo: '펜션 무료사용 문의', payMethod: '무통장입금', status: '주문접수', at: '2026-03-04T15:40:00' },
    ]);
    if (!localStorage.getItem(K.apps)) sj(K.apps, [
      { id: uid(), name: '박발효', phone: '010-4456-2093', region: '경기 성남', course: '정규 지도사 과정', memo: '주말반 희망', status: '신규', at: '2026-03-01T09:05:00' },
    ]);
    if (!localStorage.getItem(K.inq)) sj(K.inq, [
      { id: uid(), name: '정문의', phone: '010-3322-1100', type: '제휴 문의', memo: '지역 장터 입점 제안드립니다.', status: '신규', at: '2026-02-28T11:20:00' },
    ]);
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
      '[1. 컬러 팔레트]',
      '- 배경 --bg #FCFAF3(웜 페이퍼) / 표면 --surface #FFFEF9 / 인셋 --surface-2 #F3F0E2',
      '- 메인 --main #6E8252(햇살 들녘 올리브그린) · deep #56683E · deeper #3D4A2C · tint #EAEDDF',
      '- 서브 --sub #E2D9BE(오트밀) · soft #F0EBD7 · deep #CFC49E',
      '- 포인트 --point #B0473A(대추) · deep #8F3329 · tint #F0DDD8',
      '- 텍스트 --ink #2A2723 / soft #5C564C / mute #8C8576 / faint #B4AD9E',
      '- 시맨틱 ok #3E7D4F · warn #C9912F · danger #C0492E · info #4A6E86',
      '- 규칙: 포인트(대추)는 CTA·강조 한정, 대면적 사용 금지',
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

    return '<div class="stat-grid">' + cards + '</div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>최근 7일 방문 추이</h3><span class="ph-sub">브라우저 기준 데모 집계 — 운영 시 서버/애널리틱스로 교체</span></div><div style="padding:22px">' + chart + '</div></div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>최근 접수 내역</h3><span class="ph-sub">주문 · 신청 · 문의 통합</span></div>' +
      '<table class="admin-table"><thead><tr><th>일시</th><th>구분</th><th>이름</th><th>내용</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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
      return '<tr><td style="width:64px"><div class="pthumb" data-pthumb="' + p.id + '"><i data-lucide="image"></i></div></td>' +
        '<td><b>' + esc(p.name) + '</b><div class="pc-sub">' + esc(p.unit || '') + (p.option ? ' · 옵션 ' + p.option.values.length + '종' : '') + '</div></td>' +
        '<td><span class="tag">' + esc(p.cat) + '</span></td><td>' + priceTxt + '</td><td>' + stock + '</td>' +
        '<td><select class="st-sel" data-act="pstatus" data-id="' + p.id + '">' + ['판매중', '품절', '숨김'].map(function (s) { return '<option' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
        '<td style="white-space:nowrap"><a class="icon-btn" href="product.html?id=' + p.id + '" target="_blank" title="상세페이지 보기" style="margin-right:4px;text-decoration:none"><i data-lucide="external-link"></i></a>' +
        '<button class="icon-btn" data-act="pedit" data-id="' + p.id + '" title="수정" style="margin-right:4px"><i data-lucide="pen-line"></i></button>' +
        '<button class="icon-btn" data-act="pdel" data-id="' + p.id + '" title="삭제"><i data-lucide="trash-2"></i></button></td></tr>';
    }).join('') : emptyRow(7, '등록된 상품이 없습니다.');
    setTimeout(loadListThumbs, 20);
    return '<div class="panel" style="max-width:none"><div class="panel-head"><h3>상품 목록</h3><button class="btn btn-point" data-act="pnew" style="padding:10px 18px"><i data-lucide="plus"></i>상품 등록</button></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>사진</th><th>상품명</th><th>분류</th><th>판매가</th><th>재고</th><th>판매 상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function loadListThumbs() {
    document.querySelectorAll('[data-pthumb]').forEach(function (box) {
      S.idb.byIndex('pimg', 'productId', box.dataset.pthumb).then(function (imgs) {
        imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
        var main = imgs.filter(function (i) { return i.role === 'main'; })[0] || imgs[0];
        if (main) box.innerHTML = '<img src="' + mkURL(main.blob) + '" alt="">';
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
        '<div class="field"><label>분류</label><select name="cat">' + ['장류', '발효식품', '선물세트'].map(function (c) { return '<option' + (p && p.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
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
    S.idb.byIndex('pimg', 'productId', form.dataset.pid).then(function (imgs) {
      imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
      box.innerHTML = imgs.map(function (im) {
        if (pImgState.removed.indexOf(im.id) > -1) return '';
        var u = mkURL(im.blob);
        return '<div class="pimg-cell"><img src="' + u + '"><span class="pimg-role">' + (im.role === 'main' ? '대표' : im.role === 'detail' ? '상세' : '추가') + '</span>' +
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
      pImgState.removed.forEach(function (iid) { jobs.push(S.idb.del('pimg', iid)); });
      if (pImgState.main) {
        jobs.push(S.idb.byIndex('pimg', 'productId', rec.id).then(function (imgs) {
          return Promise.all(imgs.filter(function (i) { return i.role === 'main'; }).map(function (i) { return S.idb.del('pimg', i.id); }));
        }).then(function () { return S.idb.put('pimg', { id: uid(), productId: rec.id, role: 'main', ord: 0, blob: pImgState.main }); }));
      }
      pImgState.extra.forEach(function (f, i) { jobs.push(S.idb.put('pimg', { id: uid(), productId: rec.id, role: 'extra', ord: i + 1, blob: f })); });
      pImgState.detail.forEach(function (f, i) { jobs.push(S.idb.put('pimg', { id: uid(), productId: rec.id, role: 'detail', ord: i, blob: f })); });
      Promise.all(jobs).then(function () {
        prodEditing = null;
        pImgState = { main: null, extra: [], detail: [], removed: [] };
        render();
        toast('상품이 저장되었습니다.');
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

    return '<div class="panel" style="max-width:none"><div class="panel-head"><h3>주문 관리</h3><span class="ph-sub">주문을 선택한 뒤 단계 버튼으로 처리 · 자동 알림(메일/SMS)은 운영 연동 시 발송</span></div>' +
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
  function viewApps() {
    var a = gj(K.apps, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td>' + esc(r.region||'-') + '</td><td>' + esc(r.course||'-') + '</td><td style="max-width:200px">' + esc(r.memo||'-') + '</td><td>' + statusSelect(K.apps,'apps',r) + '</td><td>' + delBtn(K.apps, r.id) + '</td></tr>';
    }).join('') : emptyRow(8, '신청 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>전통발효식품체험지도사 신청 관리</h3><span class="ph-sub">총 ' + a.length + '명</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>지역</th><th>희망 과정</th><th>비고</th><th>상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function viewInq() {
    var a = gj(K.inq, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td><span class="tag">' + esc(r.type||'문의') + '</span></td><td style="max-width:280px">' + esc(r.memo||'-') + '</td><td>' + statusSelect(K.inq,'inq',r) + '</td><td>' + delBtn(K.inq, r.id) + '</td></tr>';
    }).join('') : emptyRow(7, '문의 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>문의 내역 관리</h3><span class="ph-sub">총 ' + a.length + '건</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>유형</th><th>내용</th><th>상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ============================================================
     게시글 관리
     ============================================================ */
  function viewPosts() {
    var a = gj(K.posts, []).slice().sort(function (x, y) { return (y.at || '').localeCompare(x.at || ''); });
    var rows = a.length ? a.map(function (p) {
      return '<tr><td><b>' + esc(p.title) + '</b>' + (p.sample ? ' <span class="tag sample" style="font-size:10px">샘플</span>' : '') + '</td>' +
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
  var IDB_STORES = ['files', 'gallery', 'pimg'];

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
      var blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
      var u = URL.createObjectURL(blob), a = document.createElement('a');
      var d = new Date(), p2 = function (x) { return ('0' + x).slice(-2); };
      a.href = u; a.download = 'kach-backup-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      toast('백업 파일을 내려받았습니다.');
    });
  }

  function doImport(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try { data = JSON.parse(rd.result); } catch (e) { alert('백업 파일을 읽을 수 없습니다.'); return; }
      if (!data || data.app !== 'kach') { alert('이 사이트의 백업 파일이 아닙니다.'); return; }
      if (!confirm('현재 데이터를 백업 내용으로 덮어씁니다. 계속할까요?')) return;
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

  /* ---------- nav ---------- */
  var NAV = [
    { id: 'dashboard', label: '대시보드', icon: 'layout-dashboard', view: viewDashboard, title: '대시보드' },
    { id: 'products', label: '상품 관리', icon: 'package', view: viewProducts, title: '상품 관리' },
    { id: 'orders', label: '주문 관리', icon: 'shopping-cart', view: viewOrders, title: '주문 관리', countKey: K.orders },
    { id: 'apps', label: '지도사 신청', icon: 'user-plus', view: viewApps, title: '참가자 신청 관리', countKey: K.apps },
    { id: 'inq', label: '문의 내역', icon: 'message-square', view: viewInq, title: '문의 내역 관리', countKey: K.inq },
    { id: 'posts', label: '게시글 관리', icon: 'file-text', view: viewPosts, title: '게시글 관리', countKey: K.posts },
    { id: 'partners', label: '파트너 관리', icon: 'handshake', view: viewPartners, title: '파트너 관리' },
    { id: 'popups', label: '팝업 관리', icon: 'bell', view: viewPopups, title: '팝업 관리', countKey: K.popups },
    { id: 'consents', label: '동의문 관리', icon: 'shield-check', view: viewConsents, title: '개인정보 동의문 관리' },
    { id: 'kms', label: 'KMS', icon: 'book-open', view: viewKMS, title: 'KMS — 표준 KMS · 디자인 룰북' },
    { id: 'backup', label: '데이터 백업', icon: 'database', view: viewBackup, title: '데이터 백업 · 복원' },
  ];
  var current = 'dashboard';

  /* ---------- 저장하지 않은 변경 경고 ---------- */
  var dirty = false;
  function isEditingForm() {
    return prodEditing !== null || kmsMode === 'edit' || consentMode === 'edit'
      || !!document.getElementById('partnerForm') || !!document.getElementById('popupForm');
  }
  // 이동/취소 전 호출 — 변경이 있으면 확인, 사용자가 취소하면 false 반환(이동 중단)
  function confirmLeave() {
    return !dirty || confirm('저장하지 않은 변경 내용이 있습니다.\n저장하지 않고 이동하시겠습니까?');
  }

  function renderNav() {
    document.getElementById('adminNav').innerHTML = NAV.map(function(n){
      var cnt = n.countKey ? gj(n.countKey, []).length : 0;
      var badge = (n.countKey && cnt) ? '<span class="badge">' + cnt + '</span>' : '';
      return '<button data-nav="' + n.id + '" class="' + (n.id===current?'on':'') + '"><i data-lucide="' + n.icon + '"></i>' + n.label + badge + '</button>';
    }).join('');
    icons();
  }
  function render() {
    dirty = false;
    revokeURLs();
    if (descEditor) { try { descEditor.destroy(); } catch (e) {} descEditor = null; }
    var n = NAV.filter(function(x){ return x.id === current; })[0] || NAV[0];
    document.getElementById('adminTitle').textContent = n.title;
    document.getElementById('adminView').innerHTML = n.view();
    renderNav();
    icons();
    bindForms();
  }

  /* ---------- 이미지 리사이즈 (팝업용) ---------- */
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
      if (fileIn) fileIn.addEventListener('change', function(){ var f = fileIn.files[0]; if(!f) return; resizeToDataURL(f, 400, function (durl) { pendingLogo = durl; }); });
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
      if (pin) pin.addEventListener('change', function(){
        var f = pin.files[0]; if (!f) return;
        resizeToDataURL(f, 900, function (durl) { pendingPopImg = durl; });
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

    bindProductForm();
  }

  /* ---------- delegation ---------- */
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t.dataset && t.dataset.act === 'status') { updateField(t.dataset.key, t.dataset.id, 'status', t.value); renderNav(); toast('상태가 변경되었습니다.'); }
    if (t.dataset && t.dataset.act === 'pstatus') {
      var a = S.getProducts(); a.forEach(function (p) { if (p.id === t.dataset.id) p.status = t.value; }); S.setProducts(a);
      toast('판매 상태가 변경되었습니다.');
    }
    if (t.name === 'rel') updateRelChips();
    if (t.id === 'oselAll') { document.querySelectorAll('.osel').forEach(function (c) { c.checked = t.checked; }); }
  });

  // 주문 목록 즉시 검색(주문번호·주문자·연락처·입금자·상품 등 행 전체 텍스트 매칭)
  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'oSearch') return;
    var q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.admin-table tbody tr').forEach(function (tr) {
      if (!tr.querySelector('.osel')) return;
      tr.style.display = (!q || tr.textContent.toLowerCase().indexOf(q) > -1) ? '' : 'none';
    });
  });

  document.addEventListener('click', function(e){
    // 서브탭
    var st = e.target.closest('[data-subtab]');
    if (st) {
      if (!confirmLeave()) return;
      if (current === 'kms') kmsTab = st.dataset.subtab;
      else if (current === 'consents') consentTab = st.dataset.subtab;
      render(); return;
    }
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
    } else if (act === 'poptoggle') {
      var a = gj(K.popups, []); a.forEach(function(p){ if(p.id===b.dataset.id) p.active = !p.active; }); sj(K.popups, a); render();
    } else if (act === 'pnew') { prodEditing = 'new'; pImgState.removed = []; render();
    } else if (act === 'pedit') { prodEditing = b.dataset.id; pImgState.removed = []; render();
    } else if (act === 'pback') { if (!confirmLeave()) return; prodEditing = null; pImgState = { main: null, extra: [], detail: [], removed: [] }; render();
    } else if (act === 'pdel') {
      if (!confirm('이 상품을 삭제할까요? 상품 이미지도 함께 삭제됩니다.')) return;
      S.setProducts(S.getProducts().filter(function (p) { return p.id !== b.dataset.id; }));
      S.idb.byIndex('pimg', 'productId', b.dataset.id).then(function (imgs) { imgs.forEach(function (i) { S.idb.del('pimg', i.id); }); });
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
    } else if (act === 'exportAll') {
      doExport();
    } else if (act === 'importPick') {
      var fin = document.createElement('input');
      fin.type = 'file'; fin.accept = 'application/json,.json';
      fin.onchange = function () { if (fin.files[0]) doImport(fin.files[0]); };
      fin.click();
    }
  });
  document.addEventListener('click', function(e){
    var nav = e.target.closest('[data-nav]'); if (!nav) return;
    if (!confirmLeave()) return;
    current = nav.dataset.nav;
    prodEditing = null; kmsMode = 'view'; consentMode = 'view';
    render();
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
  function unlock(){ document.getElementById('loginGate').style.display = 'none'; document.getElementById('adminApp').style.display = 'flex'; render(); icons(); }
  function initAuth() {
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

  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){ migrate(); seed(); initAuth(); });
})();
