-- cham · 0001 관리자 계정 · 로그인 시도 제한
-- 적용:  npx wrangler d1 execute cham-db --local --file=db/0001_auth.sql
-- 운영:  npx wrangler d1 execute cham-db --remote --file=db/0001_auth.sql

-- 관리자 계정.
--   role   owner = 계정 관리·설정 포함 전체 / staff = 일상 운영(주문·신청·문의·게시글)
--   status active = 사용 / disabled = 로그인 차단(행은 남겨 기록을 보존한다)
--   password_hash 는 PBKDF2-SHA256 결과의 JSON 문자열 — 평문·단순 해시를 저장하지 않는다.
--   token_min_iat 은 비밀번호를 바꾼 시각(ms). 그 이전에 발급된 세션은 모두 무효가 된다.
CREATE TABLE IF NOT EXISTS admin_users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE,
  display_name         TEXT    NOT NULL,
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'staff'  CHECK (role IN ('owner','staff')),
  status               TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_min_iat        INTEGER NOT NULL DEFAULT 0,
  last_login_at        TEXT,
  created_by           INTEGER,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- 로그인 실패 카운터(IP 단위). 지수 백오프의 상태를 여기에만 둔다.
-- 계정 단위로 잠그지 않는 이유: 남의 아이디로 일부러 틀려서 그 사람을 잠글 수 있다.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip               TEXT    PRIMARY KEY,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_attempt_at  INTEGER NOT NULL DEFAULT 0
);
