/**
 * GET /api/bootstrap — 공개 페이지가 첫 렌더 전에 한 번 부르는 묶음 응답.
 *
 * 페이지마다 따로 부르면 요청이 대여섯 개로 늘어난다(D1 왕복이 비싸다).
 * 화면에 필요한 것을 한 번에 받고, 클라이언트는 이걸 메모리에 담아
 * 지금과 똑같은 동기 게터(getProducts 등)로 읽는다.
 *
 * 주문·신청·문의는 **절대 넣지 않는다.** 고객 개인정보이고 공개 응답이다.
 */
import { productRowToObj, postRowToObj, readCollection, readDoc, imageRowToObj } from '../_shared/store.js';
import { json } from '../_shared/http.js';

export async function onRequestGet({ env }) {
  if (!env || !env.DB) return json({ error: '데이터베이스가 연결되지 않았습니다.', code: 'server_unavailable' }, 503);

  const [products, posts, cohorts, partners, popups, settings, consents, pageImages] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, cat, price, sale_price, unit, status, stock, summary, price_on_request, doc
         FROM products WHERE status != '숨김' ORDER BY sort_order, id`
    ).all().then((r) => (r.results || []).map(productRowToObj)),

    env.DB.prepare(
      `SELECT id, cat, title, html, badge, important, sample, created_at
         FROM posts ORDER BY created_at DESC LIMIT 200`
    ).all().then((r) => (r.results || []).map(postRowToObj)),

    readCollection(env, 'cohorts'),
    readCollection(env, 'partners'),
    // 팝업은 활성 여부·기간을 클라이언트가 판단한다(오늘 하루 보지 않기와 함께) — 그대로 넘긴다
    readCollection(env, 'popups'),
    readDoc(env, 'settings'),
    readDoc(env, 'consents'),

    env.DB.prepare(
      `SELECT id, scope, ref, role, ord, name, size, pcx, pcy, mbx, mby
         FROM images WHERE scope = 'page'`
    ).all().then((r) => (r.results || []).map(imageRowToObj)),
  ]);

  return json({ products, posts, cohorts, partners, popups, settings, consents, pageImages }, 200, {
    // 공개 데이터지만 관리자가 고치면 바로 보여야 한다 — 짧게만 캐시한다
    'Cache-Control': 'public, max-age=30',
  });
}
