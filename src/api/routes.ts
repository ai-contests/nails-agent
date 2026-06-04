import { Router } from './router.js';
import { openDb, schema } from '../../db/src/client.js';
import { eq, and, desc } from 'drizzle-orm';
import { analyzeHandImage } from '../services/handCV.js';
import { buildTryonWorkflow, submitPrompt, pollJob, downloadView, extractOutputs, uploadImage } from '../services/comfycloud.js';
import { runOperationCycle } from '../agent/orchestrator.js';
import { callLlmModel, ChatMessage } from '../services/llm.js';
import fs from 'fs';
import path from 'path';

const { db } = openDb();

export const router = new Router();

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Helper to return JSON response
const jsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ==========================================
// C-SIDE ROUTES
// ==========================================

// 1. Get Main Recommendation Feed
router.get('/api/recommendations/main', async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  // Find active snapshot
  const snapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  if (!snapshot) {
    // Cold start fallback: return all listed styles
    const styles = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.status, 'listed'));
    return jsonResponse({ items: styles.map((s, idx) => ({ style: s, rankNo: idx + 1 })) });
  }

  // Retrieve recommendation items
  const items = await db
    .select({
      item: schema.recommendationItems,
      style: schema.nailStyles,
    })
    .from(schema.recommendationItems)
    .innerJoin(schema.nailStyles, eq(schema.recommendationItems.style_id, schema.nailStyles.style_id))
    .where(eq(schema.recommendationItems.snapshot_id, snapshot.snapshot_id))
    .orderBy(schema.recommendationItems.rank_no);

  // Write style_view event asynchronously for main feed
  if (sessionId && items.length > 0) {
    const eventPromise = async () => {
      for (const item of items.slice(0, 10)) { // Log views for top 10 items
        await db.insert(schema.behaviorEvents).values({
          event_id: generateId('EV'),
          session_id: sessionId,
          style_id: item.style.style_id,
          event_type: 'style_view',
          source_page: 'main',
          created_at: new Date().toISOString(),
        });
      }
    };
    eventPromise().catch(err => console.error('Error logging style_view events:', err));
  }

  return jsonResponse({
    snapshotId: snapshot.snapshot_id,
    activatedAt: snapshot.activated_at,
    items: items.map(i => ({
      itemId: i.item.item_id,
      rankNo: i.item.rank_no,
      score: i.item.score,
      reason: i.item.reason,
      style: i.style,
    })),
  });
});

// 2. Get Style Details
router.get('/api/styles/:id', async (req, params) => {
  const styleId = params['id'];
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!styleId) {
    return jsonResponse({ error: 'Missing style ID' }, 400);
  }

  const style = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.style_id, styleId))
    .get();

  if (!style) {
    return jsonResponse({ error: 'Style not found' }, 404);
  }

  const features = await db
    .select()
    .from(schema.nailVisualFeatures)
    .where(eq(schema.nailVisualFeatures.style_id, styleId))
    .get();

  let isFavorited = false;
  if (sessionId) {
    const favorite = await db
      .select()
      .from(schema.sessionFavorites)
      .where(
        and(
          eq(schema.sessionFavorites.session_id, sessionId),
          eq(schema.sessionFavorites.style_id, styleId),
          eq(schema.sessionFavorites.is_active, true)
        )
      )
      .get();
    isFavorited = !!favorite;

    // Log click event
    await db.insert(schema.behaviorEvents).values({
      event_id: generateId('EV'),
      session_id: sessionId,
      style_id: styleId,
      event_type: 'style_click',
      source_page: 'detail',
      created_at: new Date().toISOString(),
    }).catch(err => console.error('Error logging style_click event:', err));
  }

  return jsonResponse({
    style,
    features,
    isFavorited,
  });
});

