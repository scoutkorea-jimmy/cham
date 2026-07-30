-- 주문 한 건에 여러 품목
--
-- 지금까지 주문은 상품 한 건을 전제로 짜여 있었다(orders.product_id · qty · unit_price).
-- 두 가지를 사려면 주문을 두 번 넣고 입금도 두 번, 배송비도 두 번 냈다.
--
-- 품목 줄은 여기가 **원본**이다. orders 의 product_id·product_name·qty·unit_price 는
-- 목록·조회 화면이 쓰는 **요약**으로 남긴다(total 이 이미 그런 값이다).
-- 요약을 없애면 주문 목록·CSV·매출 집계를 전부 다시 짜야 하는데, 얻는 것이 없다.
--
-- 재고 예약(아직 발송하지 않은 수량)도 이 표에서 센다 — 한 번의 GROUP BY 로 끝난다.

CREATE TABLE IF NOT EXISTS order_items (
  order_id     TEXT    NOT NULL,
  seq          INTEGER NOT NULL,          -- 주문 안에서의 순서(0부터)
  product_id   TEXT,
  product_name TEXT,
  option_label TEXT,
  qty          INTEGER NOT NULL DEFAULT 1,
  unit_price   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id, option_label);

-- 이 표가 생기기 전의 주문을 한 줄짜리 주문으로 옮긴다.
-- 이렇게 해 두면 재고 예약 계산에 '옛 주문' 예외를 두지 않아도 된다.
INSERT OR IGNORE INTO order_items (order_id, seq, product_id, product_name, option_label, qty, unit_price)
SELECT id, 0, product_id, product_name, option_label, COALESCE(qty, 1), COALESCE(unit_price, 0)
  FROM orders
 WHERE product_id IS NOT NULL;

-- 주문에 품목이 몇 줄인지 — 목록에서 '외 2건'을 붙일지 판단한다
ALTER TABLE orders ADD COLUMN item_count INTEGER;
UPDATE orders SET item_count = 1 WHERE product_id IS NOT NULL;
