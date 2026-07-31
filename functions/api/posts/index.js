/**
 * POST /api/posts   { cat, title, html, badge, important }  → 새 글 한 건
 * GET  /api/posts/can                                       → 내가 쓸 수 있는 게시판
 *
 * **왜 관리자 창구를 그냥 열지 않는가.**
 * `PUT /api/admin/data/posts` 는 목록을 **통째로 교체**한다. 글쓰기 권한을 받은
 * 회원에게 그 문을 열면, 자기 글 하나를 올리려고 보낸 목록이 남의 글을 전부
 * 지워 버릴 수 있다. 그래서 회원이 닿는 창구는 **한 건 단위**로만 둔다.
 *
 * 권한은 게시판별이다 → _shared/boards.js
 */
import { json, badRequest, forbidden, unauthorized, methodNotAllowed, readJson } from '../../_shared/http.js';
import { POST_INSERT, postBind, bumpVersion } from '../../_shared/store.js';
import { BOARDS, getPostActor, canWriteBoard } from '../../_shared/boards.js';

/* 제목·본문 상한. 없으면 한 번의 요청으로 DB 를 채울 수 있다. */
const MAX_TITLE = 200;
const MAX_HTML = 200_000;

function newId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ error: '글을 저장할 수 없습니다.' }, 503);

  const actor = await getPostActor(request, env);
  if (!actor) return unauthorized();

  const b = (await readJson(request)) || {};
  const cat = String(b.cat || '').trim();
  if (!BOARDS.includes(cat)) return badRequest('게시판을 확인해 주세요.');
  if (!canWriteBoard(actor, cat)) return forbidden('이 게시판에 글을 쓸 권한이 없습니다.');

  const title = String(b.title || '').trim();
  if (!title) return badRequest('제목을 입력해 주세요.');
  if (title.length > MAX_TITLE) return badRequest('제목이 너무 깁니다.');
  const html = b.html == null ? null : String(b.html);
  if (html && html.length > MAX_HTML) return badRequest('본문이 너무 깁니다.');

  const post = {
    id: newId(),
    cat, title, html,
    badge: b.badge ? String(b.badge).slice(0, 20) : null,
    /* '중요' 는 목록 맨 위에 붙는 표시다 — 관리자만 세울 수 있게 한다.
       권한 회원이 세우면 공지 위에 자기 글을 올려 둘 수 있다. */
    important: actor.kind === 'admin' ? !!b.important : false,
    at: new Date().toISOString(),
    authorKind: actor.kind,
    authorId: actor.id,
    authorName: actor.name,
  };

  try {
    await env.DB.batch([
      env.DB.prepare(POST_INSERT).bind(...postBind(post)),
      bumpVersion(env, 'posts', actor.name),
    ]);
  } catch {
    return json({ error: '글을 저장하지 못했습니다.' }, 500);
  }
  return json({ ok: true, id: post.id });
}

/**
 * 화면이 '글쓰기 버튼을 보여도 되는가'를 묻는 자리.
 *
 * 권한 회원에게는 **자기 글의 id 목록**도 함께 준다. 공개 목록(bootstrap)에는
 * 글쓴이 이름만 싣고 회원 id 는 싣지 않기 때문에, 화면이 '내 글인가'를 스스로
 * 판정할 수 없다. 이름으로 맞춰 보면 동명이인에서 남의 글에 수정 버튼이 뜬다.
 * 관리자는 전부 다루므로 목록이 필요 없다(mine 을 주지 않는다).
 */
export async function onRequestGet({ request, env }) {
  const actor = await getPostActor(request, env);
  if (!actor) return json({ boards: [], kind: null });
  if (actor.kind === 'admin') return json({ kind: 'admin', boards: actor.boards, name: actor.name });

  let mine = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id FROM posts WHERE author_kind = 'member' AND author_id = ?`
    ).bind(String(actor.id)).all();
    mine = (results || []).map((r) => r.id);
  } catch { mine = []; }
  return json({ kind: 'member', boards: actor.boards, name: actor.name, mine });
}

export const onRequest = async (ctx) => {
  const m = ctx.request.method;
  if (m === 'POST') return onRequestPost(ctx);
  if (m === 'GET') return onRequestGet(ctx);
  return methodNotAllowed();
};
