/**
 * 소식마당 게시판과 글쓰기 권한 — 서버 쪽 단일 원본.
 *
 * 게시판 이름은 `posts.cat` 에 그대로 들어가는 값이라 여기 목록이 곧 규격이다.
 * 화면(board.js)·관리자 회원 탭·권한 검사가 모두 이 목록을 따른다.
 */
import { getSession, getMemberSession } from './auth.js';

export const BOARDS = ['공지', '교육'];

/**
 * 글을 쓰려는 사람이 누구인가 — 관리자 세션이 먼저, 없으면 회원 세션.
 *
 * 둘을 한 함수로 묶는 이유: 부르는 쪽마다 '관리자면 …, 아니면 회원이면 …' 을
 * 다시 쓰면 한 곳만 고쳐지고 나머지가 옛 규칙으로 남는다.
 *
 * @returns {Promise<null | {kind:'admin'|'member', id, name, boards:string[]}>}
 */
export async function getPostActor(request, env) {
  const admin = await getSession(request, env);
  if (admin) {
    return {
      kind: 'admin', id: admin.uid,
      name: (admin.user && admin.user.display_name) || admin.username,
      boards: BOARDS.slice(),
    };
  }
  const m = await getMemberSession(request, env);
  if (!m) return null;
  const boards = memberBoards(m.member);
  if (!boards.length) return null;      // 권한 없는 회원은 '로그인했을 뿐'이다
  return { kind: 'member', id: m.mid, name: m.member.name, boards };
}

/** 회원 행의 post_boards(JSON 배열 문자열)를 배열로. 깨진 값은 '권한 없음'으로 본다. */
export function memberBoards(row) {
  if (!row || !row.post_boards) return [];
  let v;
  try { v = JSON.parse(row.post_boards); } catch { return []; }
  if (!Array.isArray(v)) return [];
  /* 목록에 없는 이름은 버린다 — 게시판을 지운 뒤에도 남아 있던 권한이
     이름이 재사용될 때 되살아나는 일을 막는다. */
  return BOARDS.filter((b) => v.includes(b));
}

/** 저장용. 빈 배열은 NULL 로 — '권한 없음'이 두 가지 모양(NULL·[])으로 남지 않게. */
export function boardsToColumn(list) {
  const clean = Array.isArray(list) ? BOARDS.filter((b) => list.includes(b)) : [];
  return clean.length ? JSON.stringify(clean) : null;
}

/**
 * 이 사람이 이 게시판에 글을 쓸 수 있는가.
 * 관리자는 게시판을 가리지 않는다(콘솔에서 이미 전부 다룰 수 있다).
 */
export function canWriteBoard(actor, cat) {
  if (!actor) return false;
  if (actor.kind === 'admin') return true;
  return actor.boards.includes(cat);
}

/**
 * 이 글을 고치거나 지울 수 있는가.
 * 권한 회원은 **자기 글만**. 작성자가 비어 있는 옛 글은 관리자만 다룬다.
 */
export function canEditPost(actor, row) {
  if (!actor) return false;
  if (actor.kind === 'admin') return true;
  if (!row || row.author_kind !== 'member') return false;
  return String(row.author_id) === String(actor.id);
}
