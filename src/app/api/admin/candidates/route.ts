export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(): Promise<Response> {
  const { db } = openDb();
  const candidates = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'candidate'));

  return json({ candidates });
}
