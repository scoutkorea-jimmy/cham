/**
 * 사진 지우기 — R2 실물과 D1 행을 함께. 관리자 사진 창구·글 삭제·글 목록 통째 저장이 같이 쓴다.
 *
 * R2 를 먼저 지우고 **지워진 것만** D1 에서 뺀다. 실패한 것은 행을 남겨 다시 지울 수 있게 하고
 * 몇 장이 남았는지 돌려준다 — 조용히 넘어가면 참조 없는 파일이 신호 없이 쌓인다.
 */
export async function deleteImageRows(env, rows) {
  const gone = [];
  const failed = [];
  for (const r of rows || []) {
    try {
      if (env.MEDIA) await env.MEDIA.delete(r.r2_key);
      gone.push(r);
    } catch { failed.push(r.id); }
  }
  if (gone.length) await env.DB.batch(gone.map((r) => env.DB.prepare(`DELETE FROM images WHERE id = ?`).bind(r.id)));
  return { deleted: gone.length, failed };
}

/** 한 글·한 상품의 사진 전부. */
export async function deleteImagesFor(env, scope, ref) {
  const { results } = await env.DB.prepare(
    `SELECT id, r2_key FROM images WHERE scope = ? AND ref = ?`
  ).bind(String(scope), String(ref)).all();
  return deleteImageRows(env, results || []);
}

/**
 * 주인이 사라진 사진 — 글(post)이나 상품(product)이 지워졌는데 남은 것.
 * 목록을 통째로 저장하는 창구는 무엇이 지워졌는지 모르므로 저장 뒤에 이걸 부른다.
 */
export async function pruneOrphanImages(env, scope) {
  const table = scope === 'post' ? 'posts' : scope === 'product' ? 'products' : null;
  if (!table) return { deleted: 0, failed: [] };
  const { results } = await env.DB.prepare(
    `SELECT id, r2_key FROM images WHERE scope = ? AND ref IS NOT NULL AND ref NOT IN (SELECT id FROM ${table})`
  ).bind(scope).all();
  return deleteImageRows(env, results || []);
}
