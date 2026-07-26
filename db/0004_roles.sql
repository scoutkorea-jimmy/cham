-- cham · 0004 권한 그룹
-- 적용:  npx wrangler d1 execute cham-db --local  --file=db/0004_roles.sql
-- 운영:  npx wrangler d1 execute cham-db --remote --file=db/0004_roles.sql
--
-- owner/staff 두 갈래로는 부족하다. 주문만 처리하는 사람에게 계좌·개인정보까지 열어 주거나,
-- 반대로 콘텐츠만 고칠 사람이 아무것도 못 하는 일이 생긴다.
-- '권한 그룹'을 만들고 그룹마다 할 수 있는 일을 체크해 둔다. 계정은 그룹 하나에 속한다.
--
-- 권한 키(perms JSON 배열)
--   sales.view        판매 관리 보기(상품·주문·매출)
--   sales.manage      상품 등록·수정, 주문 상태 처리
--   customers.view    신청·문의 보기
--   customers.manage  신청·문의 처리, 교육과정(기수) 관리
--   members.view      일반 계정 보기        ← 개인정보. 함부로 주지 않는다
--   members.manage    일반 계정 등록·수정
--   content.manage    게시글·페이지 이미지·팝업·파트너
--   settings.manage   운영 정보(계좌·연락처·사업자정보·약도)
--   accounts.manage   관리자 계정·권한 그룹
--   system.manage     동의문·KMS·데이터 백업
--
-- is_system=1 인 그룹은 지울 수 없다(최고 관리자를 지워 아무도 못 들어가는 일을 막는다).

CREATE TABLE IF NOT EXISTS admin_roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  perms       TEXT    NOT NULL DEFAULT '[]',
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 기본 그룹. 조합이 실제로 나누는 일 단위에 맞춘다.
INSERT OR IGNORE INTO admin_roles (name, description, perms, is_system) VALUES
 ('최고 관리자', '모든 기능. 계정과 권한을 관리합니다.',
  '["sales.view","sales.manage","customers.view","customers.manage","members.view","members.manage","content.manage","settings.manage","accounts.manage","system.manage"]', 1),
 ('운영 담당', '주문·신청·문의·콘텐츠를 다룹니다. 계좌 설정과 계정 관리는 못 합니다.',
  '["sales.view","sales.manage","customers.view","customers.manage","members.view","content.manage"]', 0),
 ('주문 담당', '주문 처리와 상품만 다룹니다.',
  '["sales.view","sales.manage"]', 0),
 ('콘텐츠 담당', '게시글·사진·팝업만 다룹니다.',
  '["content.manage"]', 0),
 ('조회 전용', '보기만 하고 바꾸지는 못합니다.',
  '["sales.view","customers.view"]', 0);

-- 계정이 속한 그룹. 예전 role(owner/staff) 은 남겨 두고 그룹을 우선으로 본다 —
-- 이미 만들어진 계정이 갑자기 아무 권한도 없는 상태가 되면 안 되기 때문이다.
ALTER TABLE admin_users ADD COLUMN role_id INTEGER REFERENCES admin_roles(id);

-- 기존 계정 이관: owner → 최고 관리자, staff → 운영 담당
UPDATE admin_users SET role_id = (SELECT id FROM admin_roles WHERE name = '최고 관리자')
 WHERE role_id IS NULL AND role = 'owner';
UPDATE admin_users SET role_id = (SELECT id FROM admin_roles WHERE name = '운영 담당')
 WHERE role_id IS NULL AND role = 'staff';

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role_id);
