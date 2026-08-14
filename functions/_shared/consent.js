/**
 * 동의 이력 — 받은 동의를 증명할 수 있게 남긴다.
 *
 * 예전에는 동의를 **확인만 하고 버렸다.** 통과 여부만 보고 지나가면
 * 나중에 "동의한 적 없다"는 말에 댈 것이 없다. 입증 책임은 사업자에게 있다.
 *
 * 기록은 남기되 **막는 일은 하지 않는다** — 그건 부르는 쪽의 몫이다.
 * 여기서 거절까지 하면 창구마다 다른 규칙(가입은 필수 둘, 주문은 필수 둘,
 * 문의는 하나)이 이 파일로 새어 들어온다.
 */

/**
 * 동의받은 문서의 판(版). **약관·개인정보처리방침의 시행일과 같아야 한다.**
 *
 * 문서를 고쳐 새로 시행하면 여기도 같이 올린다. 안 올리면 새 판에 동의한 사람이
 * 옛 판에 동의한 것으로 기록돼, 기록이 있는데도 증명이 안 되는 상태가 된다.
 * → public/terms.html · public/privacy.html 의 '시행일'
 */
export const CONSENT_DOC_VERSION = '2026-08-01';

/** 화면에 보여줄 이름. 관리자 화면과 회원 내려받기가 함께 쓴다. */
export const CONSENT_LABELS = {
  terms:     '이용약관',
  privacy:   '개인정보 수집·이용',
  third:     '개인정보 제3자 제공',
  marketing: '광고성 정보 수신(선택)',
};

const KNOWN = new Set(Object.keys(CONSENT_LABELS));

/**
 * 동의 여러 건을 한 번에 남긴다.
 *
 * @param {object} env
 * @param {object} o
 * @param {number|null} o.memberId  회원이면 members.id
 * @param {string} o.refKind        signup · order · seedjang · apply · inquiry · mypage · admin
 * @param {string|null} o.refId     그 주문·신청·문의의 id
 * @param {object} o.items          { terms: true, privacy: true, marketing: false }
 *
 * **실패해도 던지지 않는다.** 동의 기록을 못 남겼다고 주문·가입 자체를 막으면,
 * 부수적인 표 하나 때문에 장사가 멈춘다. 대신 남기지 못한 사실이 조용히 묻히지
 * 않도록 남긴 건수를 돌려준다 — 부르는 쪽이 필요하면 확인할 수 있다.
 */
export async function recordConsents(env, { memberId = null, refKind, refId = null, items }) {
  if (!env || !env.DB || !items) return 0;
  const rows = Object.keys(items)
    .filter((k) => KNOWN.has(k))
    .map((k) => ({ item: k, granted: items[k] ? 1 : 0 }));
  if (!rows.length) return 0;

  try {
    await env.DB.batch(rows.map((r) => env.DB.prepare(
      `INSERT INTO consent_log (member_id, ref_kind, ref_id, item, granted, doc_version)
       VALUES (?,?,?,?,?,?)`
    ).bind(memberId, refKind || null, refId, r.item, r.granted, CONSENT_DOC_VERSION)));
    return rows.length;
  } catch {
    return 0;
  }
}

/** 한 회원의 동의 이력 — 최신순. 관리자 상세와 회원 내려받기가 함께 쓴다. */
export async function memberConsents(env, memberId, limit = 100) {
  if (!env || !env.DB || !memberId) return [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT item, granted, doc_version, ref_kind, created_at
         FROM consent_log WHERE member_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`
    ).bind(memberId, limit).all();
    return (results || []).map((r) => ({
      item: r.item,
      label: CONSENT_LABELS[r.item] || r.item,
      granted: !!r.granted,
      docVersion: r.doc_version,
      where: r.ref_kind,
      at: r.created_at,
    }));
  } catch {
    return [];
  }
}
