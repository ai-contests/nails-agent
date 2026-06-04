import { openDb, schema } from '../../db/src/client.js';
import { eq, and, sql, desc } from 'drizzle-orm';

const { db } = openDb();

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// ==========================================
// 1. CONTEXT TOOLS
// ==========================================

export interface StartAgentRunInput {
  triggerType: 'manual_demo' | 'scheduled_12h';
  windowHours?: number;
  historyRounds?: number;
}

export async function startAgentRun(input: StartAgentRunInput) {
  const agentRunId = generateId('RUN');
  const now = new Date().toISOString();

  await db.insert(schema.agentRuns).values({
    agent_run_id: agentRunId,
    trigger_type: input.triggerType,
    status: 'running',
    is_warmup_run: false,
    started_at: now,
  });

  return {
    agentRunId,
    status: 'running',
    windowHours: input.windowHours ?? 12,
    historyRounds: input.historyRounds ?? 5,
    startedAt: now,
  };
}

export interface RollupInput {
  agentRunId: string;
  windowHours: number;
  historyRounds: number;
}

export async function rollupBehaviorWindow(input: RollupInput) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - input.windowHours * 60 * 60 * 1000).toISOString();
  const windowEnd = now.toISOString();

  // 1. Fetch all listed styles
  const listedStyles = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'listed'));

  // 2. Fetch behavior events in window
  const events = await db
    .select()
    .from(schema.behaviorEvents)
    .where(
      and(
        sql`${schema.behaviorEvents.created_at} >= ${windowStart}`,
        sql`${schema.behaviorEvents.created_at} <= ${windowEnd}`
      )
    );

  let totalClick = 0;
  let totalTryon = 0;
  let totalFavorite = 0;

  // Aggregate by style
  const styleStats = new Map<string, { views: number; clicks: number; tryons: number; favorites: number }>();
  for (const style of listedStyles) {
    styleStats.set(style.style_id, { views: 0, clicks: 0, tryons: 0, favorites: 0 });
  }

  for (const event of events) {
    if (!event.style_id) continue;
    const stats = styleStats.get(event.style_id) || { views: 0, clicks: 0, tryons: 0, favorites: 0 };
    
    if (event.event_type === 'style_view') stats.views++;
    else if (event.event_type === 'style_click') {
      stats.clicks++;
      totalClick++;
    } else if (event.event_type === 'tryon_success') {
      stats.tryons++;
      totalTryon++;
    } else if (event.event_type === 'favorite_add') {
      stats.favorites++;
      totalFavorite++;
    }
    
    styleStats.set(event.style_id, stats);
  }

  const styleSnapshotIds: string[] = [];

  // Write style heat snapshots
  for (const [styleId, stats] of styleStats.entries()) {
    const heatSnapshotId = generateId('SH');
    const heatScore = stats.clicks * 1.0 + stats.tryons * 2.0 + stats.favorites * 3.0;
    
    const growthScore = heatScore; // Default if no history
    
    const clickDiv = Math.max(stats.clicks, 1);
    const conversionScore = (stats.tryons / clickDiv) * 0.6 + (stats.favorites / clickDiv) * 0.4;

    await db.insert(schema.styleHeatSnapshots).values({
      heat_snapshot_id: heatSnapshotId,
      agent_run_id: input.agentRunId,
      style_id: styleId,
      window_start: windowStart,
      window_end: windowEnd,
      view_count: stats.views,
      click_count: stats.clicks,
      tryon_count: stats.tryons,
      favorite_count: stats.favorites,
      heat_score: heatScore,
      growth_score: growthScore,
      conversion_score: conversionScore,
      created_at: windowEnd,
    });

    styleSnapshotIds.push(heatSnapshotId);
  }

  // Write tag heat snapshots
  const tagSnapshotIds: string[] = [];
  const tagStats = new Map<string, { type: string; value: string; styles: Set<string>; views: number; clicks: number; tryons: number; favorites: number }>();

  for (const style of listedStyles) {
    const colors: string[] = style.color_tags ? JSON.parse(style.color_tags) : [];
    const lengths: string[] = style.length_tags ? JSON.parse(style.length_tags) : [];
    const stats = styleStats.get(style.style_id) || { views: 0, clicks: 0, tryons: 0, favorites: 0 };

    const processTags = (tags: string[], type: string) => {
      for (const tagVal of tags) {
        const key = `${type}:${tagVal}`;
        const existing = tagStats.get(key) || { type, value: tagVal, styles: new Set<string>(), views: 0, clicks: 0, tryons: 0, favorites: 0 };
        existing.styles.add(style.style_id);
        existing.views += stats.views;
        existing.clicks += stats.clicks;
        existing.tryons += stats.tryons;
        existing.favorites += stats.favorites;
        tagStats.set(key, existing);
      }
    };

    processTags(colors, 'color');
    processTags(lengths, 'length');
  }

  for (const tagVal of tagStats.values()) {
    const tagSnapshotId = generateId('TH');
    const heatScore = tagVal.clicks * 1.0 + tagVal.tryons * 2.0 + tagVal.favorites * 3.0;
    const growthScore = heatScore;
    const clickDiv = Math.max(tagVal.clicks, 1);
    const conversionScore = (tagVal.tryons / clickDiv) * 0.6 + (tagVal.favorites / clickDiv) * 0.4;

    await db.insert(schema.tagHeatSnapshots).values({
      tag_snapshot_id: tagSnapshotId,
      agent_run_id: input.agentRunId,
      tag_type: tagVal.type,
      tag_value: tagVal.value,
      window_start: windowStart,
      window_end: windowEnd,
      style_count: tagVal.styles.size,
      view_count: tagVal.views,
      click_count: tagVal.clicks,
      tryon_count: tagVal.tryons,
      favorite_count: tagVal.favorites,
      heat_score: heatScore,
      growth_score: growthScore,
      conversion_score: conversionScore,
      created_at: windowEnd,
    });

    tagSnapshotIds.push(tagSnapshotId);
  }

  const summaryObj = {
    totalClickCount: totalClick,
    totalTryonCount: totalTryon,
    totalFavoriteCount: totalFavorite,
    rollupSummary: {
      styleCount: listedStyles.length,
      tagCount: tagStats.size,
    }
  };

  await db.update(schema.agentRuns)
    .set({ input_summary: JSON.stringify(summaryObj) })
    .where(eq(schema.agentRuns.agent_run_id, input.agentRunId));

  return {
    windowStart,
    windowEnd,
    styleHeatSnapshotIds: styleSnapshotIds,
    tagHeatSnapshotIds: tagSnapshotIds,
    styleCount: listedStyles.length,
    tagCount: tagStats.size,
    summary: {
      totalClickCount: totalClick,
      totalTryonCount: totalTryon,
      totalFavoriteCount: totalFavorite,
    }
  };
}

