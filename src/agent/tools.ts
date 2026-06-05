import { openDb, schema } from '../../db/src/client';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  applyRecommendationAdjustments,
  buildExecutionPlanForProposal,
  evaluateProposalGuards,
  type ExecutionPayload,
  rebuildRanksForStatusChange,
  rebuildRanksForStatusChanges,
  selectRecentHistoryRows,
  type AdjustRecommendationExecutionPayload,
  type DecideStyleStatusExecutionPayload,
  type RecommendationChangeRequest,
  type RecommendationRankItem,
  type StyleStatusChange,
} from './operationRules.js';
import {
  type BaselineMetrics,
  type ExpectedMetric,
  computeConversionScore,
  emptyBaseline,
} from './reviewEvaluator.js';
import { computeGrowth, indexHistoryByKey } from './trendAnalyzer.js';
import {
  rankCandidateActionsFromTagTrends,
  type CandidateMatch,
  type TagTrend,
} from './tagTrendMatcher.js';

const { sqlite, db } = openDb();

export interface SqliteTransactionConnection {
  exec(statement: string): unknown;
}

export async function runInSqliteTransaction<T>(
  sqliteDb: SqliteTransactionConnection,
  work: () => Promise<T> | T,
): Promise<T> {
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const result = await work();
    sqliteDb.exec('COMMIT');
    return result;
  } catch (error) {
    sqliteDb.exec('ROLLBACK');
    throw error;
  }
}

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

  // Pull recent historical style heat for the same styles to compute real growth_score.
  // We pull a reasonably-large window and let trendAnalyzer pick the freshest N.
  const recentStyleHistoryRows = await db
    .select()
    .from(schema.styleHeatSnapshots)
    .where(sql`${schema.styleHeatSnapshots.agent_run_id} != ${input.agentRunId}`)
    .orderBy(desc(schema.styleHeatSnapshots.window_end))
    .limit(2000);
  const styleHistoryIndex = indexHistoryByKey(
    recentStyleHistoryRows.filter((r): r is typeof r & { style_id: string } => !!r.style_id),
    r => r.style_id,
  );

  // Write style heat snapshots
  for (const [styleId, stats] of styleStats.entries()) {
    const heatSnapshotId = generateId('SH');
    const heatScore = stats.clicks * 1.0 + stats.tryons * 2.0 + stats.favorites * 3.0;

    const growth = computeGrowth(
      heatScore,
      styleHistoryIndex.get(styleId) ?? [],
      { historyRounds: input.historyRounds },
    );
    const growthScore = growth.growthScore;

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

  // Pull recent historical tag heat to compute real growth_score per tag.
  const recentTagHistoryRows = await db
    .select()
    .from(schema.tagHeatSnapshots)
    .where(sql`${schema.tagHeatSnapshots.agent_run_id} != ${input.agentRunId}`)
    .orderBy(desc(schema.tagHeatSnapshots.window_end))
    .limit(2000);
  const tagHistoryIndex = indexHistoryByKey(
    recentTagHistoryRows,
    r => `${r.tag_type}:${r.tag_value}`,
  );

  for (const tagVal of tagStats.values()) {
    const tagSnapshotId = generateId('TH');
    const heatScore = tagVal.clicks * 1.0 + tagVal.tryons * 2.0 + tagVal.favorites * 3.0;
    const tagKey = `${tagVal.type}:${tagVal.value}`;
    const growth = computeGrowth(
      heatScore,
      tagHistoryIndex.get(tagKey) ?? [],
      { historyRounds: input.historyRounds },
    );
    const growthScore = growth.growthScore;
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

/**
 * Aggregate raw behavior_events for a given style (or all listed styles when styleId is null)
 * inside an [start, end] window. Returns counts that feed BaselineMetrics for the review.
 *
 * `null` styleId case is used by global recommendation adjustments where the "target" is
 * the whole listed catalog.
 */
export async function aggregateBehaviorMetrics(
  styleId: string | null,
  windowStart: string,
  windowEnd: string,
): Promise<BaselineMetrics> {
  const filters = [
    sql`${schema.behaviorEvents.created_at} >= ${windowStart}`,
    sql`${schema.behaviorEvents.created_at} <= ${windowEnd}`,
  ];
  if (styleId) filters.push(eq(schema.behaviorEvents.style_id, styleId));

  const events = await db
    .select()
    .from(schema.behaviorEvents)
    .where(and(...filters));

  const acc = emptyBaseline();
  for (const event of events) {
    if (event.event_type === 'style_click') acc.click_count++;
    else if (event.event_type === 'tryon_start' || event.event_type === 'tryon_success') acc.tryon_count++;
    else if (event.event_type === 'favorite_add') acc.favorite_count++;
  }
  acc.conversion_score = Number(computeConversionScore(acc).toFixed(4));
  return acc;
}

/**
 * Capture the baseline metrics for the same-length window immediately BEFORE `referenceTime`.
 * Used at proposal execution time so that review can compare like-for-like.
 */
export async function captureBaselineForReview(
  styleId: string | null,
  referenceTime: Date,
  windowHours: number,
): Promise<{ windowStart: string; windowEnd: string; metrics: BaselineMetrics }> {
  const windowEnd = referenceTime.toISOString();
  const windowStart = new Date(referenceTime.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const metrics = await aggregateBehaviorMetrics(styleId, windowStart, windowEnd);
  return { windowStart, windowEnd, metrics };
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

  // Enrich each pending review with real after_metrics computed from behavior_events.
  const enriched = [] as Array<typeof pendingReviews[number] & {
    parsed: {
      beforeMetrics: BaselineMetrics;
      afterMetrics: BaselineMetrics;
      expectedMetrics: ExpectedMetric[];
      targetStyleIds: string[];
    };
  }>;

  for (const review of pendingReviews) {
    const beforeJson = safeJson(review.before_metrics, {} as Record<string, unknown>);
    const expectedJson = safeJson(review.expected_effect, {} as Record<string, unknown>);

    const expectedMetrics = (expectedJson['expectedMetrics'] as ExpectedMetric[] | undefined) ?? [];
    const beforeMetrics: BaselineMetrics = (beforeJson['metrics'] as BaselineMetrics | undefined)
      ?? emptyBaseline();

    // Target styles: prefer the explicit pending_review.style_id; otherwise read decision items.
    let targetStyleIds: string[] = [];
    if (review.style_id) {
      targetStyleIds = [review.style_id];
    } else {
      const items = await db
        .select()
        .from(schema.agentDecisionItems)
        .where(eq(schema.agentDecisionItems.decision_id, review.decision_id));
      targetStyleIds = items.map(i => i.style_id).filter((s): s is string => !!s);
    }

    let afterMetrics: BaselineMetrics;
    if (targetStyleIds.length === 0) {
      // Global recommendation review — aggregate across all listed styles in the after-window.
      afterMetrics = await aggregateBehaviorMetrics(null, review.review_window_start, review.review_window_end);
    } else if (targetStyleIds.length === 1) {
      afterMetrics = await aggregateBehaviorMetrics(targetStyleIds[0]!, review.review_window_start, review.review_window_end);
    } else {
      const parts = await Promise.all(
        targetStyleIds.map(sid => aggregateBehaviorMetrics(sid, review.review_window_start, review.review_window_end)),
      );
      afterMetrics = parts.reduce((acc, p) => ({
        click_count: acc.click_count + p.click_count,
        tryon_count: acc.tryon_count + p.tryon_count,
        favorite_count: acc.favorite_count + p.favorite_count,
        conversion_score: 0,
      }), emptyBaseline());
      afterMetrics.conversion_score = Number(computeConversionScore(afterMetrics).toFixed(4));
    }

    enriched.push({
      ...review,
      parsed: {
        beforeMetrics,
        afterMetrics,
        expectedMetrics,
        targetStyleIds,
      },
    });
  }

  return {
    agentRunId,
    pendingReviews: enriched,
  };
}

function safeJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; }
  catch { return fallback; }
}

export async function getOperationContext(agentRunId: string, historyRounds = 5) {
  const styleHeat = await db
    .select()
    .from(schema.styleHeatSnapshots)
    .where(eq(schema.styleHeatSnapshots.agent_run_id, agentRunId));

  const tagHeat = await db
    .select()
    .from(schema.tagHeatSnapshots)
    .where(eq(schema.tagHeatSnapshots.agent_run_id, agentRunId));

  const recentStyleHeatRows = await db
    .select()
    .from(schema.styleHeatSnapshots)
    .orderBy(desc(schema.styleHeatSnapshots.window_end))
    .limit(1000);

  const recentTagHeatRows = await db
    .select()
    .from(schema.tagHeatSnapshots)
    .orderBy(desc(schema.tagHeatSnapshots.window_end))
    .limit(1000);

  const historicalStyleHeat = selectRecentHistoryRows(recentStyleHeatRows, agentRunId, historyRounds);
  const historicalTagHeat = selectRecentHistoryRows(recentTagHeatRows, agentRunId, historyRounds);

  const activeRecommendationSnapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  const activeRecommendationItems = activeRecommendationSnapshot
    ? await db
      .select({
        item: schema.recommendationItems,
        style: schema.nailStyles,
      })
      .from(schema.recommendationItems)
      .innerJoin(schema.nailStyles, eq(schema.recommendationItems.style_id, schema.nailStyles.style_id))
      .where(eq(schema.recommendationItems.snapshot_id, activeRecommendationSnapshot.snapshot_id))
      .orderBy(schema.recommendationItems.rank_no)
    : [];

  const candidates = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'candidate'));

  const listedForSaturation = await db
    .select()
    .from(schema.nailStyles)
    .where(eq(schema.nailStyles.status, 'listed'));

  const memories = await db
    .select()
    .from(schema.strategyMemories)
    .orderBy(desc(schema.strategyMemories.created_at))
    .limit(10);

  // Tag trend → candidate matcher: deterministic "rising tag → up to 3 actionable
  // candidate styles" mapping. LLM sees these as concrete suggestions so it can
  // emit recordActionProposal(list_candidate) without having to do the matching
  // itself. tagHeat rows from drizzle may have nullable fields — sanitize.
  const tagHeatForMatcher = tagHeat.map(t => ({
    tag_type: t.tag_type,
    tag_value: t.tag_value,
    heat_score: t.heat_score ?? 0,
    growth_score: t.growth_score ?? 0,
    click_count: t.click_count ?? 0,
    tryon_count: t.tryon_count ?? 0,
    favorite_count: t.favorite_count ?? 0,
    style_count: t.style_count ?? 0,
  }));
  const candidatesForMatcher = candidates.map(c => ({
    style_id: c.style_id,
    color_tags: c.color_tags ?? '[]',
    length_tags: c.length_tags ?? '[]',
    is_available_for_tryon: c.is_available_for_tryon,
  }));
  const listedForMatcher = listedForSaturation.map(s => ({
    style_id: s.style_id,
    color_tags: s.color_tags ?? '[]',
    length_tags: s.length_tags ?? '[]',
  }));
  const tagTrendActions: { trends: TagTrend[]; actions: CandidateMatch[] } =
    rankCandidateActionsFromTagTrends(tagHeatForMatcher, candidatesForMatcher, listedForMatcher);

  return {
    agentRunId,
    styleHeat,
    tagHeat,
    historicalStyleHeat,
    historicalTagHeat,
    activeRecommendationSnapshot,
    activeRecommendationItems,
    candidates,
    memories,
    tagTrendActions,
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

  const targetIds = JSON.parse(proposal.target_ids || '[]') as string[];
  const expectedMetrics = JSON.parse(proposal.expected_metrics || '[]') as Record<string, unknown>[];
  const targetStyles: { style_id: string; status: string }[] = [];
  for (const targetId of targetIds) {
    const style = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.style_id, targetId))
      .get();
    if (style) {
      targetStyles.push({ style_id: style.style_id, status: style.status });
    }
  }

  const activeGlobalSnapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  const guardResult = evaluateProposalGuards(
    {
      proposalType: proposal.proposal_type,
      targetIds,
      intendedAction: proposal.intended_action,
      hypothesis: proposal.hypothesis,
      expectedMetrics,
      rollbackCondition: proposal.rollback_condition,
      reviewWindowHours: proposal.review_window_hours,
      confidence: proposal.confidence,
    },
    targetStyles,
    !!activeGlobalSnapshot,
  );

  const executionPlan = guardResult.passed
    ? buildExecutionPlanForProposal({
      proposalType: proposal.proposal_type,
      targetIds,
      intendedAction: proposal.intended_action,
      hypothesis: proposal.hypothesis,
      expectedMetrics,
      rollbackCondition: proposal.rollback_condition,
      reviewWindowHours: proposal.review_window_hours,
      confidence: proposal.confidence,
    })
    : { executionTool: null, executionPayload: null };

  const checkResult = {
    passed: guardResult.passed,
    rulesChecked: guardResult.rulesChecked,
    executionTool: executionPlan.executionTool,
    executionPayload: executionPlan.executionPayload,
    timestamp: new Date().toISOString(),
  };
  const status = guardResult.passed ? 'approved' : 'rejected';

  await db.update(schema.agentActionProposals)
    .set({
      status,
      check_result: JSON.stringify(checkResult),
      execution_tool: executionPlan.executionTool,
      execution_payload: executionPlan.executionPayload ? JSON.stringify(executionPlan.executionPayload) : null,
      updated_at: new Date().toISOString(),
    })
    .where(eq(schema.agentActionProposals.proposal_id, proposalId));

  return {
    proposalId,
    status,
    checkResult,
    executionTool: executionPlan.executionTool,
    executionPayload: executionPlan.executionPayload,
  };
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
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    );

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

  if (!style) {
    throw new Error(`Style ${input.styleId} not found`);
  }

  const currentSnapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  if (!currentSnapshot) {
    throw new Error('No active global_main recommendation snapshot found');
  }

  const currentRecommendationItems = await db
    .select()
    .from(schema.recommendationItems)
    .where(eq(schema.recommendationItems.snapshot_id, currentSnapshot.snapshot_id))
    .orderBy(schema.recommendationItems.rank_no);

  const currentRanks = currentRecommendationItems.map(item => ({
    styleId: item.style_id,
    rankNo: item.rank_no,
    score: item.score,
    reason: item.reason,
  }));
  const rankBefore = currentRanks.find(item => item.styleId === input.styleId)?.rankNo ?? null;
  const rebuiltRanks = rebuildRanksForStatusChange(currentRanks, input.styleId, input.newStatus);
  const rankAfter = rebuiltRanks.find(item => item.styleId === input.styleId)?.rankNo ?? null;

  const originalStatus = style.status;

  // Update nailStyles
  await db.update(schema.nailStyles)
    .set({
      status: input.newStatus,
      source_type: input.newStatus === 'listed' && !style.source_type ? 'agent_listed' : style.source_type,
      is_available_for_tryon: input.newStatus === 'listed' ? true : style.is_available_for_tryon,
      listed_at: input.newStatus === 'listed' ? now : null,
      updated_at: now,
    })
    .where(eq(schema.nailStyles.style_id, input.styleId));

  const rebuiltSnapshotId = generateId('RECS');
  await db.insert(schema.recommendationSnapshots).values({
    snapshot_id: rebuiltSnapshotId,
    snapshot_type: 'global_main',
    generated_by: 'agent',
    agent_run_id: input.agentRunId,
    status: 'building',
    created_at: now,
  });

  for (const item of rebuiltRanks) {
    await db.insert(schema.recommendationItems).values({
      item_id: generateId('RECI'),
      snapshot_id: rebuiltSnapshotId,
      style_id: item.styleId,
      rank_no: item.rankNo,
      score: item.score,
      reason: item.reason || 'Inherited from previous active snapshot after Agent status change',
      score_detail: JSON.stringify({
        source: 'agent_status_rebuild',
        previousSnapshotId: currentSnapshot.snapshot_id,
      }),
    });
  }

  await db.update(schema.recommendationSnapshots)
    .set({ status: 'archived' })
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    );

  await db.update(schema.recommendationSnapshots)
    .set({ status: 'active', activated_at: now })
    .where(eq(schema.recommendationSnapshots.snapshot_id, rebuiltSnapshotId));

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
    summary: `Change status of ${input.styleId} from ${originalStatus} to ${input.newStatus} and rebuild global_main snapshot ${rebuiltSnapshotId}`,
    status: 'executed',
    execution_result: JSON.stringify({
      previousSnapshotId: currentSnapshot.snapshot_id,
      snapshotId: rebuiltSnapshotId,
      rankBefore,
      rankAfter,
    }),
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
    rank_before: rankBefore,
    rank_after: rankAfter,
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
    before_metrics: JSON.stringify({
      originalStatus,
      rankBefore,
      previousSnapshotId: currentSnapshot.snapshot_id,
    }),
    expected_effect: JSON.stringify({
      newStatus: input.newStatus,
      rankAfter,
      snapshotId: rebuiltSnapshotId,
    }),
    review_window_start: now,
    review_window_end: reviewEnd,
    created_at: now,
    updated_at: now,
  });

  return { decisionId, pendingReviewId, snapshotId: rebuiltSnapshotId, status: 'executed' };
}

