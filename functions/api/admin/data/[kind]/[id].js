/**
 * 한 건만 고치고 지운다.
 *
 *   PATCH  /api/admin/data/:kind/:id   { patch: {…} }  → 그 건만 고친다
 *   DELETE /api/admin/data/:kind/:id                   → 그 건만 지운다
 *
 * **왜 필요한가.** 예전엔 한 건을 고쳐도 목록 전체를 다시 보내 통째로 교체했다.
 * 주문 1,000건이면 상태 하나 바꾸는 데 약 500KB 가 오갔다. 그보다 나쁜 것은,
 * 화면이 **최근 1년치만** 들고 있게 된 뒤로는 그 전체 교체가
 * **1년 이전 자료를 전부 지워 버린다**는 점이다. 한 건만 건드리면 그 사고가 없다.
 *
 * 고치는 방법은 '한 줄을 읽어 → 합치고 → 그 줄만 다시 쓴다'.
 * 열마다 UPDATE 문을 만들지 않는 이유는, 목록 읽기·가져오기가 이미 쓰고 있는
 * 변환 코드(store.js)를 그대로 재사용해 형식이 어긋날 자리를 만들지 않기 위해서다.
 */
import {
  orderRowToObj, ORDER_INSERT, orderObjToBind,
  recordRowToObj, APP_INSERT, INQ_INSERT, appBind, inqBind,
  productRowToObj, PRODUCT_INSERT, productObjToBind,
  postRowToObj, POST_INSERT, postBind, bumpVersion,
} from '../../../../_shared/store.js';
import { SHIPPED } from '../../../../_shared/stock.js';
import { json, badRequest, notFound, methodNotAllowed, readJson } from '../../../../_shared/http.js';

/* 한 건씩 다룰 수 있는 항목. 교육과정·파트너·팝업은 한 덩어리 문서라 여기 없다
   (원래 작고, 통째로 저장해도 오래된 자료를 잃을 일이 없다). */
const ROW_KINDS = {
  orders:       { table: 'orders',       toObj: orderRowToObj,                     insert: ORDER_INSERT,   bind: orderObjToBind },
  applications: { table: 'applications', toObj: (r) => recordRowToObj(r, 'apply'),  insert: APP_INSERT,     bind: appBind },
  inquiries:    { table: 'inquiries',    toObj: (r) => recordRowToObj(r, 'inquiry'),insert: INQ_INSERT,     bind: inqBind },
  products:     { table: 'products',     toObj: productRowToObj,                    insert: PRODUCT_INSERT, bind: productObjToBind },
  posts:        { table: 'posts',        toObj: postRowToObj,                       insert: POST_INSERT,    bind: postBind },
};

function who(data) {
  const s = data && data.session;
  return (s && (s.displayName || s.username)) || null;
}

/**
 * 창고 수량은 **발송할 때** 줄어든다(주문을 받을 때가 아니라).
 * 되돌리기로 발송 이전 단계로 내리면 같은 수량을 되돌려 놓는다 —
 * 그러지 않으면 잘못 누른 한 번이 재고를 영영 깎는다.
 *
 * dir: -1 내보냄(줄인다) / +1 되돌림(늘린다). 고칠 것이 없으면 빈 배열.
 */
async function stockShiftStmts(env, order, dir) {
  // 품목 줄의 원본은 order_items 다. 요약 열만 보면 여러 품목 주문에서 첫 줄만 줄어든다.
  const { results } = await env.DB.prepare(
    `SELECT product_id, option_label, qty FROM order_items WHERE order_id = ? ORDER BY seq`
  ).bind(order.id).all();
  const lines = (results || []).map((r) => ({ productId: r.product_id, optionLabel: r.option_label, qty: r.qty }));
  if (!lines.length) return [];

  const out = [];
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    if (!line.productId || qty <= 0) continue;
    const row = await env.DB.prepare(`SELECT stock, doc FROM products WHERE id = ?`).bind(line.productId).first();
    if (!row) continue;                             // 상품이 지워졌다 — 되돌릴 곳이 없다

    let doc;
    try { doc = JSON.parse(row.doc || '{}'); } catch (e) { doc = {}; }
    const opt = doc.option;
    const move = dir * qty;

    if (opt && Array.isArray(opt.values) && opt.values.length) {
      if (!line.optionLabel) continue;
      const label = String(line.optionLabel).split(':').slice(1).join(':').trim();
      const i = opt.values.findIndex((v) => String(v.label).trim() === label);
      if (i < 0) continue;                          // 옵션이 그 사이 바뀌었다
      opt.values[i] = { ...opt.values[i], stock: Math.max(0, (Number(opt.values[i].stock) || 0) + move) };
      out.push(env.DB.prepare(`UPDATE products SET doc = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(JSON.stringify(doc), line.productId));
    } else {
      out.push(env.DB.prepare(`UPDATE products SET stock = MAX(0, stock + ?), updated_at = datetime('now') WHERE id = ?`)
        .bind(move, line.productId));
    }
  }
  return out;
}

export async function onRequestPatch({ request, params, env, data }) {
  const kind = String(params.kind || '');
  const id = String(params.id || '');
  const spec = ROW_KINDS[kind];
  if (!spec) return notFound('한 건씩 고칠 수 없는 항목입니다.');
  if (!id) return badRequest();

  const body = await readJson(request);
  if (!body || typeof body.patch !== 'object' || body.patch === null) return badRequest();

  const row = await env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).bind(id).first();
  if (!row) return notFound('이미 지워졌거나 없는 항목입니다.');

  // 읽어서 합친다. id 는 주소가 정하므로 본문이 바꾸지 못한다.
  const before = spec.toObj(row);
  const merged = { ...before, ...body.patch, id };

  const stmts = [
    env.DB.prepare(spec.insert).bind(...spec.bind(merged)),
    bumpVersion(env, kind, who(data)),
  ];
  // 발송선을 넘나들 때만 창고 수량을 건드린다. 같은 쪽 안에서의 상태 변경
  // (주문접수 → 결제완료, 배송중 → 배송완료)은 재고와 무관하다.
  if (kind === 'orders') {
    const was = SHIPPED.includes(before.status);
    const now = SHIPPED.includes(merged.status);
    if (was !== now) {
      const shifts = await stockShiftStmts(env, merged, now ? -1 : +1);
      if (shifts.length) {
        stmts.push(...shifts);
        stmts.push(bumpVersion(env, 'products', who(data)));
      }
    }
  }

  await env.DB.batch(stmts);
  return json({ ok: true, item: merged });
}

export async function onRequestDelete({ params, env, data }) {
  const kind = String(params.kind || '');
  const id = String(params.id || '');
  const spec = ROW_KINDS[kind];
  if (!spec) return notFound('한 건씩 지울 수 없는 항목입니다.');
  if (!id) return badRequest();

  const del = [env.DB.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).bind(id)];
  // 주문을 지우면 품목 줄도 함께 지운다 — 남으면 재고 예약이 영영 잡혀 있다
  if (kind === 'orders') del.push(env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(id));
  del.push(bumpVersion(env, kind, who(data)));
  const res = await env.DB.batch(del);
  const changed = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
  // 이미 없어도 오류로 보지 않는다 — 지우려던 결과는 같다(두 번 눌러도 안전하다)
  return json({ ok: true, deleted: changed });
}

export const onRequestGet = methodNotAllowed;
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