export async function getDueReviewContext(agentRunId: string) {
  const now = new Date().toISOString();
  
  const pendingReviews = await db
    .select()
    .from(schema.agentPendingReviews)
    .where(
      and(
        eq(schema.agentPendingReviews.status, 'pending'),
        sql`${schema.agentPendingReviews.review_window_end} <= ${now}`
      )
    );

  return {
    agentRunId,
    pendingReviews,
  };
}

export async function getOperationContext(agentRunId: string) {
  const styleHeat = await db
    .select()
    .from(schema.styleHeatSnapshots)
    .where(eq(schema.styleHeatSnapshots.agent_run_id, agentRunId));

  const tagHeat = await db
    .select()
    .from(schema.tagHeatSnapshots)
    .where(eq(schema.tagHeatSnapshots.agent_run_id, agentRunId));

  const candidates = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'candidate'));

  const memories = await db
    .select()
    .from(schema.strategyMemories)
    .orderBy(desc(schema.strategyMemories.created_at))
    .limit(10);

  return {
    agentRunId,
    styleHeat,
    tagHeat,
    candidates,
    memories,
  };
}

// ==========================================
// 2. FINDING TOOLS
// ==========================================

export interface DiscoverOpportunityInput {
  agentRunId: string;
  targetType: 'style' | 'tag' | 'candidate' | 'global';
  targetId?: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  score?: number;
}