export interface ExecuteApprovedProposalBatchInput {
  agentRunId: string;
  proposalIds: string[];
  heatRanks?: RecommendationRankItem[];
}

export async function executeApprovedProposalBatch(input: ExecuteApprovedProposalBatchInput) {
  const proposals: Array<NonNullable<Awaited<ReturnType<typeof recordProposalInputFromDb>>>> = [];
  for (const proposalId of input.proposalIds) {
    const proposal = await recordProposalInputFromDb(proposalId);
    if (proposal && proposal.status === 'approved' && proposal.executionTool && proposal.executionPayload) {
      proposals.push(proposal);
    }
  }

  if (proposals.length === 0) {
    return {
      executedCount: 0,
      snapshotId: null,
      decisionIds: [] as string[],
      pendingReviewIds: [] as string[],
      status: 'skipped',
    };
  }

  return runInSqliteTransaction(sqlite, async () => {
  const now = new Date().toISOString();
  const currentSnapshot = await db
    .select()
    .from(schema.recommendationSnapshots)
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    )
    .get();

  if (!currentSnapshot) {
    throw new Error('No active global_main recommendation snapshot found');
  }

  const currentRecommendationItems = await db
    .select()
    .from(schema.recommendationItems)
    .where(eq(schema.recommendationItems.snapshot_id, currentSnapshot.snapshot_id))
    .orderBy(schema.recommendationItems.rank_no);

  const currentRanks = currentRecommendationItems.map(item => ({
    styleId: item.style_id,
    rankNo: item.rank_no,
    score: item.score,
    reason: item.reason,
  }));
  const currentRankByStyleId = new Map(currentRanks.map(item => [item.styleId, item.rankNo]));

  // Build the base rank list for adjustment. With fine-grained per-style
  // changes (P3) we no longer rewrite the whole list from heatRanks; we keep
  // the current active snapshot's ordering and apply local promote/demote.
  // The historical heatRanks input is still accepted but only used as a tie
  // breaker for unknown styles, not as a global override.
  const heatRankStyleIds = new Set((input.heatRanks || []).map(item => item.styleId));
  const baseRanks = input.heatRanks && input.heatRanks.length > 0
    ? [
      ...currentRanks,
      ...(input.heatRanks
        .filter(item => !currentRanks.some(r => r.styleId === item.styleId))),
    ].map((item, index) => ({ ...item, rankNo: index + 1 }))
    : currentRanks;
  void heatRankStyleIds; // reserved for future tie-break tracking

  const statusChanges: StyleStatusChange[] = [];
  const statusChangeReasons = new Map<string, string>();
  const statusChangeProposalByStyleId = new Map<string, string>();
  const statusChangePayloadByProposalId = new Map<string, DecideStyleStatusExecutionPayload>();
  const recommendationPayloadByProposalId = new Map<string, AdjustRecommendationExecutionPayload>();
  const recommendationChanges: RecommendationChangeRequest[] = [];

  for (const proposal of proposals) {
    if (proposal.executionTool === 'adjust_recommendation') {
      const payload = proposal.executionPayload as AdjustRecommendationExecutionPayload;
      recommendationPayloadByProposalId.set(proposal.proposal_id, payload);
      recommendationChanges.push(...payload.changes);
    } else if (proposal.executionTool === 'decide_style_status') {
      const payload = proposal.executionPayload as DecideStyleStatusExecutionPayload;
      statusChangePayloadByProposalId.set(proposal.proposal_id, payload);
      for (const change of payload.changes) {
        statusChanges.push({ styleId: change.styleId, newStatus: change.newStatus });
        statusChangeReasons.set(change.styleId, change.reason);
        statusChangeProposalByStyleId.set(change.styleId, proposal.proposal_id);
      }
    }
  }

  // P3: Apply fine-grained recommendation adjustments first (promote/demote with
  // targetRank/maxDelta + diversity guard), then apply status changes which may
  // insert/remove rows. Diversity tags come from each style's color_tags list.
  let adjustmentReports: ReturnType<typeof applyRecommendationAdjustments>['reports'] = [];
  let postAdjustmentRanks: RecommendationRankItem[] = baseRanks;
  if (recommendationChanges.length > 0) {
    const stylesForTags = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.status, 'listed'));
    const tagsByStyle = new Map<string, string[]>();
    for (const s of stylesForTags) {
      const colors: string[] = s.color_tags ? safeJson<string[]>(s.color_tags, []) : [];
      tagsByStyle.set(s.style_id, colors.map(c => `color:${c}`));
    }
    const adjResult = applyRecommendationAdjustments(baseRanks, recommendationChanges, {
      maxDeltaDefault: 10,
      defaultDelta: 5,
      diversityWindow: 5,
      maxSameTagInWindow: 3,
      tagsByStyle,
    });
    postAdjustmentRanks = adjResult.ranks;
    adjustmentReports = adjResult.reports;
  }
  const finalRanks = rebuildRanksForStatusChanges(postAdjustmentRanks, statusChanges);
  const finalRankByStyleId = new Map(finalRanks.map(item => [item.styleId, item.rankNo]));

  const stylesBeforeChange = new Map<string, { status: string; source_type: string | null; is_available_for_tryon: boolean | null }>();
  for (const change of statusChanges) {
    const style = await db
      .select()
      .from(schema.nailStyles)
      .where(eq(schema.nailStyles.style_id, change.styleId))
      .get();

    if (!style) {
      throw new Error(`Style ${change.styleId} not found`);
    }

    stylesBeforeChange.set(change.styleId, {
      status: style.status,
      source_type: style.source_type,
      is_available_for_tryon: style.is_available_for_tryon,
    });

    await db.update(schema.nailStyles)
      .set({
        status: change.newStatus,
        source_type: change.newStatus === 'listed' && !style.source_type ? 'agent_listed' : style.source_type,
        is_available_for_tryon: change.newStatus === 'listed' ? true : style.is_available_for_tryon,
        listed_at: change.newStatus === 'listed' ? now : null,
        updated_at: now,
      })
      .where(eq(schema.nailStyles.style_id, change.styleId));
  }

  const snapshotId = generateId('RECS');
  await db.insert(schema.recommendationSnapshots).values({
    snapshot_id: snapshotId,
    snapshot_type: 'global_main',
    generated_by: 'agent',
    agent_run_id: input.agentRunId,
    status: 'building',
    created_at: now,
  });

  for (const item of finalRanks) {
    await db.insert(schema.recommendationItems).values({
      item_id: generateId('RECI'),
      snapshot_id: snapshotId,
      style_id: item.styleId,
      rank_no: item.rankNo,
      score: item.score,
      reason: item.reason || 'Agent batch execution final rank',
      score_detail: JSON.stringify({
        source: 'agent_batch_execution',
        previousSnapshotId: currentSnapshot.snapshot_id,
      }),
    });
  }

  await db.update(schema.recommendationSnapshots)
    .set({ status: 'archived' })
    .where(
      and(
        eq(schema.recommendationSnapshots.snapshot_type, 'global_main'),
        eq(schema.recommendationSnapshots.status, 'active')
      )
    );

  await db.update(schema.recommendationSnapshots)
    .set({ status: 'active', activated_at: now })
    .where(eq(schema.recommendationSnapshots.snapshot_id, snapshotId));

  const decisionIds: string[] = [];
  const pendingReviewIds: string[] = [];

  for (const proposal of proposals) {
    const proposalStatusChanges = statusChanges.filter(change => statusChangeProposalByStyleId.get(change.styleId) === proposal.proposal_id);
    const recommendationPayload = recommendationPayloadByProposalId.get(proposal.proposal_id);
    const statusPayload = statusChangePayloadByProposalId.get(proposal.proposal_id);
    const actionType = proposal.executionTool === 'adjust_recommendation'
      ? 'promote_recommendation'
      : proposalStatusChanges[0]?.newStatus === 'listed'
        ? 'list_candidate'
        : 'unlist_to_candidate';
    const decisionId = generateId('DEC');

    await db.insert(schema.agentDecisions).values({
      decision_id: decisionId,
      agent_run_id: input.agentRunId,
      action_type: actionType,
      target_type: proposal.executionTool === 'adjust_recommendation' ? 'recommendation_snapshot' : 'style',
      target_id: proposal.executionTool === 'adjust_recommendation' ? snapshotId : proposalStatusChanges[0]?.styleId ?? null,
      title: proposal.executionTool === 'adjust_recommendation'
        ? 'Adjust main recommendations page'
        : `Modify status for ${proposalStatusChanges.length} style(s)`,
      summary: proposal.executionTool === 'adjust_recommendation'
        ? `Agent batch generated recommendation snapshot ${snapshotId}.`
        : `Agent batch changed ${proposalStatusChanges.length} style status value(s) and generated snapshot ${snapshotId}.`,
      status: 'executed',
      execution_result: JSON.stringify({
        previousSnapshotId: currentSnapshot.snapshot_id,
        snapshotId,
        executionPayload: recommendationPayload || statusPayload || null,
        // Only attach adjustment reports to recommendation decisions to avoid noise on status decisions.
        adjustmentReports: proposal.executionTool === 'adjust_recommendation' && recommendationPayload
          ? adjustmentReports.filter(r => recommendationPayload.changes.some(c => c.styleId === r.styleId))
          : undefined,
      }),
      requires_review: true,
      created_at: now,
      executed_at: now,
    });
    decisionIds.push(decisionId);

    const reviewWindowHours = proposal.review_window_hours ?? 24;
    const reviewEnd = new Date(Date.now() + reviewWindowHours * 60 * 60 * 1000).toISOString();
    const expectedMetrics = (proposal.expectedMetrics as unknown as ExpectedMetric[]) ?? [];

    if (proposal.executionTool === 'decide_style_status') {
      for (const change of proposalStatusChanges) {
        const before = stylesBeforeChange.get(change.styleId);
        await db.insert(schema.agentDecisionItems).values({
          decision_item_id: generateId('DECI'),
          decision_id: decisionId,
          style_id: change.styleId,
          item_action_type: change.newStatus === 'listed' ? 'list' : 'unlist',
          from_status: before?.status ?? null,
          to_status: change.newStatus,
          rank_before: currentRankByStyleId.get(change.styleId) ?? null,
          rank_after: finalRankByStyleId.get(change.styleId) ?? null,
          reason: statusChangeReasons.get(change.styleId) || 'Agent batch status change',
          created_at: now,
        });

        const baseline = await captureBaselineForReview(change.styleId, new Date(now), reviewWindowHours);

        const pendingReviewId = generateId('REV');
        await db.insert(schema.agentPendingReviews).values({
          pending_review_id: pendingReviewId,
          decision_id: decisionId,
          style_id: change.styleId,
          review_type: change.newStatus === 'listed' ? 'candidate_listing' : 'style_unlist',
          status: 'pending',
          before_metrics: JSON.stringify({
            originalStatus: before?.status ?? null,
            rankBefore: currentRankByStyleId.get(change.styleId) ?? null,
            previousSnapshotId: currentSnapshot.snapshot_id,
            metrics: baseline.metrics,
            metricsWindow: { start: baseline.windowStart, end: baseline.windowEnd },
          }),
          expected_effect: JSON.stringify({
            newStatus: change.newStatus,
            rankAfter: finalRankByStyleId.get(change.styleId) ?? null,
            snapshotId,
            expectedMetrics,
            rollbackCondition: proposal.rollback_condition,
          }),
          review_window_start: now,
          review_window_end: reviewEnd,
          created_at: now,
          updated_at: now,
        });
        pendingReviewIds.push(pendingReviewId);
      }
    } else {
      // Global recommendation review: baseline is aggregate across all listed styles.
      const baseline = await captureBaselineForReview(null, new Date(now), reviewWindowHours);

      const pendingReviewId = generateId('REV');
      await db.insert(schema.agentPendingReviews).values({
        pending_review_id: pendingReviewId,
        decision_id: decisionId,
        review_type: 'recommendation_change',
        status: 'pending',
        before_metrics: JSON.stringify({
          timestamp: now,
          previousSnapshotId: currentSnapshot.snapshot_id,
          metrics: baseline.metrics,
          metricsWindow: { start: baseline.windowStart, end: baseline.windowEnd },
        }),
        expected_effect: JSON.stringify({
          snapshotId,
          executionPayload: recommendationPayload || null,
          expectedMetrics,
          rollbackCondition: proposal.rollback_condition,
        }),
        review_window_start: now,
        review_window_end: reviewEnd,
        created_at: now,
        updated_at: now,
      });
      pendingReviewIds.push(pendingReviewId);
    }

    await db.update(schema.agentActionProposals)
      .set({ status: 'executed', decision_id: decisionId, updated_at: now })
      .where(eq(schema.agentActionProposals.proposal_id, proposal.proposal_id));
  }

  return {
    executedCount: proposals.length,
    snapshotId,
    decisionIds,
    pendingReviewIds,
    status: 'executed',
  };
  });
}