// 3. Upload Hand Image and CV Extract
router.post('/api/hand-images', async (req) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const clientId = formData.get('clientId') as string || null;

  if (!file) {
    return jsonResponse({ error: 'No file uploaded' }, 400);
  }

  const sessionId = generateId('SES');
  const handImageId = generateId('IMG');
  const now = new Date().toISOString();

  // Create new session
  await db.insert(schema.userSessions).values({
    session_id: sessionId,
    client_id: clientId,
    status: 'active',
    current_hand_image_id: handImageId,
    created_at: now,
  });

  // Save image file
  const buffer = await file.arrayBuffer();
  const fileName = `${handImageId}_${file.name}`;
  const uploadDir = path.join(process.cwd(), 'data/hand_uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const localPath = path.join(uploadDir, fileName);
  fs.writeFileSync(localPath, Buffer.from(buffer));

  // Write hand_image record
  await db.insert(schema.userHandImages).values({
    hand_image_id: handImageId,
    session_id: sessionId,
    image_url: `/data/hand_uploads/${fileName}`,
    created_at: now,
  });

  // Extract profiles
  const cvResult = await analyzeHandImage(localPath);

  // Write hand_profile record
  await db.insert(schema.userHandProfiles).values({
    hand_profile_id: generateId('HPF'),
    session_id: sessionId,
    hand_image_id: handImageId,
    hand_shape: cvResult.handShape,
    hand_shape_confidence: cvResult.handShapeConfidence,
    skin_tone: cvResult.skinTone,
    skin_tone_confidence: cvResult.skinToneConfidence,
    skin_rgb: JSON.stringify(cvResult.skinRgb),
    raw_metrics: JSON.stringify(cvResult.rawMetrics),
    created_at: now,
  });

  return jsonResponse({
    sessionId,
    handImageId,
    imageUrl: `/data/hand_uploads/${fileName}`,
    handShape: cvResult.handShape,
    skinTone: cvResult.skinTone,
  });
});

// 4. Trigger Try-On Job
router.post('/api/tryon-jobs', async (req) => {
  const { sessionId, styleId, handImageId } = await req.json() as {
    sessionId: string;
    styleId: string;
    handImageId: string;
  };

  if (!sessionId || !styleId || !handImageId) {
    return jsonResponse({ error: 'Missing parameters' }, 400);
  }

  // Load hand image path
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
    return jsonResponse({ error: 'Hand image or Style not found' }, 404);
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

  // Log tryon_start event
  await db.insert(schema.behaviorEvents).values({
    event_id: generateId('EV'),
    session_id: sessionId,
    style_id: styleId,
    event_type: 'tryon_start',
    source_page: 'detail',
    created_at: now,
  });

  // Run ComfyCloud workflow in background
  const runWorkflowPromise = async () => {
    try {
      await db.update(schema.tryonJobs)
        .set({ status: 'running', started_at: new Date().toISOString() })
        .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId));

      const handName = await uploadImage(path.join(process.cwd(), handImage.image_url));
      // Assume style.image_url points to a local or downloadable asset
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
          const outDir = path.join(process.cwd(), 'data/tryon_results');
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          const outName = `${tryonJobId}.png`;
          fs.writeFileSync(path.join(outDir, outName), imgBuffer);

          const resultUrl = `/data/tryon_results/${outName}`;
          await db.update(schema.tryonJobs)
            .set({
              status: 'success',
              result_image_url: resultUrl,
              finished_at: new Date().toISOString(),
            })
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
  };

  runWorkflowPromise().catch(err => console.error('Error running ComfyCloud try-on process:', err));

  return jsonResponse({
    tryonJobId,
    status: 'running',
  });
});

// 5. Get Try-On Job status
router.get('/api/tryon-jobs/:id', async (_req, params) => {
  const tryonJobId = params['id'];
  if (!tryonJobId) return jsonResponse({ error: 'Missing job ID' }, 400);

  const job = await db
    .select()
    .from(schema.tryonJobs)
    .where(eq(schema.tryonJobs.tryon_job_id, tryonJobId))
    .get();

  if (!job) return jsonResponse({ error: 'Job not found' }, 404);

  return jsonResponse(job);
});

