/**
 * GET /api/members/export — 내 자료 한 벌 내려받기 (로그인한 본인만)
 *
 * **왜 필요한가.** 열람·정정·삭제는 마이페이지에 이미 있는데 *가져가는 것*만 없었다.
 * 화면으로 하나씩 보는 것과 한 벌로 받는 것은 다르다 — 다른 곳으로 옮기거나,
 * 탈퇴 전에 남겨 두거나, "무엇을 갖고 있느냐"를 통째로 확인할 때 필요하다.
 * (GDPR 제20조 '데이터 이동권'. 국내법에서도 열람권을 실제로 쓰게 하는 수단이 된다.)
 *
 * **누구 것인가는 쿠키로만 정한다.** 주소나 본문의 id 를 믿으면 남의 자료를 내주게 된다.
 *
 * 담는 것은 **이 사람의 것으로 확실히 묶인 자료뿐**이다.
 *   · 회원 정보 · member_id 로 묶인 주문 · 동의 이력
 * 교육 신청·문의는 회원과 묶는 열이 없다(이름·연락처로만 남는다). 연락처가 같다고
 * 끌어오면 가족이 번호를 함께 쓸 때 남의 자료가 섞인다 — 그래서 **넣지 않고, 넣지
 * 않았다는 사실을 파일 안에 적는다.** 빠진 줄 모르는 것이 빠진 것보다 나쁘다.
 */
import { getMemberSession } from '../../_shared/auth.js';
import { publicMember } from '../../_shared/members.js';
import { orderRowToObj, attachOrderItems } from '../../_shared/store.js';
import { memberConsents } from '../../_shared/consent.js';
import { json, methodNotAllowed } from '../../_shared/http.js';

export async function onRequestGet({ request, env }) {
  const s = await getMemberSession(request, env);
  if (!s) return json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, 401);

  let orders = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM orders WHERE member_id = ? ORDER BY created_at DESC`
    ).bind(s.mid).all();
    orders = await attachOrderItems(env, (results || []).map(orderRowToObj));
  } catch { orders = []; }

  const payload = {
    안내: {
      무엇: '한국참전통발효식품협동조합이 보관 중인 회원님의 개인정보 전부입니다.',
      만든날: new Date().toISOString(),
      담기지_않은_것:
        '비회원으로 넣으신 주문과, 교육 신청·문의는 들어 있지 않습니다. ' +
        '이 자료들은 회원 계정과 묶는 값이 없어(이름·연락처로만 남습니다) ' +
        '연락처로 끌어오면 같은 번호를 쓰는 다른 분의 자료가 섞일 수 있기 때문입니다. ' +
        '필요하시면 02-855-8806 으로 요청해 주세요.',
      비밀번호: '비밀번호는 복원할 수 없는 형태로만 저장하므로 담을 수 없습니다.',
      문의: '02-855-8806 · kach5501@hanmail.net',
    },
    회원정보: publicMember(s.member, true),
    주문내역: orders,
    동의이력: await memberConsents(env, s.mid, 500),
  };

  /* 브라우저가 화면에 펼치지 않고 파일로 받게 한다.
     이름에 날짜를 넣는다 — 여러 번 받으면 어느 것이 최신인지 알 수 없다. */
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="charmjt-내자료-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const onRequestPost = methodNotAllowed;
