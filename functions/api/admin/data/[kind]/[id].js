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
  postRowToObj, POST_INSERT, postBind,
} from '../../../../_shared/store.js';
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

/** 목록이 바뀌었음을 알린다 — 다른 사람 화면이 옛 버전으로 저장하지 못하게 */
function bump(env, kind, who) {
  return env.DB.prepare(
    `INSERT INTO list_versions (kind, version, updated_at, updated_by) VALUES (?, 1, datetime('now'), ?)
     ON CONFLICT(kind) DO UPDATE SET version = version + 1, updated_at = datetime('now'), updated_by = excluded.updated_by`
  ).bind(kind, who || null);
}

function who(data) {
  const s = data && data.session;
  return (s && (s.displayName || s.username)) || null;
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
  const merged = { ...spec.toObj(row), ...body.patch, id };

  await env.DB.batch([
    env.DB.prepare(spec.insert).bind(...spec.bind(merged)),
    bump(env, kind, who(data)),
  ]);
  return json({ ok: true, item: merged });
}

export async function onRequestDelete({ params, env, data }) {
  const kind = String(params.kind || '');
  const id = String(params.id || '');
  const spec = ROW_KINDS[kind];
  if (!spec) return notFound('한 건씩 지울 수 없는 항목입니다.');
  if (!id) return badRequest();

  const res = await env.DB.batch([
    env.DB.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).bind(id),
    bump(env, kind, who(data)),
  ]);
  const changed = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
  // 이미 없어도 오류로 보지 않는다 — 지우려던 결과는 같다(두 번 눌러도 안전하다)
  return json({ ok: true, deleted: changed });
}

export const onRequestGet = methodNotAllowed;
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
