import { desc } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(): Promise<Response> {
  const { db } = openDb();
  const runs = await db
    .select()
    .from(schema.agentRuns)
    .orderBy(desc(schema.agentRuns.started_at));

  return json({ runs });
}
