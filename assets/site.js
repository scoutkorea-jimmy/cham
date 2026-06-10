/* ============================================================
   site.js — 공통 셸 · 디자인 시스템 구동부
   한국참전통발효식품협동조합
   - 내비/푸터/모바일 메뉴 주입, 모달(신청·주문·문의·조회·로그인)
   - 스토어: 파트너 · 팝업 · 게시글 · 동의문 · 상품 · 방문 통계
   - IndexedDB(첨부파일·갤러리·상품 이미지) 공용 헬퍼
   - 비회원 주문(주문번호 발급 · 주문 조회), 개인정보 동의 게이팅
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Nav config ---------------- */
  var NAV = [
    { id: 'about', label: '협동조합 소개', href: 'about.html', dd: [
      { label: '대표 인사말', href: 'about.html#greeting' },
      { label: '설립 목적', href: 'about.html#purpose' },
      { label: '비전 · 미션', href: 'about.html#vision' },
      { label: '파트너 · 정선만장대', href: 'about.html#partner' },
      { label: '오시는 길', href: 'about.html#location' },
    ]},
    { id: 'ferments', label: '전통발효식품', href: 'ferments.html', dd: [
      { label: '전통 발효란?', href: 'ferments.html#about' },
      { label: '씨장 이야기', href: 'ferments.html#seedjang' },
      { label: '발효식품의 종류', href: 'ferments.html#types' },
      { label: '전통발효 과정', href: 'ferments.html#process' },
    ]},
    { id: 'instructor', label: '체험지도사', href: 'instructor.html', dd: [
      { label: '과정 소개', href: 'instructor.html#intro' },
      { label: '교육 과정', href: 'instructor.html#curriculum' },
      { label: '수료 혜택', href: 'instructor.html#benefit' },
      { label: '교육 일정', href: 'instructor.html#schedule' },
      { label: '신청하기', href: 'instructor.html#apply' },
    ]},
    { id: 'products', label: '제품', href: 'products.html', dd: [
      { label: '장류', href: 'products.html#jang' },
      { label: '발효식품', href: 'products.html#ferment' },
      { label: '씨장 분양', href: 'products.html#seedjang' },
      { label: '선물세트', href: 'products.html#gift' },
      { label: '비회원 주문 조회', href: 'products.html#lookup' },
    ]},
    { id: 'news', label: '소식마당', href: 'news.html', dd: [
      { label: '공지사항', href: 'news.html#notice' },
      { label: '교육 일정', href: 'news.html#edu' },
      { label: '갤러리', href: 'news.html#gallery' },
    ]},
    { id: 'contact', label: '문의하기', href: 'contact.html' },
  ];

  /* ---------------- tiny helpers ---------------- */
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function currentPage() {
    if (document.body.dataset.page) return document.body.dataset.page;
    var f = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    return f || 'index';
  }
  function icons() { if (window.lucide) window.lucide.createIcons(); }
  function uid(){ return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 10000).toString(36); }
  function fmtWon(n){ return (Number(n) || 0).toLocaleString('ko-KR'); }
  function fmtYMD(iso){ return iso ? String(iso).slice(0, 10).replace(/-/g, '.') : '-'; }
  function todayStr(){ var d = new Date(), p = function(x){ return ('0' + x).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function genOrderNo(){
    var d = new Date(), p = function(x){ return ('0' + x).slice(-2); };
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ('0000' + Math.floor(Math.random() * 100000)).slice(-5);
  }

  /* ---------------- localStorage stores ---------------- */
  function getJSON(k, def){ try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function setJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pushRecord(key, rec){ var a = getJSON(key, []); rec.id = rec.id || uid(); rec.at = new Date().toISOString(); rec.status = rec.status || '신규'; a.unshift(rec); setJSON(key, a); return rec; }

  /* ---------------- IndexedDB (첨부 · 갤러리 · 상품 이미지) ---------------- */
  var dbPromise = null;
  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      var r = indexedDB.open('kach_db', 2);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('files')) { var s = d.createObjectStore('files', { keyPath: 'id' }); s.createIndex('postId', 'postId', { unique: false }); }
        if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('pimg')) { var p = d.createObjectStore('pimg', { keyPath: 'id' }); p.createIndex('productId', 'productId', { unique: false }); }
      };
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error); };
    });
    return dbPromise;
  }
  var idb = {
    put: function (store, rec) { return openDB().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, 'readwrite'); t.objectStore(store).put(rec); t.oncomplete = function(){ res(rec); }; t.onerror = function(){ rej(t.error); }; }); }); },
    del: function (store, id) { return openDB().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, 'readwrite'); t.objectStore(store).delete(id); t.oncomplete = res; t.onerror = function(){ rej(t.error); }; }); }); },
    all: function (store) { return openDB().then(function (d) { return new Promise(function (res) { var q = d.transaction(store).objectStore(store).getAll(); q.onsuccess = function(){ res(q.result || []); }; q.onerror = function(){ res([]); }; }); }); },
    byIndex: function (store, index, val) { return openDB().then(function (d) { return new Promise(function (res) { var q = d.transaction(store).objectStore(store).index(index).getAll(val); q.onsuccess = function(){ res(q.result || []); }; q.onerror = function(){ res([]); }; }); }); },
  };

  /* ---------------- 방문 통계 (대시보드용) ---------------- */
  var VISITS_KEY = 'kach_visits_v1';
  function trackVisit() {
    if (currentPage() === 'admin') return;
    try {
      var v = getJSON(VISITS_KEY, {});
      var d = todayStr();
      if (!v[d]) v[d] = { pv: 0, uv: 0 };
      v[d].pv += 1;
      if (sessionStorage.getItem('kach_uv_' + d) !== '1') { v[d].uv += 1; sessionStorage.setItem('kach_uv_' + d, '1'); }
      var keys = Object.keys(v).sort();
      while (keys.length > 90) { delete v[keys.shift()]; }
      setJSON(VISITS_KEY, v);
    } catch (e) {}
  }

  /* ---------------- 관리자 인증 (보안) ----------------
     · 로그인 상태(세션)를 어디에도 저장하지 않습니다 — 새로고침/이동 시 재인증.
     · 자격증명 평문을 소스에 두지 않습니다 — SHA-256 해시 비교(미지원 환경은 base64 폴백).
     · 무작위 대입(brute force) 방지: 5회 실패 시 5분 잠금(시도 카운터만 저장).
     · 데모 한계: 클라이언트 검증이므로 운영 시 반드시 서버 인증으로 교체하세요.
  -------------------------------------------------------- */
  var AUTH_USER = 'admin';
  var AUTH_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // SHA-256('admin')
  var AUTH_B64 = 'YWRtaW4=';            // base64('admin') — 폴백용
  var GUARD_KEY = 'kach_login_guard';   // {fails, until} — 실패 카운터만 저장
  var MAX_FAILS = 5, LOCK_MS = 5 * 60 * 1000;

  function loginGuard(){ return getJSON(GUARD_KEY, { fails: 0, until: 0 }) || { fails: 0, until: 0 }; }
  function lockMs(){ var g = loginGuard(); var r = (g.until || 0) - Date.now(); return r > 0 ? r : 0; }
  function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      try {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        });
      } catch (e) {}
    }
    return Promise.resolve(null);
  }
  function b64(str){ try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return ''; } }
  // returns Promise<{ok} | {ok:false, locked, lockMs} | {ok:false, attemptsLeft}>
  function verifyLogin(id, pw) {
    if (lockMs() > 0) return Promise.resolve({ ok: false, locked: true, lockMs: lockMs() });
    return sha256Hex(pw).then(function (hex) {
      var ok = id === AUTH_USER && (hex ? hex === AUTH_HASH : b64(pw) === AUTH_B64);
      var g = loginGuard();
      if (ok) { setJSON(GUARD_KEY, { fails: 0, until: 0 }); return { ok: true }; }
      g.fails = (g.fails || 0) + 1;
      var res = { ok: false };
      if (g.fails >= MAX_FAILS) { g.until = Date.now() + LOCK_MS; g.fails = 0; res.locked = true; res.lockMs = LOCK_MS; }
      else { res.attemptsLeft = MAX_FAILS - g.fails; }
      setJSON(GUARD_KEY, g);
      return res;
    });
  }

  // 관리 기능 게이팅 — 호출 시마다 새로 인증을 요구(상태를 보관하지 않음)
  function requireAdmin(cb) {
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">관리자 인증</div><h3>관리자 로그인</h3>' +
        '<p>관리 기능은 인증 후 이용할 수 있습니다. 인증 정보는 저장되지 않으며, 작업할 때마다 다시 확인합니다.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="siteLoginForm" autocomplete="off">' +
        '<div class="form-grid"><div class="field full"><label>아이디</label><input name="lid" autocomplete="off" required></div>' +
        '<div class="field full"><label>비밀번호</label><input name="lpw" type="password" autocomplete="off" required></div></div>' +
        '<div class="login-msg" id="siteLoginErr"></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button><button type="submit" class="btn btn-point" id="siteLoginBtn">인증</button></div>' +
      '</form></div>', 420);
    var f = document.getElementById('siteLoginForm');
    var btn = document.getElementById('siteLoginBtn');
    var err = document.getElementById('siteLoginErr');
    var timer = null;
    function refreshLock() {
      var ms = lockMs();
      if (ms > 0) {
        btn.disabled = true; err.className = 'login-msg err';
        err.textContent = '로그인 시도가 많아 잠시 잠겼습니다. ' + Math.ceil(ms / 1000) + '초 후 다시 시도하세요.';
        timer = setTimeout(refreshLock, 1000);
      } else { btn.disabled = false; if (timer) { clearTimeout(timer); timer = null; } }
    }
    refreshLock();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (lockMs() > 0) { refreshLock(); return; }
      btn.disabled = true;
      var fd = new FormData(f);
      verifyLogin(fd.get('lid'), fd.get('lpw')).then(function (r) {
        if (r.ok) { closeModal(); cb(); return; }
        if (r.locked) { refreshLock(); return; }
        btn.disabled = false;
        err.className = 'login-msg err';
        err.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.' + (r.attemptsLeft != null ? ' (남은 시도 ' + r.attemptsLeft + '회)' : '');
        f.querySelector('[name=lpw]').value = '';
        f.querySelector('[name=lpw]').focus();
      });
    });
    var first = f.querySelector('[name=lid]'); if (first) setTimeout(function(){ first.focus(); }, 60);
  }

  /* ---------------- 동의문 (관리자 페이지에서 수정) ---------------- */
  var CONSENT_KEY = 'kach_consents_v1';
  var CONSENT_DEFAULTS = {
    privacy: {
      title: '개인정보 수집·이용 동의',
      body: '한국참전통발효식품협동조합은 「개인정보 보호법」에 따라 아래와 같이 개인정보를 수집·이용합니다.\n\n1. 수집 항목: 이름, 연락처(전화번호), 배송지 주소(상품 주문 시), 이메일(입력한 경우)\n2. 수집·이용 목적: 교육과정 신청 접수 및 상담, 상품 주문 접수·결제 확인·배송, 문의 응대 및 결과 회신\n3. 보유·이용 기간: 수집 목적 달성 후 지체 없이 파기합니다. 단, 전자상거래 등 관계 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관합니다. (계약·청약철회 기록 5년, 대금결제·재화 공급 기록 5년, 소비자 불만·분쟁처리 기록 3년)\n4. 동의 거부 권리: 동의를 거부하실 수 있으며, 동의하지 않을 경우 신청·주문·문의 접수가 제한될 수 있습니다.',
    },
    third: {
      title: '개인정보 제3자 제공 동의',
      body: '주문 상품의 배송 및 결제 확인을 위해 아래와 같이 개인정보를 제3자에게 제공합니다.\n\n1. 제공받는 자: 배송업체(택배사), 결제 확인 금융기관\n2. 제공 항목: 이름, 연락처, 배송지 주소\n3. 제공 목적: 상품 배송, 입금(결제) 확인\n4. 보유·이용 기간: 배송 완료 및 결제 확인 후 지체 없이 파기\n5. 동의 거부 권리: 동의를 거부하실 수 있으며, 동의하지 않을 경우 상품 배송이 제한될 수 있습니다.',
    },
  };
  function getConsents() {
    var c = getJSON(CONSENT_KEY, {}) || {};
    return {
      privacy: { title: CONSENT_DEFAULTS.privacy.title, body: (c.privacy && c.privacy.body) || CONSENT_DEFAULTS.privacy.body },
      third: { title: CONSENT_DEFAULTS.third.title, body: (c.third && c.third.body) || CONSENT_DEFAULTS.third.body },
    };
  }

  /* ---------------- 파트너 (가로형 로고 · 무한 슬라이드) ---------------- */
  var PARTNER_KEY = 'kach_partners_v1';
  var PARTNER_DEFAULTS = [
    { id: 'p_mjd', name: '정선만장대', logo: '', url: 'https://www.manjangdae.com' },
    { id: 'p_local', name: '정선군 로컬푸드', logo: '', url: '' },
    { id: 'p_farm', name: '협력 재배 농가', logo: '', url: '' },
    { id: 'p_org', name: '전통장류 명인회', logo: '', url: '' },
  ];
  function getPartners(){ var p = getJSON(PARTNER_KEY, null); return p && p.length != null ? p : PARTNER_DEFAULTS.slice(); }
  function setPartners(arr){ setJSON(PARTNER_KEY, arr); }

  function partnerItemHTML(p) {
    var inner = p.logo
      ? '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + ' 로고">'
      : '<span class="p-fallback">' + esc(p.name) + '</span>';
    if (p.url) return '<a class="partner-item" href="' + esc(p.url) + '" target="_blank" rel="noopener" title="' + esc(p.name) + '">' + inner + '</a>';
    return '<div class="partner-item" title="' + esc(p.name) + '">' + inner + '</div>';
  }
  function renderPartnersStrip() {
    var track = document.getElementById('partners-track');
    if (!track) return;
    var list = getPartners();
    if (!list.length) { track.style.animation = 'none'; track.innerHTML = '<div class="partners-empty">등록된 파트너가 없습니다.</div>'; return; }
    var rep = Math.max(1, Math.ceil(8 / list.length));
    var items = '';
    for (var i = 0; i < rep; i++) items += list.map(partnerItemHTML).join('');
    var half = '<div class="pt-half">' + items + '</div>';
    track.innerHTML = half + half;
    track.style.setProperty('--pt-dur', Math.max(20, list.length * rep * 5) + 's');
    icons();
  }

  /* ---------------- 게시글 (소식마당) ---------------- */
  var POSTS_KEY = 'kach_posts_v1';
  var POST_SEEDS = [
    { id: 'sp1', cat: '공지', important: true, sample: true, title: '2026년 봄학기 전통발효식품체험지도사 과정 모집 안내', at: '2026-03-04T09:00:00',
      html: '<p>전통발효식품체험지도사 2026년 1기 교육생을 모집합니다.</p><ul><li>교육 기간: 2026.04.04 ~ 04.25 (매주 토요일)</li><li>장소: 구로 본원</li><li>신청 방법: 홈페이지 신청서 접수 후 담당자 안내</li></ul><p>많은 관심 부탁드립니다.</p>' },
    { id: 'sp2', cat: '공지', sample: true, title: '홈페이지 리뉴얼 오픈 안내', at: '2026-02-28T09:00:00',
      html: '<p>홈페이지가 새 단장을 마치고 오픈했습니다. 이용에 불편이 없도록 계속 다듬어가겠습니다.</p>' },
    { id: 'sp3', cat: '공지', sample: true, title: '설 연휴 배송 및 고객센터 운영 일정', at: '2026-02-05T09:00:00',
      html: '<p>설 연휴 기간의 배송 마감 일정과 고객센터 운영 시간을 안내드립니다.</p>' },
    { id: 'sp4', cat: '언론', sample: true, title: '[언론보도] 사라지는 씨장 지키는 사람들 — 전통발효명가 정선만장대', at: '2026-01-18T09:00:00',
      html: '<p>정선만장대의 씨장 보존 활동이 언론에 소개되었습니다.</p>' },
    { id: 'sp5', cat: '공지', sample: true, title: '씨장 분양 신청 상시 접수 안내', at: '2026-01-10T09:00:00',
      html: '<p>전국민 씨장 갖기 운동 — 씨장 분양 신청을 상시 접수하고 있습니다.</p>' },
    { id: 'sp6', cat: '교육', sample: true, badge: '모집중', title: '전통발효식품체험지도사 2026년 1기 (4/4 개강)', at: '2026-02-20T09:00:00',
      html: '<p>모집 마감: 2026.03.28 · 매주 토요일 10:00–16:00 · 구로 본원</p>' },
    { id: 'sp7', cat: '교육', sample: true, badge: '원데이', title: '된장·고추장 담그기 원데이 체험 클래스 (3월)', at: '2026-02-15T09:00:00',
      html: '<p>2026.03.21 (토) 13:00–16:00 · 구로 본원</p>' },
    { id: 'sp8', cat: '교육', sample: true, badge: '원데이', title: '정선 장독대 견학 + 씨장 체험 프로그램', at: '2026-02-10T09:00:00',
      html: '<p>2026.04.12 (일) · 강원 정선</p>' },
  ];
  function seedPosts(){ if (!localStorage.getItem(POSTS_KEY)) setJSON(POSTS_KEY, POST_SEEDS); }
  function getPosts(){ return getJSON(POSTS_KEY, []); }
  function setPosts(a){ setJSON(POSTS_KEY, a); }

  function renderNewsPreview() {
    var box = document.getElementById('news-rows');
    if (!box) return;
    var posts = getPosts().slice().sort(function(a, b){ return (b.at || '').localeCompare(a.at || ''); }).slice(0, 3);
    box.innerHTML = posts.length ? posts.map(function (p) {
      var anchor = p.cat === '교육' ? '#edu' : '#notice';
      return '<a class="news-row" href="news.html' + anchor + '">' +
        (p.sample ? '<span class="tag sample">샘플</span>' : '') +
        '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || p.cat) + '</span>' +
        '<span class="nr-title">' + esc(p.title) + '</span>' +
        '<span class="nr-date">' + fmtYMD(p.at) + '</span></a>';
    }).join('') : '<div class="partners-empty">등록된 소식이 없습니다.</div>';
  }

  /* ---------------- 상품 (목록 · 상세 · 관리자 등록) ---------------- */
  var PRODUCTS_KEY = 'kach_products_v2';
  var SHIP_TPL = '· 배송비: 3,500원 (5만원 이상 구매 시 무료)\n· 배송 방법: 택배 (CJ대한통운)\n· 출고: 결제(입금) 확인 후 2~3 영업일 이내\n· 제주 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.\n· 발효식품 특성상 기온이 높은 시기에는 아이스팩 포장으로 출고됩니다.';
  var REFUND_TPL = '· 단순 변심에 의한 교환·반품: 상품 수령 후 7일 이내 신청 가능 (왕복 배송비 구매자 부담)\n· 식품 특성상 개봉했거나 포장이 훼손된 경우 교환·반품이 불가합니다.\n· 상품 하자·오배송: 수령 후 30일 이내 무상 교환 또는 환불해 드립니다.\n· 환불은 반품 상품 확인 후 3영업일 이내 입금 계좌로 처리됩니다.\n· 기타 사항은 소비자분쟁해결기준(공정거래위원회 고시)에 따릅니다.';
  function gosiBase(over) {
    var g = {
      pname: '', maker: '한국참전통발효식품협동조합 (제조: 정선만장대)', country: '대한민국', origin: '국산 (강원 정선)',
      volume: '', ingredients: '', expiry: '제품 별도 표기 (제조일로부터 24개월)', storage: '직사광선을 피해 서늘한 곳, 개봉 후 냉장 보관',
      phone: '02-855-8806', warranty: '본 제품은 공정거래위원회 고시 소비자분쟁해결기준에 의거 교환 또는 보상받을 수 있습니다.',
    };
    for (var k in over) g[k] = over[k];
    return g;
  }
  var PRODUCT_DEFAULTS = [
    { id: 'p_doenjang', name: '전통 된장', cat: '장류', price: 25000, salePrice: null, unit: '1kg', status: '판매중', stock: 50, option: null,
      summary: '깊고 구수한 전통의 맛. 국산 콩 100%를 전통 씨장 방식으로 3년 이상 숙성했습니다.', icon: 'bean', tone: 'tone-oat',
      descHtml: '<h3>3년의 시간이 빚은 깊은 맛</h3><p>청정 정선의 장독대에서 자연의 속도로 익힌 전통 된장입니다. 국산 콩과 천일염만으로 담그고, 대를 이어온 씨장을 더해 깊은 풍미를 냅니다.</p><p>찌개·국은 물론 쌈장 베이스로도 좋습니다.</p>',
      gosi: gosiBase({ pname: '전통 된장 1kg', volume: '1kg', ingredients: '국산 콩 100%, 천일염, 씨장' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_gochujang', 'p_makjang', 'p_set3'] },
    { id: 'p_gochujang', name: '태양초 고추장', cat: '장류', price: 28000, salePrice: null, unit: '1kg', status: '판매중', stock: 40, option: null,
      summary: '매콤하고 감칠맛 가득. 햇볕에 말린 국산 태양초 고춧가루로 담갔습니다.', icon: 'flame', tone: 'tone-point',
      descHtml: '<h3>태양초의 매운맛, 발효의 단맛</h3><p>국산 태양초 고춧가루와 찹쌀, 전통 메주가루로 담가 장기 숙성한 고추장입니다. 인공 감미료 없이 발효가 만든 자연스러운 단맛이 특징입니다.</p>',
      gosi: gosiBase({ pname: '태양초 고추장 1kg', volume: '1kg', ingredients: '국산 고춧가루, 찹쌀, 메주가루, 천일염, 조청' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_makjang', 'p_set3'] },
    { id: 'p_makjang', name: '정선 막장', cat: '장류', price: 22000, salePrice: null, unit: '1kg', status: '판매중', stock: 45, option: null,
      summary: '구수하고 깊은 감칠맛. 강원도 전통 방식 그대로의 막장입니다.', icon: 'wheat', tone: 'tone-main',
      descHtml: '<h3>강원도 밥상의 비밀, 막장</h3><p>콩과 보리를 함께 띄워 담그는 강원도 전통 막장입니다. 된장보다 부드럽고 단맛이 돌아 쌈장·찌개에 두루 어울립니다.</p>',
      gosi: gosiBase({ pname: '정선 막장 1kg', volume: '1kg', ingredients: '국산 콩, 보리, 고춧가루, 천일염' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_gochujang', 'p_set3'] },
    { id: 'p_cheongguk', name: '전통 청국장', cat: '발효식품', price: 12000, salePrice: null, unit: '500g', status: '판매중', stock: 60, option: null,
      summary: '진하고 구수한 자연 발효 청국장. 국산 콩 100%.', icon: 'soup', tone: 'tone-deep',
      descHtml: '<h3>이틀의 기다림, 진한 구수함</h3><p>국산 콩을 삶아 볏짚으로 자연 발효시킨 전통 청국장입니다. 냉동 보관 후 끓이기만 하면 진한 청국장찌개가 완성됩니다.</p>',
      gosi: gosiBase({ pname: '전통 청국장 500g', volume: '500g', ingredients: '국산 콩 100%', storage: '냉동 보관 (-18℃ 이하)', expiry: '제조일로부터 6개월 (냉동 기준, 별도 표기)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_jangajji'] },
    { id: 'p_jangajji', name: '제철 장아찌', cat: '발효식품', price: 15000, salePrice: null, unit: '500g', status: '판매중', stock: 30, option: null,
      summary: '전통 장으로 담근 짭조름한 밑반찬. 제철 채소로 담급니다.', icon: 'salad', tone: 'tone-oat',
      descHtml: '<h3>장이 익으면 반찬이 됩니다</h3><p>제철 채소를 3년 숙성 전통 장에 박아 담근 장아찌입니다. 시기에 따라 구성 채소가 달라집니다.</p>',
      gosi: gosiBase({ pname: '제철 장아찌 500g', volume: '500g', ingredients: '제철 채소(깻잎·고추·무 등), 전통 간장·된장, 천일염', storage: '냉장 보관 (0~10℃)', expiry: '제조일로부터 6개월 (냉장 기준, 별도 표기)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_cheongguk', 'p_meju'] },
    { id: 'p_meju', name: '전통 메주', cat: '발효식품', price: 18000, salePrice: null, unit: '1개', status: '판매중', stock: 25,
      option: { name: '구성', values: [ { label: '1개', add: 0, stock: 25 }, { label: '3개 묶음 (5% 할인)', add: 33300, stock: 10 } ] },
      summary: '직접 장을 담그실 분들을 위한 자연 건조 메주.', icon: 'package', tone: 'tone-main',
      descHtml: '<h3>장 담그기의 시작</h3><p>국산 콩을 삶아 빚고 자연 바람에 말려 띄운 전통 메주입니다. 장 담그기 시기(정월)에 맞춰 예약 주문을 권장합니다.</p>',
      gosi: gosiBase({ pname: '전통 메주', volume: '약 1.5kg/개', ingredients: '국산 콩 100%', storage: '통풍이 잘 되는 서늘한 곳' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_jangajji'] },
    { id: 'p_set3', name: '명절 장(醬) 3종 세트', cat: '선물세트', price: 45000, salePrice: 42000, unit: '세트', status: '판매중', stock: 30,
      option: { name: '포장', values: [ { label: '전통 보자기 포장', add: 0, stock: 20 }, { label: '고급 한지 상자 포장', add: 5000, stock: 10 } ] },
      summary: '된장·고추장·막장 각 500g 정성 구성. 명절 선물로 가장 사랑받는 세트입니다.', icon: 'gift', tone: 'tone-point',
      descHtml: '<h3>마음을 담은 전통의 선물</h3><p>대표 장류 3종(된장·고추장·막장 각 500g)을 한 상자에 담았습니다. 전통 보자기 또는 고급 한지 상자 포장을 선택할 수 있습니다.</p>',
      gosi: gosiBase({ pname: '명절 장 3종 세트 (된장·고추장·막장 각 500g)', volume: '500g × 3', ingredients: '된장(국산 콩, 천일염), 고추장(국산 고춧가루, 찹쌀, 메주가루), 막장(국산 콩, 보리)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_setprem', 'p_doenjang'] },
    { id: 'p_setprem', name: '프리미엄 발효 선물세트', cat: '선물세트', price: 59000, salePrice: null, unit: '세트', status: '품절', stock: 0, option: null,
      summary: '장류 3종과 청국장을 한 상자에. 고급 한지 포장.', icon: 'gift', tone: 'tone-deep',
      descHtml: '<h3>발효의 정수를 한 상자에</h3><p>장 3종에 청국장을 더한 프리미엄 구성입니다. 고급 한지 상자에 담아 격식 있는 선물로 좋습니다.</p>',
      gosi: gosiBase({ pname: '프리미엄 발효 선물세트', volume: '500g × 4', ingredients: '된장·고추장·막장·청국장 (국산 콩, 고춧가루, 보리 등)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_set3'] },
  ];
  function seedProducts(){ if (!localStorage.getItem(PRODUCTS_KEY)) setJSON(PRODUCTS_KEY, PRODUCT_DEFAULTS); }
  function getProducts(){ return getJSON(PRODUCTS_KEY, []); }
  function setProducts(a){ setJSON(PRODUCTS_KEY, a); }
  function getProduct(id){ var a = getProducts(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

  /* ---------------- 주문 상태 ---------------- */
  var OSTAT = ['주문접수', '결제완료', '배송준비중', '배송중', '배송완료'];
  var ST_COLOR = { '주문접수': '#C9912F', '결제완료': '#4A6E86', '배송준비중': '#6E8252', '배송중': '#B0473A', '배송완료': '#3E7D4F', '취소': '#8C8576', '반품요청': '#C0492E', '반품완료': '#8C8576', '교환요청': '#C9912F', '교환완료': '#8C8576' };
  function stTag(s){ var c = ST_COLOR[s] || '#777'; return '<span class="tag" style="background:' + c + '1F;color:' + c + ';font-weight:700">' + esc(s) + '</span>'; }

  /* ---------------- 홈 팝업 (관리자 팝업관리 · 이미지 지원) ---------------- */
  var POPUP_KEY = 'kach_popups_v1';
  function getPopups(){ var p = getJSON(POPUP_KEY, null); return p && p.length != null ? p : null; }
  function activePopup() {
    var list = getPopups(); if (!list) return null;
    var today = todayStr();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p.active) continue;
      if (p.startsAt && today < p.startsAt) continue;
      if (p.endsAt && today > p.endsAt) continue;
      if (localStorage.getItem('kach_popdismiss_' + p.id) === today) continue;
      return p;
    }
    return null;
  }
  function showPopup() {
    if (currentPage() !== 'index') return;
    var p = activePopup(); if (!p) return;
    var visual = p.img
      ? '<img src="' + esc(p.img) + '" alt="' + esc(p.title) + '" style="display:block;width:100%;max-height:46vh;object-fit:cover">'
      : '<div class="ph tone-deep ratio-169" data-label="" style="border-radius:0"><i data-lucide="bell"></i></div>';
    var root = rawModal(
      visual +
      '<div style="padding:26px 28px 24px">' +
        '<div class="eyebrow">공지</div>' +
        '<h3 style="margin:10px 0 10px;font-size:22px">' + esc(p.title) + '</h3>' +
        '<p class="muted" style="margin:0;white-space:pre-line">' + esc(p.body || '') + '</p>' +
        (p.link ? '<a class="btn btn-point" href="' + esc(p.link) + '" style="margin-top:18px"><i data-lucide="arrow-right"></i>' + esc(p.linkLabel || '자세히 보기') + '</a>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:22px;border-top:1px solid var(--line-soft);padding-top:14px">' +
          '<button type="button" class="btn-text" id="popDismiss" style="color:var(--ink-mute)">오늘 하루 보지 않기</button>' +
          '<button type="button" class="btn btn-ghost" data-modal-close style="padding:9px 18px">닫기</button>' +
        '</div>' +
      '</div>', 440);
    var dz = document.getElementById('popDismiss');
    if (dz) dz.addEventListener('click', function () {
      try { localStorage.setItem('kach_popdismiss_' + p.id, todayStr()); } catch (e) {}
      closeModal();
    });
  }

  /* ---------------- Chrome (nav / footer / mobile) ---------------- */
  function buildNav() {
    var cur = currentPage();
    var links = NAV.map(function (n) {
      var active = n.id === cur ? ' active' : '';
      var dd = n.dd ? '<div class="nav-dd">' + n.dd.map(function (d) { return '<a href="' + d.href + '">' + d.label + '</a>'; }).join('') + '</div>' : '';
      var caret = n.dd ? ' <i data-lucide="chevron-down" style="width:14px;height:14px;opacity:.6"></i>' : '';
      return '<div class="nav-item' + active + '"><a href="' + n.href + '">' + n.label + caret + '</a>' + dd + '</div>';
    }).join('');
    return '<div class="nav"><div class="nav-inner">' +
        '<a class="brand" href="index.html" aria-label="홈으로">' +
          '<img src="assets/logo.png" alt="한국참전통발효식품협동조합 로고">' +
          '<span class="bt"><b>한국참전통발효식품</b><span>협동조합 · 孝</span></span>' +
        '</a>' +
        '<nav class="nav-links" aria-label="주 메뉴">' + links + '</nav>' +
        '<div class="nav-cta">' +
          '<button class="btn btn-point" data-modal="apply"><i data-lucide="sprout"></i>지도사 신청</button>' +
          '<button class="btn btn-ghost nav-toggle" aria-label="메뉴 열기" id="navToggle" style="padding:11px 13px"><i data-lucide="menu"></i></button>' +
        '</div>' +
      '</div></div>';
  }
  function buildMobile() {
    var cur = currentPage();
    var items = NAV.map(function (n) {
      var sub = n.dd ? n.dd.map(function (d) { return '<a href="' + d.href + '">' + d.label + '</a>'; }).join('') : '';
      return '<div class="mm-group"><a class="mm-top' + (n.id === cur ? ' active' : '') + '" href="' + n.href + '">' + n.label + '</a>' +
        (sub ? '<div class="mm-sub">' + sub + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="mobile-menu" id="mobileMenu">' +
      '<div class="mm-body"><div class="mm-head"><b>메뉴</b><button id="mmClose" aria-label="닫기"><i data-lucide="x"></i></button></div>' + items +
      '<button class="btn btn-point btn-lg" data-modal="apply" style="margin-top:16px"><i data-lucide="sprout"></i>전통발효식품체험지도사 신청</button>' +
      '</div></div>';
  }
  function buildFooter() {
    return '<div class="footer-inner">' +
      '<div class="footer-top">' +
        '<div class="footer-brand">' +
          '<img src="assets/logo.png" alt="한국참전통발효식품협동조합 로고">' +
          '<b>한국참전통발효식품협동조합</b>' +
          '<p>전통 발효식품의 보급과 교육을 통해 건강한 식문화를 만들어갑니다. 전통의 깊이, 발효의 가치를 다음 세대로 이어갑니다.</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h6>바로가기</h6>' +
          '<a href="about.html">협동조합 소개</a><a href="ferments.html">전통발효식품</a>' +
          '<a href="instructor.html">체험지도사 과정</a><a href="products.html">제품 판매</a>' +
          '<a href="news.html">소식마당</a><a href="contact.html">문의하기</a>' +
        '</div>' +
        '<div class="footer-col footer-info">' +
          '<h6>사업자 정보</h6>' +
          '<span><b>대표</b> 김필연</span>' +
          '<span><b>사업자등록번호</b> 869-81-02406</span>' +
          '<span><b>통신판매업신고</b> 2025-서울구로-1345</span>' +
          '<span><b>주소</b> 서울특별시 구로구 구로동 240,<br>세일빌딩 701호</span>' +
          '<span><b>전화</b> 02-855-8806</span>' +
          '<span><b>이메일</b> kach5501@hanmail.net</span>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>© 2026 한국참전통발효식품협동조합. All rights reserved.</span>' +
        '<span class="foot-meta">이용약관 · 개인정보처리방침 · <a href="admin.html" class="admin-link" title="관리자 페이지">관리자</a></span>' +
      '</div>' +
    '</div>';
  }

  function mountChrome() {
    var nav = document.getElementById('site-nav');
    if (nav) { nav.innerHTML = buildNav(); }
    if (nav && !document.getElementById('mobileMenu')) document.body.insertAdjacentElement('afterbegin', el(buildMobile()));
    var foot = document.getElementById('site-footer');
    if (foot) foot.innerHTML = buildFooter();

    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('mobileMenu');
    var close = document.getElementById('mmClose');
    if (toggle) toggle.addEventListener('click', function(){ menu.classList.add('open'); });
    if (close) close.addEventListener('click', function(){ menu.classList.remove('open'); });
    if (menu) menu.addEventListener('click', function(e){ if (e.target === menu) menu.classList.remove('open'); });
  }

  /* ---------------- SEO 보강 (canonical · og:url · og:image 절대경로) ---------------- */
  function enhanceSEO() {
    try {
      var href = location.href.split('#')[0];
      if (!document.querySelector('link[rel=canonical]')) {
        var l = document.createElement('link'); l.rel = 'canonical'; l.href = href; document.head.appendChild(l);
      }
      function ensureMeta(prop, content) {
        var m = document.querySelector('meta[property="' + prop + '"]');
        if (!m) { m = document.createElement('meta'); m.setAttribute('property', prop); document.head.appendChild(m); }
        if (!m.getAttribute('content')) m.setAttribute('content', content);
      }
      ensureMeta('og:url', href);
      var ogi = document.querySelector('meta[property="og:image"]');
      if (ogi && !/^https?:/.test(ogi.getAttribute('content') || '')) {
        ogi.setAttribute('content', new URL(ogi.getAttribute('content'), location.href).href);
      }
    } catch (e) {}
  }

  /* ---------------- Top 플로팅 버튼 ---------------- */
  function initToTop() {
    var b = document.createElement('button');
    b.className = 'to-top'; b.setAttribute('aria-label', '맨 위로');
    b.innerHTML = '<i data-lucide="chevron-up"></i>';
    document.body.appendChild(b);
    b.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var onScroll = function(){ b.classList.toggle('show', (window.scrollY || document.documentElement.scrollTop) > 480); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- 토스트 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('siteToast');
    if (!t) { t = document.createElement('div'); t.id = 'siteToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  /* ---------------- Modals (신청 · 주문 · 문의) ---------------- */
  var PAY_BANK = '농협 000-0000-0000-00';
  var PAY_HOLDER = '한국참전통발효식품협동조합';

  var MODALS = {
    apply: {
      kicker: '체험지도사', title: '전통발효식품체험지도사 신청', store: 'kach_applications',
      desc: '아래 정보를 남겨주시면 담당자가 순차적으로 연락드립니다.', submit: '신청서 제출',
      consents: ['privacy'],
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'region', label: '지역', placeholder: '예) 서울 구로구' },
        { name: 'course', label: '희망 과정', type: 'select', options: ['정규 지도사 과정', '원데이 체험 클래스', '아직 결정 못함'] },
        { name: 'memo', label: '비고', type: 'textarea', full: true, placeholder: '문의하실 내용이나 일정 희망을 적어주세요.' },
      ],
    },
    order: {
      kicker: '비회원 주문', title: '제품 주문 (무통장입금)', store: 'kach_orders',
      desc: '회원가입 없이 주문하실 수 있습니다. 입금 확인 후 배송이 시작됩니다.', submit: '주문 접수',
      consents: ['privacy', 'third'], pay: true,
      fields: [
        { name: 'product', label: '상품', readonly: true, full: true },
        { name: 'optionLabel', label: '옵션', readonly: true, full: true, omitEmpty: true },
        { name: 'qty', label: '수량', type: 'number', value: '1', required: true, min: 1 },
        { name: 'depositor', label: '입금자명', required: true, placeholder: '입금하실 분 성함' },
        { name: 'name', label: '주문자', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'email', label: '이메일 (선택)', type: 'email', full: true, placeholder: '주문 조회에 사용할 수 있습니다' },
        { name: 'address', label: '배송지 주소', required: true, full: true, placeholder: '받으실 주소를 입력해주세요.' },
        { name: 'request', label: '배송 요청사항', type: 'textarea', full: true, placeholder: '예) 부재 시 문 앞에 놓아주세요.' },
        { name: 'unitPrice', type: 'hidden' },
        { name: 'productId', type: 'hidden' },
      ],
    },
    seedjang: {
      kicker: '씨장 분양', title: '씨장 분양 신청', store: 'kach_orders',
      desc: '전국민 씨장 갖기 운동 — 분양 신청 정보를 남겨주세요.', submit: '분양 신청',
      consents: ['privacy', 'third'], pay: 'note',
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'amount', label: '분양 용량', type: 'select', options: ['1kg (15만원)', '씨장 30kg 분양', '상담 후 결정'] },
        { name: 'region', label: '지역', placeholder: '예) 강원 정선군' },
        { name: 'memo', label: '비고', type: 'textarea', full: true, placeholder: '펜션 무료사용 등 문의사항을 적어주세요.' },
      ],
    },
    inquiry: {
      kicker: '문의', title: '문의하기', store: 'kach_inquiries',
      desc: '문의 내용을 남겨주시면 빠르게 답변드립니다.', submit: '문의 보내기',
      consents: ['privacy'],
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', placeholder: '010-0000-0000' },
        { name: 'type', label: '문의 유형', type: 'select', options: ['일반 문의', '교육 문의', '제품 문의', '제휴 문의'] },
        { name: 'memo', label: '내용', type: 'textarea', full: true, required: true, placeholder: '문의하실 내용을 적어주세요.' },
      ],
    },
  };

  function fieldHTML(f, data) {
    var id = 'mf_' + f.name, req = f.required ? ' required' : '', star = f.required ? '<span class="req">*</span>' : '';
    var val = (data && data[f.name] != null) ? data[f.name] : (f.value || '');
    if (f.type === 'hidden') return '<input type="hidden" name="' + f.name + '" value="' + esc(val) + '">';
    if (f.omitEmpty && !val) return '';
    var ctrl;
    if (f.type === 'select') {
      ctrl = '<select name="' + f.name + '" id="' + id + '"' + req + '>' + f.options.map(function(o){ return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      ctrl = '<textarea name="' + f.name + '" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '"' + req + '>' + esc(val) + '</textarea>';
    } else {
      ctrl = '<input type="' + (f.type || 'text') + '" name="' + f.name + '" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(val) + '"' + (f.readonly ? ' readonly' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + req + '>';
    }
    return '<div class="field' + (f.full ? ' full' : '') + '"><label for="' + id + '">' + esc(f.label) + star + '</label>' + ctrl + '</div>';
  }

  function consentHTML(keys) {
    var c = getConsents();
    return keys.map(function (k) {
      var t = c[k];
      return '<div class="consent-box">' +
        '<div class="consent-head">' +
          '<label><input type="checkbox" class="consent-chk"><span>[필수] ' + esc(t.title) + '</span></label>' +
          '<button type="button" class="consent-toggle" data-consent-toggle>전문 보기 <i data-lucide="chevron-down"></i></button>' +
        '</div>' +
        '<div class="consent-body" hidden>' + esc(t.body) + '</div>' +
      '</div>';
    }).join('');
  }

  function payBoxHTML(mode, data) {
    var qty = Number((data && data.qty) || 1) || 1;
    var unit = Number((data && data.unitPrice) || 0) || 0;
    var totalRow = mode === 'note'
      ? '<div class="pay-row"><span>분양 금액</span><span>1kg당 15만원 · 30kg 분양 가능 (상담 후 확정)</span></div>'
      : (unit ? '<div class="pay-row"><span>총 결제금액</span><b class="pay-total" id="payTotal">' + fmtWon(unit * qty) + '원</b></div>' : '');
    return '<div class="pay-box"><b><i data-lucide="landmark"></i>무통장입금(계좌이체) 안내</b>' +
      '<div class="pay-row"><span>입금 계좌</span><span>' + PAY_BANK + '<br>(예금주: ' + PAY_HOLDER + ')</span></div>' +
      totalRow +
      '<div class="pay-row"><span>입금 기한</span><span>주문 후 3일 이내</span></div>' +
      '<p>입금자명은 ‘입금자명’ 항목과 동일하게 입금해 주세요. 입금 확인 후 결제완료 처리되며 순차 배송됩니다. 주문 완료 시 발급되는 <b>주문번호</b>와 연락처(또는 이메일)로 언제든 주문을 조회할 수 있습니다.</p>' +
      '<p class="pay-demo">※ 데모 안내: 표시된 계좌번호는 예시이며 실제 운영 시 교체됩니다.</p>' +
    '</div>';
  }

  function ensureModalRoot() {
    var r = document.getElementById('modalRoot');
    if (!r) { r = document.createElement('div'); r.id = 'modalRoot'; r.className = 'modal-root'; document.body.appendChild(r); }
    return r;
  }
  function rawModal(dialogHtml, width) {
    var root = ensureModalRoot();
    root.innerHTML = '<div class="modal-dim" data-modal-close></div>' +
      '<div class="modal-dialog" role="dialog" aria-modal="true" style="width:min(' + (width || 560) + 'px,94vw)">' + dialogHtml + '</div>';
    root.classList.add('open');
    document.body.style.overflow = 'hidden';
    icons();
    return root;
  }

  function openModal(type, data) {
    var cfg = MODALS[type]; if (!cfg) return;
    var fields = cfg.fields.map(function(f){ return fieldHTML(f, data); }).join('');
    var consents = cfg.consents ? consentHTML(cfg.consents) : '';
    var pay = cfg.pay ? payBoxHTML(cfg.pay === 'note' ? 'note' : 'total', data) : '';
    var disabled = cfg.consents && cfg.consents.length ? ' disabled' : '';
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">' + cfg.kicker + '</div><h3>' + esc(cfg.title) + '</h3><p>' + esc(cfg.desc) + '</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="modalForm" data-store="' + cfg.store + '" data-type="' + type + '">' +
        '<div class="form-grid">' + fields + '</div>' +
        pay + consents +
        '<div class="modal-note"><i data-lucide="info"></i><span>이 양식은 데모 프로토타입으로 접수되어 관리자 페이지에 표시됩니다. 실제 발송·결제는 운영 서버 연동 후 동작합니다.</span></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button><button type="submit" class="btn btn-point"' + disabled + '>' + cfg.submit + '</button></div>' +
      '</form></div>');
    var root = document.getElementById('modalRoot');
    var first = root.querySelector('input:not([type=hidden]), select, textarea');
    if (first && !first.readOnly) setTimeout(function(){ first.focus(); }, 60);
  }

  function closeModal() {
    var r = document.getElementById('modalRoot');
    if (r) r.classList.remove('open');
    document.body.style.overflow = '';
  }

  function submitModal(form) {
    var data = {}; var fd = new FormData(form);
    fd.forEach(function(v, k){ data[k] = v; });
    var store = form.getAttribute('data-store');
    var type = form.getAttribute('data-type');
    data.kind = type;
    var isOrder = (type === 'order' || type === 'seedjang');
    if (isOrder) {
      data.orderNo = genOrderNo();
      data.payMethod = '무통장입금';
      data.status = '주문접수';
      if (data.unitPrice) data.total = Number(data.unitPrice) * (Number(data.qty) || 1);
    }
    pushRecord(store, data);
    var title = MODALS[type].title;
    var body = form.closest('.modal-body');
    var orderInfo = '';
    if (isOrder && data.orderNo) {
      orderInfo = '<div class="pay-box" style="text-align:left;margin-top:18px"><b><i data-lucide="receipt"></i>주문번호</b>' +
        '<div class="pay-row"><span>주문번호</span><b class="pay-total" style="font-size:20px;letter-spacing:.04em">' + data.orderNo + '</b></div>' +
        (data.total ? '<div class="pay-row"><span>결제금액</span><b>' + fmtWon(data.total) + '원</b></div>' : '') +
        '<div class="pay-row"><span>입금 계좌</span><span>' + PAY_BANK + ' (예금주: ' + PAY_HOLDER + ')</span></div>' +
        '<p>주문번호를 꼭 보관해 주세요. 제품 페이지의 <b>비회원 주문 조회</b>에서 주문번호와 연락처(또는 이메일)로 진행 상태를 확인할 수 있습니다.</p></div>';
    }
    body.innerHTML =
      '<div class="modal-success">' +
        '<div class="ok-ring"><i data-lucide="check"></i></div>' +
        '<h3 style="font-size:22px">' + (isOrder ? '주문이 접수되었습니다' : '신청이 접수되었습니다') + '</h3>' +
        '<p class="muted" style="margin-top:10px">' + esc(title) + ' 접수가 정상적으로 완료되었습니다.<br>담당자가 확인 후 진행해 드리겠습니다.</p>' +
        orderInfo +
        '<div class="modal-foot"><button type="button" class="btn btn-point" data-modal-close>확인</button></div>' +
      '</div>';
    icons();
  }

  /* ---------------- 비회원 주문 조회 ---------------- */
  function openOrderLookup() {
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">비회원 주문</div><h3>주문 조회</h3><p>주문번호와 연락처(또는 이메일)를 입력하시면 진행 상태를 확인할 수 있습니다.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="lookupForm">' +
        '<div class="form-grid">' +
          '<div class="field full"><label>주문번호<span class="req">*</span></label><input name="ono" required placeholder="예) 2026061100001" inputmode="numeric"></div>' +
          '<div class="field full"><label>연락처 또는 이메일<span class="req">*</span></label><input name="contact" required placeholder="010-0000-0000 / name@email.com"></div>' +
        '</div>' +
        '<div id="lookupResult"></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>닫기</button><button type="submit" class="btn btn-point"><i data-lucide="search"></i>조회하기</button></div>' +
      '</form></div>');
    var f = document.getElementById('lookupForm');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      var ono = String(fd.get('ono') || '').trim();
      var contact = String(fd.get('contact') || '').trim();
      var digits = contact.replace(/\D/g, '');
      var orders = getJSON('kach_orders', []);
      var found = null;
      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        if (String(o.orderNo || '') !== ono) continue;
        var phoneOk = digits && String(o.phone || '').replace(/\D/g, '') === digits;
        var mailOk = contact.indexOf('@') > -1 && String(o.email || '').toLowerCase() === contact.toLowerCase();
        if (phoneOk || mailOk) { found = o; break; }
      }
      var box = document.getElementById('lookupResult');
      if (!found) {
        box.innerHTML = '<div class="modal-note" style="margin-top:16px"><i data-lucide="alert-circle"></i><span>일치하는 주문을 찾을 수 없습니다. 주문번호와 연락처를 다시 확인해 주세요.</span></div>';
        icons(); return;
      }
      var special = ['취소', '반품요청', '반품완료', '교환요청', '교환완료'].indexOf(found.status) > -1;
      var steps = OSTAT.map(function (s) {
        var on = !special && OSTAT.indexOf(found.status) >= OSTAT.indexOf(s);
        var curNow = found.status === s;
        return '<span class="tag" style="' + (on ? 'background:var(--main);color:#fff;' : '') + (curNow ? 'box-shadow:0 0 0 2px var(--main-tint);' : '') + '">' + s + '</span>';
      }).join('<i data-lucide="chevron-right" style="width:13px;height:13px;color:var(--ink-faint)"></i>');
      box.innerHTML =
        '<div style="border:1px solid var(--line-soft);border-radius:var(--r-md);padding:16px 18px;margin-top:16px;background:var(--surface)">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
            '<b>' + esc(found.product || found.amount || '씨장 분양') + (found.optionLabel ? ' <span class="muted" style="font-weight:500">(' + esc(found.optionLabel) + ')</span>' : '') + '</b>' + stTag(found.status) +
          '</div>' +
          '<div class="muted" style="font-size:13px;margin-top:6px">주문일 ' + fmtYMD(found.at) + (found.qty ? ' · 수량 ' + esc(found.qty) : '') + (found.total ? ' · ' + fmtWon(found.total) + '원' : '') + '</div>' +
          (special
            ? '<div class="modal-note" style="margin-top:12px"><i data-lucide="info"></i><span>이 주문은 ‘' + found.status + '’ 상태입니다. 자세한 사항은 고객센터(02-855-8806)로 문의해 주세요.</span></div>'
            : '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:14px">' + steps + '</div>') +
          (found.tracking ? '<div class="muted" style="font-size:13px;margin-top:10px">운송장: ' + esc(found.courier || '') + ' ' + esc(found.tracking) + '</div>' : '') +
        '</div>';
      icons();
    });
  }

  /* ---------------- 이벤트 위임 ---------------- */
  function initModalDelegation() {
    document.addEventListener('click', function(e){
      var trigger = e.target.closest('[data-modal]');
      if (trigger) {
        e.preventDefault();
        var t = trigger.getAttribute('data-modal');
        if (t === 'orderlookup') { openOrderLookup(); return; }
        openModal(t, trigger.dataset);
        return;
      }
      var ct = e.target.closest('[data-consent-toggle]');
      if (ct) {
        var body = ct.closest('.consent-box').querySelector('.consent-body');
        var open = body.hasAttribute('hidden');
        if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
        ct.classList.toggle('open', open);
        return;
      }
      if (e.target.closest('[data-modal-close]')) { closeModal(); }
    });
    document.addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('consent-chk')) {
        var form = e.target.closest('form'); if (!form) return;
        var all = form.querySelectorAll('.consent-chk');
        var ok = true;
        for (var i = 0; i < all.length; i++) if (!all[i].checked) ok = false;
        var btn = form.querySelector('button[type=submit]');
        if (btn) btn.disabled = !ok;
      }
    });
    document.addEventListener('input', function (e) {
      if (e.target.name === 'qty' && e.target.closest('#modalForm')) {
        var form = e.target.closest('#modalForm');
        var unit = Number((form.querySelector('[name=unitPrice]') || {}).value || 0);
        var totalEl = document.getElementById('payTotal');
        if (unit && totalEl) totalEl.textContent = fmtWon(unit * Math.max(1, Number(e.target.value) || 1)) + '원';
      }
    });
    document.addEventListener('submit', function(e){
      if (e.target && e.target.id === 'modalForm') {
        e.preventDefault();
        var chks = e.target.querySelectorAll('.consent-chk');
        for (var i = 0; i < chks.length; i++) if (!chks[i].checked) return;
        submitModal(e.target);
      }
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });
  }

  /* ---------------- Reveal on scroll (최초 1회 애니메이션) ----------------
     동적으로 추가되는 요소도 revealScan()으로 등록 → 처음 보일 때 1회만 재생 */
  var revealIO = null;
  function ensureIO() {
    if (revealIO || !('IntersectionObserver' in window)) return revealIO;
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    return revealIO;
  }
  function revealScan(root) {
    var els = (root || document).querySelectorAll('.reveal:not(.in)');
    var io = ensureIO();
    if (!io) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    els.forEach(function (e) {
      if (e.dataset.revScan) return;
      e.dataset.revScan = '1';
      // 형제 사이 순서에 따른 가벼운 스태거
      var idx = 0, s = e;
      while ((s = s.previousElementSibling) && idx < 6) { if (s.classList && s.classList.contains('reveal')) idx++; }
      e.style.animationDelay = ((idx % 6) * 60) + 'ms';
      io.observe(e);
    });
  }

  /* ---------------- 내비 스크롤 인터랙션 ---------------- */
  function initNavScroll() {
    var nav = document.querySelector('#site-nav .nav');
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop) > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  try { document.documentElement.classList.add('js'); } catch (e) {}
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    seedPosts();
    seedProducts();
    trackVisit();
    mountChrome();
    enhanceSEO();
    initModalDelegation();
    renderPartnersStrip();
    renderNewsPreview();
    revealScan();
    initToTop();
    initNavScroll();
    icons();
    setTimeout(icons, 60);
    setTimeout(showPopup, 700);
  });

  /* expose for admin + page scripts */
  window.Site = {
    icons: icons, esc: esc, uid: uid, el: el,
    getJSON: getJSON, setJSON: setJSON, pushRecord: pushRecord,
    fmtWon: fmtWon, fmtYMD: fmtYMD, todayStr: todayStr, genOrderNo: genOrderNo,
    idb: idb, toast: toast, revealScan: revealScan,
    requireAdmin: requireAdmin, verifyLogin: verifyLogin, lockMs: lockMs,
    openModal: openModal, closeModal: closeModal, rawModal: rawModal, openOrderLookup: openOrderLookup,
    getPartners: getPartners, setPartners: setPartners, renderPartnersStrip: renderPartnersStrip, partnerDefaults: PARTNER_DEFAULTS,
    POPUP_KEY: POPUP_KEY, getPopups: getPopups,
    POSTS_KEY: POSTS_KEY, getPosts: getPosts, setPosts: setPosts,
    CONSENT_KEY: CONSENT_KEY, getConsents: getConsents, consentDefaults: CONSENT_DEFAULTS,
    PRODUCTS_KEY: PRODUCTS_KEY, getProducts: getProducts, setProducts: setProducts, getProduct: getProduct,
    productDefaults: PRODUCT_DEFAULTS, SHIP_TPL: SHIP_TPL, REFUND_TPL: REFUND_TPL, gosiBase: gosiBase,
    OSTAT: OSTAT, stTag: stTag, ST_COLOR: ST_COLOR,
    VISITS_KEY: VISITS_KEY,
    PAY_BANK: PAY_BANK, PAY_HOLDER: PAY_HOLDER,
  };
})();
