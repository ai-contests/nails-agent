export const dynamic = 'force-dynamic';
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

  // Deterministic scoring: hand_shape × length_tag affinity + skin_tone × color_tag affinity
  // No Math.random() — scores are stable between calls for the same session.
  const SHAPE_LENGTH_AFFINITY: Record<string, Record<string, number>> = {
    slender_long:  { long: 1.0, medium: 0.6, short: 0.2 },
    narrow_palm:   { long: 0.9, medium: 0.7, short: 0.3 },
    square_palm:   { long: 0.4, medium: 0.8, short: 0.8 },
    short_wide:    { long: 0.2, medium: 0.6, short: 1.0 },
  };
  const TONE_COLOR_AFFINITY: Record<string, string[]> = {
    cool_fair:   ['lavender', 'light_blue', 'silver', 'champagne', 'white', 'pink'],
    warm_fair:   ['peach', 'rose_gold', 'champagne', 'coral', 'nude', 'pink'],
    natural:     ['rose_gold', 'pink', 'white', 'nude', 'brown', 'mauve'],
    warm_yellow: ['orange', 'coral', 'gold', 'champagne', 'rose_gold', 'tan'],
    wheat:       ['brown', 'tan', 'olive', 'burgundy', 'rose_gold'],
    deep:        ['gold', 'burgundy', 'black', 'purple', 'plum', 'red'],
  };

  const shapeLengths = SHAPE_LENGTH_AFFINITY[profile.hand_shape] ?? {};
  const toneColors = new Set(TONE_COLOR_AFFINITY[profile.skin_tone] ?? []);

  const scored = listedStyles
    .map(s => {
      const lengths: string[] = s.length_tags ? (JSON.parse(s.length_tags) as string[]) : [];
      const colors: string[] = s.color_tags ? (JSON.parse(s.color_tags) as string[]) : [];

      const lengthScore = lengths.reduce((max, l) => Math.max(max, shapeLengths[l] ?? 0.3), 0);
      const colorScore = colors.some(c => toneColors.has(c)) ? 0.5 : 0;

      return { style: s, score: lengthScore + colorScore };
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
