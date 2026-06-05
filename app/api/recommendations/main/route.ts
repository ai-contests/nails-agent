import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';

export async function GET(req: NextRequest): Promise<Response> {
  const { db } = openDb();
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  const snapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  if (!snapshot) {
    const styles = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.status, 'listed'));
    return json({ items: styles.map((s, idx) => ({ style: s, rankNo: idx + 1 })) });
  }

  const items = await db
    .select({
      item: schema.recommendationItems,
      style: schema.nailStyles,
    })
    .from(schema.recommendationItems)
    .innerJoin(schema.nailStyles, eq(schema.recommendationItems.style_id, schema.nailStyles.style_id))
    .where(eq(schema.recommendationItems.snapshot_id, snapshot.snapshot_id))
    .orderBy(schema.recommendationItems.rank_no);

  if (sessionId && items.length > 0) {
    (async () => {
      const now = new Date().toISOString();
      for (const item of items.slice(0, 10)) {
        await db.insert(schema.behaviorEvents).values({
          event_id: generateId('EV'),
          session_id: sessionId,
          style_id: item.style.style_id,
          event_type: 'style_view',
          source_page: 'main',
          created_at: now,
        }).catch((err: unknown) => console.error('Error logging style_view event:', err));
      }
    })();
  }

  return json({
    snapshotId: snapshot.snapshot_id,
    activatedAt: snapshot.activated_at,
    items: items.map(i => ({
      itemId: i.item.item_id,
      rankNo: i.item.rank_no,
      score: i.item.score,
      reason: i.item.reason,
      style: i.style,
    })),
  });
}
