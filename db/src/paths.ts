import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, '../..');
export const DATA_DIR = join(PROJECT_ROOT, 'data');
export const EXTRACTION_MANIFEST = join(DATA_DIR, 'extraction', 'manifest.json');

loadEnv({ path: join(PROJECT_ROOT, '.env') });

export const DB_PATH = process.env.SQLITE_PATH ?? join(DATA_DIR, 'nails.db');
