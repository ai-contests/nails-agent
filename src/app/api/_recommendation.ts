/**
 * Shared recommendation helpers for Next.js API routes.
 * Ported from src/api/recommendationLogic.ts (Bun server).
 */

import { eq, and } from 'drizzle-orm';
import { schema } from '@/db/src/client';

export interface StyleLike {
  style_id: string;
}

/**
 * Merge a primary ranked list with a fallback, deduplicating by style_id.
 * Primary items come first; fallback fills remaining slots up to `limit`.
 */
export function mergeRankedStyles<T extends StyleLike>(
  primary: T[],
  fallback: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const style of [...primary, ...fallback]) {
    if (seen.has(style.style_id)) continue;
    seen.add(style.style_id);
    merged.push(style);
    if (merged.length >= limit) break;
  }

  return merged;
}

/**
 * Return the currently active global_main recommendation snapshot's styles,
 * falling back to all listed styles if no active snapshot exists.
 * Used as the fallback for similar-hand-recommendations when behavioral
 * signals are insufficient.
 */
export async function getGlobalRecommendationFallback(
  db: ReturnType<typeof import('@/db/src/client').openDb>['db'],
  limit: number,
) {
  const snapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active'),
      ),
    )
    .get();

  if (snapshot) {
    const ranked = await db
      .select({ style: schema.nailStyles })
      .from(schema.recommendationItems)
      .innerJoin(
        schema.nailStyles,
        eq(schema.recommendationItems.style_id, schema.nailStyles.style_id),
      )
      .where(
        and(
          eq(schema.recommendationItems.snapshot_id, snapshot.snapshot_id),
          eq(schema.nailStyles.status, 'listed'),
        ),
      )
      .orderBy(schema.recommendationItems.rank_no)
      .limit(limit);

    return ranked.map((row: { style: typeof schema.nailStyles.$inferSelect }) => row.style);
  }

  return db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'listed'))
    .limit(limit);
}