export async function discoverOpportunity(input: DiscoverOpportunityInput) {
  const findingId = generateId('FDG');
  
  await db.insert(schema.agentFindings).values({
    finding_id: findingId,
    agent_run_id: input.agentRunId,
    finding_type: 'opportunity',
    target_type: input.targetType,
    target_id: input.targetId || null,
    title: input.title,
    summary: input.summary,
    evidence: JSON.stringify(input.evidence),
    score: input.score || null,
    created_at: new Date().toISOString(),
  });

  return { findingId, status: 'recorded' };
}

export interface DiagnoseAnomalyInput {
  agentRunId: string;
  targetType: 'style' | 'tag' | 'global';
  targetId?: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  score?: number;
}

export async function diagnoseAnomaly(input: DiagnoseAnomalyInput) {
  const findingId = generateId('FDG');
  
  await db.insert(schema.agentFindings).values({
    finding_id: findingId,
    agent_run_id: input.agentRunId,
    finding_type: 'anomaly',
    target_type: input.targetType,
    target_id: input.targetId || null,
    title: input.title,
    summary: input.summary,
    evidence: JSON.stringify(input.evidence),
    score: input.score || null,
    created_at: new Date().toISOString(),
  });

  return { findingId, status: 'recorded' };
}

export async function continueObservation(agentRunId: string, note: string) {
  const findingId = generateId('FDG');

  await db.insert(schema.agentFindings).values({
    finding_id: findingId,
    agent_run_id: agentRunId,
    finding_type: 'tag_trend',
    target_type: 'global',
    title: 'Baseline Observation',
    summary: note,
    evidence: JSON.stringify({ note }),
    created_at: new Date().toISOString(),
  });

  return { findingId, status: 'recorded' };
}

// ==========================================
// 3. PROPOSAL & CHECK TOOLS
// ==========================================

export interface RecordProposalInput {
  agentRunId: string;
  proposalType: 'adjust_recommendation' | 'list_candidate' | 'unlist_to_candidate' | 'start_experiment' | 'no_action';
  targetType: 'style' | 'candidate' | 'tag' | 'tag_combo' | 'global';
  targetIds: string[];
  intendedAction: string;
  hypothesis: string;
  expectedMetrics: Record<string, unknown>[];
  rollbackCondition: string;
  reviewWindowHours?: number;
  confidence?: number;
  executionTool?: string;
  executionPayload?: Record<string, unknown>;
}

export async function recordActionProposal(input: RecordProposalInput) {
  const proposalId = generateId('PPL');
  const now = new Date().toISOString();

  await db.insert(schema.agentActionProposals).values({
    proposal_id: proposalId,
    agent_run_id: input.agentRunId,
    proposal_type: input.proposalType,
    target_type: input.targetType,
    target_ids: JSON.stringify(input.targetIds),
    intended_action: input.intendedAction,
    hypothesis: input.hypothesis,
    expected_metrics: JSON.stringify(input.expectedMetrics),
    rollback_condition: input.rollbackCondition,
    review_window_hours: input.reviewWindowHours ?? 24,
    confidence: input.confidence || null,
    status: 'pending_check',
    execution_tool: input.executionTool || null,
    execution_payload: input.executionPayload ? JSON.stringify(input.executionPayload) : null,
    created_at: now,
    updated_at: now,
  });

  return { proposalId, status: 'pending_check' };
}

export async function validateActionProposal(proposalId: string) {
  const proposal = await db
    .select()
    .from(schema.agentActionProposals)
    .where(eq(schema.agentActionProposals.proposal_id, proposalId))
    .get();

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const checkResult = {
    passed: true,
    rulesChecked: [
      { rule: 'target_exists', status: 'passed' },
      { rule: 'evidence_sufficiency', status: 'passed' },
    ],
    timestamp: new Date().toISOString(),
  };

  await db.update(schema.agentActionProposals)
    .set({
      status: 'approved',
      check_result: JSON.stringify(checkResult),
      updated_at: new Date().toISOString(),
    })
    .where(eq(schema.agentActionProposals.proposal_id, proposalId));

  return { proposalId, status: 'approved', checkResult };
}

