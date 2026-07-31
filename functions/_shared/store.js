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
    qty: r.qty, unitPrice: r.unit_price, shipFee: r.ship_fee, total: r.total,
    itemCount: r.item_count,
    depositor: r.depositor, payMethod: r.pay_method,
    shipMethod: r.ship_method, courier: r.courier, tracking: r.tracking,
    cancelReason: r.cancel_reason, rmaReason: r.rma_reason, pickupAddr: r.pickup_addr,
    memberId: r.member_id,
    at: r.created_at,
  };
  // null 열은 내보내지 않는다 — 기존 코드가 `o.tracking ? …` 처럼 존재 여부로 분기한다
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

const ORDER_COLS = new Set([
  'id', 'orderNo', 'kind', 'status', 'name', 'phone', 'email', 'address',
  'productId', 'product', 'optionLabel', 'qty', 'unitPrice', 'shipFee', 'total', 'itemCount',
  // items 는 order_items 표가 원본이다 — payload 에 같이 넣으면 두 곳이 어긋난다
  'items',
  'depositor', 'payMethod', 'shipMethod', 'courier', 'tracking',
  'cancelReason', 'rmaReason', 'pickupAddr', 'at', 'memberId',
]);

export function orderObjToBind(o) {
  const payload = {};
  for (const k of Object.keys(o)) if (!ORDER_COLS.has(k)) payload[k] = o[k];
  return [
    String(o.id), String(o.orderNo || ''), o.kind || 'order', o.status || '주문접수',
    o.name ?? null, o.phone ?? null, o.email ?? null, o.address ?? null,
    o.productId ?? null, o.product ?? null, o.optionLabel ?? null,
    // 택배비만 num() 을 쓰지 않는다 — 0(무료)과 '이 열이 생기기 전 주문'(NULL)은 다른 뜻이다
    num(o.qty), num(o.unitPrice), o.shipFee == null ? null : Number(o.shipFee), num(o.total),
    o.itemCount == null ? null : Number(o.itemCount),
    o.depositor ?? null, o.payMethod ?? null,
    o.shipMethod ?? null, o.courier ?? null, o.tracking ?? null,
    o.cancelReason ?? null, o.rmaReason ?? null, o.pickupAddr ?? null,
    JSON.stringify(payload), o.at || new Date().toISOString(),
    o.memberId == null ? null : Number(o.memberId),
  ];
}

export const ORDER_INSERT = `
  INSERT INTO orders (id, order_no, kind, status, name, phone, email, address,
    product_id, product_name, option_label, qty, unit_price, ship_fee, total, item_count,
    depositor, pay_method, ship_method, courier, tracking,
    cancel_reason, rma_reason, pickup_addr, payload, created_at, member_id)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    order_no=excluded.order_no, kind=excluded.kind, status=excluded.status,
    name=excluded.name, phone=excluded.phone, email=excluded.email, address=excluded.address,
    product_id=excluded.product_id, product_name=excluded.product_name,
    option_label=excluded.option_label, qty=excluded.qty, unit_price=excluded.unit_price,
    ship_fee=excluded.ship_fee, total=excluded.total, item_count=excluded.item_count,
    depositor=excluded.depositor, pay_method=excluded.pay_method,
    ship_method=excluded.ship_method, courier=excluded.courier, tracking=excluded.tracking,
    cancel_reason=excluded.cancel_reason, rma_reason=excluded.rma_reason,
    pickup_addr=excluded.pickup_addr, payload=excluded.payload,
    created_at=excluded.created_at, member_id=excluded.member_id, updated_at=datetime('now')`;

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
    /* 작성자는 이름만 내보낸다. id 는 '자기 글인가'를 서버가 판정할 때만 쓰는 값이라
       공개 목록에 실을 이유가 없다 — 실으면 누가 어느 회원인지가 밖으로 나간다. */
    authorName: r.author_name,
  };
  if (r.important) o.important = true;
  if (r.sample) o.sample = true;
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

export const POST_INSERT = `
  INSERT INTO posts (id, cat, title, html, badge, important, sample, created_at,
                     author_kind, author_id, author_name)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET cat=excluded.cat, title=excluded.title, html=excluded.html,
    badge=excluded.badge, important=excluded.important, sample=excluded.sample,
    created_at=excluded.created_at, updated_at=datetime('now'),
    /* 작성자는 처음 쓴 사람으로 남긴다. 관리자가 남의 글을 고쳐도 글쓴이가
       관리자로 바뀌지 않아야 '누가 쓴 글인가'가 흔들리지 않는다. */
    author_kind=COALESCE(posts.author_kind, excluded.author_kind),
    author_id  =COALESCE(posts.author_id,   excluded.author_id),
    author_name=COALESCE(posts.author_name, excluded.author_name)`;

