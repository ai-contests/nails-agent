import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { DB_PATH } from './paths';
import * as schema from './schema/index';

const require = createRequire(import.meta.url);
let cachedDb: any = null;

export function openDb() {
  if (cachedDb) return cachedDb;
  
  mkdirSync(dirname(DB_PATH), { recursive: true });
  
  const isBun = typeof Bun !== 'undefined';
  
  if (isBun) {
    const { Database } = require('bun:sqlite');
    const { drizzle } = require('drizzle-orm/bun-sqlite');
    const sqlite = new Database(DB_PATH);
    sqlite.run('PRAGMA journal_mode = WAL');
    sqlite.run('PRAGMA foreign_keys = ON');
    cachedDb = { sqlite, db: drizzle(sqlite, { schema }) };
  } else {
    const { createClient } = require('@libsql/client');
    const { drizzle } = require('drizzle-orm/libsql');
    const client = createClient({ url: `file:${DB_PATH}` });
    cachedDb = { sqlite: client, db: drizzle(client, { schema }) };
  }
  
  return cachedDb;
}

export { schema };


