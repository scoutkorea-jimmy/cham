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
import { ORDER_INSERT, orderObjToBind, APP_INSERT, INQ_INSERT, appBind, inqBind, parseJSON } from '../_shared/store.js';
import { getMemberSession } from '../_shared/auth.js';
import { json, badRequest, methodNotAllowed, readJson } from '../_shared/http.js';

const MAX_LEN = 2000;
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
    `SELECT name, unit, price, sale_price, status, price_on_request, doc FROM products WHERE id = ?`
  ).bind(productId).first();
  if (!row || row.status !== '판매중' || row.price_on_request) return null;

  let unit = row.sale_price != null ? Number(row.sale_price) : Number(row.price);
  const opt = parseJSON(row.doc, {}).option;
  let optLabel = null;

  if (opt && Array.isArray(opt.values) && opt.values.length) {
    if (!optionLabel) return null;                 // 옵션 상품인데 안 골랐다 → 거절
    // optionLabel 은 '용량: 500ml (대)' 형태로 온다 — 뒷부분만 옵션값 이름이다
    const label = String(optionLabel).split(':').slice(1).join(':').trim() || String(optionLabel).trim();
    const hit = opt.values.find((v) => String(v.label).trim() === label);
    if (!hit) return null;                         // 없는 옵션을 보냈다 → 거절
    unit += Number(hit.add) || 0;
    optLabel = `${opt.name}: ${hit.label}`;        // 표기도 서버가 만든다
  }
  if (!Number.isFinite(unit)) return null;

  return {
    unit,
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

  if (kind === 'order') {
    if (!clean(d.address)) return badRequest('배송지 주소를 입력해 주세요.');
    const qty = Math.max(1, Math.min(999, Math.floor(Number(d.qty) || 1)));
    const item = await resolveItem(env, clean(d.productId, 80), d.optionLabel);
    if (!item) {
      return json({ error: '주문할 수 없는 상품입니다. 페이지를 새로고침해 주세요.', code: 'unavailable' }, 409);
    }
    rec.productId = clean(d.productId, 80);
    rec.product = item.name;            // 이름·옵션·금액 모두 상품표에서 만든 값
    rec.optionLabel = item.optionLabel;
    rec.qty = qty;
    rec.unitPrice = item.unit;
    rec.total = item.unit * qty;
  } else {
    rec.amount = clean(d.amount, 120);
  }

  await env.DB.prepare(ORDER_INSERT).bind(...orderObjToBind(rec)).run();
  return json({ ok: true, id, orderNo, total: rec.total ?? null }, 201);
}

export const onRequestGet = methodNotAllowed;
