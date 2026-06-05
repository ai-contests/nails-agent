import { openDb, schema } from '@/db/src/client';
import { json, generateId } from '@/app/api/_helpers';

export async function POST(): Promise<Response> {
  const { db } = openDb();
  const chatSessionId = generateId('CSES');
  const now = new Date().toISOString();

  await db.insert(schema.agentChatSessions).values({
    chat_session_id: chatSessionId,
    created_at: now,
    updated_at: now,
  });

  return json({ chatSessionId });
}
