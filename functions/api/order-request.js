/**
 * POST /api/order-request  { orderNo, contact?, type, reason }
 *
 * 손님이 취소·반품·교환을 **신청**한다.
 *
 * **주문 상태는 바꾸지 않는다.** 승인도 거절도 전부 관리자가 판단한다(운영자 결정).
 * 화면이 상태를 '취소'로 바꿔 버리면, 이미 포장해 둔 것을 취소로 읽거나
 * 입금된 건이 조용히 사라진다. 여기서는 '손님이 이렇게 요청했다'만 남긴다.
 *
 * 누구 주문인지 확인하는 방법은 두 가지다.
 *   · 로그인한 회원 — **쿠키로만** 판단한다(브라우저가 보낸 회원번호는 믿지 않는다).
 *   · 비회원 — 주문번호 + 연락처를 서버가 대조한다(주문 조회와 같은 규칙).
 */
import { getMemberSession } from '../_shared/auth.js';
import { json, badRequest, methodNotAllowed, readJson } from '../_shared/http.js';

const digits = (s) => String(s || '').replace(/\D/g, '');
const clean = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

/* 어떤 상태에서 무엇을 신청할 수 있는가.
   배송이 시작되기 전에는 취소, 물건이 손에 간 뒤에는 반품·교환이다. */
const ALLOWED = {
  cancel:   { label: '주문 취소', from: ['주문접수', '결제완료', '배송준비중'] },
  return:   { label: '반품',     from: ['배송중', '배송완료'] },
  exchange: { label: '교환',     from: ['배송중', '배송완료'] },
};

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ error: '접수할 수 없습니다.', code: 'server_unavailable' }, 503);

  const body = await readJson(request);
  if (!body) return badRequest();
  const orderNo = clean(body.orderNo, 40);
  const type = clean(body.type, 20);
  const reason = clean(body.reason, 500);
  const spec = ALLOWED[type];
  if (!orderNo || !spec) return badRequest();
  if (!reason) return badRequest('사유를 적어 주세요. 처리에 필요합니다.');

  const row = await env.DB.prepare(
    `SELECT id, status, phone, email, member_id, payload FROM orders WHERE order_no = ?`
  ).bind(orderNo).first();

  // 없을 때와 안 맞을 때를 구분하지 않는다 — 구분해 주면 주문번호를 훑을 수 있다
  const miss = () => json({ error: '주문을 찾을 수 없습니다. 주문번호와 연락처를 확인해 주세요.', code: 'not_found' }, 404);
  if (!row) return miss();

  const ms = await getMemberSession(request, env);
  const mine = ms && row.member_id != null && Number(row.member_id) === Number(ms.mid);
  if (!mine) {
    const contact = clean(body.contact, 120);
    if (!contact) return miss();
    const d = digits(contact);
    const phoneOk = d.length >= 8 && digits(row.phone) === d;
    const mailOk = contact.includes('@') && String(row.email || '').toLowerCase() === contact.toLowerCase();
    if (!phoneOk && !mailOk) return miss();
  }

  if (!spec.from.includes(row.status)) {
    return json({
      error: `지금은 ‘${spec.label}’을 신청할 수 없는 상태입니다(현재 ${row.status}). 02-855-8806 으로 문의해 주세요.`,
      code: 'bad_status',
    }, 409);
  }

  let prev = null;
  try { prev = (JSON.parse(row.payload || '{}') || {}).custRequest || null; } catch {}
  if (prev && prev.type === type && prev.status !== '처리됨') {
    return json({ error: `이미 ‘${spec.label}’ 신청이 접수되어 있습니다. 확인 후 연락드리겠습니다.`, code: 'duplicate' }, 409);
  }

  const req = { type, label: spec.label, reason, at: new Date().toISOString() };
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders SET payload = json_set(COALESCE(payload,'{}'), '$.custRequest', json(?)),
                         updated_at = datetime('now')
        WHERE id = ?`
    ).bind(JSON.stringify(req), row.id),
    // 관리자 화면이 옛 목록으로 저장하지 못하게 — 한 건만 바뀌어도 목록은 달라졌다
    env.DB.prepare(
      `INSERT INTO list_versions (kind, version, updated_at, updated_by) VALUES ('orders', 1, datetime('now'), '손님 신청')
       ON CONFLICT(kind) DO UPDATE SET version = version + 1, updated_at = datetime('now'), updated_by = excluded.updated_by`
    ),
  ]);

  return json({ ok: true, request: req }, 201);
}

export const onRequestGet = methodNotAllowed;
