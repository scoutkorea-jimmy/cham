-- 주문에 택배비를 남긴다
--
-- 지금까지 total 은 '상품값 × 수량' 이었고 택배비는 어디에도 없었다. 화면은 '택배비 별도'
-- 라고만 적어서, 무료 기준 미만 주문은 손님이 얼마를 입금해야 하는지 알 수 없었고
-- 관리자도 입금액을 대조할 수 없었다.
--
-- 앞으로 total = 상품값 + ship_fee (손님이 실제로 입금할 금액) 이다.
-- ship_fee 가 NULL 인 행은 이 열이 생기기 전의 주문이다 — 화면은 '별도'로 표시한다.
-- 0 은 '무료'라는 뜻이므로 NULL 과 구분해야 한다.
ALTER TABLE orders ADD COLUMN ship_fee INTEGER;

-- 상품별 '배송안내' 글에서 배송비 줄을 걷어낸다.
-- 금액을 상품마다 저장해 두면 관리자 > 설정에서 택배비를 고쳐도 상품 글에는 옛 금액이
-- 남아, 같은 화면에 서로 다른 두 금액이 보인다. 배송비 줄은 이제 화면이 설정에서 만든다.
UPDATE products
   SET doc = json_set(doc, '$.ship',
         ltrim(substr(json_extract(doc, '$.ship'),
                      instr(json_extract(doc, '$.ship'), char(10)) + 1)))
 WHERE json_extract(doc, '$.ship') LIKE '· 배송비:%'
   AND instr(json_extract(doc, '$.ship'), char(10)) > 0;