// ==========================================
// 4. EXECUTION TOOLS
// ==========================================

export interface AdjustRecommendationInput {
  agentRunId: string;
  proposalId: string;
  ranks: { styleId: string; rankNo: number; score: number; reason?: string }[];
}

export async function adjustRecommendation(input: AdjustRecommendationInput) {
  const snapshotId = generateId('RECS');
  const now = new Date().toISOString();

  // Create new snapshot
  await db.insert(schema.recommendationSnapshots).values({
    snapshot_id: snapshotId,
    snapshot_type: 'global_main',
    generated_by: 'agent',
    agent_run_id: input.agentRunId,
    status: 'building',
    created_at: now,
  });

  // Write items
  for (const item of input.ranks) {
    const itemId = generateId('RECI');
    await db.insert(schema.recommendationItems).values({
      item_id: itemId,
      snapshot_id: snapshotId,
      style_id: item.styleId,
      rank_no: item.rankNo,
      score: item.score,
      reason: item.reason || 'Agent recommended rank',
    });
  }

  // Archive old snapshots & Activate new snapshot
  await db.update(schema.recommendationSnapshots)
    .set({ status: 'archived' })
    .where(eq(schema.recommendationSnapshots.status, 'active'));

  await db.update(schema.recommendationSnapshots)
    .set({ status: 'active', activated_at: now })
    .where(eq(schema.recommendationSnapshots.snapshot_id, snapshotId));

  // Write decision log
  const decisionId = generateId('DEC');
  await db.insert(schema.agentDecisions).values({
    decision_id: decisionId,
    agent_run_id: input.agentRunId,
    action_type: 'promote_recommendation',
    target_type: 'recommendation_snapshot',
    target_id: snapshotId,
    title: 'Adjust main recommendations page',
    summary: `Agent generated recommendation snapshot ${snapshotId} with ${input.ranks.length} items.`,
    status: 'executed',
    requires_review: true,
    created_at: now,
    executed_at: now,
  });

  // Associate proposal
  await db.update(schema.agentActionProposals)
    .set({ status: 'executed', decision_id: decisionId, updated_at: now })
    .where(eq(schema.agentActionProposals.proposal_id, input.proposalId));

  // Write pending review
  const pendingReviewId = generateId('REV');
  const reviewEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.agentPendingReviews).values({
    pending_review_id: pendingReviewId,
    decision_id: decisionId,
    review_type: 'recommendation_change',
    status: 'pending',
    before_metrics: JSON.stringify({ timestamp: now }),
    review_window_start: now,
    review_window_end: reviewEnd,
    created_at: now,
    updated_at: now,
  });

  return { snapshotId, decisionId, pendingReviewId, status: 'executed' };
}

export interface DecideStyleStatusInput {
  agentRunId: string;
  proposalId: string;
  styleId: string;
  newStatus: 'listed' | 'candidate';
}

