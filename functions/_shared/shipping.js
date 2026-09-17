/**
 * 택배비 — 원본은 **관리자 > 설정**(shipFee · shipFreeOver). 기본값은 site.js 의 SETTINGS_DEFAULTS 와 같아야 한다.
 *
 * 설정 화면은 빈 칸을 '기본값을 쓴다'로 두고 `''` 를 그대로 저장한다. `Number('')` 은 0 이라, 그대로 쓰면
 * 택배비가 0원이 된다 — 화면(site.js getSettings 는 '' 를 기본값으로 되돌린다)과 서버 금액이 어긋난다.
 * 주문 접수·상품 구조화 데이터·llms.txt 가 모두 여기 한 곳을 쓴다.
 */
export const SHIP_FEE_DEFAULT = 5100;
export const SHIP_FREE_OVER_DEFAULT = 50000;

const num = (v) => (v == null || v === '' ? NaN : Number(v));

/** 편도 택배비(원) */
export function shipFeeOf(st) {
  const f = num(st && st.shipFee);
  return Number.isFinite(f) && f >= 0 ? f : SHIP_FEE_DEFAULT;
}
/** 이 금액 이상이면 무료 */
export function shipFreeOverOf(st) {
  const o = num(st && st.shipFreeOver);
  return Number.isFinite(o) && o > 0 ? o : SHIP_FREE_OVER_DEFAULT;
}
/** 주문 한 건에 붙는 택배비 */
export function shipFeeFor(st, itemsTotal) {
  return itemsTotal >= shipFreeOverOf(st) ? 0 : shipFeeOf(st);
}
