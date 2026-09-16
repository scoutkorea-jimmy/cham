#!/usr/bin/env node
/**
 * 자동 백업(R2 `backups/db-YYYY-MM-DD.json` — 관리자 > 데이터 백업에서 내려받는다)을
 * D1 에 되돌릴 SQL 로 바꾼다.
 *
 *   node scripts/backup-to-sql.mjs db-2026-09-17.json > restore.sql
 *   node scripts/backup-to-sql.mjs db-2026-09-17.json orders order_items > restore.sql   # 표를 골라서
 *   npx wrangler d1 execute cham-db --remote --file=restore.sql
 *
 * INSERT OR REPLACE 라 백업에 있는 행은 덮어쓰고, 백업 뒤에 생긴 행은 **남는다.**
 * 표를 통째로 백업 시점으로 되돌리려면 먼저 그 표를 비운다 → docs/deploy.md '복구'.
 * 스키마(CREATE TABLE)는 만들지 않는다 — db/*.sql 이 원본이다.
 */
import { readFileSync } from 'node:fs';

const [file, ...only] = process.argv.slice(2);
if (!file) {
  console.error('쓰는 법: node scripts/backup-to-sql.mjs <backup.json> [표 이름 …]');
  process.exit(1);
}
const dump = JSON.parse(readFileSync(file, 'utf8'));
if (!dump || dump.kind !== 'd1-rows' || !dump.tables) {
  console.error('자동 백업 파일이 아닙니다(kind: d1-rows 가 아니다).');
  process.exit(1);
}

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;
const v = (x) => {
  if (x === null || x === undefined) return 'NULL';
  if (typeof x === 'number') return Number.isFinite(x) ? String(x) : 'NULL';
  if (typeof x === 'boolean') return x ? '1' : '0';
  return `'${String(x).replace(/'/g, "''")}'`;
};

const out = [`-- ${file} · 뜬 시각 ${dump.takenAt} · 이 파일: ${new Date().toISOString()}`];
for (const [table, rows] of Object.entries(dump.tables)) {
  if (only.length && !only.includes(table)) continue;
  out.push(`-- ${table}: ${rows.length}행`);
  for (const row of rows) {
    const cols = Object.keys(row);
    out.push(`INSERT OR REPLACE INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map((c) => v(row[c])).join(', ')});`);
  }
}
process.stdout.write(out.join('\n') + '\n');
