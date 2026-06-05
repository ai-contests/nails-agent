import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(req: NextRequest): Promise<Response> {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return json({ error: 'Missing session ID' }, 400);

  const { db } = openDb();

  const profile = await db
    .select()
    .from(schema.userHandProfiles)
    .where(eq(schema.userHandProfiles.session_id, sessionId))
    .get();

  const listedStyles = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'listed'))
    .limit(30);

  if (!profile || profile.hand_shape === 'unknown') {
    return json({ handShape: 'unknown', skinTone: null, items: listedStyles.slice(0, 15) });
  }

  // Bias selection by hand shape:
  // slender_long -> prefer medium/long length tags and nude/pink colors
  // short_wide   -> prefer short length tags
  const preferLong = profile.hand_shape === 'slender_long' || profile.hand_shape === 'narrow_palm';
  const scored = listedStyles
    .map(s => {
      const lengths: string[] = s.length_tags ? (JSON.parse(s.length_tags) as string[]) : [];
      let score = Math.random();
      if (preferLong && (lengths.includes('long') || lengths.includes('medium'))) score += 1;
      if (!preferLong && lengths.includes('short')) score += 1;
      return { style: s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(x => x.style);

  return json({
    handShape: profile.hand_shape,
    skinTone: profile.skin_tone,
    items: scored,
  });
}
