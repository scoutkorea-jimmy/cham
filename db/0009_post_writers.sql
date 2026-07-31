-- 소식마당 글쓰기 권한 · 글의 작성자
--
-- 지금까지 글쓰기는 **관리자 계정**만 할 수 있었다. 강사에게 교육 소식을 맡기려면
-- 관리자 계정을 하나 더 내주는 수밖에 없었고, 그러면 주문·회원·설정까지 다 열린다.
--
-- 회원에게 **게시판 단위로** 글쓰기를 열어 준다.
--   post_boards 예) '["교육"]' · '["공지","교육"]' · NULL(권한 없음)
-- 게시판마다 열이 아니라 목록 한 칸인 이유: 게시판이 늘 때 스키마를 또 바꾸지
-- 않기 위해서다. 판정은 '이 목록에 그 게시판이 있는가' 한 가지뿐이라 단순하다.
ALTER TABLE members ADD COLUMN post_boards TEXT;

-- 글의 작성자. '자기 글만 고친다'를 판정하려면 누가 썼는지 남아야 한다.
--   author_kind: 'admin' | 'member'   (누구의 계정 체계인가)
--   author_id  : 그 체계 안의 식별자   (admin_users.id 또는 members.id)
--   author_name: 그때의 이름           (계정이 지워져도 목록이 비지 않게 베껴 둔다)
--
-- 이미 있던 글은 전부 NULL 이다. NULL 은 '관리자가 쓴 옛 글'로 다룬다 —
-- 권한 회원에게는 남의 글이므로 손댈 수 없고, 관리자는 그대로 다 다룬다.
ALTER TABLE posts ADD COLUMN author_kind TEXT;
ALTER TABLE posts ADD COLUMN author_id   TEXT;
ALTER TABLE posts ADD COLUMN author_name TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_kind, author_id);
