/**
 * POST /api/visit  { source }
 * 방문 집계. 같은 사람의 재방문(uv) 판정은 브라우저가 sessionStorage 로 하고,
 * 여기서는 받은 만큼 더한다 — 통계용 대략값이라 이 정도로 충분하다.
 * 90일이 지난 날짜는 지운다(대시보드가 최근 7일만 쓴다).
 */
import { json, methodNotAllowed, readJson } from '../_shared/http.js';

const SOURCES = new Set(['직접 방문', '검색엔진', '소셜·블로그', '기타 사이트']);

/* 사람이 아닌 접속은 세지 않는다. 화면(site.js)에서도 거르지만 여기서 한 번 더 본다 —
   집계 주소는 공개라 스크립트가 바로 두드릴 수 있고, 그러면 화면 쪽 판정이 소용없다. */
const BOT_UA = /bot|crawl|spider|slurp|headless|playwright|puppeteer|lighthouse|pingdom|monitor|preview|facebookexternalhit|kakaotalk-scrap|yeti|daumoa/i;

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ ok: false }, 200);
  if (BOT_UA.test(request.headers.get('user-agent') || '')) return json({ ok: true, counted: false });
  const body = await readJson(request) || {};
  if (body.automated) return json({ ok: true, counted: false });
  const day = new Date().toISOString().slice(0, 10);
  const isNew = !!body.newVisitor;

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO visits (day, pv, uv) VALUES (?, 1, ?)
         ON CONFLICT(day) DO UPDATE SET pv = pv + 1, uv = uv + ?`
      ).bind(day, isNew ? 1 : 0, isNew ? 1 : 0),
      env.DB.prepare(`DELETE FROM visits WHERE day < date('now', '-90 days')`),
    ]);
    if (isNew && SOURCES.has(body.source)) {
      await env.DB.prepare(
        `INSERT INTO visit_sources (kind, n) VALUES (?, 1)
         ON CONFLICT(kind) DO UPDATE SET n = n + 1`
      ).bind(body.source).run();
    }
  } catch { /* 집계 실패가 페이지를 막지 않는다 */ }

  return json({ ok: true });
}

export const onRequestGet = methodNotAllowed;
