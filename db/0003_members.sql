-- cham · 0003 일반 계정(회원)
-- 적용:  npx wrangler d1 execute cham-db --local  --file=db/0003_members.sql
-- 운영:  npx wrangler d1 execute cham-db --remote --file=db/0003_members.sql
--
-- 관리자 계정(admin_users)과 표를 나눈다. 하는 일도, 담는 정보도, 지켜야 할 것도 다르다.
--   · admin_users — 사이트를 운영하는 사람. 권한(owner/staff)이 핵심.
--   · members     — 교육을 신청하고 물건을 사는 사람. **개인정보**가 핵심.
-- 한 표에 섞으면 권한 실수 하나가 곧 개인정보 사고가 된다.
--
-- 수집 항목(개인정보처리방침·동의문과 일치해야 한다)
--   필수: 이름, 휴대전화번호
--   선택: 이메일, 주소
-- 비밀번호는 PBKDF2-SHA256 해시로만 저장한다. 평문을 두지 않는다.

CREATE TABLE IF NOT EXISTS members (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE,   -- 로그인 아이디
  password_hash        TEXT    NOT NULL,
  name                 TEXT    NOT NULL,          -- 필수
  phone                TEXT    NOT NULL,          -- 필수 (숫자만 저장)
  email                TEXT,                      -- 선택
  address              TEXT,                      -- 선택
  address_detail       TEXT,                      -- 선택 (상세주소)
  postcode             TEXT,                      -- 선택
  memo                 TEXT,                      -- 관리자 메모 (본인에게 보이지 않는다)
  status               TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_min_iat        INTEGER NOT NULL DEFAULT 0,
  marketing_optin      INTEGER NOT NULL DEFAULT 0, -- 광고성 정보 수신 동의(선택)
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 주문·신청에서 연락처로 회원을 찾는 일이 잦다
CREATE INDEX IF NOT EXISTS idx_members_phone  ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_name   ON members(name);
