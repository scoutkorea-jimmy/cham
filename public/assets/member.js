/**
 * cham · 회원 화면 (가입 · 로그인 · 내 정보)
 *
 * signup.html 과 mypage.html 이 함께 쓴다. 두 화면이 같은 규칙(아이디 형식·비밀번호
 * 길이·안내 문구)을 써야 해서 한 파일에 둔다 — 나뉘어 있으면 한쪽만 고쳐진다.
 *
 * **화면의 검사는 친절을 위한 것이고, 실제 방어선은 서버다.**
 * 아이디 중복·비밀번호 강도·동의 여부는 functions/api/members/* 에서 다시 본다.
 * 여기서 막는 이유는 왕복 한 번을 줄여 주기 위해서다.
 */
(function () {
  'use strict';
  var S = window.Site || {};

  function api(path, opts) {
    var o = opts || {};
    o.credentials = 'same-origin';
    if (o.body && typeof o.body !== 'string') {
      o.headers = o.headers || {}; o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(o.body);
    }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icons() { if (window.lucide && lucide.createIcons) lucide.createIcons(); }
  function fmtWon(n) { return (Number(n) || 0).toLocaleString('ko-KR'); }
  function fmtDate(s) {
    if (!s) return '-';
    var d = new Date(String(s).replace(' ', 'T') + (String(s).length <= 19 && String(s).indexOf('Z') < 0 ? 'Z' : ''));
    if (isNaN(d)) return String(s).slice(0, 10);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  /* 안내 줄 — 성공과 실패가 같은 자리에 뜬다. 자리가 다르면 눈이 두 곳을 살펴야 한다. */
  function say(el, msg, kind) {
    if (!el) return;
    el.className = 'form-msg' + (kind ? ' ' + kind : '');
    el.textContent = msg || '';
    el.hidden = !msg;
  }
  function lock(btn, on, busyText) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.disabled = true; btn.textContent = busyText || '처리 중…';
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }
  function vals(form) {
    var o = {};
    [].forEach.call(form.querySelectorAll('[name]'), function (el) {
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return o;
  }

  /* ================= 회원가입 ================= */
  function initSignup() {
    var form = document.getElementById('signupForm');
    if (!form) return;
    var msg = document.getElementById('signupMsg');
    var btn = form.querySelector('button[type=submit]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(form);
      if (!v.agreeTerms || !v.agreePrivacy) { say(msg, '이용약관과 개인정보 수집·이용에 동의해 주세요.', 'bad'); return; }
      if (v.password !== v.password2) { say(msg, '비밀번호가 서로 다릅니다.', 'bad'); return; }

      say(msg, '');
      lock(btn, true, '가입 중…');
      api('/api/members/signup', { method: 'POST', body: {
        username: v.username, password: v.password, name: v.name, phone: v.phone,
        email: v.email, postcode: v.postcode, address: v.address, addressDetail: v.addressDetail,
        marketingOptin: !!v.marketingOptin, agreeTerms: true, agreePrivacy: true,
      } }).then(function (r) {
        lock(btn, false);
        if (!r.ok) { say(msg, (r.data && r.data.error) || '가입하지 못했습니다.', 'bad'); return; }
        // 가입하면 바로 로그인된 상태다(서버가 쿠키를 내렸다) — 마이페이지로 보낸다
        location.href = 'mypage.html?welcome=1';
      }).catch(function () {
        lock(btn, false);
        say(msg, '연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', 'bad');
      });
    });
  }

  /* ================= 로그인 ================= */
  function initLogin() {
    var form = document.getElementById('loginFormM');
    if (!form) return;
    var msg = document.getElementById('loginMsgM');
    var btn = form.querySelector('button[type=submit]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(form);
      say(msg, '');
      lock(btn, true, '확인 중…');
      api('/api/members/login', { method: 'POST', body: { username: v.username, password: v.password } })
        .then(function (r) {
          lock(btn, false);
          if (!r.ok) { say(msg, (r.data && r.data.error) || '로그인하지 못했습니다.', 'bad'); return; }
          location.reload();
        }).catch(function () {
          lock(btn, false);
          say(msg, '연결하지 못했습니다.', 'bad');
        });
    });
  }

  /* 아이디 찾기 — 비밀번호는 여기서 다루지 않는다(메일 발송 수단을 아직 정하지 않았다).
     서버가 아이디를 가려서 돌려준다. 없을 때와 안 맞을 때를 구분해 알려주지 않는다 —
     구분해 주면 번호를 훑어 '이 번호는 회원이다'를 알아낼 수 있다. */
  function initFindId() {
    var open = document.getElementById('findIdOpen');
    var form = document.getElementById('findIdForm');
    if (!open || !form) return;
    var msg = document.getElementById('findIdMsg');
    open.addEventListener('click', function () {
      form.hidden = !form.hidden;
      if (!form.hidden) { var f = form.querySelector('[name=name]'); if (f) f.focus(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(form);
      var btn = form.querySelector('button[type=submit]');
      say(msg, '');
      lock(btn, true, '찾는 중…');
      api('/api/members/find-id', { method: 'POST', body: { name: v.name, phone: v.phone } })
        .then(function (r) {
          lock(btn, false);
          if (!r.ok) { say(msg, (r.data && r.data.error) || '조회하지 못했습니다.', 'bad'); return; }
          if (!r.data.found) {
            say(msg, '입력하신 이름과 번호로 가입된 아이디가 없습니다. 02-855-8806 으로 문의해 주세요.', 'bad');
            return;
          }
          var list = (r.data.ids || []).map(function (x) { return x.masked; }).join(', ');
          say(msg, '가입된 아이디: ' + list + ' — 가운데를 가려 보여 드립니다. 기억나지 않으시면 02-855-8806 으로 연락 주세요.', 'good');
        })
        .catch(function () { lock(btn, false); say(msg, '연결하지 못했습니다.', 'bad'); });
    });
  }

  /* ================= 마이페이지 ================= */
  function orderRows(orders) {
    if (!orders || !orders.length) {
      return '<tr><td colspan="4" style="text-align:center;color:var(--ink-mute);padding:24px">' +
        '아직 주문 내역이 없습니다. 로그인한 채로 주문하시면 여기에 모입니다.</td></tr>';
    }
    return orders.map(function (o) {
      /* 취소·반품은 **신청만** 한다 — 승인은 관리자가 판단한다.
         이미 낸 신청이 있으면 버튼 대신 그 사실을 보여 준다(두 번 신청하지 않게). */
      var can = S.orderReqOptions ? S.orderReqOptions(o.status) : [];
      var reqCell = o.custRequest
        ? '<div class="mp-sub">' + esc(S.orderReqNote(o.custRequest)) + '</div>'
        : (can.length
          ? '<button type="button" class="btn-text" data-oreq="' + esc(o.orderNo || '') + '">취소 · 반품 신청</button>'
          : '');
      return '<tr><td><b style="font-variant-numeric:tabular-nums">' + esc(o.orderNo || '-') + '</b>' +
        '<div class="mp-sub">' + fmtDate(o.at) + '</div></td>' +
        '<td>' + esc(o.product || o.amount || '-') +
          (o.optionLabel ? '<div class="mp-sub">' + esc(o.optionLabel) + '</div>' : '') + '</td>' +
        '<td>' + (o.total ? fmtWon(o.total) + '원' : '-') +
          (o.qty ? '<div class="mp-sub">' + esc(o.qty) + '개</div>' : '') + '</td>' +
        '<td><span class="tag">' + esc(o.status || '-') + '</span>' +
          (o.tracking ? '<div class="mp-sub">' + esc(o.courier || '') + ' ' + esc(o.tracking) + '</div>' : '') +
          reqCell +
        '</td></tr>';
    }).join('');
  }

  /* 신청 버튼 — 표를 다시 그릴 때마다 다시 걸지 않도록 위임으로 한 번만 건다.
     회원은 쿠키로 본인이 확인되므로 연락처를 다시 묻지 않는다. */
  function bindOrderRequests(tbody, orders) {
    if (!tbody || tbody._oreqBound) return;
    tbody._oreqBound = true;
    tbody.addEventListener('click', function (e) {
      var b = e.target.closest('[data-oreq]');
      if (!b || !S.openOrderRequest) return;
      var no = b.dataset.oreq;
      var o = orders.filter(function (x) { return String(x.orderNo) === no; })[0];
      if (!o) return;
      S.openOrderRequest({
        orderNo: no, status: o.status,
        onDone: function (req) { o.custRequest = req; tbody.innerHTML = orderRows(orders); },
      });
    });
  }

  function fillProfile(m) {
    var f = document.getElementById('profileForm');
    if (!f || !m) return;
    var set = function (n, v) { var el = f.querySelector('[name=' + n + ']'); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v; } };
    set('name', m.name); set('phone', m.phone); set('email', m.email);
    set('postcode', m.postcode); set('address', m.address); set('addressDetail', m.addressDetail);
    set('marketingOptin', m.marketingOptin);
  }

  function initMypage() {
    var root = document.getElementById('mpRoot');
    if (!root) return;
    var gate = document.getElementById('mpGate');       // 로그인 화면
    var body = document.getElementById('mpBody');       // 내 정보 화면

    /* 로그인 표식 쿠키가 없으면 서버에 묻지 않는다.
       손님 대부분은 로그인하지 않은 채로 이 페이지를 여는데, 그때마다 401 이
       한 번씩 오간다(브라우저 콘솔에도 오류로 찍힌다). 표식은 토큰과 함께
       내려가고 함께 지워지므로 어긋나지 않는다 — 표식만 거짓이어도
       마이페이지를 열면 서버가 로그인 화면을 돌려줄 뿐이다. */
    function showGate() {
      if (gate) gate.hidden = false;
      if (body) body.hidden = true;
      initLogin(); initFindId();
      icons();
    }
    if (S.memberLoggedIn && !S.memberLoggedIn()) { showGate(); return; }

    api('/api/members/me').then(function (r) {
      if (!r.ok) { showGate(); return; }        // 표식은 있었는데 서버가 아니라고 한다
      if (gate) gate.hidden = true;
      if (body) body.hidden = false;

      var m = r.data.member || {};
      var hi = document.getElementById('mpHello');
      if (hi) hi.innerHTML = '<b>' + esc(m.name) + '</b>님, 반갑습니다. <span class="mp-sub">아이디 ' + esc(m.username) + ' · 가입 ' + fmtDate(m.createdAt) + '</span>';
      if (new URLSearchParams(location.search).get('welcome')) {
        say(document.getElementById('mpMsg'), '가입이 완료되었습니다. 아래에서 정보를 확인해 주세요.', 'good');
      }
      fillProfile(m);
      var tb = document.getElementById('mpOrders');
      if (tb) {
        var list = r.data.orders || [];
        tb.innerHTML = orderRows(list);
        bindOrderRequests(tb, list);
      }
      icons();
    }).catch(function () {
      if (gate) gate.hidden = false;
      initLogin(); initFindId(); icons();
    });

    // 내 정보 저장
    var pf = document.getElementById('profileForm');
    if (pf) pf.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(pf);
      var msg = document.getElementById('profileMsg');
      var btn = pf.querySelector('button[type=submit]');
      say(msg, ''); lock(btn, true, '저장 중…');
      api('/api/members/me', { method: 'PATCH', body: {
        name: v.name, phone: v.phone, email: v.email,
        postcode: v.postcode, address: v.address, addressDetail: v.addressDetail,
        marketingOptin: !!v.marketingOptin,
      } }).then(function (r) {
        lock(btn, false);
        if (!r.ok) { say(msg, (r.data && r.data.error) || '저장하지 못했습니다.', 'bad'); return; }
        fillProfile(r.data.member);
        say(msg, '저장했습니다.', 'good');
      }).catch(function () { lock(btn, false); say(msg, '연결하지 못했습니다.', 'bad'); });
    });

    // 비밀번호 변경
    var pw = document.getElementById('pwForm');
    if (pw) pw.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(pw);
      var msg = document.getElementById('pwMsg');
      var btn = pw.querySelector('button[type=submit]');
      if (v.newPassword !== v.newPassword2) { say(msg, '새 비밀번호가 서로 다릅니다.', 'bad'); return; }
      say(msg, ''); lock(btn, true, '변경 중…');
      api('/api/members/me', { method: 'PATCH', body: { currentPassword: v.currentPassword, newPassword: v.newPassword } })
        .then(function (r) {
          lock(btn, false);
          if (!r.ok) { say(msg, (r.data && r.data.error) || '변경하지 못했습니다.', 'bad'); return; }
          pw.reset();
          say(msg, '비밀번호를 바꿨습니다. 다른 기기에서 로그인된 것은 모두 끊었습니다.', 'good');
        }).catch(function () { lock(btn, false); say(msg, '연결하지 못했습니다.', 'bad'); });
    });

    /* 탈퇴 — 되돌릴 수 없어서 문을 셋 둔다: 비밀번호 · 체크 · 마지막 확인창.
       셋 다 지나야 요청이 나간다. */
    var quit = document.getElementById('quitForm');
    if (quit) quit.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = vals(quit);
      var msg = document.getElementById('quitMsg');
      var btn = quit.querySelector('button[type=submit]');
      if (!v.confirm) { say(msg, '되돌릴 수 없다는 것을 확인해 주세요.', 'bad'); return; }
      if (!v.password) { say(msg, '지금 비밀번호를 넣어 주세요.', 'bad'); return; }
      if (!window.confirm('정말 탈퇴하시겠습니까?\n\n이름·연락처·주소가 모두 지워지고 되돌릴 수 없습니다.')) return;
      say(msg, ''); lock(btn, true, '처리 중…');
      api('/api/members/withdraw', { method: 'POST', body: { password: v.password } })
        .then(function (r) {
          lock(btn, false);
          if (!r.ok) { say(msg, (r.data && r.data.error) || '탈퇴하지 못했습니다.', 'bad'); return; }
          alert('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
          location.href = 'index.html';
        }).catch(function () { lock(btn, false); say(msg, '연결하지 못했습니다.', 'bad'); });
    });

    // 로그아웃
    var out = document.getElementById('mpLogout');
    if (out) out.addEventListener('click', function () {
      api('/api/members/logout', { method: 'POST' }).then(function () { location.href = 'index.html'; })
        .catch(function () { location.href = 'index.html'; });
    });
  }

  function ready(fn) {
    if (S.ready) { S.ready(fn); return; }
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { initSignup(); initMypage(); });
})();
