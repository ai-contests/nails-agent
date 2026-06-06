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

  // If a specific category is selected, we check if it matches in color_tags or length_tags
  if (cat && cat !== 'all') {
    const term = `%${cat.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${schema.nailStyles.color_tags})`, term),
        like(sql`lower(${schema.nailStyles.length_tags})`, term)
      )!
    );
  }

  // If there is a search query, match it against the style_id (since we don't have titles in db currently)
  // or color tags to provide broader search
  if (q) {
    const term = `%${q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${schema.nailStyles.style_id})`, term),
        like(sql`lower(${schema.nailStyles.color_tags})`, term)
      )!
    );
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
