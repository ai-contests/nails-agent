import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { json } from '@/app/api/_helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: tryonJobId } = await params;
  if (!tryonJobId) return json({ error: 'Missing job ID' }, 400);

  const { db } = openDb();
  const job = await db
    .select()
    .from(schema.tryonJobs)
    .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId))
    .get();

  if (!job) return json({ error: 'Job not found' }, 404);

  return json({
    tryonJobId: job.tryon_job_id,
    sessionId: job.session_id,
    styleId: job.style_id,
    handImageId: job.hand_image_id,
    status: job.status,
    inputHandImageUrl: job.input_hand_image_url,
    styleImageUrl: job.style_image_url,
    resultImageUrl: job.result_image_url,
    errorMessage: job.error_message,
    comfyuiWorkflowId: job.comfyui_workflow_id,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
  });
}
