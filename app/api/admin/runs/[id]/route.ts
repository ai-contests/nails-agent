import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: runId } = await params;
  if (!runId) return json({ error: 'Missing run ID' }, 400);

  const { db } = openDb();

  const run = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agent_run_id, runId))
    .get();

  if (!run) return json({ error: 'Run not found' }, 404);

  const [findings, decisions, proposals] = await Promise.all([
    db.select().from(schema.agentFindings).where(eq(schema.agentFindings.agent_run_id, runId)),
    db.select().from(schema.agentDecisions).where(eq(schema.agentDecisions.agent_run_id, runId)),
    db.select().from(schema.agentActionProposals).where(eq(schema.agentActionProposals.agent_run_id, runId)),
  ]);

  return json({ run, findings, decisions, proposals });
}
