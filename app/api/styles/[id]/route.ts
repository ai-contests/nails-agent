import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: styleId } = await params;
  const { db } = openDb();
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!styleId) {
    return json({ error: 'Missing style ID' }, 400);
  }

  const style = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.style_id, styleId))
    .get();

  if (!style) {
    return json({ error: 'Style not found' }, 404);
  }

  const features = await db
    .select()
    .from(schema.nailVisualFeatures)
    .where(eq(schema.nailVisualFeatures.style_id, styleId))
    .get();

  let isFavorited = false;
  if (sessionId) {
    const favorite = await db
      .select()
      .from(schema.sessionFavorites)
      .where(
        and(
          eq(schema.sessionFavorites.session_id, sessionId),
          eq(schema.sessionFavorites.style_id, styleId),
          eq(schema.sessionFavorites.is_active, true)
        )
      )
      .get();
    isFavorited = !!favorite;

    await db.insert(schema.behaviorEvents).values({
      event_id: generateId('EV'),
      session_id: sessionId,
      style_id: styleId,
      event_type: 'style_click',
      source_page: 'detail',
      created_at: new Date().toISOString(),
    }).catch((err: unknown) => console.error('Error logging style_click event:', err));
  }

  return json({ style, features: features ?? null, isFavorited });
}
