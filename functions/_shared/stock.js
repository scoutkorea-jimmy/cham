/**
 * 재고 — '지금 팔 수 있는 수량'은 창고에 있는 수량이 아니다.
 *
 * 재고는 **발송할 때** 줄인다. 무통장입금이라, 입금하지 않은 주문이 창고 수량을
 * 영구히 묶어 버리는 일을 막기 위해서다.
 *
 * 그런데 그것만 하면 재고 1개짜리에 주문 10건이 전부 통과한다 — 주문 시점에는
 * 아직 아무것도 줄지 않았기 때문이다. 그래서 **팔 수 있는 수량은
 * '창고 수량 − 아직 발송하지 않은 주문 수량'** 으로 본다.
 * 공개 페이지에도 이 값을 내보낸다(창고 수량은 관리자만 본다).
 */

/** 아직 나가지 않아 재고를 잡고 있는 상태 */
export const UNSHIPPED = ['주문접수', '결제완료', '배송준비중'];
/** 이미 나가서 창고 수량이 실제로 줄어든 상태 */
export const SHIPPED = ['배송중', '배송완료'];

/** 옵션 없는 주문은 option_label 이 NULL 이라 '' 로 맞춰 둔다 */
export function optKey(productId, optionLabel) {
  return String(productId) + '|' + (optionLabel == null ? '' : String(optionLabel));
}

/** 상품·옵션별로 아직 발송하지 않은 수량 (bootstrap 이 한 번에 읽는다).
    주문 한 건에 품목이 여러 줄일 수 있어 order_items 에서 센다 — 그 표가 줄의 원본이다. */
export async function reservedMap(env) {
  const marks = UNSHIPPED.map(() => '?').join(',');
  const r = await env.DB.prepare(
    `SELECT i.product_id AS product_id, IFNULL(i.option_label, '') AS opt, SUM(i.qty) AS n
       FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.product_id IS NOT NULL AND o.status IN (${marks})
      GROUP BY i.product_id, opt`
  ).bind(...UNSHIPPED).all();
  const m = new Map();
  for (const row of r.results || []) m.set(optKey(row.product_id, row.opt), Number(row.n) || 0);
  return m;
}

/** 한 상품·한 옵션만 (주문을 받을 때 그 자리에서 다시 센다 — bootstrap 이후에 늘었을 수 있다) */
export async function reservedFor(env, productId, optionLabel) {
  const marks = UNSHIPPED.map(() => '?').join(',');
  const r = await env.DB.prepare(
    `SELECT IFNULL(SUM(i.qty), 0) AS n
       FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.product_id = ? AND IFNULL(i.option_label, '') = ? AND o.status IN (${marks})`
  ).bind(productId, optionLabel == null ? '' : String(optionLabel), ...UNSHIPPED).first();
  return Number(r && r.n) || 0;
}

/**
 * 팔 수 있는 수량을 **따로 된 표**로 만든다 — 상품 객체의 stock 은 창고 수량 그대로 둔다.
 *
 * 상품 객체를 고쳐 내보내면 안 된다. 관리자 화면도 같은 응답을 읽는데, 그 상태로
 * 상품을 저장하면 줄어든 값이 창고 수량으로 다시 저장되고, 발송할 때 또 줄어
 * **재고가 두 번 깎인다.**
 *
 * 옵션 상품은 옵션마다 따로 센다 — 500ml 만 다 팔렸는데 300ml 까지 막으면 안 된다.
 */
export function stockLeftMap(products, reserved) {
  const out = {};
  for (const p of products) {
    const opt = p.option;
    if (opt && Array.isArray(opt.values) && opt.values.length) {
      for (const v of opt.values) {
        const k = optKey(p.id, `${opt.name}: ${v.label}`);
        out[k] = Math.max(0, (Number(v.stock) || 0) - (reserved.get(k) || 0));
      }
    } else {
      const k = optKey(p.id, '');
      out[k] = Math.max(0, (Number(p.stock) || 0) - (reserved.get(k) || 0));
    }
  }
  return out;
}
