/**
 * 매일 한 번, D1 의 표를 JSON 으로 떠서 R2 `backups/` 에 남긴다.
 *
 * **왜 여기서 하나.** Pages Functions 에는 정해진 시각에 도는 자리가 없다(크론은 Workers 기능).
 * 그래서 GitHub Actions 백업(`.github/workflows/backup.yml`)을 두었는데, 시크릿이 없어
 * **만들어진 날부터 매일 실패했다** — '백업이 돌고 있다'고 믿는 상태가 한 달 이어졌다.
 * 이 방식은 시크릿도 외부 계정도 필요 없다. 사이트가 이미 가진 D1·R2 바인딩만 쓴다.
 * 손님이 첫 페이지를 여는 순간(`/api/bootstrap`) 그날 백업이 없으면, 응답을 보낸 **뒤에**
 * (`waitUntil`) 뜬다 — 손님은 기다리지 않는다.
 *
 * **무엇을 담나.** `sqlite_master` 의 사용자 표 전부를 행 그대로 — 관리자 계정·회원·동의 이력·
 * 주문 품목까지. 관리자 '내보내기'(export.js)는 화면이 아는 모양으로 바꾸느라 회원·계정·동의
 * 이력·품목 줄을 빠뜨린다. 여기서는 바꾸지 않고 그대로 뜬다.
 *   - 빼는 것: `admin_login_attempts`(빈도 제한 카운터). IP 가 키다 — 개인정보 처리 기록에
 *     'IP 를 자료로 쌓지 않는다'고 적어 두었으므로 백업에도 남기지 않는다.
 *   - 이미지 본문은 담지 않는다. 이미 R2 에 있다 — R2 를 R2 에 또 넣을 이유가 없다.
 *
 * **되돌리기.** `scripts/backup-to-sql.mjs` 가 이 JSON 을 INSERT 문으로 바꾼다 → docs/deploy.md '복구'.
 * **보관.** 최근 30일. 그보다 오래된 것은 새 백업을 남길 때 지운다.
 */
import { readDoc, writeDoc } from './store.js';

export const BACKUP_PREFIX = 'backups/';
const KEY_PREFIX = 'backups/db-';           // 이 함수가 남기는 것. Actions 의 SQL 덤프(cham-*.sql)와 구분
const KEEP_DAYS = 30;
const MARK_KEY = 'backup';                  // documents 표의 표식 — { lastDay, at, key, bytes, tables, pruned, lastError }
const SKIP_TABLES = new Set(['admin_login_attempts']);
const RETRY_AFTER_MS = 10 * 60 * 1000;      // 실패하면 이만큼 뒤에 다시 — 매 요청마다 전 표를 읽지 않는다

/* isolate 안의 기억. 오늘 것을 확인했으면 요청마다 D1 을 다시 묻지 않는다.
   isolate 가 여럿이면 각자 한 번씩 묻는다 — 같은 날 두 번 떠도 같은 키에 덮어쓸 뿐이다. */
let checkedDay = '';
let nextTryAt = 0;

/** 한국 시각 기준 날짜. UTC 로 나누면 밤 아홉 시 뒤로는 '어제' 백업이 된다. */
export const kstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function listTables(env) {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
      ORDER BY name`
  ).all();
  return (results || []).map((r) => r.name).filter((n) => !SKIP_TABLES.has(n));
}

/** 모든 표의 행. 표 이름은 sqlite_master 에서 왔으므로 큰따옴표만 막으면 된다. */
export async function snapshot(env) {
  const tables = {};
  for (const name of await listTables(env)) {
    const { results } = await env.DB.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all();
    tables[name] = results || [];
  }
  return { app: 'kach', kind: 'd1-rows', version: 1, takenAt: new Date().toISOString(), tables };
}

/** 보관 기간이 지난 것을 지운다. 이 함수가 남긴 것(db-)만 — Actions 덤프는 건드리지 않는다. */
async function prune(env, today) {
  const cutoff = new Date(Date.parse(today) - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  const listed = await env.MEDIA.list({ prefix: KEY_PREFIX });
  const old = (listed.objects || []).filter((o) => o.key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 10) < cutoff);
  await Promise.all(old.map((o) => env.MEDIA.delete(o.key)));
  return old.length;
}

/**
 * 오늘 백업이 없으면 뜬다. 어떤 경우에도 던지지 않는다 — 백업이 페이지를 막아서는 안 된다.
 * 실패는 표식(`lastError`)에 남겨 관리자 화면이 보여 준다. 조용히 사라지는 실패가 가장 나쁘다.
 */
export async function runDailyBackup(env) {
  if (!env || !env.DB || !env.MEDIA) return;
  const today = kstDay();
  if (checkedDay === today || Date.now() < nextTryAt) return;

  let mark = null;
  try {
    mark = (await readDoc(env, MARK_KEY)) || {};
    if (mark.lastDay === today) { checkedDay = today; return; }

    const snap = await snapshot(env);
    const key = `${KEY_PREFIX}${today}.json`;
    const put = await env.MEDIA.put(key, JSON.stringify(snap), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    const pruned = await prune(env, today);
    await writeDoc(env, MARK_KEY, {
      lastDay: today, at: snap.takenAt, key, bytes: put ? put.size : null,
      tables: Object.keys(snap.tables).length,
      rows: Object.values(snap.tables).reduce((n, t) => n + t.length, 0),
      pruned,
    });
    checkedDay = today;
  } catch (e) {
    nextTryAt = Date.now() + RETRY_AFTER_MS;
    try {
      await writeDoc(env, MARK_KEY, { ...(mark || {}), lastError: String(e && e.message || e), lastErrorAt: new Date().toISOString() });
    } catch {
      /* 표식조차 못 쓰면(D1 이 죽었다) 남길 곳이 없다 — 다음 시도가 다시 적는다 */
    }
  }
}
