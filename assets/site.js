/* ============================================================
   site.js — shared chrome, icons, modals, partners store
   한국참전통발효식품협동조합
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
      { label: '전체 상품', href: 'products.html#all' },
      { label: '장류', href: 'products.html#jang' },
      { label: '씨장 분양', href: 'products.html#seedjang' },
      { label: '선물세트', href: 'products.html#gift' },
    ]},
    { id: 'news', label: '소식마당', href: 'news.html', dd: [
      { label: '공지사항', href: 'news.html#notice' },
      { label: '교육 일정', href: 'news.html#edu' },
      { label: '행사 소식', href: 'news.html#event' },
      { label: '갤러리', href: 'news.html#gallery' },
    ]},
    { id: 'contact', label: '문의하기', href: 'contact.html' },
  ];

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function currentPage() {
    if (document.body.dataset.page) return document.body.dataset.page;
    var f = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    return f || 'index';
  }
  function icons() { if (window.lucide) window.lucide.createIcons(); }

  /* ---------------- localStorage stores ---------------- */
  function getJSON(k, def){ try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function setJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pushRecord(key, rec){ var a = getJSON(key, []); rec.id = 'r' + Date.now().toString(36); rec.at = new Date().toISOString(); rec.status = rec.status || '신규'; a.unshift(rec); setJSON(key, a); return rec; }

  /* ---------------- Partners ---------------- */
  var PARTNER_KEY = 'kach_partners_v1';
  var PARTNER_DEFAULTS = [
    { id: 'p_mjd', name: '정선만장대', sub: '전통발효식품협동조합 · 강원 정선', logo: '', url: 'https://www.manjangdae.com', featured: true },
    { id: 'p_local', name: '정선군 로컬푸드', sub: '지역 농산물 파트너', logo: '', url: '' },
    { id: 'p_farm', name: '협력 재배 농가', sub: '국산 콩 · 고추 공급', logo: '', url: '' },
    { id: 'p_org', name: '전통장류 명인회', sub: '기술 자문 파트너', logo: '', url: '' },
  ];
  function getPartners(){ var p = getJSON(PARTNER_KEY, null); return p && p.length != null ? p : PARTNER_DEFAULTS.slice(); }
  function setPartners(arr){ setJSON(PARTNER_KEY, arr); }

  function partnerItemHTML(p) {
    var inner = p.logo
      ? '<div class="p-logo"><img src="' + esc(p.logo) + '" alt="' + esc(p.name) + ' 로고"></div>'
      : '<div class="p-fallback">' + esc(p.name) + '</div>';
    var badge = p.featured ? '<span class="p-badge">주요 파트너</span>' : '';
    var body = inner + badge + '<span class="p-name">' + esc(p.sub || p.name) + '</span>';
    var cls = 'partner-item' + (p.featured ? ' featured' : '');
    if (p.url) return '<a class="' + cls + '" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + body + '</a>';
    return '<div class="' + cls + '">' + body + '</div>';
  }
  function renderPartnersStrip() {
    var track = document.getElementById('partners-track');
    if (!track) return;
    var list = getPartners();
    track.innerHTML = list.length
      ? list.map(partnerItemHTML).join('')
      : '<div class="partners-empty">등록된 파트너가 없습니다.</div>';
    icons();
  }

  /* ---------------- Homepage popup (관리자 팝업관리) ---------------- */
  var POPUP_KEY = 'kach_popups_v1';
  function getPopups(){ var p = getJSON(POPUP_KEY, null); return p && p.length != null ? p : null; }
  function activePopup() {
    var list = getPopups(); if (!list) return null;
    var today = new Date().toISOString().slice(0, 10);
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
    var root = ensureModalRoot();
    root.innerHTML =
      '<div class="modal-dim" data-modal-close></div>' +
      '<div class="modal-dialog" role="dialog" aria-modal="true" style="width:min(440px,94vw)">' +
        '<div class="ph tone-deep ratio-169" data-label="" style="border-radius:0"><i data-lucide="bell"></i></div>' +
        '<div style="padding:26px 28px 24px">' +
          '<div class="eyebrow">공지</div>' +
          '<h3 style="margin:10px 0 10px;font-size:22px">' + esc(p.title) + '</h3>' +
          '<p class="muted" style="margin:0;white-space:pre-line">' + esc(p.body || '') + '</p>' +
          (p.link ? '<a class="btn btn-point" href="' + esc(p.link) + '" style="margin-top:18px"><i data-lucide="arrow-right"></i>' + esc(p.linkLabel || '자세히 보기') + '</a>' : '') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:22px;border-top:1px solid var(--line-soft);padding-top:14px">' +
            '<button type="button" class="btn-text" id="popDismiss" style="color:var(--ink-mute)">오늘 하루 보지 않기</button>' +
            '<button type="button" class="btn btn-ghost" data-modal-close style="padding:9px 18px">닫기</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    root.classList.add('open');
    icons();
    var dz = document.getElementById('popDismiss');
    if (dz) dz.addEventListener('click', function () {
      try { localStorage.setItem('kach_popdismiss_' + p.id, new Date().toISOString().slice(0, 10)); } catch (e) {}
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
          '<img src="assets/logo.png" alt="로고">' +
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
    if (!document.getElementById('mobileMenu')) document.body.insertAdjacentElement('afterbegin', el(buildMobile()));
    var foot = document.getElementById('site-footer');
    if (foot) foot.innerHTML = buildFooter();

    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('mobileMenu');
    var close = document.getElementById('mmClose');
    if (toggle) toggle.addEventListener('click', function(){ menu.classList.add('open'); });
    if (close) close.addEventListener('click', function(){ menu.classList.remove('open'); });
    if (menu) menu.addEventListener('click', function(e){ if (e.target === menu) menu.classList.remove('open'); });
  }

  /* ---------------- Modals (신청 · 주문 · 문의) ---------------- */
  var MODALS = {
    apply: {
      kicker: '체험지도사', title: '전통발효식품체험지도사 신청', store: 'kach_applications',
      desc: '아래 정보를 남겨주시면 담당자가 순차적으로 연락드립니다.', submit: '신청서 제출',
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'email', label: '이메일', type: 'email', placeholder: 'name@email.com' },
        { name: 'region', label: '지역', placeholder: '예) 서울 구로구' },
        { name: 'course', label: '희망 과정', type: 'select', options: ['정규 지도사 과정', '원데이 체험 클래스', '아직 결정 못함'] },
        { name: 'memo', label: '비고', type: 'textarea', full: true, placeholder: '문의하실 내용이나 일정 희망을 적어주세요.' },
      ],
    },
    order: {
      kicker: '제품 구매', title: '제품 주문 · 구매 문의', store: 'kach_orders',
      desc: '주문 정보를 남겨주시면 결제·배송 안내를 드립니다.', submit: '주문 접수',
      fields: [
        { name: 'product', label: '상품', readonly: true, full: true },
        { name: 'qty', label: '수량', type: 'number', value: '1', required: true },
        { name: 'name', label: '주문자', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'address', label: '배송지', full: true, placeholder: '받으실 주소를 입력해주세요.' },
        { name: 'memo', label: '요청사항', type: 'textarea', full: true, placeholder: '배송 메모 등' },
      ],
    },
    seedjang: {
      kicker: '씨장 분양', title: '씨장 분양 신청', store: 'kach_orders',
      desc: '전국민 씨장 갖기 운동 — 분양 신청 정보를 남겨주세요.', submit: '분양 신청',
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
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', placeholder: '010-0000-0000' },
        { name: 'email', label: '이메일', type: 'email', placeholder: 'name@email.com' },
        { name: 'type', label: '문의 유형', type: 'select', options: ['일반 문의', '교육 문의', '제품 문의', '제휴 문의'] },
        { name: 'memo', label: '내용', type: 'textarea', full: true, required: true, placeholder: '문의하실 내용을 적어주세요.' },
      ],
    },
  };

  function fieldHTML(f, data) {
    var id = 'mf_' + f.name, req = f.required ? ' required' : '', star = f.required ? '<span class="req">*</span>' : '';
    var val = (data && data[f.name] != null) ? data[f.name] : (f.value || '');
    var ctrl;
    if (f.type === 'select') {
      ctrl = '<select name="' + f.name + '" id="' + id + '"' + req + '>' + f.options.map(function(o){ return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      ctrl = '<textarea name="' + f.name + '" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '"' + req + '>' + esc(val) + '</textarea>';
    } else {
      ctrl = '<input type="' + (f.type || 'text') + '" name="' + f.name + '" id="' + id + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(val) + '"' + (f.readonly ? ' readonly' : '') + req + '>';
    }
    return '<div class="field' + (f.full ? ' full' : '') + '"><label for="' + id + '">' + esc(f.label) + star + '</label>' + ctrl + '</div>';
  }

  function ensureModalRoot() {
    var r = document.getElementById('modalRoot');
    if (!r) { r = document.createElement('div'); r.id = 'modalRoot'; r.className = 'modal-root'; document.body.appendChild(r); }
    return r;
  }

  function openModal(type, data) {
    var cfg = MODALS[type]; if (!cfg) return;
    var root = ensureModalRoot();
    var fields = cfg.fields.map(function(f){ return fieldHTML(f, data); }).join('');
    root.innerHTML =
      '<div class="modal-dim" data-modal-close></div>' +
      '<div class="modal-dialog" role="dialog" aria-modal="true" aria-label="' + esc(cfg.title) + '">' +
        '<div class="modal-head"><div><div class="eyebrow">' + cfg.kicker + '</div><h3>' + esc(cfg.title) + '</h3><p>' + esc(cfg.desc) + '</p></div>' +
          '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
        '<div class="modal-body"><form id="modalForm" data-store="' + cfg.store + '" data-type="' + type + '">' +
          '<div class="form-grid">' + fields + '</div>' +
          '<div class="modal-note"><i data-lucide="info"></i><span>이 신청은 데모 프로토타입으로 접수되어 관리자 페이지에 표시됩니다. 실제 발송·결제는 운영 서버 연동 후 동작합니다.</span></div>' +
          '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>취소</button><button type="submit" class="btn btn-point">' + cfg.submit + '</button></div>' +
        '</form></div>' +
      '</div>';
    root.classList.add('open');
    document.body.style.overflow = 'hidden';
    icons();
    var first = root.querySelector('input, select, textarea'); if (first && !first.readOnly) setTimeout(function(){ first.focus(); }, 60);
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
    pushRecord(store, data);
    var title = MODALS[type].title;
    var body = form.closest('.modal-body');
    body.innerHTML =
      '<div class="modal-success">' +
        '<div class="ok-ring"><i data-lucide="check"></i></div>' +
        '<h3 style="font-size:22px">신청이 접수되었습니다</h3>' +
        '<p class="muted" style="margin-top:10px">' + esc(title) + ' 신청이 정상적으로 접수되었습니다.<br>담당자가 확인 후 연락드리겠습니다.</p>' +
        '<div class="modal-note" style="text-align:left"><i data-lucide="info"></i><span>접수 내역은 관리자 페이지 → 신청/주문 관리에서 확인할 수 있습니다. (데모)</span></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-point" data-modal-close>확인</button></div>' +
      '</div>';
    icons();
  }

  function initModalDelegation() {
    document.addEventListener('click', function(e){
      var trigger = e.target.closest('[data-modal]');
      if (trigger) { e.preventDefault(); openModal(trigger.getAttribute('data-modal'), trigger.dataset); return; }
      if (e.target.closest('[data-modal-close]')) { closeModal(); }
    });
    document.addEventListener('submit', function(e){
      if (e.target && e.target.id === 'modalForm') { e.preventDefault(); submitModal(e.target); }
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function(e){ e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e, i) { e.style.animationDelay = ((i % 4) * 70) + 'ms'; io.observe(e); });
  }

  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    mountChrome();
    initModalDelegation();
    renderPartnersStrip();
    initReveal();
    icons();
    setTimeout(icons, 60);
    setTimeout(showPopup, 700);
  });

  /* expose for admin + pages */
  window.Site = {
    icons: icons, getJSON: getJSON, setJSON: setJSON,
    getPartners: getPartners, setPartners: setPartners,
    renderPartnersStrip: renderPartnersStrip, partnerDefaults: PARTNER_DEFAULTS,
    openModal: openModal, closeModal: closeModal, esc: esc,
    POPUP_KEY: POPUP_KEY, getPopups: getPopups,
  };
})();
