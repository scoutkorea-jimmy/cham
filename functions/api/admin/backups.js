/**
 * 자동 백업(R2 `backups/`) — 목록과 내려받기. (owner 전용)
 *
 *   GET /api/admin/backups            → { items:[{ key, day, size, uploaded }], mark }
 *   GET /api/admin/backups?key=…      → 그 파일 그대로 (첨부로)
 *
 * owner 만인 이유는 내보내기(export.js)와 같다 — 회원·주문의 개인정보가 통째로 들어 있다.
 * 백업을 뜨는 쪽은 `_shared/backup.js`(bootstrap 이 매일 한 번 부른다).
 */
import { readDoc } from '../../_shared/store.js';
import { json, forbidden, notFound, badRequest } from '../../_shared/http.js';
import { BACKUP_PREFIX } from '../../_shared/backup.js';

export async function onRequestGet({ request, env, data }) {
  const session = data && data.session;
  if (!session || session.role !== 'owner') return forbidden('백업은 관리자(owner)만 볼 수 있습니다.');
  if (!env || !env.MEDIA) return json({ error: '저장소가 연결되지 않았습니다.', code: 'server_unavailable' }, 503);

  const key = new URL(request.url).searchParams.get('key');
  if (key) {
    // 주소로 아무 R2 키나 받아 가지 못하게 — 백업 폴더 안만
    if (!key.startsWith(BACKUP_PREFIX) || key.includes('..')) return badRequest();
    const obj = await env.MEDIA.get(key);
    if (!obj) return notFound('그 백업 파일이 없습니다.');
    return new Response(obj.body, {
      headers: {
        'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${key.slice(BACKUP_PREFIX.length).replace(/[^\w.\-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const listed = await env.MEDIA.list({ prefix: BACKUP_PREFIX });
  const items = (listed.objects || []).map((o) => {
    const m = o.key.match(/(\d{4}-\d{2}-\d{2})/);
    return { key: o.key, day: m ? m[1] : null, size: o.size, uploaded: o.uploaded };
  }).sort((a, b) => (String(b.uploaded) > String(a.uploaded) ? 1 : -1));
  return json({ items, mark: await readDoc(env, 'backup') });
}
