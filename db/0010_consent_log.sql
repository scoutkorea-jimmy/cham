-- 동의 이력
--
-- 지금까지 동의는 **확인만 하고 버렸다.** 가입 때 `agreeTerms`·`agreePrivacy` 가
-- 참인지 보고 통과시킨 뒤, 남는 것은 `members.marketing_optin` 한 칸뿐이었다.
-- 그래서 "이 사람이 **언제 · 어느 판 약관에** 동의했는가"를 댈 수 없었다.
-- 개인정보보호법은 동의를 받았다는 **입증 책임을 사업자에게** 둔다.
--
-- 약관·방침을 고칠 때마다 이 문제가 커진다. 2026-08-01 시행판에 동의한 사람과
-- 그 다음 판에 동의한 사람이 섞이면, 나중에는 어느 쪽도 증명하지 못한다.
--
-- **비회원도 남긴다.** 주문·신청·문의도 개인정보를 받는다 —
-- 회원만 남기면 실제 수집의 절반이 기록 밖에 있게 된다.
--   회원  → member_id 로 묶는다
--   비회원 → ref_kind·ref_id 로 그 주문·신청·문의에 묶는다
--
-- **IP 는 저장하지 않는다.** 입증에는 '언제 · 무엇에 · 어느 판'이면 충분하고,
-- IP 자체가 또 하나의 개인정보다. 개인정보처리방침에 "접속 일시와 개인을
-- 식별하지 않는 집계값"만 수집한다고 적어 두었으므로, IP 를 새로 쌓으면
-- 방침이 사실과 어긋난다. 덜 모으는 쪽이 옳다.
CREATE TABLE IF NOT EXISTS consent_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER,                    -- 회원이면 members.id / 비회원은 NULL
  ref_kind    TEXT,                       -- signup · order · seedjang · apply · inquiry · mypage · admin
  ref_id      TEXT,                       -- 그 주문·신청·문의의 id (비회원을 되짚는 유일한 실마리)
  item        TEXT    NOT NULL,           -- terms · privacy · third · marketing
  granted     INTEGER NOT NULL,           -- 1 동의 / 0 거부·철회
  doc_version TEXT,                       -- 동의한 문서의 시행일 (예: 2026-08-01)
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 회원 상세에서 '이 사람의 동의 이력'을 최신순으로 편다
CREATE INDEX IF NOT EXISTS idx_consent_member ON consent_log(member_id, created_at DESC);
-- 비회원 주문에서 되짚는다
CREATE INDEX IF NOT EXISTS idx_consent_ref    ON consent_log(ref_kind, ref_id);
