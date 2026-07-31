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

  /* ---------- 상품 이미지 로드 (대표 1장) ----------
     이미지 주소는 Site.Media 가 만든다 — 서버 모드는 R2 주소, 로컬 모드는 blob: 주소. */
  function mainImage(productId) {
    // 서버 모드에서는 bootstrap 이 대표 이미지를 이미 실어 왔다 — 카드마다 다시 묻지 않는다
    var cached = S.Media.mainOf(productId);
    if (cached !== undefined) return Promise.resolve(cached ? cached.url : null);
    return S.Media.list('product', productId).then(function (imgs) {
      imgs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
      var main = imgs.filter(function (i) { return i.role === 'main'; })[0] || imgs[0];
      return main ? main.url : null;
    });
  }

  function priceHTML(p, compact) {
    // 확정 판매가가 없는 품목은 숫자를 지어내지 않고 '가격 문의'로 표시한다
    if (p.priceOnRequest) {
      return compact
        ? '<span class="price-ask">가격 문의</span>'
        : '<span class="price-ask" style="font-size:24px">가격 문의</span><span class="muted" style="font-size:var(--fs-sm);margin-left:var(--gap-tight)">전화 02-855-8806</span>';
    }
    var now = p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);
    var hasDc = p.salePrice != null && p.salePrice !== '' && Number(p.salePrice) < Number(p.price);
    if (compact) {
      return (hasDc ? '<span style="color:var(--ink-faint);text-decoration:line-through;font-size:13px;margin-right:var(--gap-tight)">' + fmtWon(p.price) + '</span>' : '') +
        '<span class="price">' + fmtWon(now) + '<small>원/' + esc(p.unit || '') + '</small></span>';
    }
    var dcRate = hasDc ? Math.round((1 - now / Number(p.price)) * 100) : 0;
    return (hasDc ? '<span class="dc">' + dcRate + '%</span><span class="was">' + fmtWon(p.price) + '원</span>' : '') +
      '<span class="now">' + fmtWon(now) + '원</span><span class="muted" style="font-size:14px">/ ' + esc(p.unit || '') + '</span>';
  }

  /* 대표 비주얼 — 관리자 업로드 사진이 없을 때 쓰이는 기본 표시.
     p.photo(정적 파일 경로)가 있으면 실사진을, 없으면 색면 자리표시를 낸다. */
  function fallbackVisual(p) {
    if (p.photo) return '<img class="prod-photo" src="' + esc(p.photo) + '" alt="' + esc(p.name) + '">';
    return '<div class="ph ' + (p.tone || 'tone-oat') + ' ratio-1" data-label="제품 사진 — ' + esc(p.name) + '" style="border-radius:0;height:100%"><i data-lucide="' + (p.icon || 'package') + '"></i></div>';
  }

  function cardHTML(p) {
    var soldout = S.isSoldOut(p);
    return '<a class="card card-hover prod-link reveal" href="product.html?id=' + p.id + '" aria-label="' + esc(p.name) + ' 상세보기">' +
      '<div class="prod-img" data-pimg="' + p.id + '">' +
        fallbackVisual(p) +
        (soldout ? '<div class="prod-soldout-veil">품절</div>' : '') +
      '</div>' +
      '<div style="padding:20px">' +
        '<span class="tag' + (p.cat === '선물세트' ? ' point' : '') + '">' + esc(p.cat) + '</span>' +
        '<h3 style="font-size:var(--fs-h5);margin:var(--gap-tight) 0 4px">' + esc(p.name) + '</h3>' +
        '<p class="muted" style="margin:0 0 var(--gap-tight);font-size:14px">' + esc(p.summary || '') + '</p>' +
        priceHTML(p, true) +
      '</div></a>';
  }

  function fillCardImages(scope) {
    (scope || document).querySelectorAll('[data-pimg]').forEach(function (box) {
      mainImage(box.dataset.pimg).then(function (url) {
        if (!url) return;
        var cur = box.querySelector('.ph, img');
        if (cur) cur.outerHTML = '<img src="' + url + '" alt="">';
      });
    });
  }

  /* ================= 제품 목록 페이지 ================= */
  function renderLists() {
    var any = false;
    var products = S.getProducts().filter(function (p) { return p.status !== '숨김'; });
    S.PRODUCT_CATS.forEach(function (cat) {
      var box = document.getElementById(cat.gridId);
      if (!box) return;
      any = true;
      var list = products.filter(function (p) { return p.cat === cat.name; });
      box.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="muted">등록된 상품이 없습니다.</p>';
    });
    if (any) { icons(); fillCardImages(); if (S.revealScan) S.revealScan(); }
  }

  /* 가격표 — 상품 데이터에서 만든다.
     예전에는 같은 페이지 안에서 표는 손으로 적은 숫자를, 상품 카드는 실제 데이터를
     보여 주었다. 관리자가 값을 고쳐도 표는 그대로라 선물상자가 표에서는 45,000원,
     카드에서는 50,000원이었다. 값이 두 군데 있으면 반드시 어긋난다. */
  function priceCell(p) {
    if (p.priceOnRequest) return '가격 문의';
    var base = p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);
    var adds = (p.option && p.option.values ? p.option.values : []).map(function (v) { return Number(v.add) || 0; });
    var max = adds.length ? Math.max.apply(null, adds) : 0;
    return max > 0 ? fmtWon(base) + ' ~ ' + fmtWon(base + max) + '원' : fmtWon(base) + '원';
  }
  // 용량 칸 — 옵션이 있으면 옵션 이름이 곧 용량이다(300ml (소) → 300ml)
  function volCell(p) {
    var vals = p.option && p.option.values ? p.option.values : [];
    if (!vals.length) return p.unit || '-';
    return vals.map(function (v) { return String(v.label || '').replace(/\s*\([^)]*\)\s*$/, ''); }).join(' · ');
  }
  function renderPriceTable() {
    /* 표 머리말의 배송 안내도 설정에서 만든다 — HTML 에 '5만원 이상 무료'를 적어 두면
       관리자 > 설정에서 기준을 바꿔도 이 줄만 옛말로 남는다. */
    var cap = document.getElementById('priceCaption');
    if (cap) cap.textContent = '부가세 포함가 · ' + S.shipNote();

    var products = S.getProducts().filter(function (p) { return p.status !== '숨김'; });

    var tb = document.getElementById('price-rows');
    if (tb) {
      var rows = products.map(function (p) {
        return '<tr><td>' + esc(p.cat || '-') + '</td><td>' + esc(p.name) + '</td>' +
          '<td>' + esc(volCell(p)) + '</td><td class="num">' + esc(priceCell(p)) + '</td></tr>';
      }).join('');
      // 씨장 분양은 상품표에 없는 별도 안내다(상담 후 확정) — 표 끝에 붙인다
      rows += '<tr><td>씨장</td><td>씨장 분양</td><td>-</td><td class="num">가격 문의</td></tr>';
      tb.innerHTML = rows;
    }

    /* 식초 페이지의 표(구분 열 없이 3칸). 여기도 상품 데이터에서 만든다 —
       손으로 적어 두었더니 선물상자가 표에서는 45,000원, 실제 상품은 50,000원이었다.
       제품 페이지에서 한 번 겪은 것과 같은 일이다. 값이 두 군데 있으면 반드시 어긋난다. */
    var vt = document.getElementById('vin-price-rows');
    if (vt) {
      var vin = products.filter(function (p) { return p.cat === '식초' || isVinegar(p); });
      vt.innerHTML = vin.length
        ? vin.map(function (p) {
            return '<tr><td>' + esc(p.name) + '</td><td>' + esc(volCell(p)) + '</td>' +
              '<td class="num">' + esc(priceCell(p)) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="3">등록된 상품이 없습니다.</td></tr>';
    }
  }

  /* ================= 상품 상세 페이지 ================= */
  /* 식초 섭취 유의사항 — 상품 하나하나의 상세설명에 적어 넣지 않는다.
     같은 글이 식초 품목 수만큼 흩어지면 한 곳만 고쳐지고 나머지는 옛말로 남으며,
     상세설명은 관리자가 지우거나 덮어쓸 수 있어 안전 안내가 조용히 사라진다.
     품목 성격에서 판단해 화면이 붙인다. */
  function isVinegar(p) {
    return /식초/.test(String(p.name || '')) || String(p.id || '').indexOf('p_vin_') === 0;
  }
  function cautionHTML(p) {
    if (!isVinegar(p)) return '';
    return '<div class="pd-caution"><b><i data-lucide="alert-circle"></i>드시기 전에</b>' +
      '<p>위장이 약하신 분은 <b>공복에 드시는 것을 권하지 않습니다.</b> 꼭 식후에 드세요. ' +
      '식초는 산도가 높아 원액 그대로 드시면 치아와 위에 자극이 될 수 있으니, 반드시 물에 6배 이상 희석해 드시고 드신 뒤에는 물을 충분히 마셔 주세요.</p></div>';
  }

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
        '<p class="muted" style="margin-top:var(--gap-tight)">판매가 종료되었거나 주소가 잘못되었습니다.</p>' +
        '<a class="btn btn-point" href="products.html" style="margin-top:var(--gap-related)">제품 목록으로</a></div>';
      return;
    }
    document.title = p.name + ' · 한국참전통발효식품협동조합';
    /* 제품별 메타/OG 보강(공유 미리보기·검색) */
    try {
      var setM = function (sel, val) { var m = document.querySelector(sel); if (m && val) m.setAttribute('content', val); };
      setM('meta[name="description"]', p.summary || p.name);
      setM('meta[property="og:title"]', p.name + ' · 한국참전통발효식품협동조합');
      setM('meta[property="og:description"]', p.summary);
    } catch (e) {}
    var soldout = S.isSoldOut(p);
    // 확정가가 없는 품목은 수량·합계·주문 UI를 띄우지 않고 전화/문의로만 받는다
    var ask = !!p.priceOnRequest;
    var basePrice = p.salePrice != null && p.salePrice !== '' ? Number(p.salePrice) : Number(p.price);

    /* --- JSON-LD (SEO) --- */
    try {
      var ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, description: p.summary,
        offers: { '@type': 'Offer', price: basePrice, priceCurrency: 'KRW', availability: soldout ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
        brand: { '@type': 'Brand', name: '한국참전통발효식품협동조합' },
      });
      document.head.appendChild(ld);
    } catch (e) {}

    var optHtml = '';
    if (p.option && p.option.values && p.option.values.length) {
      optHtml = '<div class="pd-row"><label for="pdOpt">' + esc(p.option.name) + '</label>' +
        '<select id="pdOpt">' + p.option.values.map(function (v, i) {
          // 남은 수량은 창고 수량이 아니다 — 아직 발송하지 않은 주문이 이미 잡고 있다
          var out = S.stockLeft(p, p.option.name + ': ' + v.label) <= 0;
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
            '<div class="pd-slide">' + fallbackVisual(p) + '</div>' +
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
          (ask ? '' :
            '<div class="pd-opts">' + optHtml +
              '<div class="pd-row"><label>수량</label><div class="stepper">' +
                '<button type="button" id="pdMinus" aria-label="수량 줄이기">−</button>' +
                '<input id="pdQty" type="number" value="1" min="1" inputmode="numeric">' +
                '<button type="button" id="pdPlus" aria-label="수량 늘리기">+</button>' +
              '</div></div>' +
            '</div>' +
            '<div class="pd-total"><span>총 상품 금액</span><b id="pdTotal">' + fmtWon(basePrice) + '원</b></div>' +
            '<p class="pd-ship-note"><i data-lucide="truck"></i>' + esc(S.shipNote()) + '</p>') +
          '<div class="pd-cta">' +
            (ask
              ? '<a class="btn btn-point btn-lg" href="tel:02-855-8806"><i data-lucide="phone"></i>02-855-8806</a>'
              : '<button class="btn btn-ghost btn-lg" id="pdCart"' + (soldout ? ' disabled' : '') + '><i data-lucide="plus"></i>장바구니</button>' +
                '<button class="btn btn-point btn-lg" id="pdBuy"' + (soldout ? ' disabled' : '') + '><i data-lucide="shopping-basket"></i>' + (soldout ? '품절' : '바로 구매') + '</button>') +
            '<button class="btn btn-ghost btn-lg" id="pdAsk"><i data-lucide="message-circle"></i>문의하기</button>' +
          '</div>' +
          (ask
            ? '<p class="pd-meta-note">· 이 품목은 <b>가격이 변동될 수 있어</b> 전화·문의로 안내해 드립니다<br>· 수량과 배송지를 알려주시면 정확한 금액을 안내해 드립니다</p>'
            : '<p class="pd-meta-note">· 회원가입 없이 <b>비회원 주문</b>이 가능합니다 (무통장입금)<br>· 주문 후 발급되는 주문번호로 <a href="#" data-modal="orderlookup" style="text-decoration:underline">주문 조회</a>를 할 수 있습니다</p>') +
        '</div>' +
      '</div>' +
      '<div class="wrap" style="padding-bottom:64px">' +
        '<div class="pd-acc">' +
          '<details open><summary>상세 설명 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body"><div class="rich" style="white-space:normal">' + (p.descHtml || '<p>상세 설명이 준비 중입니다.</p>') + '</div>' + cautionHTML(p) + '<div id="pdDetailImgs"></div></div></details>' +
          '<details><summary>상품정보고시 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body" style="white-space:normal"><table class="gosi-table"><tbody>' + gosiRows(p.gosi || {}) + '</tbody></table></div></details>' +
          // 배송비 줄은 상품에 저장된 글이 아니라 설정에서 만든다 — 저장해 두면 설정을
          // 고쳐도 상품마다 옛 금액이 남아, 같은 화면에 서로 다른 두 금액이 보인다.
          '<details><summary>배송안내 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body">' +
            esc(S.shipFeeLine() + '\n' + (p.ship || S.SHIP_TPL)) + '</div></details>' +
          '<details><summary>교환 · 반품 · 환불 안내 <i data-lucide="chevron-down"></i></summary><div class="pd-acc-body">' + esc(p.refund || S.REFUND_TPL) + '\n\n· 소비자 상담: ' + esc((p.gosi && p.gosi.phone) || '02-855-8806') + ' (평일 09:00–18:00)</div></details>' +
        '</div>' +
        '<div id="pdRelatedWrap" style="display:none;margin-top:var(--gap-sub)">' +
          '<div class="section-head"><span class="eyebrow">함께 보면 좋은</span><h2 style="font-size:26px">관련 상품</h2></div>' +
          '<div class="grid g-4" id="pdRelated" style="margin-top:var(--gap-group)"></div>' +
        '</div>' +
      '</div>' +
      (ask
        ? '<div class="buybar"><span class="bb-price">가격 문의</span>' +
            '<a class="btn btn-point" href="tel:02-855-8806">전화 문의</a></div>'
        : '<div class="buybar"><span class="bb-price" id="bbPrice">' + fmtWon(basePrice) + '원</span>' +
            '<button class="btn btn-ghost" id="bbCart"' + (soldout ? ' disabled' : '') + ' style="padding:12px 14px" aria-label="장바구니에 담기"><i data-lucide="plus"></i></button>' +
            '<button class="btn btn-point" id="bbBuy"' + (soldout ? ' disabled' : '') + '>' + (soldout ? '품절' : '바로 구매') + '</button></div>');
    document.body.classList.add('has-buybar');
    icons();

    /* --- 이미지 갤러리 (대표 + 추가, 스와이프) --- */
    // 한 번 읽어 상세 이미지와 갤러리로 나눠 쓴다(예전에는 같은 조회를 두 번 했다)
    S.Media.list('product', p.id).then(function (all) {
      var detailImgs = all.filter(function (i) { return i.role === 'detail'; })
        .sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
      var dbox = document.getElementById('pdDetailImgs');
      if (dbox && detailImgs.length) {
        dbox.innerHTML = detailImgs.map(function (d) {
          return '<img src="' + d.url + '" alt="' + esc(p.name) + ' 상세 이미지" style="width:100%;border-radius:var(--r-sm);margin-top:var(--gap-tight)">';
        }).join('');
      }
      var imgs = all.filter(function (i) { return i.role !== 'detail'; });
      imgs.sort(function (a, b) { return (a.role === 'main' ? -1 : 1) - (b.role === 'main' ? -1 : 1) || (a.ord || 0) - (b.ord || 0); });
      if (!imgs.length) return;
      var main = document.getElementById('pdMain');
      var urls = imgs.map(function (i) { return i.url; });
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
      if (ask) return;
      var qty = Math.max(1, Number(document.getElementById('pdQty').value) || 1);
      var total = fmtWon(unitPrice() * qty) + '원';
      document.getElementById('pdTotal').textContent = total;
      var bb = document.getElementById('bbPrice');
      if (bb) bb.textContent = total;
    }
    if (!ask) {
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
    }

    /* --- 구매 / 문의 --- */
    function buy() {
      if (soldout) return;
      var o = currentOption();
      var qty = Math.max(1, Number(document.getElementById('pdQty').value) || 1);
      // 옵션을 고르면 용량은 옵션 칸이 말해 준다 — 이름에 기본 용량을 붙이면
      // '오미자 식초 (300ml)' + '용량: 500ml' 처럼 서로 어긋난다.
      // (서버 모드에서는 /api/submit 이 상품표에서 같은 규칙으로 다시 만든다.)
      S.openModal('order', {
        product: o ? p.name : p.name + (p.unit ? ' (' + p.unit + ')' : ''),
        optionLabel: o ? p.option.name + ': ' + o.label : '',
        qty: String(qty),
        unitPrice: String(unitPrice()),
        productId: p.id,
      });
    }
    /* 장바구니에 담기 — 담은 뒤 화면을 옮기지 않는다. 더 담으러 온 사람을
       장바구니로 끌고 가면 다시 목록을 찾아 돌아와야 한다. */
    function addToCart() {
      if (soldout) return;
      var o = currentOption();
      var qty = Math.max(1, Number(document.getElementById('pdQty').value) || 1);
      S.cartAdd(p.id, o ? p.option.name + ': ' + o.label : null, qty);
      S.toast('장바구니에 담았습니다. 오른쪽 위 장바구니에서 확인하세요.');
    }
    var pdBuy = document.getElementById('pdBuy');
    if (pdBuy) pdBuy.addEventListener('click', buy);
    var bbBuy = document.getElementById('bbBuy');
    if (bbBuy) bbBuy.addEventListener('click', buy);
    var pdCart = document.getElementById('pdCart');
    if (pdCart) pdCart.addEventListener('click', addToCart);
    var bbCart = document.getElementById('bbCart');
    if (bbCart) bbCart.addEventListener('click', addToCart);
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

  // Site.ready 는 DOM 과 데이터(서버 모드의 /api/bootstrap)를 모두 기다린다.
  // 그냥 DOMContentLoaded 로 그리면 상품이 아직 없어 빈 목록이 나온다.
  function ready(fn){
    if (S.ready) { S.ready(fn); return; }
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    renderLists();
    renderPriceTable();
    renderDetail();
  });
})();
