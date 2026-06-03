import { existsSync, rmSync } from 'node:fs';
import { DB_PATH } from './paths.ts';

if (existsSync(DB_PATH)) {
  rmSync(DB_PATH);
  console.log(`[reset] removed ${DB_PATH}`);
} else {
  console.log(`[reset] ${DB_PATH} not found, nothing to do`);
}

// 同时清掉 WAL / SHM 边角文件
for (const suffix of ['-wal', '-shm', '-journal']) {
  const p = DB_PATH + suffix;
  if (existsSync(p)) { rmSync(p); console.log(`[reset] removed ${p}`); }
}
