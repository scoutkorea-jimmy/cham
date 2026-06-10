/* ============================================================
   admin.js — 관리자 콘솔
   주문/신청/문의/회원/파트너/팝업 관리 (localStorage 기반 데모)
   ============================================================ */
(function () {
  'use strict';
  var S = window.Site || {};
  function gj(k, d){ try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function sj(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function icons(){ if (window.lucide) window.lucide.createIcons(); }
  function fmtDate(iso){ if(!iso) return '-'; var d = new Date(iso); if(isNaN(d)) return esc(iso); return d.getFullYear()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+('0'+d.getDate()).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function uid(){ return 'r' + Date.now().toString(36) + Math.floor(Math.random()*1000); }

  var K = { orders: 'kach_orders', apps: 'kach_applications', inq: 'kach_inquiries', members: 'kach_members', popups: (S.POPUP_KEY || 'kach_popups_v1') };

  /* ---------- seed demo data (first run) ---------- */
  function seed() {
    if (!localStorage.getItem(K.members)) sj(K.members, [
      { id: uid(), name: '김참살', phone: '010-2241-7780', email: 'kimcs@email.com', joined: '2025-11-04', grade: '정회원' },
      { id: uid(), name: '이정선', phone: '010-9930-1187', email: 'leejs@email.com', joined: '2025-12-12', grade: '정회원' },
      { id: uid(), name: '박발효', phone: '010-4456-2093', email: 'park@email.com', joined: '2026-01-20', grade: '준회원' },
      { id: uid(), name: '최씨장', phone: '010-7788-5521', email: 'choi@email.com', joined: '2026-02-09', grade: '정회원' },
    ]);
    if (!localStorage.getItem(K.popups)) sj(K.popups, [
      { id: uid(), title: '[샘플] 2026 봄학기 지도사 과정 모집', body: '전통발효식품체험지도사 2026년 1기를 모집합니다.\n4월 4일 개강 · 선착순 마감.', link: 'instructor.html', linkLabel: '과정 보러가기', active: true, startsAt: '', endsAt: '' },
    ]);
    // demo records if entirely empty, so tables aren't bare
    if (!localStorage.getItem(K.orders)) sj(K.orders, [
      { id: uid(), kind: 'order', product: '전통 된장 (1kg)', qty: '2', name: '김참살', phone: '010-2241-7780', address: '서울 구로구', memo: '', status: '신규', at: '2026-03-02T10:12:00' },
      { id: uid(), kind: 'seedjang', amount: '씨장 30kg 분양', name: '이정선', phone: '010-9930-1187', region: '강원 정선', memo: '펜션 무료사용 문의', status: '확인', at: '2026-02-27T15:40:00' },
    ]);
    if (!localStorage.getItem(K.apps)) sj(K.apps, [
      { id: uid(), name: '박발효', phone: '010-4456-2093', email: 'park@email.com', region: '경기 성남', course: '정규 지도사 과정', memo: '주말반 희망', status: '신규', at: '2026-03-01T09:05:00' },
    ]);
    if (!localStorage.getItem(K.inq)) sj(K.inq, [
      { id: uid(), name: '정문의', phone: '010-3322-1100', email: '', type: '제휴 문의', memo: '지역 장터 입점 제안드립니다.', status: '신규', at: '2026-02-29T11:20:00' },
    ]);
  }

  /* ---------- status options ---------- */
  var STATUS = {
    orders: ['신규', '확인', '배송중', '완료', '취소'],
    apps: ['신규', '상담', '확정', '수료', '취소'],
    inq: ['신규', '답변완료', '보류'],
  };

  /* ---------- generic row ops ---------- */
  function updateField(key, id, field, val) { var a = gj(key, []); a.forEach(function(r){ if(r.id===id) r[field]=val; }); sj(key, a); }
  function removeRow(key, id) { sj(key, gj(key, []).filter(function(r){ return r.id !== id; })); }

  function statusSelect(key, sk, r) {
    return '<select class="st-sel" data-act="status" data-key="' + key + '" data-id="' + r.id + '">' +
      STATUS[sk].map(function(o){ return '<option' + (o === r.status ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
  }
  function delBtn(key, id) { return '<button class="icon-btn" data-act="del" data-key="' + key + '" data-id="' + id + '" title="삭제"><i data-lucide="trash-2"></i></button>'; }

  function emptyRow(cols, msg) { return '<tr><td colspan="' + cols + '"><div class="admin-empty"><i data-lucide="inbox"></i><div>' + msg + '</div></div></td></tr>'; }

  /* ---------- views ---------- */
  function viewDashboard() {
    var orders = gj(K.orders, []), apps = gj(K.apps, []), inq = gj(K.inq, []), members = gj(K.members, []);
    var newCount = function(a){ return a.filter(function(r){ return r.status === '신규'; }).length; };
    var stats = [
      { i: 'shopping-cart', v: orders.length, l: '전체 주문 · 분양', n: newCount(orders) },
      { i: 'user-plus', v: apps.length, l: '체험지도사 신청', n: newCount(apps) },
      { i: 'message-square', v: inq.length, l: '문의 내역', n: newCount(inq) },
      { i: 'users', v: members.length, l: '회원 수', n: 0 },
    ];
    var cards = stats.map(function(s){
      return '<div class="stat"><div class="si"><i data-lucide="' + s.i + '"></i></div><div class="sv">' + s.v +
        (s.n ? '<span style="font-size:13px;color:var(--point);font-weight:700;margin-left:8px">신규 ' + s.n + '</span>' : '') +
        '</div><div class="sl">' + s.l + '</div></div>';
    }).join('');
    var recent = orders.concat(apps).concat(inq).sort(function(a,b){ return (b.at||'').localeCompare(a.at||''); }).slice(0, 6);
    var rows = recent.length ? recent.map(function(r){
      var label = r.kind === 'order' ? '주문' : r.kind === 'seedjang' ? '씨장분양' : r.course ? '지도사신청' : r.type ? '문의' : '신청';
      var detail = r.product || r.amount || r.course || r.type || '-';
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td><span class="tag">' + label + '</span></td><td>' + esc(r.name || '-') + '</td><td>' + esc(detail) + '</td><td><span class="tag point">' + esc(r.status || '신규') + '</span></td></tr>';
    }).join('') : emptyRow(5, '아직 접수된 내역이 없습니다.');
    return '<div class="stat-grid">' + cards + '</div>' +
      '<div class="panel" style="margin-top:24px"><div class="panel-head"><h3>최근 접수 내역</h3><span class="ph-sub">주문·신청·문의 통합</span></div>' +
      '<table class="admin-table"><thead><tr><th>일시</th><th>구분</th><th>이름</th><th>내용</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function viewOrders() {
    var a = gj(K.orders, []);
    var rows = a.length ? a.map(function(r){
      var item = r.kind === 'seedjang' ? (r.amount || '씨장 분양') : (r.product || '-');
      var kind = r.kind === 'seedjang' ? '<span class="tag point">씨장분양</span>' : '<span class="tag">제품</span>';
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + kind + '</td><td>' + esc(item) + '</td><td>' + esc(r.qty || '-') + '</td><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td>' + esc(r.address||r.region||'-') + '</td><td>' + statusSelect(K.orders,'orders',r) + '</td><td>' + delBtn(K.orders, r.id) + '</td></tr>';
    }).join('') : emptyRow(9, '주문·분양 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>상품 주문 · 씨장 분양 관리</h3><span class="ph-sub">총 ' + a.length + '건</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>일시</th><th>구분</th><th>상품/용량</th><th>수량</th><th>주문자</th><th>연락처</th><th>배송지/지역</th><th>상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function viewApps() {
    var a = gj(K.apps, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td>' + esc(r.email||'-') + '</td><td>' + esc(r.region||'-') + '</td><td>' + esc(r.course||'-') + '</td><td>' + statusSelect(K.apps,'apps',r) + '</td><td>' + delBtn(K.apps, r.id) + '</td></tr>';
    }).join('') : emptyRow(8, '신청 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>전통발효식품체험지도사 신청 관리</h3><span class="ph-sub">총 ' + a.length + '명</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>이메일</th><th>지역</th><th>희망 과정</th><th>상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function viewInq() {
    var a = gj(K.inq, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td class="dt">' + fmtDate(r.at) + '</td><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td><span class="tag">' + esc(r.type||'문의') + '</span></td><td style="max-width:280px">' + esc(r.memo||'-') + '</td><td>' + statusSelect(K.inq,'inq',r) + '</td><td>' + delBtn(K.inq, r.id) + '</td></tr>';
    }).join('') : emptyRow(7, '문의 내역이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>문의 내역 관리</h3><span class="ph-sub">총 ' + a.length + '건</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>일시</th><th>이름</th><th>연락처</th><th>유형</th><th>내용</th><th>상태</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function viewMembers() {
    var a = gj(K.members, []);
    var rows = a.length ? a.map(function(r){
      return '<tr><td>' + esc(r.name||'-') + '</td><td>' + esc(r.phone||'-') + '</td><td>' + esc(r.email||'-') + '</td><td class="dt">' + esc(r.joined||'-') + '</td><td><span class="tag' + (r.grade==='정회원'?' solid':'') + '">' + esc(r.grade||'준회원') + '</span></td><td>' + delBtn(K.members, r.id) + '</td></tr>';
    }).join('') : emptyRow(6, '등록된 회원이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>회원 정보 관리</h3><span class="ph-sub">총 ' + a.length + '명</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>이름</th><th>연락처</th><th>이메일</th><th>가입일</th><th>등급</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<form class="admin-form" id="memberForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field"><label>이름</label><input name="name" required placeholder="홍길동"></div>' +
        '<div class="field"><label>연락처</label><input name="phone" placeholder="010-0000-0000"></div>' +
        '<div class="field"><label>이메일</label><input name="email" type="email" placeholder="name@email.com"></div>' +
        '<div class="field"><label>등급</label><select name="grade"><option>정회원</option><option>준회원</option></select></div>' +
        '<div class="full"><button class="btn btn-point" type="submit"><i data-lucide="user-plus"></i>회원 추가</button></div>' +
      '</form></div>';
  }

  function viewPartners() {
    var a = S.getPartners ? S.getPartners() : gj('kach_partners_v1', []);
    var cards = a.length ? a.map(function(p){
      var logo = p.logo ? '<img src="' + esc(p.logo) + '" alt="">' : esc(p.name);
      return '<div class="pcard"><div class="pc-logo">' + logo + '</div>' +
        '<div><div class="pc-name">' + esc(p.name) + (p.featured?' <span class="tag point" style="font-size:10px">주요</span>':'') + '</div><div class="pc-sub">' + esc(p.sub||'') + '</div></div>' +
        '<div class="pc-row"><button class="btn-text" data-act="pfeature" data-id="' + p.id + '" style="font-size:12px">' + (p.featured?'주요 해제':'주요 지정') + '</button>' + delBtn('PARTNER', p.id) + '</div></div>';
    }).join('') : '<div class="admin-empty" style="grid-column:1/-1"><i data-lucide="handshake"></i><div>등록된 파트너가 없습니다.</div></div>';
    return '<div class="panel"><div class="panel-head"><h3>파트너 관리</h3><span class="ph-sub">홈 파트너 스트립에 노출 · 총 ' + a.length + '곳</span></div>' +
      '<div class="card-list">' + cards + '</div>' +
      '<form class="admin-form" id="partnerForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field"><label>파트너명</label><input name="name" required placeholder="예) 정선만장대"></div>' +
        '<div class="field"><label>한 줄 설명</label><input name="sub" placeholder="예) 전통발효명가 · 강원 정선"></div>' +
        '<div class="field"><label>링크 (선택)</label><input name="url" placeholder="https://"></div>' +
        '<div class="field"><label>로고 이미지 (선택)</label><input name="logo" type="file" accept="image/*"></div>' +
        '<div class="field full" style="flex-direction:row;align-items:center;gap:12px"><button type="button" class="toggle" id="pFeat"><i></i></button><label style="margin:0">주요 파트너로 지정</label></div>' +
        '<div class="full" style="display:flex;gap:10px"><button class="btn btn-point" type="submit"><i data-lucide="plus"></i>파트너 추가</button><button class="btn btn-ghost" type="button" id="partnerReset"><i data-lucide="rotate-ccw"></i>기본값 복원</button></div>' +
      '</form></div>';
  }

  function viewPopups() {
    var a = gj(K.popups, []);
    var rows = a.length ? a.map(function(p){
      return '<tr><td><b>' + esc(p.title) + '</b><div class="pc-sub" style="margin-top:3px">' + esc((p.body||'').replace(/\n/g,' ')).slice(0,50) + '</div></td>' +
        '<td class="dt">' + (p.startsAt||'상시') + (p.endsAt?(' ~ '+p.endsAt):'') + '</td>' +
        '<td><button class="toggle ' + (p.active?'on':'') + '" data-act="poptoggle" data-id="' + p.id + '"><i></i></button></td>' +
        '<td>' + delBtn(K.popups, p.id) + '</td></tr>';
    }).join('') : emptyRow(4, '등록된 팝업이 없습니다.');
    return '<div class="panel"><div class="panel-head"><h3>팝업 관리</h3><span class="ph-sub">활성 팝업은 홈 첫 화면에 노출됩니다</span></div>' +
      '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>제목 · 내용</th><th>노출 기간</th><th>활성</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<form class="admin-form" id="popupForm" style="border-top:1px solid var(--line-soft)">' +
        '<div class="field full"><label>제목</label><input name="title" required placeholder="예) 2026 봄학기 지도사 과정 모집"></div>' +
        '<div class="field full"><label>내용</label><textarea name="body" placeholder="팝업에 표시할 안내 문구"></textarea></div>' +
        '<div class="field"><label>링크 (선택)</label><input name="link" placeholder="instructor.html"></div>' +
        '<div class="field"><label>버튼 문구</label><input name="linkLabel" placeholder="자세히 보기"></div>' +
        '<div class="field"><label>시작일 (선택)</label><input name="startsAt" type="date"></div>' +
        '<div class="field"><label>종료일 (선택)</label><input name="endsAt" type="date"></div>' +
        '<div class="full"><button class="btn btn-point" type="submit"><i data-lucide="plus"></i>팝업 추가</button></div>' +
      '</form></div>';
  }

  /* ---------- nav ---------- */
  var NAV = [
    { id: 'dashboard', label: '대시보드', icon: 'layout-dashboard', view: viewDashboard, title: '대시보드' },
    { id: 'orders', label: '상품 주문', icon: 'shopping-cart', view: viewOrders, title: '상품 주문 관리', countKey: K.orders },
    { id: 'apps', label: '지도사 신청', icon: 'user-plus', view: viewApps, title: '참가자 신청 관리', countKey: K.apps },
    { id: 'inq', label: '문의 내역', icon: 'message-square', view: viewInq, title: '문의 내역 관리', countKey: K.inq },
    { id: 'members', label: '회원 정보', icon: 'users', view: viewMembers, title: '회원 정보 관리', countKey: K.members },
    { id: 'partners', label: '파트너 관리', icon: 'handshake', view: viewPartners, title: '파트너 관리' },
    { id: 'popups', label: '팝업 관리', icon: 'bell', view: viewPopups, title: '팝업 관리', countKey: K.popups },
  ];
  var current = 'dashboard';

  function renderNav() {
    document.getElementById('adminNav').innerHTML = NAV.map(function(n){
      var cnt = n.countKey ? gj(n.countKey, []).length : 0;
      var badge = (n.countKey && cnt) ? '<span class="badge">' + cnt + '</span>' : '';
      return '<button data-nav="' + n.id + '" class="' + (n.id===current?'on':'') + '"><i data-lucide="' + n.icon + '"></i>' + n.label + badge + '</button>';
    }).join('');
    icons();
  }
  function render() {
    var n = NAV.filter(function(x){ return x.id === current; })[0] || NAV[0];
    document.getElementById('adminTitle').textContent = n.title;
    document.getElementById('adminView').innerHTML = n.view();
    renderNav();
    icons();
    bindForms();
  }

  /* ---------- form bindings ---------- */
  var pendingFeatured = false, pendingLogo = '';
  function bindForms() {
    var mf = document.getElementById('memberForm');
    if (mf) mf.addEventListener('submit', function(e){ e.preventDefault(); var d = formData(mf); d.id = uid(); d.joined = new Date().toISOString().slice(0,10); var a = gj(K.members, []); a.unshift(d); sj(K.members, a); render(); });

    var pf = document.getElementById('partnerForm');
    if (pf) {
      pendingFeatured = false; pendingLogo = '';
      var ft = document.getElementById('pFeat');
      if (ft) ft.addEventListener('click', function(){ pendingFeatured = !pendingFeatured; ft.classList.toggle('on', pendingFeatured); });
      var fileIn = pf.querySelector('input[name=logo]');
      if (fileIn) fileIn.addEventListener('change', function(){ var f = fileIn.files[0]; if(!f) return; var rd = new FileReader(); rd.onload = function(){ pendingLogo = rd.result; }; rd.readAsDataURL(f); });
      pf.addEventListener('submit', function(e){ e.preventDefault(); var d = formData(pf); var p = { id: uid(), name: d.name, sub: d.sub, url: d.url, logo: pendingLogo, featured: pendingFeatured }; var a = S.getPartners(); a.push(p); S.setPartners(a); render(); });
      var rs = document.getElementById('partnerReset');
      if (rs) rs.addEventListener('click', function(){ if(confirm('파트너 목록을 기본값으로 되돌릴까요?')){ S.setPartners(S.partnerDefaults.slice()); render(); } });
    }

    var pop = document.getElementById('popupForm');
    if (pop) pop.addEventListener('submit', function(e){ e.preventDefault(); var d = formData(pop); d.id = uid(); d.active = true; var a = gj(K.popups, []); a.unshift(d); sj(K.popups, a); render(); });
  }
  function formData(form){ var o = {}; new FormData(form).forEach(function(v,k){ if(k!=='logo') o[k]=v; }); return o; }

  /* ---------- delegation ---------- */
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t.dataset && t.dataset.act === 'status') { updateField(t.dataset.key, t.dataset.id, 'status', t.value); }
  });
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act;
    if (act === 'del') {
      if (!confirm('삭제하시겠습니까?')) return;
      if (b.dataset.key === 'PARTNER') { S.setPartners(S.getPartners().filter(function(p){ return p.id !== b.dataset.id; })); }
      else removeRow(b.dataset.key, b.dataset.id);
      render();
    } else if (act === 'poptoggle') {
      var a = gj(K.popups, []); a.forEach(function(p){ if(p.id===b.dataset.id) p.active = !p.active; }); sj(K.popups, a); render();
    } else if (act === 'pfeature') {
      var ps = S.getPartners(); ps.forEach(function(p){ if(p.id===b.dataset.id) p.featured = !p.featured; }); S.setPartners(ps); render();
    }
  });
  document.addEventListener('click', function(e){
    var nav = e.target.closest('[data-nav]'); if (!nav) return;
    current = nav.dataset.nav; render();
    document.querySelector('.admin-main').scrollTo(0,0);
  });

  /* ---------- auth ---------- */
  var PW = 'manjangdae';
  function unlock(){ document.getElementById('loginGate').style.display = 'none'; document.getElementById('adminApp').style.display = 'flex'; render(); icons(); }
  function initAuth() {
    var ok = sessionStorage.getItem('kach_admin') === '1';
    if (ok) { unlock(); }
    else {
      document.getElementById('loginGate').style.display = 'grid';
      icons();
      setTimeout(function(){ var i = document.getElementById('loginPw'); if(i) i.focus(); }, 100);
    }
    document.getElementById('loginForm').addEventListener('submit', function(e){
      e.preventDefault();
      var v = document.getElementById('loginPw').value;
      if (v === PW) { sessionStorage.setItem('kach_admin','1'); unlock(); }
      else { document.getElementById('loginErr').textContent = '비밀번호가 올바르지 않습니다.'; }
    });
    document.getElementById('logoutBtn').addEventListener('click', function(){ sessionStorage.removeItem('kach_admin'); location.reload(); });
  }

  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){ seed(); initAuth(); });
})();
