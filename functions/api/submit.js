/**
 * POST /api/submit  { kind: 'order'|'seedjang'|'apply'|'inquiry', data: {...} }
 *
 * 공개 양식(주문·씨장분양·지도사신청·문의)의 접수 창구.
 *
 * 서버가 하는 일 — 클라이언트를 믿지 않는 부분:
 *   · 주문번호를 **서버가** 발급한다(중복 없이).
 *   · 금액을 **서버가** 상품표에서 다시 계산한다. 브라우저가 보낸 unitPrice·total 은 버린다.
 *     그러지 않으면 개발자도구로 총액을 1원으로 바꿔 주문할 수 있다.
 *   · status 는 항상 '주문접수'/'신규'로 시작한다(클라이언트가 정하지 못한다).
 */
import {
  ORDER_INSERT, orderObjToBind, ORDER_ITEM_INSERT, orderItemBind,
  APP_INSERT, INQ_INSERT, appBind, inqBind, parseJSON, readDoc,
} from '../_shared/store.js';
import { reservedFor } from '../_shared/stock.js';
import { getMemberSession } from '../_shared/auth.js';
import { json, badRequest, methodNotAllowed, readJson } from '../_shared/http.js';

const MAX_LEN = 2000;
const MAX_ITEMS = 20;          // 장바구니 한 번에 담을 수 있는 가짓수
const clean = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);
const KINDS = new Set(['order', 'seedjang', 'apply', 'inquiry']);

function uid() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** 주문번호 = YYYYMMDD + 5자리. 충돌하면 다시 뽑는다(유니크 인덱스가 최종 방어선). */
async function issueOrderNo(env) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  for (let i = 0; i < 6; i += 1) {
    const no = ymd + String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const hit = await env.DB.prepare(`SELECT 1 FROM orders WHERE order_no = ?`).bind(no).first();
    if (!hit) return no;
  }
  return ymd + Date.now().toString().slice(-5);
}

/* 택배비 — 원본은 **관리자 > 설정**(shipFee · shipFreeOver)이다.
   브라우저가 보낸 값은 쓰지 않는다. 총액을 조작하지 못하게 하는 것과 같은 이유로,
   손님이 입금할 금액은 서버가 처음부터 끝까지 다시 만든다.
   기본값은 site.js 의 SETTINGS_DEFAULTS 와 같아야 한다(설정을 한 번도 저장하지 않은 상태). */
const SHIP_FEE_DEFAULT = 5000;
const SHIP_FREE_OVER_DEFAULT = 50000;
async function shipFeeFor(env, itemsTotal) {
  const st = (await readDoc(env, 'settings')) || {};
  const fee = Number(st.shipFee);
  const over = Number(st.shipFreeOver);
  const f = Number.isFinite(fee) && fee >= 0 ? fee : SHIP_FEE_DEFAULT;
  const o = Number.isFinite(over) && over > 0 ? over : SHIP_FREE_OVER_DEFAULT;
  return itemsTotal >= o ? 0 : f;
}

/**
 * 상품표에서 단가와 표시 이름을 직접 만든다. 상품이 없거나 판매중이 아니면 null(주문 거절).
 *
 * 이름까지 서버가 만드는 이유 두 가지.
 *  · 브라우저가 보낸 이름을 그대로 쓰면 아무 문자열이나 주문 내역에 남길 수 있다.
 *  · 옵션을 골랐을 때 기본 용량이 남아 어긋나는 문제를 여기서 끝낸다
 *    (예전에는 500ml 를 골라도 '오미자 식초 (300ml)' 로 저장됐다).
 *    옵션이 있으면 용량은 옵션 칸이 말해 주므로 이름에는 붙이지 않는다.
 */