export const postBind = (p) => [
  String(p.id), p.cat || '공지', String(p.title || ''), p.html ?? null,
  p.badge ?? null, p.important ? 1 : 0, p.sample ? 1 : 0,
  p.at || new Date().toISOString(),
  p.authorKind ?? null, p.authorId == null ? null : String(p.authorId), p.authorName ?? null,
];

/**
 * 목록이 바뀌었음을 알린다 — 다른 사람 화면이 옛 버전으로 저장하지 못하게.
 * 관리자 창구 둘(전체 교체·한 건)과 회원 글쓰기가 함께 쓴다. 세 곳에 같은 SQL 을
 * 두면 한 곳만 고쳐질 자리라 여기 한 번만 적는다.
 * @returns 준비된 statement — 부르는 쪽이 batch 에 넣거나 그대로 run() 한다.
 */
export function bumpVersion(env, kind, who) {
  return env.DB.prepare(
    `INSERT INTO list_versions (kind, version, updated_at, updated_by) VALUES (?, 1, datetime('now'), ?)
     ON CONFLICT(kind) DO UPDATE SET version = version + 1, updated_at = datetime('now'), updated_by = excluded.updated_by`
  ).bind(kind, who || null);
}

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
/* 사진 주소에 붙는 판(版) 번호.
   페이지 슬롯은 id 가 슬롯 이름으로 **고정**이라(admin/images.js) 사진을 바꿔도 주소가 같다.
   그런데 /api/images/:id 는 immutable 로 1년 캐시한다 — '주소가 바뀌니 안전하다'는
   전제였지만 페이지 슬롯에는 성립하지 않아, 새 사진을 올려도 브라우저·CDN 이 옛 사진을
   계속 내주었다. 갱신 시각을 주소에 붙이면 바뀐 순간 주소가 달라져 둘 다 해결된다. */
function imageVersion(r) {
  const v = String(r.created_at || '').replace(/\D/g, '');
  return v ? `?v=${v}` : '';
}
export function imageRowToObj(r) {
  const o = {
    id: r.id, scope: r.scope, ref: r.ref, role: r.role, ord: r.ord,
    url: `/api/images/${encodeURIComponent(r.id)}${imageVersion(r)}`,
    name: r.name, size: r.size, type: r.mime,
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
    name=excluded.name, pcx=excluded.pcx, pcy=excluded.pcy, mbx=excluded.mbx, mby=excluded.mby,
    created_at=datetime('now')`;
/* created_at 을 함께 올린다 — 이 UPDATE 가 도는 경우는 id 가 고정된 페이지 슬롯을
   갈아끼울 때뿐이고, 그 시각이 곧 사진 주소의 판 번호가 된다(imageVersion).
   다른 scope 는 올릴 때마다 새 id 를 받으므로 이 가지를 타지 않는다. */

/* ── 주문 품목 줄 ─────────────────────────────────────────
   orders 의 product_* 열은 요약이고, 줄 하나하나의 원본은 여기다.
   재고 예약도 이 표에서 센다 — 주문마다 payload 를 열어 보지 않아도 된다. */
export const ORDER_ITEM_INSERT = `
  INSERT INTO order_items (order_id, seq, product_id, product_name, option_label, qty, unit_price)
  VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(order_id, seq) DO UPDATE SET
    product_id=excluded.product_id, product_name=excluded.product_name,
    option_label=excluded.option_label, qty=excluded.qty, unit_price=excluded.unit_price`;

export function orderItemBind(orderId, seq, it) {
  return [
    String(orderId), Number(seq),
    it.productId ?? null, it.product ?? null, it.optionLabel ?? null,
    num(it.qty) ?? 1, num(it.unitPrice) ?? 0,
  ];
}

export function orderItemRowToObj(r) {
  return {
    productId: r.product_id, product: r.product_name, optionLabel: r.option_label,
    qty: r.qty, unitPrice: r.unit_price,
  };
}

/**
 * 주문 목록에 품목 줄을 붙인다. 주문마다 따로 물으면 N+1 이 된다 — 한 번에 읽어 나눈다.
 * 줄이 하나뿐인 주문에는 붙이지 않는다(요약 열이 곧 그 줄이고, 응답만 두 배가 된다).
 */
export async function attachOrderItems(env, orders) {
  const multi = orders.filter((o) => Number(o.itemCount) > 1);
  if (!multi.length) return orders;
  const ids = multi.map((o) => o.id);
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT order_id, seq, product_id, product_name, option_label, qty, unit_price
       FROM order_items WHERE order_id IN (${marks}) ORDER BY order_id, seq`
  ).bind(...ids).all();
  const byId = new Map();
  for (const r of results || []) {
    if (!byId.has(r.order_id)) byId.set(r.order_id, []);
    byId.get(r.order_id).push(orderItemRowToObj(r));
  }
  for (const o of multi) o.items = byId.get(o.id) || [];
  return orders;
}
