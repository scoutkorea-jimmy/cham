/**
 * 한국 시각 기준 날짜. 워커의 시계는 UTC 라 `new Date().toISOString()` 을 그대로 자르면
 * 밤 아홉 시 뒤로는 '어제' 날짜가 된다 — 주문번호·방문 집계·백업 파일 이름·llms.txt 가 모두 이 한 곳을 쓴다.
 */
const KST_OFFSET_MS = 9 * 3600 * 1000;

/** 'YYYY-MM-DD' */
export const kstDay = () => new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
/** 'YYYYMMDD' — 주문번호 앞자리 */
export const kstYmd = () => kstDay().replace(/-/g, '');
