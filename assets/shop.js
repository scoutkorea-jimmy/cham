/* ============================================================
   shop.js — 제품 목록 · 상품 상세페이지 (비회원 구매)
   - 목록: kach_products_v2 스토어에서 카테고리별 렌더 (숨김 제외)
   - 상세: 이미지 갤러리(스와이프) · 옵션/수량 → 금액 자동계산
           품절 비활성화 · 모바일 하단 고정 구매바
           법적 고지(상품정보고시·배송·교환/반품) 아코디언 · 관련 상품
   - 구매: Site.openModal('order') — 비회원 주문 + 무통장입금 안내
   ============================================================ */
(function () {
  'use strict';
  var S = window.Site;
  if (!S) return;
  var esc = S.esc, fmtWon = S.fmtWon, icons = S.icons;

  // ObjectURL 수명 관리 — 문서 종료 시 일괄 회수
  var objUrls = [];
  function mkURL(blob){ var u = URL.createObjectURL(blob); objUrls.push(u); return u; }
  window.addEventListener('pagehide', function () { objUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); objUrls = []; });

  /* ---------- 상품 이미지 로드 (대표 1장) ---------- */
  function mainImage(productId) {
    return S.idb.byIndex('pimg', 'productId', productId).then(function (imgs) {
      imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
      var main = imgs.filter(function (i) { return i.role === 'main'; })[0] || imgs[0];
      return main ? mkURL(main.blob) : null;
    });
  }

  function priceHTML(p, compact) {
    var now = p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);
    var hasDc = p.salePrice != null && p.salePrice !== '' && Number(p.salePrice) < Number(p.price);
    if (compact) {
      return (hasDc ? '<span style="color:var(--ink-faint);text-decoration:line-through;font-size:13px;margin-right:6px">' + fmtWon(p.price) + '</span>' : '') +
        '<span class="price">' + fmtWon(now) + '<small>원/' + esc(p.unit || '') + '</small></span>';
    }
    var dcRate = hasDc ? Math.round((1 - now / Number(p.price)) * 100) : 0;
    return (hasDc ? '<span class="dc">' + dcRate + '%</span><span class="was">' + fmtWon(p.price) + '원</span>' : '') +
      '<span class="now">' + fmtWon(now) + '원</span><span class="muted" style="font-size:14px">/ ' + esc(p.unit || '') + '</span>';
  }

  function cardHTML(p) {
    var soldout = p.status === '품절';
    return '<a class="card card-hover prod-link reveal" href="product.html?id=' + p.id + '" aria-label="' + esc(p.name) + ' 상세보기">' +
      '<div class="prod-img" data-pimg="' + p.id + '">' +
        '<div class="ph ' + (p.tone || 'tone-oat') + ' ratio-1" data-label="제품 사진 — ' + esc(p.name) + '" style="border-radius:0;height:100%"><i data-lucide="' + (p.icon || 'package') + '"></i></div>' +
        (soldout ? '<div class="prod-soldout-veil">품절</div>' : '') +
      '</div>' +
      '<div style="padding:20px">' +
        '<span class="tag' + (p.cat === '선물세트' ? ' point' : '') + '">' + esc(p.cat) + '</span>' +
        '<h3 style="font-size:var(--fs-h5);margin:12px 0 4px">' + esc(p.name) + '</h3>' +
        '<p class="muted" style="margin:0 0 12px;font-size:14px">' + esc(p.summary || '') + '</p>' +
        priceHTML(p, true) +
      '</div></a>';
  }

  function fillCardImages(scope) {
    (scope || document).querySelectorAll('[data-pimg]').forEach(function (box) {
      mainImage(box.dataset.pimg).then(function (url) {
        if (!url) return;
        box.querySelector('.ph').outerHTML = '<img src="' + url + '" alt="">';
      });
    });
  }

  /* ================= 제품 목록 페이지 ================= */
  function renderLists() {
    var cats = { '장류': 'grid-jang', '발효식품': 'grid-ferment', '선물세트': 'grid-gift' };
    var any = false;
    var products = S.getProducts().filter(function (p) { return p.status !== '숨김'; });
    Object.keys(cats).forEach(function (cat) {
      var box = document.getElementById(cats[cat]);
      if (!box) return;
      any = true;
      var list = products.filter(function (p) { return p.cat === cat; });
      box.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="muted">등록된 상품이 없습니다.</p>';
    });
    if (any) { icons(); fillCardImages(); if (S.revealScan) S.revealScan(); }
  }

  /* ================= 상품 상세 페이지 ================= */
  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function renderDetail() {
    var rootEl = document.getElementById('pdRoot');
    if (!rootEl) return;
    var p = S.getProduct(qs('id'));
    if (!p || p.status === '숨김') {
      rootEl.innerHTML = '<div class="wrap" style="padding:96px 32px;text-align:center">' +
        '<h1 style="font-size:26px">상품을 찾을 수 없습니다</h1>' +
        '<p class="muted" style="margin-top:12px">판매가 종료되었거나 주소가 잘못되었습니다.</p>' +
        '<a class="btn btn-point" href="products.html" style="margin-top:18px">제품 목록으로</a></div>';
      return;
    }
    document.title = p.name + ' · 한국찬전통발효식품협동조합';
    var soldout = p.status === '품절';
    var basePrice = p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);

    /* --- JSON-LD (SEO) --- */
    try {
      var ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, description: p.summary,
        offers: { '@type': 'Offer', price: basePrice, priceCurrency: 'KRW', availability: soldout ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
        brand: { '@type': 'Brand', name: '한국찬전통발효식품협동조합' },
      });
      document.head.appendChild(ld);
    } catch (e) {}

    var optHtml = '';
    if (p.option && p.option.values && p.option.values.length) {
      optHtml = '<div class="pd-row"><label for="pdOpt">' + esc(p.option.name) + '</label>' +
        '<select id="pdOpt">' + p.option.values.map(function (v, i) {
          var out = Number(v.stock) <= 0;
          return '<option value="' + i + '"' + (out ? ' disabled' : '') + '>' + esc(v.label) +
            (Number(v.add) ? ' (+' + fmtWon(v.add) + '원)' : '') + (out ? ' — 품절' : '') + '</option>';
        }).join('') + '</select></div>';
    }

    function gosiRows(g) {
      var rows = [
        ['품명 및 모델명', g.pname], ['제조사', g.maker], ['제조국', g.country], ['원산지', g.origin],
        ['용량 · 중량', g.volume], ['원재료명 및 함량', g.ingredients], ['소비기한', g.expiry], ['보관방법', g.storage],
        ['소비자상담 전화번호', g.phone], ['품질보증 기준', g.warranty],
      ];
      return rows.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + esc(r[1] || '-') + '</td></tr>'; }).join('');
    }

    rootEl.innerHTML =
      '<div class="wrap pd-crumb"><div class="crumb"><a href="index.html">홈</a><i data-lucide="chevron-right"></i><a href="products.html">제품</a><i data-lucide="chevron-right"></i><span>' + esc(p.name) + '</span></div></div>' +
      '<div class="wrap pd-top">' +
        '<div class="pd-gallery">' +
          '<div class="pd-main" id="pdMain">' +
            '<div class="pd-slide"><div class="ph ' + (p.tone || 'tone-oat') + '" data-label="제품 사진 — ' + esc(p.name) + '" style="width:100%;height:100%;border-radius:0"><i data-lucide="' + (p.icon || 'package') + '"></i></div></div>' +
          '</div>' +
          '<div class="pd-thumbs" id="pdThumbs"></div>' +
        '</div>' +
        '<div class="pd-info">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<span class="tag' + (p.cat === '선물세트' ? ' point' : '') + '">' + esc(p.cat) + '</span>' +
            (soldout ? '<span class="tag pd-badge-soldout">품절</span>' : '<span class="tag solid">판매중</span>') +
          '</div>' +
          '<h1>' + esc(p.name) + '</h1>' +
          '<p class="pd-summary">' + esc(p.summary || '') + '</p>' +
          '<div class="pd-price">' + priceHTML(p) + '</div>' +
          '<div class="pd-opts">' + optHtml +
            '<div class="pd-row"><label>수량</label><div class="stepper">' +
              '<button type="button" id="pdMinus" aria-label="수량 줄이기">−</button>' +
              '<input id="pdQty" type="number" value="1" min="1" inputmode="numeric">' +
              '<button type="button" id="pdPlus" aria-label="수량 늘리기">+</button>' +
            '</div></div>' +
          '</div>' +
          '<div class="pd-total"><span>총 상품 금액</span><b id="pdTotal">' + fmtWon(basePrice) + '원</b></div>' +
          '<div class="pd-cta">' +
            '<button class="btn btn-point btn-lg" id="pdBuy"' + (soldout ? ' disabled' : '') + '><i data-lucide="shopping-basket"></i>' + (soldout ? '품절' : '구매하기') + '</button>' +
            '<button class="btn btn-ghost btn-lg" id="pdAsk"><i data-lucide="message-circle"></i>문의하기</button>' +
          '</div>' +
          '<p class="pd-meta-note">· 회원가입 없이 <b>비회원 주문</b>이 가능합니다 (무통장입금)<br>· 주문 후 발급되는 주문번호로 <a href="#" data-modal="orderlookup" style="text-decoration:underline">주문 조회</a>를 할 수 있습니다</p>' +
        '</div>' +
      '</div>' +
      '<div class="wrap" style="padding-bottom:64px">' +
        '<div class="pd-acc">' +
          '<details open><summary>상세 설명 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body"><div class="rich" style="white-space:normal">' + (p.descHtml || '<p>상세 설명이 준비 중입니다.</p>') + '</div><div id="pdDetailImgs"></div></div></details>' +
          '<details><summary>상품정보고시 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body" style="white-space:normal"><table class="gosi-table"><tbody>' + gosiRows(p.gosi || {}) + '</tbody></table></div></details>' +
          '<details><summary>배송안내 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body">' + esc(p.ship || S.SHIP_TPL) + '</div></details>' +
          '<details><summary>교환 · 반품 · 환불 안내 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body">' + esc(p.refund || S.REFUND_TPL) + '\n\n· 소비자 상담: ' + esc((p.gosi && p.gosi.phone) || '02-855-8806') + ' (평일 09:00–18:00)</div></details>' +
        '</div>' +
        '<div id="pdRelatedWrap" style="display:none;margin-top:64px">' +
          '<div class="section-head"><span class="eyebrow">함께 보면 좋은</span><h2 style="font-size:26px">관련 상품</h2></div>' +
          '<div class="grid g-4" id="pdRelated" style="margin-top:28px"></div>' +
        '</div>' +
      '</div>' +
      '<div class="buybar"><span class="bb-price" id="bbPrice">' + fmtWon(basePrice) + '원</span>' +
        '<button class="btn btn-point" id="bbBuy"' + (soldout ? ' disabled' : '') + '>' + (soldout ? '품절' : '구매하기') + '</button></div>';
    document.body.classList.add('has-buybar');
    icons();

    /* --- 이미지 갤러리 (대표 + 추가, 스와이프) --- */
    S.idb.byIndex('pimg', 'productId', p.id).then(function (imgs) {
      imgs = imgs.filter(function (i) { return i.role !== 'detail'; });
      imgs.sort(function (a, b) { return (a.role === 'main' ? -1 : 1) - (b.role === 'main' ? -1 : 1) || (a.ord || 0) - (b.ord || 0); });
      var detailImgs = [];
      S.idb.byIndex('pimg', 'productId', p.id).then(function (all) {
        detailImgs = all.filter(function (i) { return i.role === 'detail'; }).sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
        var dbox = document.getElementById('pdDetailImgs');
        if (dbox && detailImgs.length) {
          dbox.innerHTML = detailImgs.map(function (d) {
            return '<img src="' + mkURL(d.blob) + '" alt="' + esc(p.name) + ' 상세 이미지" style="width:100%;border-radius:var(--r-sm);margin-top:12px">';
          }).join('');
        }
      });
      if (!imgs.length) return;
      var main = document.getElementById('pdMain');
      var urls = imgs.map(function (i) { return mkURL(i.blob); });
      main.innerHTML = urls.map(function (u) {
        return '<div class="pd-slide"><img src="' + u + '" alt="' + esc(p.name) + '"></div>';
      }).join('');
      var thumbs = document.getElementById('pdThumbs');
      if (urls.length > 1) {
        thumbs.innerHTML = urls.map(function (u, i) {
          return '<button class="' + (i === 0 ? 'on' : '') + '" data-pdgo="' + i + '" aria-label="' + (i + 1) + '번 사진"><img src="' + u + '" alt=""></button>';
        }).join('');
        thumbs.addEventListener('click', function (e) {
          var b = e.target.closest('[data-pdgo]');
          if (!b) return;
          main.scrollTo({ left: main.clientWidth * Number(b.dataset.pdgo), behavior: 'smooth' });
        });
        main.addEventListener('scroll', function () {
          var i = Math.round(main.scrollLeft / main.clientWidth);
          thumbs.querySelectorAll('button').forEach(function (b, j) { b.classList.toggle('on', i === j); });
        }, { passive: true });
      }
    });

    /* --- 옵션/수량 → 금액 자동 계산 --- */
    function currentOption() {
      var sel = document.getElementById('pdOpt');
      if (!sel || !p.option) return null;
      return p.option.values[Number(sel.value)] || null;
    }
    function unitPrice() {
      var o = currentOption();
      return basePrice + (o ? Number(o.add) || 0 : 0);
    }
    function updateTotal() {
      var qty = Math.max(1, Number(document.getElementById('pdQty').value) || 1);
      var total = fmtWon(unitPrice() * qty) + '원';
      document.getElementById('pdTotal').textContent = total;
      var bb = document.getElementById('bbPrice');
      if (bb) bb.textContent = total;
    }
    document.getElementById('pdMinus').addEventListener('click', function () {
      var q = document.getElementById('pdQty');
      q.value = Math.max(1, (Number(q.value) || 1) - 1); updateTotal();
    });
    document.getElementById('pdPlus').addEventListener('click', function () {
      var q = document.getElementById('pdQty');
      q.value = (Number(q.value) || 1) + 1; updateTotal();
    });
    document.getElementById('pdQty').addEventListener('input', updateTotal);
    var optSel = document.getElementById('pdOpt');
    if (optSel) optSel.addEventListener('change', updateTotal);

    /* --- 구매 / 문의 --- */
    function buy() {
      if (soldout) return;
      var o = currentOption();
      var qty = Math.max(1, Number(document.getElementById('pdQty').value) || 1);
      S.openModal('order', {
        product: p.name + ' (' + (p.unit || '') + ')',
        optionLabel: o ? p.option.name + ': ' + o.label : '',
        qty: String(qty),
        unitPrice: String(unitPrice()),
        productId: p.id,
      });
    }
    document.getElementById('pdBuy').addEventListener('click', buy);
    var bbBuy = document.getElementById('bbBuy');
    if (bbBuy) bbBuy.addEventListener('click', buy);
    document.getElementById('pdAsk').addEventListener('click', function () {
      S.openModal('inquiry', { type: '제품 문의', memo: '[상품 문의] ' + p.name + '\n' });
    });

    /* --- 관련 상품 (관리자 지정) --- */
    var rel = (p.related || []).map(S.getProduct).filter(function (x) { return x && x.status !== '숨김'; });
    if (rel.length) {
      document.getElementById('pdRelatedWrap').style.display = '';
      var relBox = document.getElementById('pdRelated');
      relBox.innerHTML = rel.slice(0, 4).map(cardHTML).join('');
      icons();
      fillCardImages(relBox);
    }
  }

  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    renderLists();
    renderDetail();
  });
})();
