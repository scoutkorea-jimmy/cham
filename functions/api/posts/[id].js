/**
 * PATCH  /api/posts/:id   { title, html, badge, cat, important }  → 그 글만 고친다
 * DELETE /api/posts/:id                                           → 그 글만 지운다
 *
 * 권한 회원은 **자기 글만** 다룬다. 작성자가 비어 있는 옛 글은 관리자만 다룬다
 * → _shared/boards.js `canEditPost`
 *
 * 관리자 창구(`/api/admin/data/posts/:id`)와 나뉘어 있는 것이 중복으로 보일 수 있으나,
 * 그쪽은 **관리자 세션을 전제로 모든 kind 를 다루는 일반 창구**이고 여기는 게시글
 * 하나만 다루면서 회원 권한을 함께 본다. 판정 규칙은 boards.js 한 곳에 있다.
 */
import { json, badRequest, forbidden, notFound, unauthorized, methodNotAllowed, readJson } from '../../_shared/http.js';
import { postRowToObj, POST_INSERT, postBind, bumpVersion } from '../../_shared/store.js';
import { BOARDS, getPostActor, canWriteBoard, canEditPost } from '../../_shared/boards.js';

const MAX_TITLE = 200;
const MAX_HTML = 200_000;

async function load(env, id) {
  try {
    return await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(String(id)).first();
  } catch { return null; }
}

/** 이 요청을 처리할 자격이 있는가 — 세 갈래(비로그인·남의 글·없는 글)를 한 곳에서 가른다. */
async function gate(request, env, id) {
  if (!env || !env.DB) return { err: json({ error: '처리할 수 없습니다.' }, 503) };
  const actor = await getPostActor(request, env);
  if (!actor) return { err: unauthorized() };
  const row = await load(env, id);
  if (!row) return { err: notFound('글을 찾을 수 없습니다.') };
  if (!canEditPost(actor, row)) return { err: forbidden('이 글을 고칠 권한이 없습니다.') };
  return { actor, row };
}

export async function onRequestPatch({ request, env, params }) {
  const g = await gate(request, env, params.id);
  if (g.err) return g.err;
  const { actor, row } = g;

  const b = (await readJson(request)) || {};
  const cur = postRowToObj(row);

  let cat = cur.cat;
  if (b.cat != null) {
    cat = String(b.cat).trim();
    if (!BOARDS.includes(cat)) return badRequest('게시판을 확인해 주세요.');
    /* 옮겨 가는 게시판에도 권한이 있어야 한다 — 없으면 쓸 수 없는 곳으로 글을 밀어 넣을 수 있다 */
    if (!canWriteBoard(actor, cat)) return forbidden('이 게시판으로 옮길 권한이 없습니다.');
  }

  const title = b.title != null ? String(b.title).trim() : cur.title;
  if (!title) return badRequest('제목을 입력해 주세요.');
  if (title.length > MAX_TITLE) return badRequest('제목이 너무 깁니다.');
  const html = b.html != null ? String(b.html) : (cur.html ?? null);
  if (html && html.length > MAX_HTML) return badRequest('본문이 너무 깁니다.');

  const next = {
    id: row.id, cat, title, html,
    badge: b.badge != null ? (String(b.badge).slice(0, 20) || null) : (cur.badge ?? null),
    // '중요'는 관리자만 — 새 글 규칙과 같다
    important: actor.kind === 'admin'
      ? (b.important != null ? !!b.important : !!cur.important)
      : !!cur.important,
    at: row.created_at,
    /* 작성자는 넘기지 않는다. POST_INSERT 가 COALESCE 로 원래 값을 지키므로
       관리자가 남의 글을 고쳐도 글쓴이가 바뀌지 않는다. */
  };

  try {
    await env.DB.batch([
      env.DB.prepare(POST_INSERT).bind(...postBind(next)),
      bumpVersion(env, 'posts', actor.name),
    ]);
  } catch {
    return json({ error: '글을 저장하지 못했습니다.' }, 500);
  }
  return json({ ok: true, id: row.id });
}

export async function onRequestDelete({ request, env, params }) {
  const g = await gate(request, env, params.id);
  if (g.err) return g.err;

  try {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(String(params.id)),
      bumpVersion(env, 'posts', g.actor.name),
    ]);
  } catch {
    return json({ error: '글을 지우지 못했습니다.' }, 500);
  }
  return json({ ok: true });
}

export const onRequest = async (ctx) => {
  const m = ctx.request.method;
  if (m === 'PATCH') return onRequestPatch(ctx);
  if (m === 'DELETE') return onRequestDelete(ctx);
  return methodNotAllowed();
};
