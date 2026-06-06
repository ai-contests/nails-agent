export const dynamic = 'force-dynamic';
/**
 * GET /api/similar-hand-recommendations?sessionId=<id>
 *
 * PRD §5.4 — 相似手型弹窗
 * 召回逻辑: 取同 hand_shape 的其他 sessions 在 behavior_events
 *   (favorite_add / tryon_success / style_click) 数高的 ~30 个 style_id
 * 兜底:
 *   - hand_shape=unknown → global_main active 推荐前 30
 *   - 同手型数据不足 → mergeRankedStyles(行为结果, 全平台热度补齐)
 * 来源: source_page=similar_hand_popup (由前端在埋点时带上，API 不强制)
 */

import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';
import { mergeRankedStyles, getGlobalRecommendationFallback } from '@/src/app/api/_recommendation';

const LIMIT = 30;

/** Behavior event weights matching PRD priority: favorite > tryon > click */
const EVENT_SCORE: Record<string, number> = {
  favorite_add: 3,
  tryon_success: 2,
  style_click: 1,
};

export async function GET(req: NextRequest): Promise<Response> {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return json({ error: 'Missing session ID' }, 400);

  const { db } = openDb();

  // Load this session's hand profile
  const profile = await db
    .select()
    .from(schema.userHandProfiles)
    .where(eq(schema.userHandProfiles.session_id, sessionId))
    .get();

  // Fallback: unknown hand_shape → global recommendations
  if (!profile || profile.hand_shape === 'unknown') {
    const fallback = await getGlobalRecommendationFallback(db, LIMIT);
    return json({
      handShape: 'unknown',
      skinTone: null,
      source: 'global_fallback',
      items: fallback,
    });
  }

  // Query behavior signals from OTHER sessions with the same hand_shape.
  // Joins: user_hand_profiles (same shape, different session)
  //        → behavior_events (favorite_add / tryon_success / style_click)
  //        → nail_styles (listed only)
  const behaviorRows = await db
    .select({
      style: schema.nailStyles,
      eventType: schema.behaviorEvents.event_type,
      createdAt: schema.behaviorEvents.created_at,
    })
    .from(schema.userHandProfiles)
    .innerJoin(
      schema.behaviorEvents,
      eq(schema.userHandProfiles.session_id, schema.behaviorEvents.session_id),
    )
    .innerJoin(
      schema.nailStyles,
      eq(schema.behaviorEvents.style_id, schema.nailStyles.style_id),
    )
    .where(
      and(
        eq(schema.userHandProfiles.hand_shape, profile.hand_shape),
        sql`${schema.userHandProfiles.session_id} != ${sessionId}`,
        eq(schema.nailStyles.status, 'listed'),
        sql`${schema.behaviorEvents.event_type} IN ('favorite_add', 'tryon_success', 'style_click')`,
      ),
    );

  // Aggregate: score each style by weighted event count
  type StyleScore = {
    style: typeof schema.nailStyles.$inferSelect;
    score: number;
    lastEventAt: string;
  };

  const scoreByStyle = new Map<string, StyleScore>();
  for (const row of behaviorRows) {
    const current = scoreByStyle.get(row.style.style_id) ?? {
      style: row.style,
      score: 0,
      lastEventAt: row.createdAt,
    };
    current.score += EVENT_SCORE[row.eventType] ?? 1;
    if (row.createdAt > current.lastEventAt) current.lastEventAt = row.createdAt;
    scoreByStyle.set(row.style.style_id, current);
  }

  const behaviorRanked = [...scoreByStyle.values()]
    .sort((a, b) => b.score - a.score || b.lastEventAt.localeCompare(a.lastEventAt))
    .map(v => v.style);

  // Fallback: fill remaining slots from global active snapshot
  const globalFallback = await getGlobalRecommendationFallback(db, LIMIT);
  const items = mergeRankedStyles(behaviorRanked, globalFallback, LIMIT);

  return json({
    handShape: profile.hand_shape,
    skinTone: profile.skin_tone,
    source: behaviorRanked.length > 0 ? 'similar_hand_behavior' : 'global_fallback',
    behaviorMatchCount: behaviorRanked.length,
    items,
  });
}