async function resolveItem(env, productId, optionLabel) {
  if (!productId) return null;
  const row = await env.DB.prepare(
    `SELECT name, unit, price, sale_price, status, stock, price_on_request, doc FROM products WHERE id = ?`
  ).bind(productId).first();
  if (!row || row.status !== '판매중' || row.price_on_request) return null;

  let unit = row.sale_price != null ? Number(row.sale_price) : Number(row.price);
  const opt = parseJSON(row.doc, {}).option;
  let optLabel = null;
  let onHand = Number(row.stock) || 0;             // 옵션이 있으면 아래에서 옵션 재고로 바뀐다

  if (opt && Array.isArray(opt.values) && opt.values.length) {
    if (!optionLabel) return null;                 // 옵션 상품인데 안 골랐다 → 거절
    // optionLabel 은 '용량: 500ml (대)' 형태로 온다 — 뒷부분만 옵션값 이름이다
    const label = String(optionLabel).split(':').slice(1).join(':').trim() || String(optionLabel).trim();
    const hit = opt.values.find((v) => String(v.label).trim() === label);
    if (!hit) return null;                         // 없는 옵션을 보냈다 → 거절
    unit += Number(hit.add) || 0;
    optLabel = `${opt.name}: ${hit.label}`;        // 표기도 서버가 만든다
    onHand = Number(hit.stock) || 0;
  }
  if (!Number.isFinite(unit)) return null;

  return {
    unit,
    onHand,
    optionLabel: optLabel,
    name: optLabel ? row.name : row.name + (row.unit ? ` (${row.unit})` : ''),
  };
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ error: '접수할 수 없습니다.', code: 'server_unavailable' }, 503);

  const body = await readJson(request);
  if (!body || !KINDS.has(body.kind) || typeof body.data !== 'object' || !body.data) return badRequest();

  const kind = body.kind;
  const d = body.data;
  const now = new Date().toISOString();
  const id = uid();

  if (kind === 'apply') {
    if (!clean(d.name) || !clean(d.phone)) return badRequest('이름과 연락처를 입력해 주세요.');
    await env.DB.prepare(APP_INSERT).bind(...appBind({
      id, name: clean(d.name, 60), phone: clean(d.phone, 40), region: clean(d.region, 80),
      course: clean(d.course, 120), memo: clean(d.memo, MAX_LEN), status: '신규', at: now,
    })).run();
    return json({ ok: true, id }, 201);
  }

  if (kind === 'inquiry') {
    if (!clean(d.name) || !clean(d.memo)) return badRequest('이름과 문의 내용을 입력해 주세요.');
    await env.DB.prepare(INQ_INSERT).bind(...inqBind({
      id, name: clean(d.name, 60), phone: clean(d.phone, 40), type: clean(d.type, 40),
      memo: clean(d.memo, MAX_LEN), status: '신규', at: now,
    })).run();
    return json({ ok: true, id }, 201);
  }

  // ── 주문 · 씨장 분양 ─────────────────────────────────────
  if (!clean(d.name) || !clean(d.phone)) return badRequest('이름과 연락처를 입력해 주세요.');

  const orderNo = await issueOrderNo(env);
  /* 회원이 로그인한 채로 넣은 주문이면 계정에 묶는다.
     **쿠키로만 판단한다** — 브라우저가 보낸 memberId 를 믿으면 남의 계정에 주문을 꽂을 수 있다. */
  const ms = await getMemberSession(request, env);
  const rec = {
    id, orderNo, kind, status: '주문접수', payMethod: '무통장입금', at: now,
    memberId: ms ? ms.mid : null,
    name: clean(d.name, 60), phone: clean(d.phone, 40), email: clean(d.email, 120),
    address: clean(d.address, 300), depositor: clean(d.depositor, 60),
    request: clean(d.request, MAX_LEN), memo: clean(d.memo, MAX_LEN),
    region: clean(d.region, 80),
  };

  const itemStmts = [];
  if (kind === 'order') {
    if (!clean(d.address)) return badRequest('배송지 주소를 입력해 주세요.');

    /* 장바구니 주문은 items 로 온다. 한 품목만 살 때는 지금까지처럼 productId·qty 로 온다 —
       두 경로를 한 모양으로 맞춰 놓고 아래는 한 갈래로만 처리한다. */
    const raw = Array.isArray(d.items) && d.items.length
      ? d.items
      : [{ productId: d.productId, optionLabel: d.optionLabel, qty: d.qty }];
    if (raw.length > MAX_ITEMS) return badRequest(`한 번에 ${MAX_ITEMS}가지까지 주문하실 수 있습니다.`);

    /* 같은 상품·같은 옵션이 두 줄로 오면 합쳐서 본다.
       합치지 않으면 재고 3개짜리를 2개+2개로 나눠 담아 통과시킬 수 있다. */
    const merged = new Map();
    for (const r of raw) {
      const pid = clean(r.productId, 80);
      if (!pid) return badRequest('주문할 수 없는 상품입니다.');
      const opt = r.optionLabel == null ? '' : String(r.optionLabel);
      const qty = Math.max(1, Math.min(999, Math.floor(Number(r.qty) || 1)));
      const key = pid + '|' + opt;
      const hit = merged.get(key);
      if (hit) hit.qty = Math.min(999, hit.qty + qty);
      else merged.set(key, { productId: pid, optionLabel: opt || null, qty });
    }

    const items = [];
    let itemsTotal = 0;
    for (const m of merged.values()) {
      const item = await resolveItem(env, m.productId, m.optionLabel);
      if (!item) {
        return json({ error: '주문할 수 없는 상품이 있습니다. 페이지를 새로고침해 주세요.', code: 'unavailable' }, 409);
      }
      /* 남은 수량을 **여기서 다시 센다.** 화면이 받아 간 값은 페이지를 연 시점의 것이라,
         그 사이에 다 팔렸을 수 있다. 창고 수량에서 아직 발송하지 않은 주문을 뺀 값이
         실제로 팔 수 있는 수량이다(재고는 발송할 때 줄어든다). */
      const left = item.onHand - await reservedFor(env, m.productId, item.optionLabel);
      if (left < m.qty) {
        return json({
          error: left > 0
            ? `‘${item.name}’ 은(는) ${left}개만 남았습니다. 수량을 줄여 주세요.`
            : `‘${item.name}’ 이(가) 방금 품절되었습니다. 장바구니에서 빼 주세요.`,
          code: 'out_of_stock', productId: m.productId, left: Math.max(0, left),
        }, 409);
      }
      items.push({ productId: m.productId, product: item.name, optionLabel: item.optionLabel, qty: m.qty, unitPrice: item.unit });
      itemsTotal += item.unit * m.qty;
    }

    // 목록·조회 화면이 읽는 요약. 줄 하나하나의 원본은 order_items 다.
    const head = items[0];
    rec.productId = head.productId;
    rec.product = items.length === 1 ? head.product : `${head.product} 외 ${items.length - 1}건`;
    rec.optionLabel = items.length === 1 ? head.optionLabel : null;
    rec.qty = items.reduce((n, it) => n + it.qty, 0);
    rec.unitPrice = items.length === 1 ? head.unitPrice : null;
    rec.itemCount = items.length;
    // total 은 '손님이 입금할 금액' 이다 — 택배비는 주문 한 건에 **한 번만** 붙는다
    rec.shipFee = await shipFeeFor(env, itemsTotal);
    rec.total = itemsTotal + rec.shipFee;

    items.forEach((it, i) => {
      itemStmts.push(env.DB.prepare(ORDER_ITEM_INSERT).bind(...orderItemBind(id, i, it)));
    });
  } else {
    rec.amount = clean(d.amount, 120);
  }

  await env.DB.batch([
    env.DB.prepare(ORDER_INSERT).bind(...orderObjToBind(rec)),
    ...itemStmts,
  ]);
  return json({
    ok: true, id, orderNo,
    total: rec.total ?? null, shipFee: rec.shipFee ?? null, itemCount: rec.itemCount ?? null,
  }, 201);
}

export const onRequestGet = methodNotAllowed;
