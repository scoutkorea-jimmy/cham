/**
 * cham · D1 ↔ 클라이언트 객체 변환
 *
 * 클라이언트(site.js·admin.js·shop.js)가 지금 쓰는 객체 모양을 **그대로** 유지한다.
 * 그래야 화면 코드를 건드리지 않고 저장소만 바꿀 수 있다.
 * 읽기 API 와 가져오기(import) 가 같은 변환을 쓰도록 여기 한 곳에만 둔다.
 *
 * 기본값(SETTINGS_DEFAULTS 등)은 서버에 두지 않는다 — site.js 가 원본이고,
 * 서버는 '저장된 값이 있으면 그것, 없으면 null' 만 답한다. 두 곳에 두면 어긋난다.
 */

export function parseJSON(s, def) {
  if (s == null) return def;
  try { const v = JSON.parse(s); return v == null ? def : v; } catch { return def; }
}

const num = (v) => (v == null || v === '' ? null : Number(v));
const int = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; };

/* ── 주문 ─────────────────────────────────────────────────── */
// 열로 뽑은 값 + payload 를 합쳐 원래 레코드로 되돌린다.
export function orderRowToObj(r) {
  const extra = parseJSON(r.payload, {});
  const o = {
    ...extra,
    id: r.id, orderNo: r.order_no, kind: r.kind, status: r.status,
    name: r.name, phone: r.phone, email: r.email, address: r.address,
    productId: r.product_id, product: r.product_name, optionLabel: r.option_label,
    qty: r.qty, unitPrice: r.unit_price, total: r.total,
    depositor: r.depositor, payMethod: r.pay_method,
    shipMethod: r.ship_method, courier: r.courier, tracking: r.tracking,
    cancelReason: r.cancel_reason, rmaReason: r.rma_reason, pickupAddr: r.pickup_addr,
    at: r.created_at,
  };
  // null 열은 내보내지 않는다 — 기존 코드가 `o.tracking ? …` 처럼 존재 여부로 분기한다
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

const ORDER_COLS = new Set([
  'id', 'orderNo', 'kind', 'status', 'name', 'phone', 'email', 'address',
  'productId', 'product', 'optionLabel', 'qty', 'unitPrice', 'total',
  'depositor', 'payMethod', 'shipMethod', 'courier', 'tracking',
  'cancelReason', 'rmaReason', 'pickupAddr', 'at',
]);

export function orderObjToBind(o) {
  const payload = {};
  for (const k of Object.keys(o)) if (!ORDER_COLS.has(k)) payload[k] = o[k];
  return [
    String(o.id), String(o.orderNo || ''), o.kind || 'order', o.status || '주문접수',
    o.name ?? null, o.phone ?? null, o.email ?? null, o.address ?? null,
    o.productId ?? null, o.product ?? null, o.optionLabel ?? null,
    num(o.qty), num(o.unitPrice), num(o.total),
    o.depositor ?? null, o.payMethod ?? null,
    o.shipMethod ?? null, o.courier ?? null, o.tracking ?? null,
    o.cancelReason ?? null, o.rmaReason ?? null, o.pickupAddr ?? null,
    JSON.stringify(payload), o.at || new Date().toISOString(),
  ];
}

export const ORDER_INSERT = `
  INSERT INTO orders (id, order_no, kind, status, name, phone, email, address,
    product_id, product_name, option_label, qty, unit_price, total,
    depositor, pay_method, ship_method, courier, tracking,
    cancel_reason, rma_reason, pickup_addr, payload, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    order_no=excluded.order_no, kind=excluded.kind, status=excluded.status,
    name=excluded.name, phone=excluded.phone, email=excluded.email, address=excluded.address,
    product_id=excluded.product_id, product_name=excluded.product_name,
    option_label=excluded.option_label, qty=excluded.qty, unit_price=excluded.unit_price,
    total=excluded.total, depositor=excluded.depositor, pay_method=excluded.pay_method,
    ship_method=excluded.ship_method, courier=excluded.courier, tracking=excluded.tracking,
    cancel_reason=excluded.cancel_reason, rma_reason=excluded.rma_reason,
    pickup_addr=excluded.pickup_addr, payload=excluded.payload,
    created_at=excluded.created_at, updated_at=datetime('now')`;

/* ── 신청 · 문의 ──────────────────────────────────────────── */
export function recordRowToObj(r, kind) {
  const o = {
    id: r.id, name: r.name, phone: r.phone, memo: r.memo,
    status: r.status, adminMemo: r.admin_memo, handledAt: r.handled_at, at: r.created_at,
    kind,
  };
  if (kind === 'apply') { o.region = r.region; o.course = r.course; }
  else o.type = r.type;
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

export const APP_INSERT = `
  INSERT INTO applications (id, name, phone, region, course, memo, status, admin_memo, handled_at, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, region=excluded.region,
    course=excluded.course, memo=excluded.memo, status=excluded.status,
    admin_memo=excluded.admin_memo, handled_at=excluded.handled_at, created_at=excluded.created_at`;

export const INQ_INSERT = `
  INSERT INTO inquiries (id, name, phone, type, memo, status, admin_memo, handled_at, created_at)
  VALUES (?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, type=excluded.type,
    memo=excluded.memo, status=excluded.status, admin_memo=excluded.admin_memo,
    handled_at=excluded.handled_at, created_at=excluded.created_at`;

export const appBind = (r) => [
  String(r.id), r.name ?? null, r.phone ?? null, r.region ?? null, r.course ?? null,
  r.memo ?? null, r.status || '신규', r.adminMemo ?? null, r.handledAt ?? null,
  r.at || new Date().toISOString(),
];
export const inqBind = (r) => [
  String(r.id), r.name ?? null, r.phone ?? null, r.type ?? null,
  r.memo ?? null, r.status || '신규', r.adminMemo ?? null, r.handledAt ?? null,
  r.at || new Date().toISOString(),
];

/* ── 상품 ─────────────────────────────────────────────────── */
export function productRowToObj(r) {
  return {
    ...parseJSON(r.doc, {}),            // option · gosi · related · descHtml · icon · tone · photo · ship · refund
    id: r.id, name: r.name, cat: r.cat,
    price: r.price, salePrice: r.sale_price, unit: r.unit,
    status: r.status, stock: r.stock, summary: r.summary,
    ...(r.price_on_request ? { priceOnRequest: true } : {}),
  };
}

const PRODUCT_COLS = new Set(['id', 'name', 'cat', 'price', 'salePrice', 'unit', 'status', 'stock', 'summary', 'priceOnRequest']);

export function productObjToBind(p, ord) {
  const doc = {};
  for (const k of Object.keys(p)) if (!PRODUCT_COLS.has(k)) doc[k] = p[k];
  return [
    String(p.id), String(p.name || ''), p.cat ?? null,
    int(p.price), p.salePrice === '' || p.salePrice == null ? null : int(p.salePrice),
    p.unit ?? null, p.status || '판매중', int(p.stock), p.summary ?? null,
    p.priceOnRequest ? 1 : 0, int(ord), JSON.stringify(doc),
  ];
}

export const PRODUCT_INSERT = `
  INSERT INTO products (id, name, cat, price, sale_price, unit, status, stock, summary,
    price_on_request, sort_order, doc)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, cat=excluded.cat, price=excluded.price,
    sale_price=excluded.sale_price, unit=excluded.unit, status=excluded.status,
    stock=excluded.stock, summary=excluded.summary, price_on_request=excluded.price_on_request,
    sort_order=excluded.sort_order, doc=excluded.doc, updated_at=datetime('now')`;

/* ── 게시글 ───────────────────────────────────────────────── */
export function postRowToObj(r) {
  const o = {
    id: r.id, cat: r.cat, title: r.title, html: r.html,
    badge: r.badge, at: r.created_at,
  };
  if (r.important) o.important = true;
  if (r.sample) o.sample = true;
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

export const POST_INSERT = `
  INSERT INTO posts (id, cat, title, html, badge, important, sample, created_at)
  VALUES (?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET cat=excluded.cat, title=excluded.title, html=excluded.html,
    badge=excluded.badge, important=excluded.important, sample=excluded.sample,
    created_at=excluded.created_at, updated_at=datetime('now')`;

export const postBind = (p) => [
  String(p.id), p.cat || '공지', String(p.title || ''), p.html ?? null,
  p.badge ?? null, p.important ? 1 : 0, p.sample ? 1 : 0,
  p.at || new Date().toISOString(),
];

/* ── 목록(기수·파트너·팝업) · 단일 문서(설정·동의문·KMS) ──── */
export async function readCollection(env, kind) {
  const { results } = await env.DB.prepare(
    `SELECT id, doc FROM collections WHERE kind = ? ORDER BY sort_order, id`
  ).bind(kind).all();
  if (!results || !results.length) return null;   // null = 한 번도 저장한 적 없음 → 클라이언트 기본값
  return results.map((r) => ({ id: r.id, ...parseJSON(r.doc, {}) }));
}

export async function writeCollection(env, kind, list) {
  const stmts = [env.DB.prepare(`DELETE FROM collections WHERE kind = ?`).bind(kind)];
  (list || []).forEach((item, i) => {
    const { id, ...rest } = item || {};
    stmts.push(env.DB.prepare(
      `INSERT INTO collections (kind, id, sort_order, doc) VALUES (?,?,?,?)`
    ).bind(kind, String(id || `c${i}`), i, JSON.stringify(rest)));
  });
  await env.DB.batch(stmts);
}

export async function readDoc(env, key) {
  const row = await env.DB.prepare(`SELECT doc FROM documents WHERE key = ?`).bind(key).first();
  return row ? parseJSON(row.doc, null) : null;
}

export async function writeDoc(env, key, obj) {
  await env.DB.prepare(
    `INSERT INTO documents (key, doc) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET doc = excluded.doc, updated_at = datetime('now')`
  ).bind(key, JSON.stringify(obj ?? {})).run();
}

/* ── 이미지 ───────────────────────────────────────────────── */
// 클라이언트에는 blob 대신 URL 을 준다. applySlot()·갤러리는 이미 URL 을 받는 구조라 그대로 맞는다.
export function imageRowToObj(r) {
  const o = {
    id: r.id, scope: r.scope, ref: r.ref, role: r.role, ord: r.ord,
    url: `/api/images/${encodeURIComponent(r.id)}`,
    name: r.name, size: r.size,
  };
  if (r.scope === 'page') {
    o.pcx = r.pcx; o.pcy = r.pcy; o.mbx = r.mbx; o.mby = r.mby;
  }
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

export const IMAGE_INSERT = `
  INSERT INTO images (id, scope, ref, role, ord, r2_key, mime, size, name, pcx, pcy, mbx, mby)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET scope=excluded.scope, ref=excluded.ref, role=excluded.role,
    ord=excluded.ord, r2_key=excluded.r2_key, mime=excluded.mime, size=excluded.size,
    name=excluded.name, pcx=excluded.pcx, pcy=excluded.pcy, mbx=excluded.mbx, mby=excluded.mby`;
