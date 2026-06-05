import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './paths';
import * as schema from './schema/index';

let cachedDb: any = null;

export function openDb() {
  if (cachedDb) return cachedDb;
  
  mkdirSync(dirname(DB_PATH), { recursive: true });
  
  // Use @libsql/client which is cross-runtime compatible (Node.js & Bun)
  const sqlite = createClient({ 
    url: `file:${DB_PATH}`,
    // Ensure WAL mode is handled natively by SQLite or not strictly required for local file url if driver handles it
  });
  
  cachedDb = { sqlite, db: drizzle(sqlite, { schema }) };
  return cachedDb;
}

export { schema };
