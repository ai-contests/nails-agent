import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { openDb, schema } from '@/db/src/client';
import {
  buildTryonWorkflow,
  submitPrompt,
  pollJob,
  downloadView,
  extractOutputs,
  uploadImage,
} from '@/src/services/comfycloud';
import { json, generateId } from '@/app/api/_helpers';

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json() as {
    sessionId?: string;
    styleId?: string;
    handImageId?: string;
  };

  const { sessionId, styleId, handImageId } = body;

  if (!sessionId || !styleId || !handImageId) {
    return json({ error: 'Missing parameters' }, 400);
  }

  const { db } = openDb();

  const handImage = await db
    .select()
    .from(schema.userHandImages)
    .where(eq(schema.userHandImages.hand_image_id, handImageId))
    .get();

  const style = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.style_id, styleId))
    .get();

  if (!handImage || !style) {
    return json({ error: 'Hand image or Style not found' }, 404);
  }

  const tryonJobId = generateId('JOB');
  const now = new Date().toISOString();

  await db.insert(schema.tryonJobs).values({
    tryon_job_id: tryonJobId,
    session_id: sessionId,
    style_id: styleId,
    hand_image_id: handImageId,
    status: 'pending',
    input_hand_image_url: handImage.image_url,
    style_image_url: style.image_url,
    created_at: now,
  });

  await db.insert(schema.behaviorEvents).values({
    event_id: generateId('EV'),
    session_id: sessionId,
    style_id: styleId,
    event_type: 'tryon_start',
    source_page: 'detail',
    created_at: now,
  });

  // Background workflow — fire and forget
  (async () => {
    try {
      await db.update(schema.tryonJobs)
        .set({ status: 'running', started_at: new Date().toISOString() })
        .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId));

      const handName = await uploadImage(path.join(process.cwd(), handImage.image_url));
      const styleName = await uploadImage(path.join(process.cwd(), style.image_url));
      const workflow = buildTryonWorkflow(handName, styleName);
      const promptId = await submitPrompt(workflow);

      await db.update(schema.tryonJobs)
        .set({ comfyui_workflow_id: promptId })
        .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId));

      const jobResult = await pollJob(promptId);

      if (jobResult.status === 'completed') {
        const outputs = extractOutputs(jobResult);
        const outImg = outputs[0];
        if (outImg) {
          const imgBuffer = await downloadView(outImg.filename, outImg.subfolder, outImg.type);
          const outDir = path.join(process.cwd(), 'data', 'tryon_results');
          await mkdir(outDir, { recursive: true });
          const outName = `${tryonJobId}.png`;
          await writeFile(path.join(outDir, outName), imgBuffer);
          const resultUrl = `/data/tryon_results/${outName}`;

          await db.update(schema.tryonJobs)
            .set({ status: 'success', result_image_url: resultUrl, finished_at: new Date().toISOString() })
            .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId));

          await db.insert(schema.behaviorEvents).values({
            event_id: generateId('EV'),
            session_id: sessionId,
            style_id: styleId,
            event_type: 'tryon_success',
            source_page: 'detail',
            created_at: new Date().toISOString(),
          });
        }
      } else {
        throw new Error(`Job ended with status ${jobResult.status}`);
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`Tryon job ${tryonJobId} failed:`, err);
      await db.update(schema.tryonJobs)
        .set({
          status: 'failed',
          error_message: err.message || String(e),
          finished_at: new Date().toISOString(),
        })
        .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId));

      await db.insert(schema.behaviorEvents).values({
        event_id: generateId('EV'),
        session_id: sessionId,
        style_id: styleId,
        event_type: 'tryon_failed',
        source_page: 'detail',
        created_at: new Date().toISOString(),
      });
    }
  })();

  return json({ tryonJobId, status: 'running' });
}
