export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';
import { and, eq, like, or, sql } from 'drizzle-orm';

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;
  
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '8', 10);
  const cat = searchParams.get('cat') || 'all';
  const q = searchParams.get('q') || '';
  
  const offset = (page - 1) * limit;
  const { db } = openDb();

  const conditions = [eq(schema.nailStyles.status, 'listed')];

  const TAG_EXPANSIONS: Record<string, string[]> = {
    nude: ['nude', 'tan', 'beige', 'cream', 'khaki'],
    metallic: ['metallic', 'silver', 'gold', 'rose_gold', 'copper', 'champagne'],
    purple: ['purple', 'lavender', 'lilac', 'plum', 'mauve'],
    red: ['red', 'hot_pink', 'red_pink', 'red_dark'],
    pink: ['pink', 'rose_gold', 'hot_pink', 'red_pink', 'dusty_rose', 'peach'],
    blue: ['blue', 'navy', 'sky_blue', 'light_blue'],
    green: ['green', 'olive', 'dark_green', 'khaki'],
    black: ['black', 'gray_dark'],
    white: ['white', 'cream', 'champagne', 'ivory'],
    gray: ['gray', 'silver', 'charcoal'],
    brown: ['brown', 'tan', 'coffee', 'chocolate']
  };

  // If a specific category is selected, we check if it matches in color_tags or length_tags
  if (cat && cat !== 'all') {
    const targetTags = TAG_EXPANSIONS[cat.toLowerCase()] || [cat.toLowerCase()];
    const orConditions = targetTags.map(t => {
      const term = `%${t.toLowerCase()}%`;
      return or(
        like(sql`lower(${schema.nailStyles.color_tags})`, term),
        like(sql`lower(${schema.nailStyles.length_tags})`, term)
      );
    });
    conditions.push(or(...orConditions)!);
  }

  // If there is a search query, match it against the style_id (since we don't have titles in db currently)
  // or color tags to provide broader search. Now supports Chinese keywords.
  if (q) {
    const translationMap: Record<string, string> = {
      '短': 'short', '中': 'medium', '长': 'long',
      '裸': 'nude', '粉': 'pink', '紫': 'purple', '红': 'red',
      '金属': 'metallic', '白': 'white', '米': 'beige', '香槟': 'champagne',
      '黑': 'black', '灰': 'gray', '银': 'silver', '蓝': 'blue',
      '天蓝': 'sky_blue', '深蓝': 'navy', '绿': 'green', '深绿': 'dark_green',
      '橄榄': 'olive', '卡其': 'khaki', '棕': 'brown', '褐': 'tan',
      '奶油': 'cream', '薰草': 'lavender', '丁香': 'lilac', '玫瑰灰': 'mauve',
      '梅子': 'plum', '玫瑰金': 'rose_gold', '烟粉': 'dusty_rose', '玫红': 'hot_pink',
      '金': 'gold', '铜': 'copper', '猫眼': 'cat_eye', '法式': 'french'
    };

    const initialTerms = [q.toLowerCase()];
    // Check for Chinese keywords and add their English equivalents
    for (const [zh, en] of Object.entries(translationMap)) {
      if (q.includes(zh)) {
        initialTerms.push(en);
      }
    }

    // Expand terms (e.g., 'nude' -> ['nude', 'tan', 'beige', ...])
    const expandedTerms = new Set<string>();
    for (const term of initialTerms) {
      expandedTerms.add(term);
      if (TAG_EXPANSIONS[term]) {
        TAG_EXPANSIONS[term].forEach(t => expandedTerms.add(t));
      }
    }

    const termConditions = Array.from(expandedTerms).map(t => {
      const term = `%${t.toLowerCase()}%`;
      return or(
        like(sql`lower(${schema.nailStyles.style_id})`, term),
        like(sql`lower(${schema.nailStyles.color_tags})`, term),
        like(sql`lower(${schema.nailStyles.length_tags})`, term)
      );
    });

    conditions.push(or(...termConditions)!);
  }

  const whereClause = and(...conditions);

  // 1. Get the total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.nailStyles)
    .where(whereClause);

  // 2. Fetch the paginated data
  const items = await db
    .select()
    .from(schema.nailStyles)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(sql`${schema.nailStyles.created_at} DESC`); // or listed_at

  return json({
    items,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  });
}