// 6. Toggle Favorite Status
router.post('/api/favorites', async (req) => {
  const { sessionId, styleId, isActive } = await req.json() as {
    sessionId: string;
    styleId: string;
    isActive: boolean;
  };

  if (!sessionId || !styleId) {
    return jsonResponse({ error: 'Missing params' }, 400);
  }

  const now = new Date().toISOString();

  // Check if favorite exists
  const existing = await db
    .select()
    .from(schema.sessionFavorites)
    .where(
      and(
        eq(schema.sessionFavorites.session_id, sessionId),
        eq(schema.sessionFavorites.style_id, styleId)
      )
    )
    .get();

  if (existing) {
    await db.update(schema.sessionFavorites)
      .set({ is_active: isActive, updated_at: now })
      .where(
        and(
          eq(schema.sessionFavorites.session_id, sessionId),
          eq(schema.sessionFavorites.style_id, styleId)
        )
      );
  } else {
    await db.insert(schema.sessionFavorites).values({
      session_id: sessionId,
      style_id: styleId,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
  }

  // Log event
  await db.insert(schema.behaviorEvents).values({
    event_id: generateId('EV'),
    session_id: sessionId,
    style_id: styleId,
    event_type: isActive ? 'favorite_add' : 'favorite_remove',
    source_page: 'detail',
    created_at: now,
  });

  return jsonResponse({ success: true, isActive });
});

// 7. Get Favorites List
router.get('/api/favorites', async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) return jsonResponse({ error: 'Missing session ID' }, 400);

  const favorites = await db
    .select({ style: schema.nailStyles })
    .from(schema.sessionFavorites)
    .innerJoin(schema.nailStyles, eq(schema.sessionFavorites.style_id, schema.nailStyles.style_id))
    .where(
      and(
        eq(schema.sessionFavorites.session_id, sessionId),
        eq(schema.sessionFavorites.is_active, true)
      )
    );

  return jsonResponse({ items: favorites.map(f => f.style) });
});

// 8. Similar Hand Recommendations
router.get('/api/similar-hand-recommendations', async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) return jsonResponse({ error: 'Missing session ID' }, 400);

  // Load hand profile
  const profile = await db
    .select()
    .from(schema.userHandProfiles)
    .where(eq(schema.userHandProfiles.session_id, sessionId))
    .get();

  if (!profile || profile.hand_shape === 'unknown') {
    // Fallback: return top 15 recommendations
    const fallbackStyles = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.status, 'listed'))
      .limit(15);
    return jsonResponse({ handShape: 'unknown', items: fallbackStyles });
  }

  // Simple召回: find listed styles matching matching tag profiles
  // For demo, we just return listed styles matching some basic filter or simple shuffle
  const matchingStyles = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'listed'))
    .limit(15);

  return jsonResponse({
    handShape: profile.hand_shape,
    skinTone: profile.skin_tone,
    items: matchingStyles,
  });
});

// ==========================================
// B-SIDE ROUTES (ADMIN & AGENT)
// ==========================================

// 9. Manual Trigger Agent Run
router.post('/api/admin/run', async () => {
  // Trigger orchestrator in background
  const runPromise = async () => {
    try {
      await runOperationCycle('manual_demo');
    } catch (e) {
      console.error('Error running manual agent cycle:', e);
    }
  };
  
  runPromise().catch(err => console.error('Error starting manual run cycle:', err));

  return jsonResponse({ status: 'triggered', message: 'Manual agent run triggered successfully.' });
});

// 10. Get Agent Runs list
router.get('/api/admin/runs', async () => {
  const runs = await db
    .select()
    .from(schema.agentRuns)
    .orderBy(desc(schema.agentRuns.started_at));
  return jsonResponse({ runs });
});

// 11. Get Agent Run details
router.get('/api/admin/runs/:id', async (_req, params) => {
  const runId = params['id'];
  if (!runId) return jsonResponse({ error: 'Missing run ID' }, 400);

  const run = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agent_run_id, runId))
    .get();

  if (!run) return jsonResponse({ error: 'Run not found' }, 404);

  const findings = await db
    .select()
    .from(schema.agentFindings)
    .where(eq(schema.agentFindings.agent_run_id, runId));

  const decisions = await db
    .select()
    .from(schema.agentDecisions)
    .where(eq(schema.agentDecisions.agent_run_id, runId));

  const proposals = await db
    .select()
    .from(schema.agentActionProposals)
    .where(eq(schema.agentActionProposals.agent_run_id, runId));

  return jsonResponse({
    run,
    findings,
    decisions,
    proposals,
  });
});

// 12. Get Candidates List
router.get('/api/admin/candidates', async () => {
  const candidates = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'candidate'));
  return jsonResponse({ candidates });
});

// 13. Create Chat Session
router.post('/api/admin/chat/session', async () => {
  const chatSessionId = generateId('CSES');
  const now = new Date().toISOString();

  await db.insert(schema.agentChatSessions).values({
    chat_session_id: chatSessionId,
    created_at: now,
    updated_at: now,
  });

  return jsonResponse({ chatSessionId });
});