// ==========================================
// 5. REVIEW & RUN TOOLS
// ==========================================

export interface WriteStrategyMemoryInput {
  pendingReviewId: string;
  outcome: 'positive' | 'neutral' | 'negative';
  outcomeScore: number;
  beforeMetrics: BaselineMetrics;
  afterMetrics: BaselineMetrics;
  metricDelta: Partial<Record<string, number>>;
  evaluations?: unknown[];
  lesson: string;
  nextSuggestion?: string;
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
    before_metrics: JSON.stringify(input.beforeMetrics),
    after_metrics: JSON.stringify(input.afterMetrics),
    outcome_score: input.outcomeScore,
    lesson: input.lesson,
    created_at: now,
  });

  await db.update(schema.agentPendingReviews)
    .set({
      status: 'completed',
      memory_id: memoryId,
      result_metrics: JSON.stringify({
        outcome: input.outcome,
        outcomeScore: input.outcomeScore,
        beforeMetrics: input.beforeMetrics,
        afterMetrics: input.afterMetrics,
        metricDelta: input.metricDelta,
        evaluations: input.evaluations ?? [],
        nextSuggestion: input.nextSuggestion ?? null,
      }),
      result_summary: input.lesson,
      updated_at: now,
    })
    .where(eq(schema.agentPendingReviews.pending_review_id, input.pendingReviewId));

  return { memoryId, outcome: input.outcome, status: 'completed' };
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
    executionTool: proposal.execution_tool,
    executionPayload: proposal.execution_payload ? JSON.parse(proposal.execution_payload) as ExecutionPayload : null,
  };
}
