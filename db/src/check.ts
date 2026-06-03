import { sql } from 'drizzle-orm';
import { openDb } from './client.ts';

const { sqlite, db } = openDb();

const tables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];

console.log(`\n[check] ${tables.length} tables in DB:\n`);
const counts: { table: string; rows: number }[] = [];
for (const t of tables) {
  if (t.name.startsWith('sqlite_') || t.name === '__drizzle_migrations') continue;
  const row = sqlite.prepare(`SELECT count(*) as n FROM ${t.name}`).get() as { n: number };
  counts.push({ table: t.name, rows: row.n });
}
const pad = Math.max(...counts.map(c => c.table.length));
for (const c of counts) {
  console.log(`  ${c.table.padEnd(pad)}  ${c.rows}`);
}

// 几个抽样
const samples = db.all(sql`SELECT style_id, status, color_tags, length_tags FROM nail_styles LIMIT 5`);
console.log(`\n[check] sample nail_styles:`);
console.dir(samples, { depth: 4 });

const recoActive = db.all(sql`SELECT snapshot_id, snapshot_type, status, generated_by FROM recommendation_snapshots WHERE status='active'`);
console.log(`\n[check] active recommendation_snapshots:`);
console.dir(recoActive, { depth: 4 });

sqlite.close();
