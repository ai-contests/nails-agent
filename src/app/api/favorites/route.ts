export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json() as {
    sessionId?: string;
    styleId?: string;
    isActive?: boolean;
  };
  const { sessionId, styleId, isActive = true } = body;

  if (!sessionId || !styleId) {
    return json({ error: 'Missing params' }, 400);
  }

  const { db } = openDb();
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(schema.sessionFavorites)
    .where(
      and(
        eq(schema.sessionFavorites.session_id, sessionId),
        eq(schema.sessionFavorites.style_id, styleId)
      )
    )
    .get();

  if (existing) {
    await db.update(schema.sessionFavorites)
      .set({ is_active: isActive, updated_at: now })
      .where(
        and(
          eq(schema.sessionFavorites.session_id, sessionId),
          eq(schema.sessionFavorites.style_id, styleId)
        )
      );
  } else {
    await db.insert(schema.sessionFavorites).values({
      session_id: sessionId,
      style_id: styleId,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
  }

  await db.insert(schema.behaviorEvents).values({
    event_id: generateId('EV'),
    session_id: sessionId,
    style_id: styleId,
    event_type: isActive ? 'favorite_add' : 'favorite_remove',
    source_page: 'detail',
    created_at: now,
  });

  return json({ success: true, isActive });
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return json({ error: 'Missing session ID' }, 400);

  const { db } = openDb();
  const favorites = await db
    .select({ style: schema.nailStyles })
    .from(schema.sessionFavorites)
    .innerJoin(schema.nailStyles, eq(schema.sessionFavorites.style_id, schema.nailStyles.style_id))
    .where(
      and(
        eq(schema.sessionFavorites.session_id, sessionId),
        eq(schema.sessionFavorites.is_active, true)
      )
    );

  return json({ items: favorites.map((f: typeof favorites[number]) => f.style) });
}
