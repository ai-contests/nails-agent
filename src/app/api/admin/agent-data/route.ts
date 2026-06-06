export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { openDb, schema } from '@/db/src/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const { db } = openDb();

  try {
    const pendingReviews = await db
      .select()
      .from(schema.agentPendingReviews)
      .orderBy(desc(schema.agentPendingReviews.created_at))
      .limit(50);

    const memories = await db
      .select()
      .from(schema.strategyMemories)
      .orderBy(desc(schema.strategyMemories.created_at))
      .limit(50);

    return NextResponse.json({
      pendingReviews,
      strategyMemories: memories
    });
  } catch (error) {
    console.error('Failed to fetch agent data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