// 14. Send Message and query LLM
router.post('/api/admin/chat/messages', async (req) => {
  const { chatSessionId, content } = await req.json() as {
    chatSessionId: string;
    content: string;
  };

  if (!chatSessionId || !content) {
    return jsonResponse({ error: 'Missing params' }, 400);
  }

  const now = new Date().toISOString();

  // Save User message
  const userMessageId = generateId('MSG');
  await db.insert(schema.agentChatMessages).values({
    message_id: userMessageId,
    chat_session_id: chatSessionId,
    role: 'user',
    content,
    created_at: now,
  });

  // Load the last successful Agent Run
  const lastRun = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.status, 'completed'))
    .orderBy(desc(schema.agentRuns.completed_at))
    .get();

  let context = 'No successful Agent Runs found yet.';
  const relatedRunIds: string[] = [];
  const relatedFindingIds: string[] = [];
  const relatedDecisionIds: string[] = [];

  if (lastRun) {
    relatedRunIds.push(lastRun.agent_run_id);
    
    // Load findings and decisions
    const findings = await db
      .select()
      .from(schema.agentFindings)
      .where(eq(schema.agentRuns.agent_run_id, lastRun.agent_run_id));
    
    const decisions = await db
      .select()
      .from(schema.agentDecisions)
      .where(eq(schema.agentDecisions.agent_run_id, lastRun.agent_run_id));

    findings.forEach(f => relatedFindingIds.push(f.finding_id));
    decisions.forEach(d => relatedDecisionIds.push(d.decision_id));

    context = `
      Last Agent Run: ${lastRun.agent_run_id} (Trigger: ${lastRun.trigger_type}, Completed At: ${lastRun.completed_at})
      Summary: ${lastRun.chat_summary}
      Findings Identified: ${JSON.stringify(findings.map(f => ({ type: f.finding_type, title: f.title, summary: f.summary })))}
      Decisions Made: ${JSON.stringify(decisions.map(d => ({ action: d.action_type, summary: d.summary })))}
    `;
  }

  // Construct LLM Prompt
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are Nails-Agent. You answer B-side operator questions about the system performance and your operational decisions.\n\nContext of last run:\n${context}`
    },
    {
      role: 'user',
      content
    }
  ];

  let replyText = 'Fallback: Unable to generate LLM response.';
  try {
    replyText = await callLlmModel(messages);
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error calling LLM for Chat:', err);
    replyText = `Error calling LLM model: ${err.message || String(e)}`;
  }

  // Save Agent Response
  const agentMessageId = generateId('MSG');
  await db.insert(schema.agentChatMessages).values({
    message_id: agentMessageId,
    chat_session_id: chatSessionId,
    role: 'agent',
    content: replyText,
    related_run_ids: JSON.stringify(relatedRunIds),
    related_finding_ids: JSON.stringify(relatedFindingIds),
    related_decision_ids: JSON.stringify(relatedDecisionIds),
    created_at: new Date().toISOString(),
  });

  return jsonResponse({
    messageId: agentMessageId,
    role: 'agent',
    content: replyText,
    relatedRunIds,
    relatedFindingIds,
    relatedDecisionIds,
  });
});

// 15. Get Messages for session
router.get('/api/admin/chat/sessions/:id/messages', async (_req, params) => {
  const chatSessionId = params['id'];
  if (!chatSessionId) return jsonResponse({ error: 'Missing session ID' }, 400);

  const messages = await db
    .select()
    .from(schema.agentChatMessages)
    .where(eq(schema.agentChatMessages.chat_session_id, chatSessionId))
    .orderBy(schema.agentChatMessages.created_at);

  return jsonResponse({
    messages: messages.map(m => ({
      messageId: m.message_id,
      role: m.role,
      content: m.content,
      relatedRunIds: m.related_run_ids ? JSON.parse(m.related_run_ids) : [],
      relatedFindingIds: m.related_finding_ids ? JSON.parse(m.related_finding_ids) : [],
      relatedDecisionIds: m.related_decision_ids ? JSON.parse(m.related_decision_ids) : [],
      createdAt: m.created_at,
    })),
  });
});

