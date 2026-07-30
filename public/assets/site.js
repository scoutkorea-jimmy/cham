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
      { label: '소셜미션 · 설립 목적', href: 'about.html#purpose' },
      { label: '비전 · 미션', href: 'about.html#vision' },
      { label: '조직 · 강사진', href: 'about.html#people' },
      { label: '인증 · 사업자 정보', href: 'about.html#credentials' },
      { label: '파트너 · 정선만장대', href: 'about.html#partner' },
      { label: '오시는 길', href: 'about.html#location' },
    ]},
    { id: 'ferments', label: '전통발효식품', href: 'ferments.html', dd: [
      { label: '전통 발효란?', href: 'ferments.html#about' },
      { label: '발효 미생물', href: 'ferments.html#microbes' },
      { label: '씨장 이야기', href: 'ferments.html#seedjang' },
      { label: '발효식품의 종류', href: 'ferments.html#types' },
      { label: '전통발효 과정', href: 'ferments.html#process' },
      { label: '발효식품의 효능', href: 'ferments.html#benefits' },
    ]},
    { id: 'vinegar', label: '식초', href: 'vinegar.html', dd: [
      { label: '서연(瑞蓮) 이야기', href: 'vinegar.html#brand' },
      { label: '식초란 무엇인가', href: 'vinegar.html#what' },
      { label: '만드는 과정', href: 'vinegar.html#process' },
      { label: '식초 종류', href: 'vinegar.html#lineup' },
      { label: '마시는 방법', href: 'vinegar.html#how' },
      { label: '품질 · 시험성적', href: 'vinegar.html#quality' },
      { label: '가격 · 구매', href: 'vinegar.html#buy' },
    ]},
    { id: 'instructor', label: '체험지도사', href: 'instructor.html', dd: [
      { label: '교육안내', href: 'instructor.html#intro' },
      { label: '배우는 목적', href: 'instructor.html#purpose' },
      { label: '교육 프로그램 12가지', href: 'instructor.html#programs' },
      { label: '과정 구성', href: 'instructor.html#curriculum' },
      { label: '수료 후 이어지는 길', href: 'instructor.html#benefit' },
      { label: '모집 기수', href: 'instructor.html#schedule' },
      { label: '원데이 수업', href: 'instructor.html#oneday' },
      { label: '신청하기', href: 'instructor.html#apply' },
    ]},
    { id: 'nuruk', label: '누룩이야기', href: 'nuruk.html', dd: [
      { label: '누룩이란?', href: 'nuruk.html#about' },
      { label: '커리큘럼', href: 'nuruk.html#curriculum' },
      { label: '수업 안내', href: 'nuruk.html#notice' },
    ]},
    { id: 'products', label: '제품', href: 'products.html', dd: [
      { label: '식초 · 와인 (서연)', href: 'products.html#vinegar' },
      { label: '장류', href: 'products.html#jang' },
      { label: '발효식품', href: 'products.html#ferment' },
      { label: '선물세트', href: 'products.html#gift' },
      { label: '가격 안내', href: 'products.html#price' },
      { label: '씨장 분양', href: 'products.html#seedjang' },
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

  /* ================================================================
     저장소 — 서버(D1·R2) 또는 브라우저(localStorage·IndexedDB)
     ================================================================
     Cloudflare Pages 이전 중이라 두 곳 모두에서 돌아가야 한다.
       · 서버 모드 — /api/bootstrap 이 응답하면. 데이터는 D1, 이미지는 R2.
       · 로컬 모드 — 응답이 없으면(GitHub Pages). 지금까지의 동작 그대로.
     3단계(배포 전환)에서 GitHub Pages 를 내리면 로컬 어댑터를 지운다.
     → docs/migration-cloudflare.md

     화면 코드가 바뀌지 않도록 **읽기는 동기 그대로** 둔다. 서버 모드에서는
     부팅 때 한 번 받아 온 값을 메모리(cache)에서 읽고, 쓰기만 뒤에서 보낸다.
  ---------------------------------------------------------------- */
  var SERVER = false;      // bootstrap 성공 여부 — boot() 에서 정해진다
  var cache = {};          // 서버 모드의 kach_* 값 보관

  // kach_* 키가 서버의 어느 항목에 대응하는가. 여기 없는 키는 늘 로컬이다
  // (로그인 잠금 카운터·팝업 '오늘 하루 보지 않기'는 브라우저마다 달라야 한다).
  var KEY_MAP = {
    'kach_products_v3':  'products',
    'kach_posts_v1':     'posts',
    'kach_cohorts_v1':   'cohorts',
    'kach_partners_v1':  'partners',
    'kach_popups_v1':    'popups',
    'kach_settings_v1':  'settings',
    'kach_consents_v1':  'consents',
    'kach_kms_v1':       'kms',
    'kach_texts_v1':     'texts',
    'kach_orders':       'orders',
    'kach_applications': 'applications',
    'kach_inquiries':    'inquiries',
  };
  var DOC_KINDS = { settings: 1, consents: 1, kms: 1, texts: 1 };

  /* 사진 한 장의 최대 크기. **서버(functions/api/admin/images.js)와 같은 값이어야 한다** —
     화면이 더 크게 허용하면 올린 뒤 서버가 되돌려 보내고, 화면이 더 작게 잡으면
     올릴 수 있는 것을 못 올린다. 예전에는 화면 8MB · 본문 삽입 10MB · 서버 8MB 로
     제각각이라 그 사이 파일이 조용히 실패했다. */
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  function tooBigMsg(name, size) {
    var mb = (size / 1024 / 1024).toFixed(1);
    return (name ? '「' + name + '」 ' : '') + '사진이 ' + mb + 'MB 입니다. ' +
      '한 장에 5MB 까지 올릴 수 있습니다.';
  }
  /* 목록마다 '내가 읽은 시점의 버전'. 저장할 때 되돌려주면 서버가 그 사이 누가
     바꿨는지 가려 준다. 비어 있으면(마이그레이션 전 등) 검사를 건너뛴다. */
  var versions = {};

  /* ---------- 기간창 ----------
     주문·신청·문의는 시간이 흐르며 계속 쌓인다. 전부 메모리에 올리면 관리자 화면이
     뜨는 데 걸리는 시간이 자료에 비례해 늘어난다. **기본은 최근 1년**만 올리고,
     그 이전은 운영자가 부를 때만 가져온다.

     주의 — 화면이 1년치만 들고 있는데 목록을 통째로 저장하면 그 이전 자료가 지워진다.
     그래서 저장할 때도 같은 기간을 함께 보내 서버가 지우는 범위를 묶게 한다. */
  var WINDOW_KINDS = { orders: 1, applications: 1, inquiries: 1 };
  var WINDOW_DAYS = 365;
  var windowSince = {};   // kind → ISO. 전체를 불러왔으면 null
  var olderCount = {};    // kind → 창 밖에 남아 있는 건수
  function defaultSince() {
    return new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  }
  function windowQuery(kind) {
    return windowSince[kind] ? '?since=' + encodeURIComponent(windowSince[kind]) : '';
  }
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent('site:' + name, { detail: detail })); } catch (e) {}
  }

  function api(path, opts) {
    var o = opts || {};
    o.credentials = 'same-origin';
    if (o.body && typeof o.body !== 'string' && !(o.body instanceof FormData)) {
      o.headers = o.headers || {}; o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(o.body);
    }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    });
  }

  function getJSON(k, def) {
    if (SERVER && k === VISITS_KEY)  return cache.__visits  || def;
    if (SERVER && k === SOURCES_KEY) return cache.__sources || def;
    // 서버는 '한 번도 저장한 적 없음'을 null 로 답한다. localStorage 에 키가 없을 때와
    // 같은 뜻이므로 기본값을 준다 — null 을 그대로 넘기면 호출부가 .length 에서 죽는다.
    if (SERVER && KEY_MAP[k]) return cache[k] == null ? def : cache[k];
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }

  /* 서버 모드의 쓰기는 '낙관적'이다 — 메모리를 먼저 바꿔 화면이 즉시 갱신되고,
     저장은 뒤에서 보낸다. 실패하면 알리고 서버 값으로 되돌린다.
     이렇게 해야 `if (!setProducts(a))` 처럼 동기 반환을 쓰는 기존 호출부가 그대로 돈다. */
  function setJSON(k, v) {
    if (SERVER && KEY_MAP[k]) {
      cache[k] = v;
      var kind = KEY_MAP[k];
      var body = DOC_KINDS[kind] ? { doc: v } : { items: v };
      // 내가 읽은 시점의 버전을 함께 보낸다 — 그 사이 남이 바꿨으면 서버가 막아 준다
      if (versions[kind] != null) body.version = versions[kind];
      // 기간창을 함께 보낸다 — 안 보내면 창 밖(1년 이전) 자료가 통째로 지워진다
      api('/api/admin/data/' + kind + windowQuery(kind), { method: 'PUT', body: body }).then(function (r) {
        if (r.ok) {
          if (r.data && r.data.version != null) versions[kind] = r.data.version;
          return;
        }
        if (r.status === 409) {
          /* 다른 사람이 먼저 저장했다. 그대로 밀어 넣으면 그 사람 작업이 사라진다 —
             내 변경을 버리고 서버 것을 다시 불러온다. 무엇이 어긋났는지 알려 준다. */
          toast(r.data.error || '다른 사람이 먼저 저장했습니다. 화면을 새로 불러옵니다.', 6000);
          reload(kind).then(function () { emit('data-reloaded', kind); });
          return;
        }
        toast(r.status === 401 || r.status === 403
          ? '저장 권한이 없습니다. 다시 로그인해 주세요.'
          : '저장하지 못했습니다: ' + (r.data.error || '서버 오류'));
        reload(kind);   // 화면과 서버가 어긋난 채 남지 않게 되돌린다
      }).catch(function () { toast('저장하지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
      return true;
    }
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }  // false=쿼터 초과 등 실패
  }

  /* 관리자 전용 자료(주문·신청·문의·KMS)는 공개 bootstrap 에 없다 — 고객 개인정보이기 때문.
     관리자 화면이 처음 그리기 전에 이걸로 채운다. */
  function loadAdminData() {
    if (!SERVER) return Promise.resolve(true);
    // 버전은 한 번에 받는다 — 항목마다 GET 하면 화면 뜨는 데 그만큼 더 기다린다
    api('/api/admin/versions').then(function (r) {
      if (r.ok && r.data && r.data.versions) versions = r.data.versions;
    }).catch(function () {});
    // 계속 쌓이는 것은 최근 1년만 — 나머지는 운영자가 부를 때 가져온다
    for (var wk in WINDOW_KINDS) windowSince[wk] = defaultSince();
    return Promise.all(['orders', 'applications', 'inquiries', 'kms', 'visits'].map(function (kind) {
      return api('/api/admin/data/' + kind + windowQuery(kind)).then(function (r) {
        if (!r.ok) return false;
        if (r.data.version != null) versions[kind] = r.data.version;
        if (r.data.older != null) olderCount[kind] = r.data.older;
        if (kind === 'visits') { cache.__visits = r.data.visits || {}; cache.__sources = r.data.sources || {}; return true; }
        var key = null;
        for (var k in KEY_MAP) if (KEY_MAP[k] === kind) key = k;
        if (key) cache[key] = DOC_KINDS[kind] ? r.data.doc : r.data.items;
        return true;
      }).catch(function () { return false; });
    })).then(function (oks) { return oks.every(Boolean); });
  }

  // 한 항목만 서버에서 다시 읽어 캐시를 맞춘다
  function reload(kind) {
    return api('/api/admin/data/' + kind + windowQuery(kind)).then(function (r) {
      if (!r.ok) return false;
      if (r.data.version != null) versions[kind] = r.data.version;
      if (r.data.older != null) olderCount[kind] = r.data.older;
      var key = null;
      for (var k in KEY_MAP) if (KEY_MAP[k] === kind) key = k;
      if (key) cache[key] = DOC_KINDS[kind] ? r.data.doc : r.data.items;
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- 한 건만 고치기 ----------
     목록 전체를 다시 보내지 않는다. 두 가지 이유다.
       · 주문 1,000건이면 상태 하나 바꾸는 데 약 500KB 가 오간다.
       · 화면이 최근 1년치만 들고 있으므로, 전체 교체는 **그 이전 자료를 지운다**.
     화면(메모리)은 먼저 고치고 서버에는 그 한 건만 보낸다. 실패하면 되돌린다. */
  function findList(kind) {
    for (var k in KEY_MAP) if (KEY_MAP[k] === kind) return k;
    return null;
  }
  function itemFail(kind, msg) {
    toast(msg, 5000);
    return reload(kind).then(function () { emit('data-reloaded', kind); return false; });
  }

  /** 한 건의 일부만 고친다. patch 는 바꿀 값만 담는다. */
  function patchItem(kind, id, patch) {
    if (!SERVER) {
      var key0 = findList(kind); if (!key0) return Promise.resolve(false);
      var arr0 = getJSON(key0, []);
      arr0.forEach(function (x) { if (x.id === id) for (var f in patch) x[f] = patch[f]; });
      setJSON(key0, arr0);
      return Promise.resolve(true);
    }
    var key = findList(kind);
    if (key) {
      var arr = (cache[key] || []).slice();
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) { var c = {}; for (var f2 in arr[i]) c[f2] = arr[i][f2];
          for (var f3 in patch) c[f3] = patch[f3]; arr[i] = c; break; }
      }
      cache[key] = arr;
    }
    return api('/api/admin/data/' + kind + '/' + encodeURIComponent(id), {
      method: 'PATCH', body: { patch: patch },
    }).then(function (r) {
      if (r.ok) { if (r.data && r.data.version != null) versions[kind] = r.data.version; return true; }
      if (r.status === 404) return itemFail(kind, '이미 지워졌거나 없는 항목입니다. 목록을 새로 불러옵니다.');
      return itemFail(kind, '저장하지 못했습니다: ' + ((r.data && r.data.error) || '서버 오류'));
    }).catch(function () { return itemFail(kind, '저장하지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
  }

  /** 여러 건을 같은 값으로 — 주문 일괄 처리에 쓴다. 하나가 실패하면 전체를 다시 읽는다. */
  function patchItems(kind, ids, patchOf) {
    var list = (ids || []).slice();
    if (!list.length) return Promise.resolve(true);
    return list.reduce(function (chain, id) {
      return chain.then(function (ok) {
        if (!ok) return false;
        return patchItem(kind, id, typeof patchOf === 'function' ? patchOf(id) : patchOf);
      });
    }, Promise.resolve(true));
  }

  /** 한 건을 지운다. */
  function removeItem(kind, id) {
    var key = findList(kind);
    if (!SERVER) {
      if (!key) return Promise.resolve(false);
      setJSON(key, getJSON(key, []).filter(function (x) { return x.id !== id; }));
      return Promise.resolve(true);
    }
    if (key) cache[key] = (cache[key] || []).filter(function (x) { return x.id !== id; });
    return api('/api/admin/data/' + kind + '/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (r) {
        if (r.ok) { if (r.data && r.data.version != null) versions[kind] = r.data.version; return true; }
        return itemFail(kind, '지우지 못했습니다: ' + ((r.data && r.data.error) || '서버 오류'));
      }).catch(function () { return itemFail(kind, '지우지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
  }

  /** 창 밖(1년 이전) 자료까지 불러온다. 운영자가 부를 때만 한다. */
  function loadOlder(kind) {
    if (!SERVER) return Promise.resolve(true);
    windowSince[kind] = null;                   // 창을 연다
    return reload(kind).then(function (ok) {
      if (!ok) { windowSince[kind] = defaultSince(); toast('지난 자료를 불러오지 못했습니다.'); return false; }
      olderCount[kind] = 0;
      emit('data-reloaded', kind);
      return true;
    });
  }
  function windowInfo(kind) {
    return { since: windowSince[kind] || null, older: olderCount[kind] || 0,
             windowed: !!windowSince[kind], days: WINDOW_DAYS };
  }

  /* 접수(주문·신청·문의) — 서버 모드에서는 서버가 주문번호와 금액을 정한다.
     Promise<rec> 를 돌려주므로 호출부는 결과를 기다려야 한다. */
  function submitRecord(kind, data) {
    if (SERVER) {
      return api('/api/submit', { method: 'POST', body: { kind: kind, data: data } }).then(function (r) {
        if (!r.ok) throw new Error(r.data.error || '접수하지 못했습니다.');
        var rec = {}; for (var k in data) rec[k] = data[k];
        rec.id = r.data.id; rec.orderNo = r.data.orderNo; rec.at = new Date().toISOString();
        // 금액은 서버가 정한 값으로 덮는다 — 화면이 계산한 값과 다르면 서버가 맞다
        if (r.data.total != null) rec.total = r.data.total;
        if (r.data.shipFee != null) rec.shipFee = r.data.shipFee;
        return rec;
      });
    }
    var storeKey = { order: 'kach_orders', seedjang: 'kach_orders', apply: 'kach_applications', inquiry: 'kach_inquiries' }[kind];
    return Promise.resolve(pushRecord(storeKey, data));
  }

  function pushRecord(key, rec){ var a = getJSON(key, []); rec.id = rec.id || uid(); rec.at = new Date().toISOString(); rec.status = rec.status || '신규'; a.unshift(rec); setJSON(key, a); return rec; }

  /* ---------------- IndexedDB (첨부 · 갤러리 · 상품 이미지) ---------------- */
  var dbPromise = null;
  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB unavailable')); return; }
      var r;
      try { r = indexedDB.open('kach_db', 3); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('files')) { var s = d.createObjectStore('files', { keyPath: 'id' }); s.createIndex('postId', 'postId', { unique: false }); }
        if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('pimg')) { var p = d.createObjectStore('pimg', { keyPath: 'id' }); p.createIndex('productId', 'productId', { unique: false }); }
        if (!d.objectStoreNames.contains('simg')) d.createObjectStore('simg', { keyPath: 'id' });  // 페이지 이미지 슬롯
      };
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error); };
      r.onblocked = function(){ rej(new Error('IndexedDB blocked')); };
    });
    // 사적 모드/차단 시: 이후 호출에서 안전 폴백하도록 메서드 레벨에서 catch
    return dbPromise;
  }
  // 모든 메서드는 IndexedDB 미사용(사적 모드 등) 환경에서도 거부 없이 안전한 기본값을 반환
  var idb = {
    put: function (store, rec) { return openDB().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, 'readwrite'); t.objectStore(store).put(rec); t.oncomplete = function(){ res(rec); }; t.onerror = function(){ rej(t.error); }; }); }).catch(function(){ return null; }); },
    del: function (store, id) { return openDB().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, 'readwrite'); t.objectStore(store).delete(id); t.oncomplete = function(){ res(true); }; t.onerror = function(){ rej(t.error); }; }); }).catch(function(){ return false; }); },
    all: function (store) { return openDB().then(function (d) { return new Promise(function (res) { var q = d.transaction(store).objectStore(store).getAll(); q.onsuccess = function(){ res(q.result || []); }; q.onerror = function(){ res([]); }; }); }).catch(function(){ return []; }); },
    byIndex: function (store, index, val) { return openDB().then(function (d) { return new Promise(function (res) { var q = d.transaction(store).objectStore(store).index(index).getAll(val); q.onsuccess = function(){ res(q.result || []); }; q.onerror = function(){ res([]); }; }); }).catch(function(){ return []; }); },
  };

  /* ---------------- 이미지 (Media) ----------------
     화면 코드는 blob 인지 URL 인지 알 필요가 없다 — 항상 `rec.url` 만 쓴다.
     서버 모드는 R2 주소를, 로컬 모드는 blob: 주소를 넣어 준다.
       scope  product | page | post | gallery
       ref    product → 상품 id / page → 슬롯 id / post → 게시글 id
  ------------------------------------------------- */
  var SCOPE_STORE = {
    product: { store: 'pimg', index: 'productId', refField: 'productId' },
    page:    { store: 'simg' },
    post:    { store: 'files', index: 'postId', refField: 'postId' },
    gallery: { store: 'gallery' },
  };
  function withURL(rec) {
    if (rec && rec.blob && !rec.url) { try { rec.url = URL.createObjectURL(rec.blob); } catch (e) {} }
    return rec;
  }
  var Media = {
    // 상품 목록 카드용 — bootstrap 이 실어 온 대표 이미지. 없으면 null(요청하지 않는다).
    mainOf: function (productId) {
      if (SERVER) return (cache.__mainImages || {})[productId] || null;
      return undefined;   // 로컬 모드는 알 수 없다 → 호출부가 list() 로 찾는다
    },
    list: function (scope, ref) {
      if (SERVER) {
        var q = '/api/images?scope=' + encodeURIComponent(scope) + (ref ? '&ref=' + encodeURIComponent(ref) : '');
        return api(q).then(function (r) { return (r.ok && r.data.images) || []; }).catch(function () { return []; });
      }
      var m = SCOPE_STORE[scope]; if (!m) return Promise.resolve([]);
      var p = (ref && m.index) ? idb.byIndex(m.store, m.index, ref) : idb.all(m.store);
      return p.then(function (recs) {
        // 페이지 슬롯은 스토어 하나에 전 슬롯이 들어 있어 ref 로 걸러야 한다
        if (ref && !m.index) recs = recs.filter(function (r) { return r.id === ref; });
        return recs.map(withURL);
      });
    },
    put: function (scope, ref, file, opts) {
      var o = opts || {};
      if (SERVER) {
        var fd = new FormData();
        fd.append('file', file, file.name || 'image');
        fd.append('scope', scope);
        if (ref) fd.append('ref', ref);
        if (o.role) fd.append('role', o.role);
        if (o.ord != null) fd.append('ord', String(o.ord));
        /* 실패를 전부 null 로 뭉개면 화면이 원인을 말할 수 없다.
           실제로 "브라우저 저장 공간을 확인해 주세요"가 떴는데, 서버 모드에서 사진은
           브라우저가 아니라 R2 로 간다 — 엉뚱한 곳을 보게 만드는 안내였다. */
        return api('/api/admin/images', { method: 'POST', body: fd })
          .then(function (r) {
            if (r.ok) return r.data.image;
            var reason = (r.data && r.data.error) ||
              (r.status === 413 ? '사진이 너무 큽니다.'
               : r.status === 401 || r.status === 403 ? '로그인이 풀렸습니다. 다시 로그인해 주세요.'
               : '사진을 저장하지 못했습니다.');
            return { error: reason, status: r.status };
          })
          .catch(function () { return { error: '연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', status: 0 }; });
      }
      var m = SCOPE_STORE[scope]; if (!m) return Promise.resolve(null);
      var rec = { id: scope === 'page' ? ref : (o.id || uid()), blob: file, at: new Date().toISOString() };
      if (m.refField && ref) rec[m.refField] = ref;
      if (o.role) rec.role = o.role;
      if (o.ord != null) rec.ord = o.ord;
      if (o.name) rec.name = o.name;
      if (o.size != null) rec.size = o.size;
      if (o.keep) for (var k in o.keep) if (o.keep[k] != null) rec[k] = o.keep[k];
      return idb.put(m.store, rec).then(function (r) { return withURL(r); });
    },
    del: function (scope, id) {
      if (SERVER) return api('/api/admin/images', { method: 'DELETE', body: { id: id } }).then(function (r) { return r.ok; }).catch(function () { return false; });
      var m = SCOPE_STORE[scope]; if (!m) return Promise.resolve(false);
      return idb.del(m.store, id);
    },
    delFor: function (scope, ref) {
      if (SERVER) return api('/api/admin/images', { method: 'DELETE', body: { scope: scope, ref: ref } }).then(function (r) { return r.ok; }).catch(function () { return false; });
      return Media.list(scope, ref).then(function (recs) {
        return Promise.all(recs.map(function (r) { return Media.del(scope, r.id); })).then(function () { return true; });
      });
    },
    // 페이지 슬롯의 초점 위치만 저장(사진은 그대로)
    setPos: function (rec, pos) {
      if (SERVER) {
        return api('/api/admin/images', { method: 'PATCH', body: {
          id: rec.id, pcx: pos.pcx, pcy: pos.pcy, mbx: pos.mbx, mby: pos.mby,
        } }).then(function (r) { return r.ok; }).catch(function () { return false; });
      }
      for (var k in pos) rec[k] = pos[k];
      return idb.put('simg', rec).then(function () { return true; });
    },
  };

  /* ---------------- 페이지 이미지 슬롯 (관리자 '페이지 이미지'에서 교체) ----------------
     각 페이지의 사진 자리에 data-img-slot="id"를 달아두면, 관리자에서 올린 사진
     (IndexedDB 'simg')이 자리표시/기본 사진 대신 표시됩니다. 슬롯은 세 종류로 쓰입니다:
       · .ph 컨테이너   → 사진 태그(class="slot-img")를 안에 덧대어 채웁니다.
       · 사진 태그 자체  → src 를 갈아끼웁니다(홈 3분할 카드·파트너 포스터).
       · 그 밖의 요소     → CSS 배경으로 처리(히어로: --bg-img/--bg-pc/--bg-mb 변수).
     ar 은 관리자 위치 편집기의 크롭 미리보기 비율(페이지의 ratio 클래스를 반영).
     crop:false 는 잘라내지 않고 원본 전체를 보여 주는 자리(포스터) — 위치 조정 없음. */
  var IMG_SLOTS = [
    { id: 'home-hero',           page: '홈',          label: '히어로 배경 — 장독대 전경', ar: '16/6' },
    { id: 'home-pillar-vinegar', page: '홈',          label: '3분할 카드① — 수제 발효식초', ar: '1/1' },
    { id: 'home-pillar-jang',    page: '홈',          label: '3분할 카드② — 전통 장·씨장', ar: '1/1' },
    { id: 'home-pillar-edu',     page: '홈',          label: '3분할 카드③ — 발효 교육', ar: '1/1' },
    { id: 'home-story-meju',     page: '홈',          label: '우리 이야기 — 발효된 메주', ar: '3/2' },
    { id: 'home-story-seedjang', page: '홈',          label: '우리 이야기 — 씨장 항아리', ar: '3/2' },
    { id: 'home-instructor',     page: '홈',          label: '체험지도사 강조 — 교육 현장', ar: '4/3' },
    { id: 'about-ceo',           page: '협동조합 소개', label: '대표 인사말 — 대표 사진', ar: '5/6' },
    { id: 'about-fair',          page: '협동조합 소개', label: '조합 활동 — 박람회·현장', ar: '16/9' },
    { id: 'about-partner',       page: '협동조합 소개', label: '파트너 — 정선만장대 포스터', crop: false },
    { id: 'ferments-meju',       page: '전통발효식품', label: '전통 발효란 — 발효된 메주', ar: '4/3' },
    { id: 'ferments-seedjang',   page: '전통발효식품', label: '씨장 이야기 — 씨장 항아리', ar: '4/3' },
    { id: 'vinegar-hero',        page: '식초',        label: '히어로 배경 — 식초 대표 이미지', ar: '16/6' },
    { id: 'vinegar-craft',       page: '식초',        label: '만드는 과정 — 작업 현장', ar: '4/3' },
    { id: 'inst-class-jang',     page: '체험지도사',   label: '수업 구분 — 장류반 수업', ar: '3/2' },
    { id: 'inst-class-vinegar',  page: '체험지도사',   label: '수업 구분 — 식초류반 수업', ar: '3/2' },
    { id: 'inst-field',          page: '체험지도사',   label: '지도사란 — 강의·실습 현장', ar: '4/3' },
    { id: 'inst-oneday',         page: '체험지도사',   label: '원데이 수업 — 와인·식초 실습', ar: '4/3' },
    { id: 'nuruk-intro',         page: '누룩이야기',   label: '누룩이란 — 누룩 사진', ar: '4/3' },
    { id: 'nuruk-rice',          page: '누룩이야기',   label: '쌀누룩 만들기', ar: '3/2' },
    { id: 'nuruk-yogurt',        page: '누룩이야기',   label: '요거트 만들기', ar: '3/2' },
    { id: 'nuruk-gochujang',     page: '누룩이야기',   label: '저염 고추장 만들기', ar: '3/2' },
    { id: 'nuruk-makjang',       page: '누룩이야기',   label: '저염 막장 만들기', ar: '3/2' },
    { id: 'nuruk-ganjang',       page: '누룩이야기',   label: '저염 간장·소금 만들기', ar: '3/2' },
    { id: 'prod-vinegar-line',   page: '제품',        label: '식초·와인 — 라인업 전경', ar: '16/9' },
    { id: 'prod-seedjang',       page: '제품',        label: '씨장 분양 — 장독대', ar: '4/3' },
  ];
  // 슬롯 레코드의 저장된 위치를 object-position/background-position 문자열로 — 없으면 가운데, 모바일은 PC 상속
  function slotPos(rec) {
    var pcx = rec.pcx != null ? rec.pcx : 50, pcy = rec.pcy != null ? rec.pcy : 50;
    var mbx = rec.mbx != null ? rec.mbx : pcx, mby = rec.mby != null ? rec.mby : pcy;
    return { pc: pcx + '% ' + pcy + '%', mb: mbx + '% ' + mby + '%' };
  }
  // 한 슬롯 요소에 올린 사진(url)과 위치를 적용 — 요소 종류(img/.ph/배경)에 맞게
  function applySlot(el, url, pos) {
    if (el.tagName === 'IMG') {
      el.src = url;
      el.style.setProperty('--op-pc', pos.pc);
      el.style.setProperty('--op-mb', pos.mb);
    } else if (el.classList.contains('ph')) {
      var img = el.querySelector('.slot-img');
      if (!img) {
        img = document.createElement('img');
        img.className = 'slot-img';
        img.alt = el.getAttribute('data-label') || '';
        el.appendChild(img);
        el.classList.add('has-img');
      }
      img.src = url;
      img.style.setProperty('--op-pc', pos.pc);
      img.style.setProperty('--op-mb', pos.mb);
    } else {
      el.style.setProperty('--bg-img', 'url("' + url + '")');
      el.style.setProperty('--bg-pc', pos.pc);
      el.style.setProperty('--bg-mb', pos.mb);
    }
  }
  function renderSlotImages() {
    var slots = document.querySelectorAll('[data-img-slot]');
    if (!slots.length) return;
    // 서버 모드에서는 bootstrap 이 이미 실어 왔다 — 사진 때문에 요청을 한 번 더 하지 않는다
    var p = (SERVER && cache.__pageImages) ? Promise.resolve(cache.__pageImages) : Media.list('page');
    p.then(function (recs) {
      var map = {};
      recs.forEach(function (r) { map[r.id] = r; });
      slots.forEach(function (el) {
        var rec = map[el.getAttribute('data-img-slot')];
        if (!rec || !rec.url) return;
        applySlot(el, rec.url, slotPos(rec));
      });
    });
  }

  /* ---------------- 방문 통계 (대시보드용) ---------------- */
  var VISITS_KEY = 'kach_visits_v1';
  var SOURCES_KEY = 'kach_sources_v1';
  // 유입 경로 분류 — 이전 페이지(referrer) 도메인 기준
  function classifySource(ref) {
    if (!ref) return '직접 방문';
    try {
      var self = location.hostname.replace(/^www\./, '').toLowerCase();
      var h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
      if (h === self) return '직접 방문';
      if (/google|naver|daum|bing|yahoo|duckduckgo|kagi|baidu|zum|nate|search/.test(h)) return '검색엔진';
      if (/facebook|instagram|youtube|youtu\.be|twitter|t\.co|x\.com|kakao|band\.us|tistory|blog|threads|linkedin|pinterest/.test(h)) return '소셜·블로그';
      return '기타 사이트';
    } catch (e) { return '기타 사이트'; }
  }
  /* 사람이 아닌 접속 — 방문자 수에 넣지 않는다.
     검증 스크립트(Playwright·Puppeteer)는 navigator.webdriver 가 켜져 있고,
     검색엔진 크롤러는 UA 로 자기를 밝힌다. 이것들을 세면 운영자가 보는 숫자가
     실제 손님과 무관해진다 — 실제로 하루 방문자가 검증 때문에 399까지 올라갔다. */
  var BOT_UA = /bot|crawl|spider|slurp|headless|playwright|puppeteer|lighthouse|pingdom|monitor|preview|facebookexternalhit|kakaotalk-scrap|yeti|daumoa/i;
  function isAutomated() {
    try {
      if (navigator.webdriver) return true;
      if (BOT_UA.test(navigator.userAgent || '')) return true;
    } catch (e) {}
    return false;
  }

  function trackVisit() {
    if (currentPage() === 'admin') return;
    if (isAutomated()) return;
    try {
      var d = todayStr();
      var isNew = sessionStorage.getItem('kach_uv_' + d) !== '1';
      if (isNew) sessionStorage.setItem('kach_uv_' + d, '1');
      var cat = classifySource(document.referrer || '');

      if (SERVER) {
        // 집계는 실패해도 화면에 영향이 없어야 한다 — 응답을 기다리지 않는다
        api('/api/visit', { method: 'POST', body: { newVisitor: isNew, source: cat } }).catch(function () {});
        return;
      }
      var v = getJSON(VISITS_KEY, {});
      if (!v[d]) v[d] = { pv: 0, uv: 0 };
      v[d].pv += 1;
      if (isNew) {
        v[d].uv += 1;
        var src = getJSON(SOURCES_KEY, {});
        src[cat] = (src[cat] || 0) + 1;
        setJSON(SOURCES_KEY, src);
      }
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

  // 잠금 카운트다운 타이머 — 모달 닫힐 때 정리(누적 방지)
  var loginTimer = null;
  function clearLoginTimer(){ if (loginTimer) { clearTimeout(loginTimer); loginTimer = null; } }

  /* 관리 기능 게이팅.
     서버 모드 — 세션이 있으면 그대로 통과, 없으면 로그인 페이지로 보낸다.
       (여기서 아이디·비밀번호를 받지 않는 이유: 인증 판단은 서버 한 곳에서만 해야 한다.)
     로컬 모드 — 지금까지처럼 호출 시마다 확인 모달을 띄운다. */
  function requireAdmin(cb) {
    if (SERVER) {
      api('/api/admin/session').then(function (r) {
        if (r.ok && r.data.authenticated) { cb(); return; }
        location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      }).catch(function () { toast('인증을 확인할 수 없습니다. 인터넷 연결을 확인해 주세요.'); });
      return;
    }
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
    function refreshLock() {
      var ms = lockMs();
      if (ms > 0) {
        btn.disabled = true; err.className = 'login-msg err';
        err.textContent = '로그인 시도가 많아 잠시 잠겼습니다. ' + Math.ceil(ms / 1000) + '초 후 다시 시도하세요.';
        loginTimer = setTimeout(refreshLock, 1000);
      } else { btn.disabled = false; clearLoginTimer(); }
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
  function setPartners(arr){ return setJSON(PARTNER_KEY, arr); }

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
  /* 예전에 심어 둔 예시 데이터 청소 (로컬 모드 전용).
     실데이터로 운영하기로 하면서 씨앗 데이터를 코드에서 없앴는데, 이미 한 번 접속했던
     브라우저에는 그때 심어진 예시 글·주문이 남아 있다. 그것까지 지운다.
     지우는 대상은 코드가 만든 것뿐이다 — 사람이 쓴 글(sample 표시 없음)은 건드리지 않는다. */
  // 관리자 콘솔이 심던 예시 주문의 주문번호. 이 값과 정확히 일치하는 것만 지운다 —
  // '오래된 주문'처럼 어림짐작으로 지우면 실제 주문을 날릴 수 있다.
  var DEMO_ORDER_NOS = ['2026030912341', '2026030787720', '2026030554102',
                        '2026030248873', '2026022633019', '2026030411208'];
  function dropDemoData() {
    try {
      // 브라우저에 남은 씨앗 데이터를 지우는 일이다. 서버 자료에는 씨앗이 없고,
      // 여기서 목록을 통째로 저장하면 화면이 들고 있지 않은 1년 이전 자료가 걸린다
      // (기간창으로 막혀 있지만 애초에 할 이유가 없는 쓰기다).
      if (SERVER) return;
      if (localStorage.getItem('kach_demo_cleared') === '1') return;

      var posts = getJSON(POSTS_KEY, []);
      if (posts.length) setJSON(POSTS_KEY, posts.filter(function (p) { return !p.sample; }));

      var orders = getJSON('kach_orders', []);
      if (orders.length) setJSON('kach_orders', orders.filter(function (o) {
        return DEMO_ORDER_NOS.indexOf(String(o.orderNo)) === -1;
      }));

      // 신청·문의는 씨앗의 접수시각이 고정값이라 그것으로 집는다
      var apps = getJSON('kach_applications', []);
      if (apps.length) setJSON('kach_applications', apps.filter(function (r) {
        return !(r.name === '박발효' && r.at === '2026-03-01T09:05:00');
      }));
      var inq = getJSON('kach_inquiries', []);
      if (inq.length) setJSON('kach_inquiries', inq.filter(function (r) {
        return !(r.name === '정문의' && r.at === '2026-02-28T11:20:00');
      }));

      var pops = getJSON('kach_popups_v1', []);
      if (pops && pops.length) setJSON('kach_popups_v1', pops.filter(function (p) {
        return String(p.title || '').indexOf('[샘플]') !== 0;
      }));

      localStorage.setItem('kach_demo_cleared', '1');
    } catch (e) {}
  }

  function getPosts(){ return getJSON(POSTS_KEY, []); }
  function setPosts(a){ return setJSON(POSTS_KEY, a); }

  function renderNewsPreview() {
    var box = document.getElementById('news-rows');
    if (!box) return;
    var posts = getPosts().slice().sort(function(a, b){ return (b.at || '').localeCompare(a.at || ''); }).slice(0, 3);
    box.innerHTML = posts.length ? posts.map(function (p) {
      var anchor = p.cat === '교육' ? '#edu' : '#notice';
      return '<a class="news-row" href="news.html' + anchor + '">' +
        '<span class="tag' + (p.important ? ' point' : '') + '">' + esc(p.badge || p.cat) + '</span>' +
        '<span class="nr-title">' + esc(p.title) + '</span>' +
        '<span class="nr-date">' + fmtYMD(p.at) + '</span></a>';
    }).join('') : '<div class="partners-empty">등록된 소식이 없습니다.</div>';
  }

  /* ---------------- 상품 (목록 · 상세 · 관리자 등록) ---------------- */
  /* v3: 서연 식초·와인 라인업 도입으로 기본 카탈로그가 전면 교체됨 (v2 데이터는 갱신 대상) */
  var PRODUCTS_KEY = 'kach_products_v3';
  /* 택배비 — 값의 원본은 **관리자 > 설정**(shipFee · shipFreeOver)이다.
     상수로 두면 설정을 고쳐도 화면이 따라오지 않는다(설정은 부팅이 끝난 뒤에 들어온다)
     → 그릴 때마다 함수로 읽는다.
     상품별 '배송안내' 글에는 금액을 넣지 않는다. 넣으면 설정을 고쳐도 이미 저장된
     상품들의 글에 옛 금액이 남아, 같은 화면에 두 금액이 동시에 보인다.
     **금액은 언제나 이 함수들이 만들고, 최종 입금액은 서버가 다시 계산한다.** */
  function shipFee() { var v = Number(getSettings().shipFee); return isFinite(v) && v >= 0 ? v : 5000; }
  function shipFreeOver() { var v = Number(getSettings().shipFreeOver); return isFinite(v) && v > 0 ? v : 50000; }
  function shipFeeFor(itemsTotal) { return Number(itemsTotal) >= shipFreeOver() ? 0 : shipFee(); }
  // 무료 기준은 '50,000원'보다 '5만원'이 읽기 쉽다 — 만원으로 떨어질 때만 그렇게 쓴다
  function shipFreeTxt() { var o = shipFreeOver(); return o % 10000 === 0 ? (o / 10000) + '만원' : fmtWon(o) + '원'; }
  function shipNote() { return '택배비 ' + fmtWon(shipFee()) + '원 별도 · ' + shipFreeTxt() + ' 이상 구매 시 무료'; }
  // 상품 상세 '배송안내' 첫 줄 — 나머지 안내(배송 방법·출고·주의)는 상품마다 따로 쓴다
  function shipFeeLine() { return '· 배송비: ' + fmtWon(shipFee()) + '원 (' + shipFreeTxt() + ' 이상 구매 시 무료)'; }
  var SHIP_TPL = '· 배송 방법: 택배 (CJ대한통운)\n· 출고: 결제(입금) 확인 후 2~3 영업일 이내\n· 제주 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.\n· 발효식품 특성상 기온이 높은 시기에는 아이스팩 포장으로 출고됩니다.';
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
  /* 상품 분류 — 목록 페이지 앵커와 관리자 등록 폼이 함께 참조하는 단일 정의 */
  var PRODUCT_CATS = [
    { name: '장류', gridId: 'grid-jang' },
    { name: '식초 · 와인', gridId: 'grid-vinegar' },
    { name: '발효식품', gridId: 'grid-ferment' },
    { name: '선물세트', gridId: 'grid-gift' },
  ];

  /* 서연(瑞蓮) 수제식초 — 용량 옵션과 고시 항목이 전 품목 동일하므로 한 곳에서 만든다.
     가격 근거: 조합 가격표(300ml 25,000 / 500ml 35,000) */
  var VINEGAR_ACID = '총산 4.7%(기준 4.00~20.00) — 강원특별자치도보건환경연구원 시험·검사 적합 (2025.04.30)';
  function vinegarProduct(o) {
    return {
      id: o.id, name: o.name, cat: '식초 · 와인', price: 25000, salePrice: null, unit: '300ml',
      status: '판매중', stock: o.stock == null ? 20 : o.stock, photo: o.photo,
      option: { name: '용량', values: [ { label: '300ml (소)', add: 0, stock: 20 }, { label: '500ml (대)', add: 10000, stock: 20 } ] },
      summary: o.summary, icon: 'wine', tone: 'tone-point',
      descHtml: '<h3>' + o.name + '</h3><p>' + o.body + '</p>' +
        '<h3>이렇게 만듭니다</h3><p>과일을 설탕과 섞어 청을 담아 3개월 숙성하고, 숙성한 청을 물과 섞어 16브릭스를 맞춥니다. 여기에 이스트를 넣어 25~30℃ 발효실에서 2~3주 발효시키면 와인이 됩니다. 이 와인을 6브릭스로 맞춘 뒤 초산균(종초)을 섞어 33℃에서 3주 정도 두면 초막이 끼면서 식초가 됩니다.</p>' +
        '<h3>이렇게 드세요</h3><p>식초는 신맛이 강하므로 물이나 다른 음료에 희석해 드십시오. 식초 50㎖(소주잔 한 컵)에 물 6배를 희석하면 적당합니다. 단기간 많이 드시기보다 <b>꾸준히</b> 드시는 것이 효과적이며, 섭취 후에는 물을 충분히 마셔 주세요.</p>',
      gosi: gosiBase({ pname: o.name, volume: '300ml / 500ml', ingredients: o.ingredients,
        maker: '한국참전통발효식품협동조합 (제조: 정선다문화가정영농조합법인)',
        origin: '국산', expiry: '제조일로부터 2년 (제품 별도 표기)',
        storage: '직사광선을 피해 서늘한 곳에 보관, 개봉 후 냉장 보관' }),
      ship: SHIP_TPL, refund: REFUND_TPL, related: o.related || [],
    };
  }

  var PRODUCT_DEFAULTS = [
    /* ---- 식초 · 와인 (서연 瑞蓮) ---- */
    vinegarProduct({ id: 'p_vin_omija', name: '오미자 식초', photo: 'assets/product-vinegar-omija.jpg',
      summary: '다섯 가지 맛이 어우러진 오미자를 발효시킨 붉은빛 수제 식초.',
      body: '오미자 청을 담가 숙성한 뒤 와인 단계를 거쳐 초산 발효시킨 식초입니다. 오미자 특유의 새콤하고 은은한 향이 남아 물에 희석해 마시기 좋습니다.',
      ingredients: '오미자, 정제수, 설탕, 초산균', related: ['p_vin_grape', 'p_vin_citrus', 'p_set_vinegar'] }),
    vinegarProduct({ id: 'p_vin_grape', name: '포도 식초', photo: 'assets/product-vinegar-grape.jpg',
      summary: '잘 익은 포도를 와인으로 빚어 다시 초산 발효시킨 수제 식초.',
      body: '포도를 청으로 담가 와인으로 발효시킨 뒤, 초산균을 더해 3주간 다시 발효시킨 식초입니다. 부드러운 산미와 포도 향이 특징입니다.',
      ingredients: '포도, 정제수, 설탕, 초산균', related: ['p_vin_omija', 'p_wine_grape', 'p_set_vinegar'] }),
    vinegarProduct({ id: 'p_vin_citrus', name: '감귤 식초', photo: 'assets/product-vinegar-citrus.jpg',
      summary: '제철 감귤의 향을 그대로 담은 밝은 빛깔의 수제 식초.',
      body: '감귤을 청으로 담가 숙성시킨 뒤 발효시킨 식초입니다. 상큼한 향이 살아 있어 음료나 드레싱으로 두루 어울립니다.',
      ingredients: '감귤, 정제수, 설탕, 초산균', related: ['p_vin_plum', 'p_vin_omija', 'p_set_vinegar'] }),
    vinegarProduct({ id: 'p_vin_plum', name: '매실 식초', photo: 'assets/product-vinegar-plum.jpg',
      summary: '초여름 매실로 담근 청을 발효시킨 깔끔한 산미의 수제 식초.',
      body: '매실 청을 충분히 숙성시켜 발효시킨 식초입니다. 군더더기 없는 산미로 여름철 희석 음료에 잘 맞습니다.',
      ingredients: '매실, 정제수, 설탕, 초산균', related: ['p_vin_citrus', 'p_vin_watermelon', 'p_set_vinegar'] }),
    vinegarProduct({ id: 'p_vin_watermelon', name: '수박 식초', photo: 'assets/product-vinegar-watermelon.jpg',
      summary: '여름 수박을 발효시킨 연한 빛깔의 순한 수제 식초.',
      body: '수박 과육으로 청을 담가 발효시킨 식초입니다. 산미가 순해 식초를 처음 접하는 분께 권합니다.',
      ingredients: '수박, 정제수, 설탕, 초산균', related: ['p_vin_plum', 'p_vin_omija', 'p_set_vinegar'] }),
    { id: 'p_wine_grape', name: '수제 포도 와인', cat: '식초 · 와인', price: 35000, salePrice: null, unit: '370ml',
      status: '판매중', stock: 15, option: null, photo: 'assets/product-wine-grape.jpg',
      summary: '전통 발효 기법으로 빚은 수제 포도 와인. 낱개 상자 포장.', icon: 'wine', tone: 'tone-point',
      descHtml: '<h3>과일을 그대로 발효시킨 수제 와인</h3><p>포도를 설탕과 섞어 청으로 담가 3개월 숙성한 뒤, 16브릭스로 맞추고 이스트를 넣어 25~30℃ 발효실에서 2~3주 발효시켜 빚은 수제 와인입니다.</p><p>같은 방식으로 담근 와인이 식초의 원료가 되기도 합니다.</p>',
      gosi: gosiBase({ pname: '수제 포도 와인 370ml', volume: '370ml', ingredients: '포도, 설탕, 정제수, 효모',
        maker: '한국참전통발효식품협동조합 (제조: 정선다문화가정영농조합법인)', origin: '국산',
        storage: '직사광선을 피해 서늘한 곳에 보관, 개봉 후 냉장 보관' }),
      ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_wine_pineapple', 'p_vin_grape'] },
    { id: 'p_wine_pineapple', name: '수제 파인애플 와인', cat: '식초 · 와인', price: 35000, salePrice: null, unit: '370ml',
      status: '판매중', stock: 12, option: null, photo: 'assets/product-wine-pineapple.jpg',
      summary: '파인애플의 향을 살려 발효시킨 맑은 빛깔의 수제 와인.', icon: 'wine', tone: 'tone-point',
      descHtml: '<h3>열대 과일의 향을 담은 수제 와인</h3><p>파인애플로 청을 담가 숙성시킨 뒤 효모로 발효시킨 수제 와인입니다. 향이 뚜렷해 선물용으로도 많이 찾으십니다.</p>',
      gosi: gosiBase({ pname: '수제 파인애플 와인 370ml', volume: '370ml', ingredients: '파인애플, 설탕, 정제수, 효모',
        maker: '한국참전통발효식품협동조합 (제조: 정선다문화가정영농조합법인)', origin: '국산',
        storage: '직사광선을 피해 서늘한 곳에 보관, 개봉 후 냉장 보관' }),
      ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_wine_grape', 'p_vin_citrus'] },

    /* ---- 장류 ---- */
    { priceOnRequest: true, id: 'p_doenjang', name: '전통 된장', cat: '장류', price: 25000, salePrice: null, unit: '1kg', status: '판매중', stock: 50, option: null,
      summary: '깊고 구수한 전통의 맛. 국산 콩 100%를 전통 씨장 방식으로 3년 이상 숙성했습니다.', icon: 'bean', tone: 'tone-oat',
      descHtml: '<h3>3년의 시간이 빚은 깊은 맛</h3><p>청정 정선의 장독대에서 자연의 속도로 익힌 전통 된장입니다. 국산 콩과 천일염만으로 담그고, 대를 이어온 씨장을 더해 깊은 풍미를 냅니다.</p><p>찌개·국은 물론 쌈장 베이스로도 좋습니다.</p>',
      gosi: gosiBase({ pname: '전통 된장 1kg', volume: '1kg', ingredients: '국산 콩 100%, 천일염, 씨장' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_gochujang', 'p_makjang', 'p_set3'] },
    { priceOnRequest: true, id: 'p_gochujang', name: '태양초 고추장', cat: '장류', price: 28000, salePrice: null, unit: '1kg', status: '판매중', stock: 40, option: null,
      summary: '매콤하고 감칠맛 가득. 햇볕에 말린 국산 태양초 고춧가루로 담갔습니다.', icon: 'flame', tone: 'tone-point',
      descHtml: '<h3>태양초의 매운맛, 발효의 단맛</h3><p>국산 태양초 고춧가루와 찹쌀, 전통 메주가루로 담가 장기 숙성한 고추장입니다. 인공 감미료 없이 발효가 만든 자연스러운 단맛이 특징입니다.</p>',
      gosi: gosiBase({ pname: '태양초 고추장 1kg', volume: '1kg', ingredients: '국산 고춧가루, 찹쌀, 메주가루, 천일염, 조청' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_makjang', 'p_set3'] },
    { priceOnRequest: true, id: 'p_makjang', name: '정선 막장', cat: '장류', price: 22000, salePrice: null, unit: '1kg', status: '판매중', stock: 45, option: null,
      summary: '구수하고 깊은 감칠맛. 강원도 전통 방식 그대로의 막장입니다.', icon: 'wheat', tone: 'tone-main',
      descHtml: '<h3>강원도 밥상의 비밀, 막장</h3><p>콩과 보리를 함께 띄워 담그는 강원도 전통 막장입니다. 된장보다 부드럽고 단맛이 돌아 쌈장·찌개에 두루 어울립니다.</p>',
      gosi: gosiBase({ pname: '정선 막장 1kg', volume: '1kg', ingredients: '국산 콩, 보리, 고춧가루, 천일염' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_gochujang', 'p_set3'] },
    { priceOnRequest: true, id: 'p_cheongguk', name: '전통 청국장', cat: '발효식품', price: 12000, salePrice: null, unit: '500g', status: '판매중', stock: 60, option: null,
      summary: '진하고 구수한 자연 발효 청국장. 국산 콩 100%.', icon: 'soup', tone: 'tone-deep',
      descHtml: '<h3>이틀의 기다림, 진한 구수함</h3><p>국산 콩을 삶아 볏짚으로 자연 발효시킨 전통 청국장입니다. 냉동 보관 후 끓이기만 하면 진한 청국장찌개가 완성됩니다.</p>',
      gosi: gosiBase({ pname: '전통 청국장 500g', volume: '500g', ingredients: '국산 콩 100%', storage: '냉동 보관 (-18℃ 이하)', expiry: '제조일로부터 6개월 (냉동 기준, 별도 표기)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_jangajji'] },
    { priceOnRequest: true, id: 'p_jangajji', name: '제철 장아찌', cat: '발효식품', price: 15000, salePrice: null, unit: '500g', status: '판매중', stock: 30, option: null,
      summary: '전통 장으로 담근 짭조름한 밑반찬. 제철 채소로 담급니다.', icon: 'salad', tone: 'tone-oat',
      descHtml: '<h3>장이 익으면 반찬이 됩니다</h3><p>제철 채소를 3년 숙성 전통 장에 섞어 담근 장아찌입니다. 시기에 따라 구성 채소가 달라집니다.</p>',
      gosi: gosiBase({ pname: '제철 장아찌 500g', volume: '500g', ingredients: '제철 채소(깻잎·고추·무 등), 전통 간장·된장, 천일염', storage: '냉장 보관 (0~10℃)', expiry: '제조일로부터 6개월 (냉장 기준, 별도 표기)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_cheongguk', 'p_meju'] },
    { priceOnRequest: true, id: 'p_meju', name: '전통 메주', cat: '발효식품', price: 18000, salePrice: null, unit: '1개', status: '판매중', stock: 25,
      option: { name: '구성', values: [ { label: '1개', add: 0, stock: 25 }, { label: '3개 묶음 (5% 할인)', add: 33300, stock: 10 } ] },
      summary: '직접 장을 담그실 분들을 위한 자연 건조 메주.', icon: 'package', tone: 'tone-main',
      descHtml: '<h3>장 담그기의 시작</h3><p>국산 콩을 삶아 빚고 자연 바람에 말려 띄운 전통 메주입니다. 장 담그기 시기(정월)에 맞춰 예약 주문을 권장합니다.</p>',
      gosi: gosiBase({ pname: '전통 메주', volume: '약 1.5kg/개', ingredients: '국산 콩 100%', storage: '통풍이 잘 되는 서늘한 곳' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_doenjang', 'p_jangajji'] },
    /* 가격은 운영 DB(관리자가 정한 값)를 따라 50,000원. 기본값은 새로 깔 때와 옛 GitHub Pages 가
       쓰는 값이라, 여기가 어긋나 있으면 같은 상품이 주소마다 다른 값으로 보인다. */
    { id: 'p_set_vinegar', name: '서연 수제식초 선물상자 (2본)', cat: '선물세트', price: 50000, salePrice: null, unit: '세트',
      status: '판매중', stock: 25, option: null, photo: 'assets/product-giftbox.jpg',
      summary: '수제식초 2본을 담은 선물상자. 명절·집들이 선물로 가장 많이 찾는 구성입니다.', icon: 'gift', tone: 'tone-point',
      descHtml: '<h3>“식초는 신이 내린 선물, 자연이 준 기적의 물”</h3><p>서연(瑞蓮) 수제식초 2본(500ml·300ml)을 전용 선물상자에 담았습니다. 사과·포도·오미자·감귤·매실·수박 중 원하시는 종류로 구성해 드립니다.</p><p>구성 변경은 주문 시 요청사항에 남겨 주시거나 02-855-8806으로 문의해 주세요.</p>',
      gosi: gosiBase({ pname: '서연 수제식초 선물상자 (500ml + 300ml)', volume: '500ml + 300ml', ingredients: '과일(사과·포도·오미자·감귤·매실·수박 중 택), 정제수, 설탕, 초산균',
        maker: '한국참전통발효식품협동조합 (제조: 정선다문화가정영농조합법인)', origin: '국산', expiry: '제조일로부터 2년 (제품 별도 표기)' }),
      ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_vin_omija', 'p_wine_grape', 'p_set3'] },
    { priceOnRequest: true, id: 'p_set3', name: '명절 장(醬) 3종 세트', cat: '선물세트', price: 45000, salePrice: 42000, unit: '세트', status: '판매중', stock: 30,
      option: { name: '포장', values: [ { label: '전통 보자기 포장', add: 0, stock: 20 }, { label: '고급 한지 상자 포장', add: 5000, stock: 10 } ] },
      summary: '된장·고추장·막장 각 500g 정성 구성. 명절 선물로 가장 사랑받는 세트입니다.', icon: 'gift', tone: 'tone-point',
      descHtml: '<h3>마음을 담은 전통의 선물</h3><p>대표 장류 3종(된장·고추장·막장 각 500g)을 한 상자에 담았습니다. 전통 보자기 또는 고급 한지 상자 포장을 선택할 수 있습니다.</p>',
      gosi: gosiBase({ pname: '명절 장 3종 세트 (된장·고추장·막장 각 500g)', volume: '500g × 3', ingredients: '된장(국산 콩, 천일염), 고추장(국산 고춧가루, 찹쌀, 메주가루), 막장(국산 콩, 보리)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_setprem', 'p_doenjang'] },
    { priceOnRequest: true, id: 'p_setprem', name: '프리미엄 발효 선물세트', cat: '선물세트', price: 59000, salePrice: null, unit: '세트', status: '품절', stock: 0, option: null,
      summary: '장류 3종과 청국장을 한 상자에. 고급 한지 포장.', icon: 'gift', tone: 'tone-deep',
      descHtml: '<h3>발효의 정수를 한 상자에</h3><p>장 3종에 청국장을 더한 프리미엄 구성입니다. 고급 한지 상자에 담아 격식 있는 선물로 좋습니다.</p>',
      gosi: gosiBase({ pname: '프리미엄 발효 선물세트', volume: '500g × 4', ingredients: '된장·고추장·막장·청국장 (국산 콩, 고춧가루, 보리 등)' }), ship: SHIP_TPL, refund: REFUND_TPL, related: ['p_set3'] },
  ];
  function seedProducts(){ if (!localStorage.getItem(PRODUCTS_KEY)) setJSON(PRODUCTS_KEY, PRODUCT_DEFAULTS); }
  function getProducts(){ return getJSON(PRODUCTS_KEY, []); }
  function setProducts(a){ return setJSON(PRODUCTS_KEY, a); }
  function getProduct(id){ var a = getProducts(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

  /* 남은 수량 · 품절 — 목록 카드 · 상세 · 구매 버튼 · 옵션 칸이 **한 규칙**을 써야 한다.
     서버 모드에서는 bootstrap 이 '창고 수량 − 아직 발송하지 않은 주문'을 따로 내려준다
     (__stockLeft). 상품의 stock 은 창고 수량 그대로다 — 관리자 화면도 같은 값을 읽으므로,
     줄어든 값을 상품에 심어 두면 상품을 저장할 때 창고 수량이 깎이고 발송할 때 또 깎인다. */
  function stockLeft(p, optionLabel) {
    if (!p) return 0;
    var key = p.id + '|' + (optionLabel || '');
    var m = cache.__stockLeft;
    if (m && m[key] != null) return Number(m[key]) || 0;
    // 로컬 모드 — 서버 집계가 없으니 창고 수량을 그대로 본다
    if (optionLabel && p.option && p.option.values) {
      var label = String(optionLabel).split(':').slice(1).join(':').trim();
      var hit = p.option.values.filter(function (v) { return String(v.label).trim() === label; })[0];
      return hit ? (Number(hit.stock) || 0) : 0;
    }
    return Number(p.stock) || 0;
  }
  function stockTotal(p) {
    var opt = p && p.option;
    if (opt && opt.values && opt.values.length) {
      return opt.values.reduce(function (s, v) { return s + stockLeft(p, opt.name + ': ' + v.label); }, 0);
    }
    return stockLeft(p, '');
  }
  function isSoldOut(p) {
    if (!p) return true;
    if (p.status === '품절') return true;
    if (p.priceOnRequest) return false;   // 전화로 안내하는 품목은 재고로 막지 않는다
    return stockTotal(p) <= 0;
  }
  /** 옵션까지 반영한 한 개 값. 서버(resolveItem)와 같은 규칙이어야 한다. */
  function unitPriceOf(p, optionLabel) {
    if (!p || p.priceOnRequest) return 0;
    var base = (p.salePrice != null && p.salePrice !== '') ? Number(p.salePrice) : Number(p.price);
    if (optionLabel && p.option && p.option.values) {
      var label = String(optionLabel).split(':').slice(1).join(':').trim();
      var hit = p.option.values.filter(function (v) { return String(v.label).trim() === label; })[0];
      if (hit) base += Number(hit.add) || 0;
    }
    return Number(base) || 0;
  }

  /* ---------------- 장바구니 ----------------
     브라우저에만 둔다. 로그인하지 않고도 담을 수 있어야 하고, 담아 둔 것이
     서버에 개인정보로 쌓일 이유도 없다.
     **금액과 이름은 담을 때가 아니라 그릴 때 상품에서 다시 읽는다** —
     값을 함께 저장해 두면 관리자가 가격을 고친 뒤에도 옛 금액이 남아 주문된다.
     담긴 줄은 '무엇을 몇 개'만 기억한다. */
  var CART_KEY = 'kach_cart_v1';
  function cartRaw() {
    var a = getJSON(CART_KEY, []);
    return Array.isArray(a) ? a.filter(function (x) { return x && x.productId; }) : [];
  }
  function cartSave(a) { var ok = setJSON(CART_KEY, a); paintCartBadge(); return ok; }
  function cartCount() {
    return cartRaw().reduce(function (n, x) { return n + (Number(x.qty) || 1); }, 0);
  }
  function cartAdd(productId, optionLabel, qty) {
    var a = cartRaw();
    var opt = optionLabel || null;
    var n = Math.max(1, Math.floor(Number(qty) || 1));
    var hit = a.filter(function (x) { return x.productId === productId && (x.optionLabel || null) === opt; })[0];
    if (hit) hit.qty = Math.min(999, (Number(hit.qty) || 1) + n);
    else a.push({ productId: productId, optionLabel: opt, qty: n });
    return cartSave(a);
  }
  function cartSetQty(i, qty) {
    var a = cartRaw(); if (!a[i]) return false;
    a[i].qty = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)));
    return cartSave(a);
  }
  function cartRemove(i) { var a = cartRaw(); a.splice(i, 1); return cartSave(a); }
  function cartClear() { return cartSave([]); }

  /** 담긴 줄에 지금 상품 정보를 붙인다. 없어졌거나 살 수 없는 줄은 ok:false 로 표시한다. */
  function cartLines() {
    return cartRaw().map(function (c, i) {
      var p = getProduct(c.productId);
      var unit = unitPriceOf(p, c.optionLabel);
      var left = p ? stockLeft(p, c.optionLabel || '') : 0;
      var gone = !p || p.status === '숨김';
      var soldout = !gone && (p.status === '품절' || left <= 0);
      return {
        i: i, productId: c.productId, optionLabel: c.optionLabel || null, qty: Number(c.qty) || 1,
        name: p ? p.name : '(판매 종료된 상품)',
        unitPrice: unit, left: left,
        ok: !gone && !soldout && !(p && p.priceOnRequest) && unit > 0,
        why: gone ? '판매 종료' : (soldout ? '품절' : (p && p.priceOnRequest ? '전화 주문 품목' : null)),
      };
    });
  }
  function cartTotals(lines) {
    var items = lines.filter(function (l) { return l.ok; })
      .reduce(function (s, l) { return s + l.unitPrice * l.qty; }, 0);
    var ship = shipFeeFor(items);
    return { items: items, ship: ship, total: items + ship };
  }
  // 내비의 장바구니 개수. 화면이 다시 그려질 때마다 부른다.
  function paintCartBadge() {
    var n = cartCount();
    [].forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.hidden = n === 0;
    });
  }

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
        '<h3 style="margin:var(--gap-tight) 0 var(--gap-tight);font-size:22px">' + esc(p.title) + '</h3>' +
        '<p class="muted" style="margin:0;white-space:pre-line">' + esc(p.body || '') + '</p>' +
        (p.link ? '<a class="btn btn-point" href="' + esc(p.link) + '" style="margin-top:var(--gap-related)"><i data-lucide="arrow-right"></i>' + esc(p.linkLabel || '자세히 보기') + '</a>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--gap-block);border-top:1px solid var(--line-soft);padding-top:14px">' +
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

  /* ---------------- Chrome (nav / footer / mobile) ----------------
     법인명은 '참'(한국참전통…) 한 글자가 조합 이름의 핵심이라 색으로 집어낸다.
     내비·푸터 두 곳에서 쓰므로 표기를 여기 한 곳에서만 만든다. */
  var BRAND_NAME = '한국참전통발효식품협동조합';
  function brandMarkup() {
    return BRAND_NAME.replace('참', '<em class="cham">참</em>');
  }

  /* ---------------- 사이트 운영 정보 (관리자 '설정'에서 편집) ----------------
     무통장입금 계좌·연락처·사업자정보·약도 좌표를 코드가 아니라 localStorage 로 관리한다.
     기본값은 현재 값 그대로라, 설정을 건드리지 않으면 화면은 종전과 동일하다.
     반영 지점: 전 페이지 푸터 · 결제 안내(무통장입금) · 모바일 메뉴 전화 · 약도(map.js). */
  var SETTINGS_KEY = 'kach_settings_v1';
  var SETTINGS_DEFAULTS = {
    bank: '농협 000-0000-0000-00',        // 무통장입금 계좌
    holder: '한국참전통발효식품협동조합',    // 예금주
    // 택배비 — 주문 모달의 입금액과 서버의 주문 금액이 같은 값을 쓴다.
    // 0 을 넣으면 전 상품 무료배송, shipFreeOver 를 아주 크게 잡으면 무료 기준이 없어진다.
    shipFee: 5000,                         // 편도 택배비(원)
    shipFreeOver: 50000,                   // 이 금액 이상이면 무료
    phone: '02-855-8806',
    phone2: '010-8768-9551',               // 보조 전화(휴대폰)
    email: 'kach5501@hanmail.net',
    address: '서울특별시 구로구 구로동로 240, 세일빌딩 701호',
    hours: '평일 09:00 – 18:00 (주말·공휴일 휴무)',
    corpName: '한국참전통발효식품 협동조합 (법인사업자)',
    ceo: '김필연',
    founded: '2021년 11월 1일',
    bizNo: '869-81-02406',                 // 사업자등록번호
    mailOrderNo: '2025-서울구로-1345',      // 통신판매업 신고번호
    bizType: '교육서비스업 — 발효식품교육, 체험학습\n도소매업 — 발효식품, 전자상거래',  // 업태·종목(여러 줄)
    eduCert: '교육부 교육기부 진로체험 인증기관',
    productTest: '발효식초 총산 4.7%(기준 4.00~20.00) 적합 — 강원특별자치도보건환경연구원 (2025.04.30)',
    lat: 37.50331, lng: 126.88262,         // 약도 핀 좌표
    // 검색 노출 — 서버가 <head> 에 넣는다(functions/_shared/seo.js). 비워 두면 넣지 않는다.
    seoGoogle: '',                         // 구글 서치콘솔 소유확인 코드
    seoNaver: '',                          // 네이버 서치어드바이저 소유확인 코드
    seoImage: 'assets/logo.png',           // 링크 공유 시 뜨는 기본 그림
  };
  function getSettings() {
    var s = getJSON(SETTINGS_KEY, {}) || {};
    var out = {};
    for (var k in SETTINGS_DEFAULTS) {
      out[k] = (s[k] != null && s[k] !== '') ? s[k] : SETTINGS_DEFAULTS[k];
    }
    return out;
  }
  function setSettings(obj) { return setJSON(SETTINGS_KEY, obj); }
  // 정적 HTML(문의·소개 페이지)에 흩어진 값을 설정으로 채운다 — [data-site="키"]
  function applySiteSettings() {
    var st = getSettings();
    var nodes = document.querySelectorAll('[data-site]');
    for (var i = 0; i < nodes.length; i++) {
      var elx = nodes[i], key = elx.getAttribute('data-site'), val = st[key];
      if (val == null) continue;
      var href = elx.getAttribute('href');
      if (href && href.indexOf('tel:') === 0) elx.setAttribute('href', 'tel:' + String(val).replace(/[^0-9+]/g, ''));
      else if (href && href.indexOf('mailto:') === 0) elx.setAttribute('href', 'mailto:' + val);
      if (key === 'address') elx.innerHTML = esc(String(val)).replace(/,\s*/, ',<br>');
      else if (elx.hasAttribute('data-site-ml')) elx.innerHTML = esc(String(val)).replace(/\n/g, '<br>');  // 여러 줄 값
      else elx.textContent = val;
    }
  }
  /* ---------------- 페이지 문구 (관리자가 고치는 제목·소개문) ----------------
     HTML 에 적힌 원문이 **기본값**이고, 관리자가 저장한 것만 덮어쓴다.
     그래서 아직 손대지 않은 문구는 개발자가 HTML 을 고치면 그대로 따라온다 —
     처음부터 전부를 자료로 옮기면 오탈자 하나 고치는 데도 관리자 화면을 거쳐야 한다.

     굵은 글씨·줄바꿈이 들어 있는 문구가 많아 innerHTML 로 넣는다. 관리자만 쓰는
     칸이라 <b>·<br> 을 허용하되, 스크립트가 될 수 있는 것은 걸러 낸다(sanitizeText). */
  var TEXTS_KEY = 'kach_texts_v1';
  function getTexts(){ return getJSON(TEXTS_KEY, {}) || {}; }
  function setTexts(o){ return setJSON(TEXTS_KEY, o); }
  /* 허용: b·strong·br·small·em·i·span. 그 밖의 태그와 on* 속성·javascript: 는 지운다.
     관리자 화면에서만 값이 들어오지만, 계정을 잠깐 빌린 사람이 스크립트를 심어
     방문자 화면에서 돌게 만드는 길을 열어 두지 않는다. */
  function sanitizeText(html) {
    /* **살아 있는 문서에서 파싱하면 안 된다.** div.innerHTML 로 넣는 순간
       주소가 잘못된 사진 태그(onerror 가 달린)의 로드가 시작되고, 실패하면서 그것이 돈다 —
       그 뒤에 태그를 지워도 이미 실행된 뒤다(실제로 이 방법을 썼다가 스크립트가 돌았다).
       DOMParser 가 만든 문서는 화면에 붙어 있지 않아 리소스를 받지도, 스크립트를 돌리지도 않는다. */
    var doc = new DOMParser().parseFromString(
      '<body>' + String(html == null ? '' : html) + '</body>', 'text/html');
    var d = doc.body;
    var ok = { B:1, STRONG:1, BR:1, SMALL:1, EM:1, I:1, SPAN:1 };
    var walk = d.querySelectorAll('*');
    for (var i = walk.length - 1; i >= 0; i--) {
      var el = walk[i];
      // 허용하지 않는 태그는 껍데기만 벗기고 안의 글은 살린다
      if (!ok[el.tagName]) {
        var kids = [].slice.call(el.childNodes);
        if (el.parentNode) {
          for (var m = 0; m < kids.length; m++) el.parentNode.insertBefore(kids[m], el);
          el.parentNode.removeChild(el);
        }
        continue;
      }
      for (var j = el.attributes.length - 1; j >= 0; j--) {
        var a = el.attributes[j].name;
        if (a.indexOf('on') === 0 || a === 'href' || a === 'src' || a === 'style') el.removeAttribute(a);
      }
    }
    return d.innerHTML;
  }
  // [data-text="키"] 자리에 관리자가 저장한 문구를 넣는다. 저장한 적 없으면 원문 그대로.
  /* ---------------- 페이지 문구 ----------------
     관리자가 홈페이지의 글을 고친다. 고칠 수 있는 자리를 찾는 규칙은 **여기 한 곳**뿐이고,
     관리자 편집기도 이 함수를 그대로 부른다 — 두 곳에 두면 편집기가 보여 준 자리와
     실제로 바뀌는 자리가 어긋난다.

     자리 이름(key)은 사람이 붙인 `data-text` 가 있으면 그것을, 없으면 문서 안의 위치로
     만든다. 위치로 만든 이름은 HTML 구조가 바뀌면 어긋날 수 있으므로,
     **고친 글과 함께 그때의 원문도 저장해 두고, 원문이 달라졌으면 붙이지 않는다.**
     그러지 않으면 페이지를 손본 뒤 엉뚱한 자리에 옛 문구가 나타난다. */
  var TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,blockquote,summary,caption,th,td,.eyebrow,.lede';
  // 화면 코드가 만들어 넣는 자리는 고칠 수 없다 — 고쳐도 다음 그리기에 지워진다
  var TEXT_SKIP = '#site-nav,#site-footer,#mobileMenu,.modal-root,.jump,.popup-wrap,[data-noedit],.rich';
  var textIndex = null;

  function textPathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'BODY') {
      if (el.id) { parts.unshift('#' + el.id); break; }
      var i = 0, sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) i++;
      parts.unshift(el.tagName.toLowerCase() + (i ? '[' + i + ']' : ''));
      el = el.parentElement;
    }
    return parts.join('>');
  }
  // 공백·줄바꿈 차이로 '원문이 바뀌었다'고 보지 않게 눌러서 비교한다
  function textSquash(h) { return String(h == null ? '' : h).replace(/\s+/g, ' ').trim(); }

  /** 이 페이지에서 고칠 수 있는 자리 목록. 화면을 그리기 전에 한 번만 훑는다. */
  function scanTexts(doc) {
    var d = doc || document;
    var page = (d.body && d.body.getAttribute('data-page')) || 'page';
    var all = [].slice.call(d.querySelectorAll(TEXT_SEL));
    var out = [];
    all.forEach(function (el) {
      if (el.closest(TEXT_SKIP)) return;
      // 안에 또 다른 편집 대상이 있으면 바깥은 건드리지 않는다 —
      // 바깥을 고치면 안쪽 자리 이름이 통째로 사라진다
      if (el.querySelector(TEXT_SEL)) return;
      var html = el.innerHTML;
      if (!textSquash(html)) return;                 // 비어 있는 자리는 보여 줄 것이 없다
      var manual = el.getAttribute('data-text');
      out.push({
        key: manual || (page + '|' + textPathOf(el)),
        named: !!manual,
        el: el, orig: html,
        kind: /^H[1-6]$/.test(el.tagName) ? '제목' : (el.classList.contains('eyebrow') ? '라벨' : '본문'),
      });
    });
    return out;
  }

  // 저장 모양: 예전에는 문자열 하나였고, 지금은 {v: 고친 글, o: 그때의 원문} 이다.
  function textRec(v) {
    if (v == null) return null;
    if (typeof v === 'string') return { v: v, o: null };
    return (typeof v === 'object' && v.v != null) ? v : null;
  }

  function applyTexts() {
    var t = getTexts();
    textIndex = scanTexts(document);
    textIndex.forEach(function (r) {
      var rec = textRec(t[r.key]);
      if (!rec || !String(rec.v).trim()) return;
      // 원문이 그 사이 바뀌었으면 붙이지 않는다. 옛 글을 새 자리에 붙이는 것이 더 나쁘다.
      if (rec.o != null && textSquash(rec.o) !== textSquash(r.orig)) { r.stale = true; return; }
      r.el.innerHTML = sanitizeText(rec.v);
      r.applied = true;
    });
  }
  /** 관리자 편집기가 쓴다 — 지금 페이지의 자리 목록(원문 포함) */
  function textList() { return textIndex || (textIndex = scanTexts(document)); }

  /* 회원 진입점.
     로그인 여부는 `member_session` 쿠키(HttpOnly 가 아닌 표식)로만 판단한다 —
     이 값은 **화면을 고르는 데만** 쓰고 권한으로 쓰지 않는다. 실제 자격은 member_token
     이고 서버가 매 요청마다 계정 행까지 확인한다. 표식이 거짓이어도 마이페이지를 열면
     서버가 로그인 화면을 돌려줄 뿐이다. */
  function memberLoggedIn() {
    return /(?:^|;\s*)member_session=1(?:;|$)/.test(document.cookie || '');
  }
  /* 로그인한 회원의 정보. 주문 폼을 미리 채우는 데만 쓴다.
     표식 쿠키가 있을 때만 한 번 물어본다 — 손님 대부분은 비회원이라, 모든 방문에
     회원 조회를 붙이면 아무 소용 없는 요청이 페이지마다 늘어난다. */
  var memberProfile = null;
  function loadMemberProfile() {
    if (!memberLoggedIn()) return Promise.resolve(null);
    return api('/api/members/me').then(function (r) {
      memberProfile = (r.ok && r.data && r.data.member) || null;
      return memberProfile;
    }).catch(function () { return null; });
  }
  function memberLinkHTML() {
    return memberLoggedIn()
      ? '<a class="btn btn-ghost nav-member" href="mypage.html"><i data-lucide="user-round"></i>마이페이지</a>'
      : '<a class="btn btn-ghost nav-member" href="mypage.html"><i data-lucide="log-in"></i>로그인</a>';
  }

  function buildNav() {
    var cur = currentPage();
    var links = NAV.map(function (n) {
      var active = n.id === cur ? ' active' : '';
      /* 지금 보고 있는 페이지의 드롭다운은 열지 않는다.
         그 페이지에는 같은 절 목록이 목차 바(.jump)로 이미 떠 있고, 그쪽은 스크롤에 따라
         현재 위치까지 표시한다. 둘을 함께 두면 같은 것을 가리키는 길이 둘이 되어
         어느 쪽을 써야 할지 헷갈린다. 다른 페이지에서는 바로 절로 가는 길이 필요하므로 남긴다. */
      var showDD = n.dd && n.id !== cur;
      var ddHead = '<span class="dd-head">' + n.label + '</span>';
      var dd = showDD ? '<div class="nav-dd">' + ddHead + n.dd.map(function (d) { return '<a href="' + d.href + '">' + d.label + '</a>'; }).join('') + '</div>' : '';
      var caret = showDD ? ' <i data-lucide="chevron-down" style="width:14px;height:14px;opacity:.6"></i>' : '';
      var currentAttr = n.id === cur ? ' aria-current="page"' : '';
      return '<div class="nav-item' + active + '"><a href="' + n.href + '"' + currentAttr + '>' + n.label + caret + '</a>' + dd + '</div>';
    }).join('');
    return '<div class="nav">' +
        '<div class="nav-top"><div class="nav-inner">' +
          '<a class="brand" href="index.html" aria-label="홈으로">' +
            '<img src="assets/logo.png" alt="' + BRAND_NAME + ' 로고">' +
            '<span class="bt"><b>' + brandMarkup() + '</b></span>' +
          '</a>' +
          '<div class="nav-cta">' +
            '<button class="btn btn-ghost nav-cart" data-open-cart aria-label="장바구니">' +
              '<i data-lucide="shopping-basket"></i><span class="nav-cart-n" data-cart-count hidden>0</span></button>' +
            memberLinkHTML() +
            '<button class="btn btn-point" data-modal="apply"><i data-lucide="sprout"></i>지도사 신청</button>' +
            '<button class="btn btn-ghost nav-toggle" aria-label="메뉴 열기" id="navToggle" style="padding:11px 13px"><i data-lucide="menu"></i></button>' +
          '</div>' +
        '</div></div>' +
        '<div class="nav-bar"><div class="nav-inner">' +
          '<nav class="nav-links" aria-label="주 메뉴">' + links + '</nav>' +
        '</div></div>' +
      '</div>';
  }
  function buildMobile() {
    var cur = currentPage();
    var items = NAV.map(function (n) {
      var sub = n.dd ? n.dd.map(function (d) { return '<a href="' + d.href + '">' + d.label + '</a>'; }).join('') : '';
      return '<div class="mm-group"><a class="mm-top' + (n.id === cur ? ' active' : '') + '" href="' + n.href + '">' + n.label + '</a>' +
        (sub ? '<div class="mm-sub">' + sub + '</div>' : '') + '</div>';
    }).join('');
    // 메뉴 항목이 많아 아래로 길다. 전화 문의는 스크롤 없이 닿도록 맨 위에 둔다.
    return '<div class="mobile-menu" id="mobileMenu">' +
      '<div class="mm-body"><div class="mm-head"><b>메뉴</b><button id="mmClose" aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<a class="mm-call" href="tel:' + getSettings().phone.replace(/[^0-9+]/g, '') + '"><i data-lucide="phone"></i><span><b>' + esc(getSettings().phone) + '</b><small>교육 · 제품 문의</small></span></a>' +
      items +
      '<div class="mm-group"><a class="mm-top" href="mypage.html">' + (memberLoggedIn() ? '마이페이지' : '로그인') + '</a>' +
        (memberLoggedIn() ? '' : '<div class="mm-sub"><a href="signup.html">회원가입</a></div>') + '</div>' +
      '<button class="btn btn-point btn-lg" data-modal="apply" style="margin-top:var(--gap-related)"><i data-lucide="sprout"></i>전통발효식품 체험지도사 신청</button>' +
      '</div></div>';
  }
  function buildFooter() {
    var st = getSettings();
    var addr = esc(st.address).replace(/,\s*/, ',<br>');
    return '<div class="footer-inner">' +
      '<div class="footer-top">' +
        '<div class="footer-brand">' +
          '<img src="assets/logo.png" alt="' + BRAND_NAME + ' 로고">' +
          '<b>' + brandMarkup() + '</b>' +
          '<p>전통 발효식품의 보급과 교육을 통해 건강한 식문화를 만들어갑니다. 전통의 깊이, 발효의 가치를 다음 세대로 이어갑니다.</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h6>바로가기</h6>' +
          '<a href="about.html">협동조합 소개</a><a href="ferments.html">전통발효식품</a>' +
          '<a href="instructor.html">체험지도사 과정</a><a href="nuruk.html">누룩이야기</a>' +
          '<a href="products.html">제품 판매</a>' +
          '<a href="news.html">소식마당</a><a href="contact.html">문의하기</a>' +
          '<a href="mypage.html">' + (memberLoggedIn() ? '마이페이지' : '로그인 · 회원가입') + '</a>' +
        '</div>' +
        '<div class="footer-col footer-info">' +
          '<h6>사업자 정보</h6>' +
          '<span><b>대표</b> ' + esc(st.ceo) + '</span>' +
          '<span><b>사업자등록번호</b> ' + esc(st.bizNo) + '</span>' +
          '<span><b>통신판매업신고</b> ' + esc(st.mailOrderNo) + '</span>' +
          '<span><b>주소</b> ' + addr + '</span>' +
          '<span><b>전화</b> ' + esc(st.phone) + '</span>' +
          '<span><b>이메일</b> ' + esc(st.email) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>© 2026 ' + BRAND_NAME + '. 모든 권리를 보유합니다.</span>' +
        '<span class="foot-meta"><a href="terms.html">이용약관</a> · <a href="privacy.html"><b>개인정보처리방침</b></a> · <a href="admin.html" class="admin-link" title="관리자 페이지">관리자</a></span>' +
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
    paintCartBadge();
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
  /* ms 를 주면 그만큼 띄운다 — 충돌 안내처럼 '읽고 판단해야 하는' 말은 2.6초면 짧다. */
  function toast(msg, ms) {
    var t = document.getElementById('siteToast');
    if (!t) { t = document.createElement('div'); t.id = 'siteToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('show'); }, ms || 2600);
  }

  /* ---------------- Modals (신청 · 주문 · 문의) ----------------
     무통장입금 계좌·예금주는 관리자 '설정'에서 편집한다(getSettings).
     모듈 로드 시점이 아니라 **모달을 그릴 때** 읽는다 — 서버 모드에서는 스크립트가
     실행될 때 아직 설정을 받아오기 전이라, 미리 잡아 두면 기본값이 굳어 버린다. */
  function payBank(){ return getSettings().bank; }
  function payHolder(){ return getSettings().holder; }
  /* 계좌가 아직 기본값(예시)인지. 실제 계좌를 넣었는데도 '예시입니다' 라고 적혀 있으면
     손님이 입금을 망설인다 — 반대로 예시인 채로 안내가 없으면 엉뚱한 곳에 넣는다.
     둘 다 막으려면 '지금 값이 기본값과 같은가' 로 판단해야 한다. */
  function payBankIsSample(){
    return String(payBank() || '').trim() === String(SETTINGS_DEFAULTS.bank).trim();
  }

  /* ---------------- 지도사 모집 기수(期數) ---------------- */
  var COHORTS_KEY = 'kach_cohorts_v1';
  /* 기수 일정은 관리자 > 지도사 신청에서 등록·수정한다.
     확정 일정이 없는 동안 지난 날짜를 '모집중'으로 띄우면 잘못된 안내가 되므로,
     기본값은 지난 과정(마감)과 상시 접수 창구만 둔다. */
  var COHORT_DEFAULTS = [
    { id: 'c31', name: '31기', period: '2026.05.15 ~ 07.24', schedule: '금 14:00–15:00', place: '구로 본원', status: '마감' },
    { id: 'c32', name: '32기', period: '일정 준비 중', schedule: '확정 후 안내', place: '구로 본원', status: '예정' },
    { id: 'c_any', name: '원데이 수업', period: '수시 접수', schedule: '일정 협의', place: '구로 본원 / 정선', status: '상시' },
  ];
  function getCohorts(){ var c = getJSON(COHORTS_KEY, null); return (c && c.length != null) ? c : COHORT_DEFAULTS.slice(); }
  function setCohorts(list){ return setJSON(COHORTS_KEY, list); }
  // 신청서에 노출할 기수 — 모집중·상시만 + '상담 후 결정'
  function cohortApplyOptions(){
    var open = getCohorts().filter(function (c) { return c.status === '모집중' || c.status === '상시'; });
    var names = open.map(function (c) { return c.name + (c.period ? ' (' + c.period + ')' : ''); });
    names.push('상담 후 결정');
    return names;
  }
  var COHORT_STATUS_TAG = { '모집중': 'tag solid', '예정': 'tag', '상시': 'tag point', '마감': 'tag' };
  /* 일정표에 보여줄 기수 개수. 해가 지날수록 지난 기수가 쌓이는데, 방문자가 알아야 할 것은
     지금 신청할 수 있는 기수와 그 직전 몇 개뿐이다. 관리자 화면에서는 전부 보인다. */
  var COHORT_VISIBLE = 5;
  // 지도사 과정 페이지의 일정표(#cohort-rows)를 채움 — 관리자가 정한 순서로 위에서부터 COHORT_VISIBLE 개
  function renderCohortSchedule(){
    var tb = document.getElementById('cohort-rows');
    if (!tb) return;
    var all = getCohorts();
    if (!all.length) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-mute);padding:24px">현재 안내된 기수가 없습니다. 신청 후 일정을 안내드립니다.</td></tr>'; return; }
    /* 순서는 관리자가 정한다 — 관리자 > 지도사 신청 > 모집 기수에서 행을 끌어 올린 차례가
       그대로 이 표의 차례다. 예전에는 '등록순의 역순이 최신순'이라 가정해 뒤집었는데,
       운영자가 보이고 싶은 차례가 등록한 차례와 같으리라는 보장이 없었다. */
    var list = all.slice(0, COHORT_VISIBLE);
    var rows = list.map(function (c) {
      var cls = COHORT_STATUS_TAG[c.status] || 'tag';
      return '<tr' + (c.status === '마감' ? ' style="opacity:.55"' : '') + '><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.period || '-') + '</td><td>' + esc(c.schedule || '-') + '</td><td>' + esc(c.place || '-') + '</td><td><span class="' + cls + '">' + esc(c.status) + '</span></td></tr>';
    }).join('');
    // 가린 기수가 있으면 숨겼다는 사실을 밝힌다 — 말없이 자르면 '이게 전부'로 읽힌다.
    if (all.length > list.length) {
      rows += '<tr><td colspan="5" style="text-align:center;color:var(--ink-mute);padding:14px;font-size:var(--fs-caption)">' +
        '기수 ' + COHORT_VISIBLE + '개만 표시합니다. 다른 기수는 02-855-8806으로 문의해 주세요.</td></tr>';
    }
    tb.innerHTML = rows;
  }

  var MODALS = {
    apply: {
      kicker: '체험지도사', title: '전통발효식품 체험지도사 신청', store: 'kach_applications',
      desc: '아래 정보를 남겨주시면 담당자가 순차적으로 연락드립니다.', submit: '신청서 제출',
      consents: ['privacy'],
      fields: [
        { name: 'name', label: '이름', required: true, placeholder: '홍길동' },
        { name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
        { name: 'region', label: '지역', placeholder: '예) 서울 구로구' },
        { name: 'course', label: '신청 기수', type: 'select', required: true, options: cohortApplyOptions },
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
      var opts = typeof f.options === 'function' ? f.options() : (f.options || []);
      ctrl = '<select name="' + f.name + '" id="' + id + '"' + req + '>' + opts.map(function(o){ return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
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

  /* 상품 금액 · 택배비 · 총 입금 금액 세 줄. 수량을 바꿀 때도 **이 함수로 다시 그린다**
     — 처음 그릴 때와 고쳐 그릴 때를 따로 만들면 한쪽만 고쳐져 금액이 어긋난다. */
  function payAmountRows(items) {
    var ship = shipFeeFor(items);
    return '<div class="pay-row"><span>상품 금액</span><span>' + fmtWon(items) + '원</span></div>' +
      '<div class="pay-row"><span>택배비</span><span>' +
        (ship ? fmtWon(ship) + '원' : '0원 <em class="pay-free">' + esc(shipFreeTxt()) + ' 이상 무료</em>') + '</span></div>' +
      '<div class="pay-row pay-sum"><span>총 입금 금액</span><b class="pay-total">' + fmtWon(items + ship) + '원</b></div>';
  }

  function payBoxHTML(mode, data) {
    var qty = Number((data && data.qty) || 1) || 1;
    var unit = Number((data && data.unitPrice) || 0) || 0;
    // 장바구니 주문은 품목이 여럿이라 한 개 값 × 수량으로 계산할 수 없다
    if (data && data.cart) {
      var ct = cartTotals(cartLines());
      return '<div class="pay-box"><b><i data-lucide="landmark"></i>무통장입금(계좌이체) 안내</b>' +
        '<div class="pay-row"><span>입금 계좌</span><span>' + esc(payBank()) + '<br>(예금주: ' + esc(payHolder()) + ')</span></div>' +
        '<div id="payAmount">' + payAmountRows(ct.items) + '</div>' +
        '<div class="pay-row"><span>입금 기한</span><span>주문 후 3일 이내</span></div>' +
        '<p>입금자명은 ‘입금자명’ 항목과 동일하게 입금해 주세요. 입금 확인 후 결제완료 처리되며 순차 배송됩니다.</p>' +
        (payBankIsSample() ? '<p class="pay-demo">※ 표시된 계좌번호는 <b>예시</b>입니다. 입금 전 02-855-8806 으로 확인해 주세요.</p>' : '') +
      '</div>';
    }
    /* 손님이 실제로 넣어야 할 금액을 못박는다.
       예전에는 '택배비 별도'라고만 적어, 무료 기준 미만 주문은 얼마를 입금해야 하는지가
       화면 어디에도 없었다. 제주·도서산간 추가분만 여기서 계산하지 않는다 — 전화로 안내한다. */
    var items = unit * qty;
    var totalRow = mode === 'note'
      ? '<div class="pay-row"><span>분양 금액</span><span>1kg당 15만원 · 30kg 분양 가능 (상담 후 확정)</span></div>'
      : (unit ? '<div id="payAmount">' + payAmountRows(items) + '</div>' : '');
    return '<div class="pay-box"><b><i data-lucide="landmark"></i>무통장입금(계좌이체) 안내</b>' +
      '<div class="pay-row"><span>입금 계좌</span><span>' + esc(payBank()) + '<br>(예금주: ' + esc(payHolder()) + ')</span></div>' +
      totalRow +
      '<div class="pay-row"><span>입금 기한</span><span>주문 후 3일 이내</span></div>' +
      '<p>입금자명은 ‘입금자명’ 항목과 동일하게 입금해 주세요. 입금 확인 후 결제완료 처리되며 순차 배송됩니다. 주문 완료 시 발급되는 <b>주문번호</b>와 연락처(또는 이메일)로 언제든 주문을 조회할 수 있습니다.</p>' +
      (payBankIsSample()
        ? '<p class="pay-demo">※ 표시된 계좌번호는 <b>예시</b>입니다. 입금 전 02-855-8806 으로 확인해 주세요.</p>'
        : '') +
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

  /* 로그인한 회원이 열면 주문자·연락처·주소를 미리 채운다.
     화면이 채워 주는 편의일 뿐이고, 주문이 누구 것인지는 서버가 쿠키로 정한다
     (functions/api/submit.js) — 여기 값을 고쳐도 남의 계정에 붙지 않는다.
     이미 값이 있으면 덮지 않는다. 손님이 다른 주소로 보내려고 고쳐 둔 것일 수 있다. */
  function prefillFromMember(type, data) {
    if (type !== 'order' && type !== 'seedjang') return data;
    var m = memberProfile;
    if (!m) return data;
    var d = data || {};
    if (!d.name && m.name) d.name = m.name;
    if (!d.phone && m.phone) d.phone = m.phone;
    if (!d.email && m.email) d.email = m.email;
    if (!d.depositor && m.name) d.depositor = m.name;
    if (!d.address && (m.address || m.addressDetail)) {
      d.address = [m.address, m.addressDetail].filter(Boolean).join(' ');
    }
    return d;
  }

  function openModal(type, data) {
    var cfg = MODALS[type]; if (!cfg) return;
    data = prefillFromMember(type, data);
    var isCart = !!(data && data.cart);
    /* 장바구니 주문에는 '상품 한 건' 칸이 맞지 않는다. 담긴 줄을 요약으로 보여 주고,
       무엇을 몇 개 사는지는 서버가 items 로 다시 확인한다. */
    var flds = isCart
      ? [{ name: 'cartSummary', label: '주문 상품', readonly: true, full: true }]
        .concat(cfg.fields.filter(function (f) {
          return ['product', 'optionLabel', 'qty', 'unitPrice', 'productId'].indexOf(f.name) < 0;
        }))
      : cfg.fields;
    if (isCart) {
      var cl = cartLines().filter(function (l) { return l.ok; });
      data.cartSummary = cl.length === 1
        ? cl[0].name + (cl[0].optionLabel ? ' · ' + cl[0].optionLabel : '') + ' ' + cl[0].qty + '개'
        : cl[0].name + ' 외 ' + (cl.length - 1) + '건 (모두 ' + cl.reduce(function (n, l) { return n + l.qty; }, 0) + '개)';
    }
    var fields = flds.map(function(f){ return fieldHTML(f, data); }).join('');
    var consents = cfg.consents ? consentHTML(cfg.consents) : '';
    var pay = cfg.pay ? payBoxHTML(cfg.pay === 'note' ? 'note' : 'total', data) : '';
    var disabled = cfg.consents && cfg.consents.length ? ' disabled' : '';
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">' + cfg.kicker + '</div><h3>' + esc(cfg.title) + '</h3><p>' + esc(cfg.desc) + '</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="modalForm" data-store="' + cfg.store + '" data-type="' + type + '"' + (isCart ? ' data-cart="1"' : '') + '>' +
        '<div class="form-grid">' + fields + '</div>' +
        pay + consents +
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
    clearLoginTimer();
  }

  function submitModal(form) {
    var data = {}; var fd = new FormData(form);
    fd.forEach(function(v, k){ data[k] = v; });
    var type = form.getAttribute('data-type');
    data.kind = type;
    var isOrder = (type === 'order' || type === 'seedjang');
    var isCart = form.getAttribute('data-cart') === '1';
    if (isCart) {
      // 무엇을 몇 개 사는지만 보낸다. 이름·금액·재고는 서버가 상품표에서 다시 만든다.
      data.items = cartLines().filter(function (l) { return l.ok; })
        .map(function (l) { return { productId: l.productId, optionLabel: l.optionLabel, qty: l.qty }; });
      if (!data.items.length) return;
      delete data.cartSummary;
    }
    if (isOrder) {
      data.payMethod = '무통장입금';
      data.status = '주문접수';
      // 서버 모드에서는 주문번호·금액을 서버가 정한다(브라우저 값은 버려진다).
      // 로컬 모드에서만 여기서 만든다.
      if (!SERVER) {
        data.orderNo = genOrderNo();
        if (isCart) {
          var ct = cartTotals(cartLines());
          data.shipFee = ct.ship; data.total = ct.total;
          data.product = data.cartSummary || '장바구니 주문';
          data.qty = data.items.reduce(function (n, x) { return n + x.qty; }, 0);
          data.itemCount = data.items.length;
        } else if (data.unitPrice) {
          var itemsTotal = Number(data.unitPrice) * (Number(data.qty) || 1);
          data.shipFee = shipFeeFor(itemsTotal);
          data.total = itemsTotal + data.shipFee;
        }
      }
    }
    var btn = form.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = '접수 중…'; }

    submitRecord(type, data).then(function (rec) {
      if (isCart) cartClear();          // 접수된 뒤에 비운다 — 실패하면 담긴 것이 남아야 한다
      renderSubmitSuccess(form, type, rec, isOrder);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = MODALS[type].submit; }
      var note = form.querySelector('.submit-error');
      if (!note) {
        note = document.createElement('div');
        note.className = 'modal-note submit-error';
        form.querySelector('.modal-foot').insertAdjacentElement('beforebegin', note);
      }
      note.innerHTML = '<i data-lucide="alert-circle"></i><span>' + esc(err.message || '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.') + '</span>';
      icons();
    });
  }

  function renderSubmitSuccess(form, type, data, isOrder) {
    var title = MODALS[type].title;
    var body = form.closest('.modal-body');
    var orderInfo = '';
    if (isOrder && data.orderNo) {
      orderInfo = '<div class="pay-box" style="text-align:left;margin-top:var(--gap-related)"><b><i data-lucide="receipt"></i>주문번호</b>' +
        '<div class="pay-row"><span>주문번호</span><b class="pay-total" style="font-size:20px;letter-spacing:.04em">' + data.orderNo + '</b></div>' +
        // 택배비가 얼마 붙었는지 보여 준다 — 금액만 적으면 '왜 상품값과 다르지?' 로 전화가 온다
        (data.total ? '<div class="pay-row"><span>입금 금액</span><b>' + fmtWon(data.total) + '원</b>' +
          (data.shipFee != null
            ? '<span class="pay-note-inline">' + (data.shipFee ? '택배비 ' + fmtWon(data.shipFee) + '원 포함' : '택배비 무료') + '</span>'
            : '') + '</div>' : '') +
        '<div class="pay-row"><span>입금 계좌</span><span>' + esc(payBank()) + ' (예금주: ' + esc(payHolder()) + ')</span></div>' +
        '<p>주문번호를 꼭 보관해 주세요. 제품 페이지의 <b>비회원 주문 조회</b>에서 주문번호와 연락처(또는 이메일)로 진행 상태를 확인할 수 있습니다.</p></div>';
    }
    body.innerHTML =
      '<div class="modal-success">' +
        '<div class="ok-ring"><i data-lucide="check"></i></div>' +
        '<h3 style="font-size:22px">' + (isOrder ? '주문이 접수되었습니다' : '신청이 접수되었습니다') + '</h3>' +
        '<p class="muted" style="margin-top:var(--gap-tight)">' + esc(title) + ' 접수가 정상적으로 완료되었습니다.<br>담당자가 확인 후 진행해 드리겠습니다.</p>' +
        orderInfo +
        '<div class="modal-foot"><button type="button" class="btn btn-point" data-modal-close>확인</button></div>' +
      '</div>';
    icons();
  }

  /* ---------------- 장바구니 화면 ----------------
     따로 된 페이지를 만들지 않는다 — 담고 바로 주문으로 이어지는 흐름이라
     페이지를 옮기면 돌아올 곳을 잃는다. */
  function cartRowsHTML() {
    var lines = cartLines();
    if (!lines.length) {
      return '<div class="cart-empty"><i data-lucide="shopping-basket"></i>' +
        '<p>장바구니가 비어 있습니다.</p>' +
        '<a class="btn btn-ghost" href="products.html">제품 보러 가기</a></div>';
    }
    var t = cartTotals(lines);
    var rows = lines.map(function (l) {
      return '<div class="cart-row' + (l.ok ? '' : ' off') + '">' +
        '<div class="cart-name"><b>' + esc(l.name) + '</b>' +
          (l.optionLabel ? '<span class="cart-opt">' + esc(l.optionLabel) + '</span>' : '') +
          (l.ok ? '' : '<span class="cart-bad">' + esc(l.why || '주문할 수 없음') + '</span>') +
        '</div>' +
        '<div class="cart-qty">' +
          (l.ok
            ? '<div class="stepper"><button type="button" data-cart-minus="' + l.i + '" aria-label="수량 줄이기">−</button>' +
              '<input type="number" min="1" value="' + l.qty + '" data-cart-qty="' + l.i + '" inputmode="numeric">' +
              '<button type="button" data-cart-plus="' + l.i + '" aria-label="수량 늘리기">+</button></div>'
            : '<span class="muted">' + l.qty + '개</span>') +
        '</div>' +
        '<div class="cart-sum">' + (l.ok ? fmtWon(l.unitPrice * l.qty) + '원' : '-') + '</div>' +
        '<button type="button" class="cart-del" data-cart-del="' + l.i + '" aria-label="빼기"><i data-lucide="x"></i></button>' +
      '</div>';
    }).join('');
    var bad = lines.filter(function (l) { return !l.ok; }).length;
    return '<div class="cart-list">' + rows + '</div>' +
      '<div class="pay-box" style="margin-top:var(--gap-tight)"><b><i data-lucide="receipt"></i>결제 예정 금액</b>' +
        '<div id="payAmount">' + payAmountRows(t.items) + '</div></div>' +
      (bad ? '<div class="modal-note"><i data-lucide="alert-circle"></i><span>주문할 수 없는 품목 ' + bad +
        '건은 금액에서 빠졌습니다. 빼고 주문하시거나 ✕ 로 지워 주세요.</span></div>' : '');
  }

  function paintCart() {
    var box = document.getElementById('cartBody');
    if (!box) return;
    box.innerHTML = cartRowsHTML();
    var lines = cartLines();
    var go = document.getElementById('cartGo');
    if (go) go.disabled = !lines.filter(function (l) { return l.ok; }).length;
    icons();
  }

  function openCart() {
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">장바구니</div><h3>담은 상품</h3>' +
        '<p>여러 품목을 한 번에 주문하시면 <b>택배비도 한 번만</b> 붙습니다.</p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><div id="cartBody"></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>계속 둘러보기</button>' +
          '<button type="button" class="btn btn-point" id="cartGo"><i data-lucide="shopping-basket"></i>주문하기</button></div>' +
      '</div>', 600);
    paintCart();
    var root = document.getElementById('modalRoot');
    root.addEventListener('click', function (e) {
      var t = e.target;
      var del = t.closest('[data-cart-del]');
      if (del) { cartRemove(Number(del.dataset.cartDel)); paintCart(); return; }
      var minus = t.closest('[data-cart-minus]');
      if (minus) {
        var im = Number(minus.dataset.cartMinus);
        cartSetQty(im, (cartRaw()[im] || {}).qty - 1); paintCart(); return;
      }
      var plus = t.closest('[data-cart-plus]');
      if (plus) {
        var ip = Number(plus.dataset.cartPlus);
        cartSetQty(ip, (Number((cartRaw()[ip] || {}).qty) || 1) + 1); paintCart(); return;
      }
      if (t.id === 'cartGo') { closeModal(); openModal('order', { cart: true }); }
    });
    root.addEventListener('change', function (e) {
      var q = e.target.closest('[data-cart-qty]');
      if (q) { cartSetQty(Number(q.dataset.cartQty), q.value); paintCart(); }
    });
  }

  /* ---------------- 취소 · 반품 · 교환 신청 ----------------
     손님은 **신청만** 한다. 승인도 거절도 관리자가 판단하고, 주문 상태는 여기서 바뀌지 않는다.
     아래 규칙은 서버(functions/api/order-request.js)와 **같아야 한다** —
     화면이 미리 거르는 것은 친절이고, 실제 방어선은 서버다. */
  var ORDER_REQ = [
    { type: 'cancel',   label: '주문 취소', from: ['주문접수', '결제완료', '배송준비중'] },
    { type: 'return',   label: '반품',     from: ['배송중', '배송완료'] },
    { type: 'exchange', label: '교환',     from: ['배송중', '배송완료'] },
  ];
  function orderReqOptions(status) {
    return ORDER_REQ.filter(function (r) { return r.from.indexOf(status) > -1; });
  }
  /** 이미 낸 신청을 한 줄로 — 두 번 신청하려다 전화하는 일을 줄인다 */
  function orderReqNote(req) {
    if (!req) return '';
    return '접수됨: ' + (req.label || req.type) + ' 신청 (' + fmtYMD(req.at) + ')';
  }

  /**
   * 신청 창. contact 는 비회원일 때만 필요하다(회원은 쿠키로 본인을 확인한다).
   * onDone(req) 로 신청 내용을 돌려주어 부른 쪽이 화면을 고칠 수 있게 한다.
   */
  function openOrderRequest(opts) {
    var o = opts || {};
    var choices = orderReqOptions(o.status);
    if (!choices.length) return;
    rawModal(
      '<div class="modal-head"><div><div class="eyebrow">주문 ' + esc(o.orderNo || '') + '</div><h3>취소 · 반품 · 교환 신청</h3>' +
        '<p>신청을 접수하면 담당자가 확인 후 연락드립니다. <b>이 자리에서 바로 처리되지는 않습니다.</b></p></div>' +
        '<button class="modal-close" data-modal-close aria-label="닫기"><i data-lucide="x"></i></button></div>' +
      '<div class="modal-body"><form id="oreqForm">' +
        '<div class="form-grid">' +
          '<div class="field full"><label>무엇을 신청하시나요?<span class="req">*</span></label>' +
            '<select name="type">' + choices.map(function (c) {
              return '<option value="' + c.type + '">' + esc(c.label) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field full"><label>사유<span class="req">*</span></label>' +
            '<textarea name="reason" rows="3" required placeholder="예) 주문을 잘못 넣었습니다 / 받은 상품이 파손되었습니다"></textarea></div>' +
          '<div class="field full"><p id="oreqMsg" class="form-msg" hidden></p></div>' +
        '</div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close>닫기</button>' +
          '<button type="submit" class="btn btn-point"><i data-lucide="send"></i>신청하기</button></div>' +
      '</form></div>', 520);

    var f = document.getElementById('oreqForm');
    var msg = document.getElementById('oreqMsg');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      var reason = String(fd.get('reason') || '').trim();
      var show = function (t, kind) {
        msg.className = 'form-msg' + (kind ? ' ' + kind : '');
        msg.textContent = t; msg.hidden = !t;
      };
      if (!reason) { show('사유를 적어 주세요. 처리에 필요합니다.', 'bad'); return; }
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = '접수 중…';
      api('/api/order-request', { method: 'POST', body: {
        orderNo: o.orderNo, contact: o.contact || '', type: String(fd.get('type') || ''), reason: reason,
      } }).then(function (r) {
        btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i>신청하기'; icons();
        if (!r.ok) { show((r.data && r.data.error) || '접수하지 못했습니다.', 'bad'); return; }
        closeModal();
        toast('신청을 접수했습니다. 확인 후 연락드리겠습니다.');
        if (typeof o.onDone === 'function') o.onDone(r.data.request);
      }).catch(function () {
        btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i>신청하기'; icons();
        show('연결하지 못했습니다.', 'bad');
      });
    });
  }

  /* ---------------- 비회원 주문 조회 ---------------- */
  // 방금 조회에 쓴 연락처. 신청할 때 본인 확인에 다시 필요한데,
  // 결과 화면에는 개인정보를 그리지 않으므로 여기에 들고 있는다.
  var lookupContact = '';
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
      lookupContact = contact;
      var box = document.getElementById('lookupResult');

      if (SERVER) {
        // 서버에서 대조한다 — 브라우저가 전체 주문을 훑지 않는다(남의 주문이 읽히면 안 된다)
        box.innerHTML = '<p class="muted" style="margin-top:var(--gap-related)">조회 중…</p>';
        api('/api/order-lookup', { method: 'POST', body: { orderNo: ono, contact: contact } })
          .then(function (r) { showLookup(box, r.ok && r.data.found ? r.data.order : null); })
          .catch(function () { showLookup(box, null, '조회하지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
        return;
      }
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
      showLookup(box, found);
    });
  }

  // 조회 결과 그리기 — 서버·로컬 두 경로가 같은 모양을 쓴다
  function showLookup(box, found, errMsg) {
      if (!found) {
        box.innerHTML = '<div class="modal-note" style="margin-top:var(--gap-related)"><i data-lucide="alert-circle"></i><span>' +
          esc(errMsg || '일치하는 주문을 찾을 수 없습니다. 주문번호와 연락처를 다시 확인해 주세요.') + '</span></div>';
        icons(); return;
      }
      var special = ['취소', '반품요청', '반품완료', '교환요청', '교환완료'].indexOf(found.status) > -1;
      var steps = OSTAT.map(function (s) {
        var on = !special && OSTAT.indexOf(found.status) >= OSTAT.indexOf(s);
        var curNow = found.status === s;
        return '<span class="tag" style="' + (on ? 'background:var(--main);color:#fff;' : '') + (curNow ? 'box-shadow:0 0 0 2px var(--main-tint);' : '') + '">' + s + '</span>';
      }).join('<i data-lucide="chevron-right" style="width:13px;height:13px;color:var(--ink-faint)"></i>');
      box.innerHTML =
        '<div style="border:1px solid var(--line-soft);border-radius:var(--r-md);padding:16px 18px;margin-top:var(--gap-related);background:var(--surface)">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
            '<b>' + esc(found.product || found.amount || '씨장 분양') + (found.optionLabel ? ' <span class="muted" style="font-weight:500">(' + esc(found.optionLabel) + ')</span>' : '') + '</b>' + stTag(found.status) +
          '</div>' +
          '<div class="muted" style="font-size:13px;margin-top:var(--gap-tight)">주문일 ' + fmtYMD(found.at) + (found.qty ? ' · 수량 ' + esc(found.qty) : '') + (found.total ? ' · ' + fmtWon(found.total) + '원' : '') + '</div>' +
          (special
            ? '<div class="modal-note" style="margin-top:var(--gap-tight)"><i data-lucide="info"></i><span>이 주문은 ‘' + found.status + '’ 상태입니다. 자세한 사항은 고객센터(02-855-8806)로 문의해 주세요.</span></div>'
            : '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:var(--gap-related)">' + steps + '</div>') +
          (found.tracking ? '<div class="muted" style="font-size:13px;margin-top:var(--gap-tight)">운송장: ' + esc(found.courier || '') + ' ' + esc(found.tracking) + '</div>' : '') +
          orderReqBlock(found) +
        '</div>';
      icons();
      var rq = document.getElementById('lookupReqBtn');
      if (rq) rq.addEventListener('click', function () {
        openOrderRequest({
          orderNo: found.orderNo, status: found.status, contact: rq.dataset.contact,
          onDone: function (req) { found.custRequest = req; showLookup(box, found); },
        });
      });
  }

  /* 조회 결과 아래의 신청 자리 — 이미 낸 신청이 있으면 버튼 대신 그 사실을 보여 준다 */
  function orderReqBlock(found, contact) {
    if (found.custRequest) {
      return '<div class="modal-note" style="margin-top:var(--gap-tight)"><i data-lucide="clock"></i><span>' +
        esc(orderReqNote(found.custRequest)) + ' — 확인 후 연락드리겠습니다.</span></div>';
    }
    if (!orderReqOptions(found.status).length) return '';
    return '<div style="margin-top:var(--gap-tight)"><button type="button" class="btn btn-ghost" id="lookupReqBtn"' +
      ' data-contact="' + esc(contact || lookupContact || '') + '" style="padding:9px 16px">' +
      '<i data-lucide="undo-2"></i>취소 · 반품 신청</button></div>';
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
      if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openCart(); return; }
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
        var box = document.getElementById('payAmount');
        // 수량이 무료 기준을 넘나들면 택배비 줄까지 바뀐다 → 세 줄을 함께 다시 그린다
        if (unit && box) box.innerHTML = payAmountRows(unit * Math.max(1, Number(e.target.value) || 1));
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

  /* ---------------- 읽기 진행 바 ----------------
     긴 페이지가 많아 '얼마나 남았는지'를 상단 3px 막대로 보여준다.
     scaleX만 갱신해 레이아웃 재계산을 일으키지 않는다. */
  function initReadBar() {
    if (prefersReducedMotion()) return;
    var bar = document.createElement('div');
    bar.className = 'read-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = (document.body.scrollHeight || 0) - window.innerHeight;
      var p = max > 0 ? Math.min(1, (window.scrollY || doc.scrollTop) / max) : 0;
      bar.style.setProperty('--p', p.toFixed(4));
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------------- 숫자 카운트업 ----------------
     조합 현황(12가지 · 31기 · 100세)이 올라가며 세어진다.
     연도(2021년)처럼 1000 이상인 값은 0부터 세면 어색해서 건너뛴다. */
  function initCountUp() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    var els = document.querySelectorAll('.t-num');
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var node = en.target.firstChild;          // 단위(<em>) 앞의 숫자 텍스트 노드
        if (!node || node.nodeType !== 3) return;
        var target = parseInt(node.nodeValue.replace(/[^0-9]/g, ''), 10);
        if (!target || target >= 1000) return;
        var start = null, dur = 1000;
        node.nodeValue = '0';
        requestAnimationFrame(function step(ts) {
          if (start === null) start = ts;
          var p = Math.min(1, (ts - start) / dur);
          node.nodeValue = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        });
      });
    }, { threshold: 0.5 });
    els.forEach(function (e) { io.observe(e); });
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  try { document.documentElement.classList.add('js'); } catch (e) {}
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  // 관리자 '페이지 이미지' 미리보기 iframe 안에서는 방문 집계·팝업을 건너뜀
  var isPreviewFrame = false;
  try { isPreviewFrame = window.self !== window.top; } catch (e) { isPreviewFrame = true; }
  /* 부팅 — 어느 저장소를 쓸지 정하고, 서버 모드면 첫 그리기 전에 데이터를 받는다.
     받아 온 뒤에 그려야 상품·소식·설정이 한 번에 제자리로 나온다
     (먼저 그리고 나중에 채우면 화면이 두 번 바뀐다). */
  var NO_API_FLAG = 'kach_no_api';
  function boot() {
    // 정적 호스팅이라고 한 번 확인했으면 페이지마다 404 를 다시 부르지 않는다
    // (콘솔에 오류가 쌓이고 요청도 헛돈다). 세션이 끝나면 다시 확인한다.
    try { if (sessionStorage.getItem(NO_API_FLAG) === '1') return Promise.resolve(false); } catch (e) {}
    return fetch('/api/bootstrap', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.products) {               // 정적 호스팅의 404 HTML 등
          try { sessionStorage.setItem(NO_API_FLAG, '1'); } catch (e) {}
          return false;
        }
        SERVER = true;
        cache['kach_products_v3']  = d.products;
        cache['kach_posts_v1']     = d.posts;
        cache['kach_cohorts_v1']   = d.cohorts;
        cache['kach_partners_v1']  = d.partners;
        cache['kach_popups_v1']    = d.popups;
        cache['kach_settings_v1']  = d.settings || {};
        cache['kach_consents_v1']  = d.consents || {};
        cache['kach_texts_v1']     = d.texts || {};
        cache.__pageImages = d.pageImages || [];
        cache.__stockLeft = d.stockLeft || null;   // 팔 수 있는 수량 (창고 수량은 상품의 stock)
        // 상품 대표 이미지: ref → 레코드. 목록 카드가 상품마다 요청하지 않도록 미리 담아 둔다
        cache.__mainImages = {};
        (d.productImages || []).forEach(function (im) { if (im.ref) cache.__mainImages[im.ref] = im; });
        return true;
      })
      .catch(function () {
        try { sessionStorage.setItem(NO_API_FLAG, '1'); } catch (e) {}
        return false;
      });
  }

  function start() {
    if (!SERVER) { seedProducts(); dropDemoData(); }   // 로컬 모드에서만 상품 카탈로그를 심는다
    if (!isPreviewFrame) trackVisit();
    // 회원 정보는 주문 폼을 채울 때만 쓴다 — 화면을 그리는 것을 기다리게 하지 않는다
    if (!isPreviewFrame) loadMemberProfile();
    mountChrome();
    applyTexts();          // 설정보다 먼저 — 문구 안의 data-site 자리가 새로 생길 수 있다
    applySiteSettings();
    enhanceSEO();
    initModalDelegation();
    renderPartnersStrip();
    renderNewsPreview();
    renderCohortSchedule();
    renderSlotImages();
    revealScan();
    initToTop();
    initNavScroll();
    if (!isPreviewFrame) { initReadBar(); initCountUp(); }
    icons();
    setTimeout(icons, 60);
    if (!isPreviewFrame) setTimeout(showPopup, 700);
    document.documentElement.classList.add('site-ready');
    try { document.dispatchEvent(new CustomEvent('site:ready', { detail: { server: SERVER } })); } catch (e) {}
  }

  // 데이터를 먼저 받고(서버 모드) DOM 이 준비되면 그린다. 순서가 어긋나지 않게 둘 다 기다린다.
  var booted = boot();
  ready(function () { booted.then(start); });

  /* expose for admin + page scripts */
  window.Site = {
    icons: icons, esc: esc, uid: uid, el: el,
    getJSON: getJSON, setJSON: setJSON, pushRecord: pushRecord, submitRecord: submitRecord,
    fmtWon: fmtWon, fmtYMD: fmtYMD, todayStr: todayStr, genOrderNo: genOrderNo,
    idb: idb, Media: Media, api: api, reload: reload, loadAdminData: loadAdminData,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES, tooBigMsg: tooBigMsg,
    patchItem: patchItem, patchItems: patchItems, removeItem: removeItem, kindOf: function (k) { return KEY_MAP[k] || null; },
    loadOlder: loadOlder, windowInfo: windowInfo,
    isServer: function(){ return SERVER; }, memberLoggedIn: memberLoggedIn, ready: function(fn){ booted.then(function(){ ready(fn); }); },
    toast: toast, revealScan: revealScan,
    IMG_SLOTS: IMG_SLOTS, renderSlotImages: renderSlotImages, slotPos: slotPos, applySlot: applySlot,
    requireAdmin: requireAdmin, verifyLogin: verifyLogin, lockMs: lockMs,
    openModal: openModal, closeModal: closeModal, rawModal: rawModal, openOrderLookup: openOrderLookup,
    openOrderRequest: openOrderRequest, orderReqOptions: orderReqOptions, orderReqNote: orderReqNote,
    openCart: openCart, cartAdd: cartAdd, cartCount: cartCount, unitPriceOf: unitPriceOf,
    getPartners: getPartners, setPartners: setPartners, renderPartnersStrip: renderPartnersStrip, partnerDefaults: PARTNER_DEFAULTS,
    POPUP_KEY: POPUP_KEY, getPopups: getPopups,
    POSTS_KEY: POSTS_KEY, getPosts: getPosts, setPosts: setPosts,
    CONSENT_KEY: CONSENT_KEY, getConsents: getConsents, consentDefaults: CONSENT_DEFAULTS,
    PRODUCTS_KEY: PRODUCTS_KEY, PRODUCT_CATS: PRODUCT_CATS, getProducts: getProducts, setProducts: setProducts, getProduct: getProduct,
    stockLeft: stockLeft, stockTotal: stockTotal, isSoldOut: isSoldOut,
    textList: textList, scanTexts: scanTexts, textRec: textRec, textSquash: textSquash, sanitizeText: sanitizeText,
    productDefaults: PRODUCT_DEFAULTS, SHIP_TPL: SHIP_TPL, REFUND_TPL: REFUND_TPL, gosiBase: gosiBase,
    shipFee: shipFee, shipFreeOver: shipFreeOver, shipFeeFor: shipFeeFor,
    shipFreeTxt: shipFreeTxt, shipNote: shipNote, shipFeeLine: shipFeeLine,
    getTexts: getTexts, setTexts: setTexts,
    OSTAT: OSTAT, stTag: stTag, ST_COLOR: ST_COLOR,
    VISITS_KEY: VISITS_KEY, SOURCES_KEY: SOURCES_KEY,
    COHORTS_KEY: COHORTS_KEY, getCohorts: getCohorts, setCohorts: setCohorts, cohortDefaults: COHORT_DEFAULTS,
    payBank: payBank, payHolder: payHolder,
    SETTINGS_KEY: SETTINGS_KEY, SETTINGS_DEFAULTS: SETTINGS_DEFAULTS, getSettings: getSettings, setSettings: setSettings, applySiteSettings: applySiteSettings,
  };
})();
