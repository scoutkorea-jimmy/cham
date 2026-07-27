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

  /* ================= 마이페이지 ================= */
  function orderRows(orders) {
    if (!orders || !orders.length) {
      return '<tr><td colspan="4" style="text-align:center;color:var(--ink-mute);padding:24px">' +
        '아직 주문 내역이 없습니다. 로그인한 채로 주문하시면 여기에 모입니다.</td></tr>';
    }
    return orders.map(function (o) {
      return '<tr><td><b style="font-variant-numeric:tabular-nums">' + esc(o.orderNo || '-') + '</b>' +
        '<div class="mp-sub">' + fmtDate(o.at) + '</div></td>' +
        '<td>' + esc(o.product || o.amount || '-') +
          (o.optionLabel ? '<div class="mp-sub">' + esc(o.optionLabel) + '</div>' : '') + '</td>' +
        '<td>' + (o.total ? fmtWon(o.total) + '원' : '-') +
          (o.qty ? '<div class="mp-sub">' + esc(o.qty) + '개</div>' : '') + '</td>' +
        '<td><span class="tag">' + esc(o.status || '-') + '</span>' +
          (o.tracking ? '<div class="mp-sub">' + esc(o.courier || '') + ' ' + esc(o.tracking) + '</div>' : '') +
        '</td></tr>';
    }).join('');
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

    api('/api/members/me').then(function (r) {
      if (!r.ok) {
        // 로그인 전 — 로그인 폼만 보여 준다
        if (gate) gate.hidden = false;
        if (body) body.hidden = true;
        initLogin();
        icons();
        return;
      }
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
      if (tb) tb.innerHTML = orderRows(r.data.orders);
      icons();
    }).catch(function () {
      if (gate) gate.hidden = false;
      initLogin(); icons();
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