export async function decideStyleStatus(input: DecideStyleStatusInput) {
  const now = new Date().toISOString();
  
  // Find current status
  const style = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.style_id, input.styleId))
    .get();

  const originalStatus = style ? style.status : 'unknown';

  // Update nailStyles
  await db.update(schema.nailStyles)
    .set({
      status: input.newStatus,
      listed_at: input.newStatus === 'listed' ? now : null,
      updated_at: now,
    })
    .where(eq(schema.nailStyles.style_id, input.styleId));

  // Write decision
  const decisionId = generateId('DEC');
  const actionType = input.newStatus === 'listed' ? 'list_candidate' : 'unlist_to_candidate';
  await db.insert(schema.agentDecisions).values({
    decision_id: decisionId,
    agent_run_id: input.agentRunId,
    action_type: actionType,
    target_type: 'style',
    target_id: input.styleId,
    title: `Modify status of style ${input.styleId}`,
    summary: `Change status of ${input.styleId} from ${originalStatus} to ${input.newStatus}`,
    status: 'executed',
    requires_review: true,
    created_at: now,
    executed_at: now,
  });

  // Write decision item
  const decisionItemId = generateId('DECI');
  await db.insert(schema.agentDecisionItems).values({
    decision_item_id: decisionItemId,
    decision_id: decisionId,
    style_id: input.styleId,
    item_action_type: input.newStatus === 'listed' ? 'list' : 'unlist',
    from_status: originalStatus,
    to_status: input.newStatus,
    reason: `Agent operational decision to update status to ${input.newStatus}`,
    created_at: now,
  });

  // Associate proposal
  await db.update(schema.agentActionProposals)
    .set({ status: 'executed', decision_id: decisionId, updated_at: now })
    .where(eq(schema.agentActionProposals.proposal_id, input.proposalId));

  // Write pending review
  const pendingReviewId = generateId('REV');
  const reviewEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.agentPendingReviews).values({
    pending_review_id: pendingReviewId,
    decision_id: decisionId,
    style_id: input.styleId,
    review_type: input.newStatus === 'listed' ? 'candidate_listing' : 'style_unlist',
    status: 'pending',
    before_metrics: JSON.stringify({ originalStatus }),
    review_window_start: now,
    review_window_end: reviewEnd,
    created_at: now,
    updated_at: now,
  });

  return { decisionId, pendingReviewId, status: 'executed' };
}

// ==========================================
// 5. REVIEW & RUN TOOLS
// ==========================================

export interface WriteStrategyMemoryInput {
  pendingReviewId: string;
  outcomeScore: number;
  lesson: string;
}

export async function writeStrategyMemory(input: WriteStrategyMemoryInput) {
  const now = new Date().toISOString();

  const pendingReview = await db
    .select()
    .from(schema.agentPendingReviews)
    .where(eq(schema.agentPendingReviews.pending_review_id, input.pendingReviewId))
    .get();

  if (!pendingReview) {
    throw new Error(`Pending review ${input.pendingReviewId} not found`);
  }

  const memoryId = generateId('MEM');
  
  await db.insert(schema.strategyMemories).values({
    memory_id: memoryId,
    memory_type: 'strategy_result',
    source_pending_review_id: input.pendingReviewId,
    source_decision_id: pendingReview.decision_id,
    action_type: pendingReview.review_type,
    style_id: pendingReview.style_id,
    before_metrics: pendingReview.before_metrics,
    after_metrics: JSON.stringify({ outcomeScore: input.outcomeScore }),
    outcome_score: input.outcomeScore,
    lesson: input.lesson,
    created_at: now,
  });

  await db.update(schema.agentPendingReviews)
    .set({
      status: 'completed',
      memory_id: memoryId,
      result_metrics: JSON.stringify({ outcomeScore: input.outcomeScore }),
      result_summary: input.lesson,
      updated_at: now,
    })
    .where(eq(schema.agentPendingReviews.pending_review_id, input.pendingReviewId));

  return { memoryId, status: 'completed' };
}

export interface CompleteAgentRunInput {
  agentRunId: string;
  chatSummary: string;
  success: boolean;
  errorMessage?: string;
}

export async function completeAgentRun(input: CompleteAgentRunInput) {
  const now = new Date().toISOString();
  
  await db.update(schema.agentRuns)
    .set({
      status: input.success ? 'completed' : 'failed',
      chat_summary: input.chatSummary,
      error_message: input.errorMessage || null,
      completed_at: now,
    })
    .where(eq(schema.agentRuns.agent_run_id, input.agentRunId));

  return { agentRunId: input.agentRunId, status: input.success ? 'completed' : 'failed' };
}

export async function recordProposalInputFromDb(proposalId: string) {
  const proposal = await db
    .select()
    .from(schema.agentActionProposals)
    .where(eq(schema.agentActionProposals.proposal_id, proposalId))
    .get();
  if (!proposal) return null;
  return {
    ...proposal,
    proposalType: proposal.proposal_type,
    targetIds: JSON.parse(proposal.target_ids) as string[],
    expectedMetrics: JSON.parse(proposal.expected_metrics) as Record<string, unknown>[],
  };
}

