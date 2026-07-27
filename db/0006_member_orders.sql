-- 주문 ↔ 회원 연결
--
-- 로그인한 채로 넣은 주문에만 값이 들어간다. 비회원 주문은 NULL 이고 지금까지처럼 동작한다.
-- 연락처로 묶지 않는 이유: 같은 번호를 가족이 함께 쓰는 일이 흔해서, 번호로 묶으면
-- 남의 주문이 내 주문 내역에 나온다. 마이페이지는 이 열로만 찾는다.
--
-- ON DELETE SET NULL — 회원을 지워도 주문 기록(매출·배송)은 남아야 한다.
ALTER TABLE orders ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id, created_at DESC);
