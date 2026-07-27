/**
 * POST /api/members/withdraw   { password }
 *
 * 회원 탈퇴 — 개인정보를 **실제로 지운다**(개인정보처리방침 제3조와 같은 동작).
 *
 * 지우는 것과 남기는 것을 나눈 기준:
 *   · 회원 행은 통째로 지운다. 아이디·비밀번호·이름·연락처·이메일·주소가 함께 사라진다.
 *   · 주문 기록은 **지우지 않는다** — 전자상거래법상 계약·결제 기록은 5년 보존 대상이다.
 *     대신 그 기록에서 **사람을 지운다**: 이름·연락처·이메일·주소·입금자명·요청사항을 비우고
 *     회원 연결(member_id)도 끊는다. 주문번호·상품·수량·금액·상태만 남아
 *     매출 집계는 그대로이고 누구인지는 알 수 없다.
 *
 * 되돌릴 수 없다. 그래서 **지금 비밀번호를 확인한 뒤에만** 진행한다 —
 * 로그인된 화면을 잠깐 빌린 사람이 계정을 없애지 못하게 하기 위해서다.
 *
 * 지도사 신청·문의는 계정에 묶여 있지 않아(이름·연락처로만 남는다) 여기서 건드리지 않는다.
 * 그쪽은 방침 제6조대로 본인이 요청하면 운영자가 확인 후 지운다.
 */
import {
  getMemberSession, verifyPassword, loadMemberSecret, clearMemberCookies, isSecureRequest,
} from '../../_shared/auth.js';
import { json, badRequest, readJson, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  const s = await getMemberSession(request, env);
  if (!s) return json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, 401);

  const b = await readJson(request);
  if (!b) return badRequest();

  const stored = await loadMemberSecret(env, s.mid);
  if (!stored || !await verifyPassword(String(b.password || ''), stored)) {
    return json({ error: '비밀번호가 올바르지 않습니다.', code: 'bad_password' }, 400);
  }

  /* 주문에서 사람을 지우고 → 회원 행을 지운다. 순서가 중요하다.
     회원을 먼저 지우면 member_id 가 NULL 로 풀려(ON DELETE SET NULL) 어느 주문이
     이 사람 것이었는지 찾을 수 없게 된다. */
  let cleared = 0;
  try {
    const res = await env.DB.prepare(
      `UPDATE orders
          SET name = NULL, phone = NULL, email = NULL, address = NULL, depositor = NULL,
              payload = '{}', member_id = NULL, updated_at = datetime('now')
        WHERE member_id = ?`
    ).bind(s.mid).run();
    cleared = (res && res.meta && res.meta.changes) || 0;
  } catch {
    return json({ error: '탈퇴를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
  }

  try {
    await env.DB.prepare(`DELETE FROM members WHERE id = ?`).bind(s.mid).run();
  } catch {
    // 주문은 이미 비웠는데 회원 행이 안 지워졌다 — 반쪽 상태를 조용히 넘기지 않는다
    return json({
      error: '탈퇴를 끝내지 못했습니다. 02-855-8806 으로 연락해 주시면 확인해 드리겠습니다.',
      code: 'partial',
    }, 500);
  }

  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  for (const c of clearMemberCookies({ secure: isSecureRequest(request) })) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify({ ok: true, clearedOrders: cleared }), { status: 200, headers });
}

export const onRequestGet = methodNotAllowed;
