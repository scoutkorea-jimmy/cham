/**
 * POST /api/order-lookup  { orderNo, contact }
 *
 * 비회원 주문 조회. 지금까지는 브라우저가 localStorage 의 **모든 주문**을 훑어
 * 대조했다 — 즉 남의 주문도 다 읽을 수 있었다. 서버에서 대조하고
 * 그 주문 한 건의 **진행 상태만** 돌려준다.
 *
 * 주소·입금자명 같은 나머지 개인정보는 내보내지 않는다. 주문번호는 8+5자리라
 * 무작위로 맞힐 수 있으므로, 맞혀도 얻을 게 없도록 응답을 최소화한다.
 */
import { json, badRequest, methodNotAllowed, readJson } from '../_shared/http.js';

const digits = (s) => String(s || '').replace(/\D/g, '');

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ error: '조회할 수 없습니다.', code: 'server_unavailable' }, 503);

  const body = await readJson(request);
  if (!body) return badRequest();
  const orderNo = String(body.orderNo || '').trim();
  const contact = String(body.contact || '').trim();
  if (!orderNo || !contact) return badRequest('주문번호와 연락처를 입력해 주세요.');

  const row = await env.DB.prepare(
    `SELECT id, order_no, kind, status, phone, email, product_name, option_label,
            qty, total, ship_fee, item_count, courier, tracking, created_at, payload
       FROM orders WHERE order_no = ?`
  ).bind(orderNo).first();

  // 주문이 없을 때와 연락처가 다를 때를 **구분하지 않는다** —
  // 구분해 주면 주문번호만으로 존재 여부를 훑을 수 있다.
  const miss = () => json({ found: false }, 200);
  if (!row) return miss();

  const d = digits(contact);
  const phoneOk = d.length >= 8 && digits(row.phone) === d;
  const mailOk = contact.includes('@') && String(row.email || '').toLowerCase() === contact.toLowerCase();
  if (!phoneOk && !mailOk) return miss();

  let amount = null, custRequest = null;
  try {
    const pl = JSON.parse(row.payload || '{}') || {};
    amount = pl.amount || null;
    custRequest = pl.custRequest || null;   // 손님이 낸 취소·반품 신청(있으면 화면이 알려 준다)
  } catch {}

  // 여러 품목 주문이면 줄 목록도 준다 — '외 2건'만 보이면 무엇을 샀는지 알 수 없다
  let items = null;
  if (Number(row.item_count) > 1) {
    const r = await env.DB.prepare(
      `SELECT product_name, option_label, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY seq`
    ).bind(row.id).all();
    items = (r.results || []).map((x) => ({
      product: x.product_name, optionLabel: x.option_label, qty: x.qty, unitPrice: x.unit_price,
    }));
  }

  return json({
    found: true,
    order: {
      orderNo: row.order_no,
      status: row.status,
      product: row.product_name || amount || '씨장 분양',
      optionLabel: row.option_label || null,
      qty: row.qty || null,
      total: row.total || null,
      shipFee: row.ship_fee == null ? null : row.ship_fee,
      items,
      courier: row.courier || null,
      tracking: row.tracking || null,
      at: row.created_at,
      custRequest,
    },
  });
}

export const onRequestGet = methodNotAllowed;
