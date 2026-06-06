export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: chatSessionId } = await params;
  if (!chatSessionId) return json({ error: 'Missing session ID' }, 400);

  const { db } = openDb();
  const messages = await db
    .select()
    .from(schema.agentChatMessages)
    .where(eq(schema.agentChatMessages.chat_session_id, chatSessionId))
    .orderBy(schema.agentChatMessages.created_at);

  return json({
    messages: messages.map((m: typeof messages[number]) => ({
      messageId: m.message_id,
      role: m.role,
      content: m.content,
      relatedRunIds: m.related_run_ids ? (JSON.parse(m.related_run_ids) as string[]) : [],
      relatedFindingIds: m.related_finding_ids ? (JSON.parse(m.related_finding_ids) as string[]) : [],
      relatedDecisionIds: m.related_decision_ids ? (JSON.parse(m.related_decision_ids) as string[]) : [],
      createdAt: m.created_at,
    })),
  });
}
