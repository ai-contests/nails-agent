import { defineConfig } from 'drizzle-kit';

// drizzle-kit 加载 config 时是 CJS 上下文，避免用 ESM-only API（fileURLToPath 等）。
// SQLITE_PATH 由 db:migrate 之前显式 export，或默认仓库根 data/nails.db。
const dbPath = process.env.SQLITE_PATH ?? '../data/nails.db';

export default defineConfig({
  out: './migrations',
  schema: './src/schema/index.ts',
  dialect: 'sqlite',
  dbCredentials: { url: dbPath },
  verbose: true,
  strict: false,
});
