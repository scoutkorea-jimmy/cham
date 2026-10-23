import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadProductDetail } from '../functions/_shared/product-seo.js';

const row = {
  id: 'vinegar', name: '수제식초', cat: '식초', price: 25000,
  sale_price: null, status: '판매중', stock: 3,
  doc: JSON.stringify({ ship: '· 출고: 결제(입금) 확인 후 2~3 영업일 이내' }),
};
async function detail(overrides = {}, shipFee = 5100) {
  const env = { DB: { prepare(sql) {
    return { bind() { return this; }, async first() {
      return sql.includes('FROM products') ? { ...row, ...overrides } : { id: 'photo' };
    } };
  } } };
  const url = new URL('https://example.org/product?id=vinegar');
  return loadProductDetail(env, url, url.href, { shipFee, shipFreeOver: 50000 });
}

test('상품 분류·배송·반품 데이터와 화면 안내가 일치한다', async () => {
  const d = await detail();
  const ld = d.jsonLd[0];
  assert.equal(ld.category[0], '식초');
  assert.equal(ld.category[1].codeValue, '2140');
  const shipping = ld.offers.shippingDetails;
  assert.equal(shipping.shippingRate.value, '5100');
  assert.equal(shipping.deliveryTime.handlingTime.minValue, 2);
  assert.equal(shipping.deliveryTime.handlingTime.maxValue, 3);
  assert.deepEqual(shipping.deliveryTime.transitTime, {
    '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY',
  });
  const policy = ld.offers.hasMerchantReturnPolicy;
  assert.equal(policy.merchantReturnDays, 7);
  assert.equal(policy.returnFees, 'https://schema.org/ReturnShippingFees');
  assert.equal(policy.merchantReturnLink, 'https://example.org/terms#refund');
  assert.match(d.bodyHTML, /1~2영업일/);
  assert.equal('review' in ld, false);
  assert.equal('aggregateRating' in ld, false);
  const shop = await readFile(new URL('../public/assets/shop.js', import.meta.url), 'utf8');
  assert.match(shop, /택배사 인계 후 통상 1~2영업일/);
  const terms = await readFile(new URL('../public/terms.html', import.meta.url), 'utf8');
  assert.match(terms, /id="refund"/);
  assert.match(terms, /7일 이내/);
});

test('가격문의·숨김·품절·할인가의 기존 동작을 보존한다', async () => {
  assert.equal('offers' in (await detail({ price_on_request: 1 })).jsonLd[0], false);
  assert.equal(await detail({ status: '숨김' }), null);
  const ld = (await detail({ status: '품절', sale_price: 20000 })).jsonLd[0];
  assert.equal(ld.offers.price, '20000');
  assert.equal(ld.offers.availability, 'https://schema.org/OutOfStock');
});

test('카테고리 매핑과 별도 출고 안내, 무료배송을 보존한다', async () => {
  for (const [cat, code] of [['선물세트', '136'], ['장류', '427'], ['발효식품', '422']]) {
    assert.equal((await detail({ cat })).jsonLd[0].category[1].codeValue, code);
  }
  const ld = (await detail({ cat: '새 분류', doc: '{}' }, 0)).jsonLd[0];
  assert.equal(ld.category, '새 분류');
  assert.equal(ld.offers.shippingDetails.shippingRate.value, '0');
  assert.equal('handlingTime' in ld.offers.shippingDetails.deliveryTime, false);
  assert.equal((await detail({ price: 50000 })).jsonLd[0].offers.shippingDetails.shippingRate.value, '0');
  assert.equal((await detail({ price: 50000, sale_price: 49000 })).jsonLd[0].offers.shippingDetails.shippingRate.value, '5100');
});
