export interface HeatHistoryRow {
  agent_run_id?: string | null;
  window_end: string;
}

export interface ProposalGuardInput {
  proposalType: string;
  targetIds: string[];
  intendedAction: string;
  hypothesis: string;
  expectedMetrics: unknown[];
  rollbackCondition: string;
  reviewWindowHours?: number | null;
  confidence?: number | null;
}

export interface TargetStyle {
  style_id: string;
  status: string;
}

export interface ProposalGuardResult {
  passed: boolean;
  rulesChecked: { rule: string; status: 'passed' | 'failed'; detail?: string }[];
}

export interface RecommendationRankItem {
  styleId: string;
  rankNo: number;
  score: number;
  reason?: string;
}

export interface StyleStatusChange {
  styleId: string;
  newStatus: 'listed' | 'candidate';
}

export type ExecutionToolName = 'adjust_recommendation' | 'decide_style_status';

export interface ExecutionExperiment {
  experimentType: 'recommendation_boost' | 'style_status_change';
  reviewWindowHours: number;
  targetMetrics: string[];
}

export interface RecommendationChangeRequest {
  styleId: string;
  action: 'promote' | 'demote';
  /** Explicit target rank (1-indexed). Omitted → use action default. */
  targetRank?: number;
  /** Hard cap on how many positions the rank may move. Default 10. */
  maxDelta?: number;
  reason: string;
}

export interface AdjustRecommendationExecutionPayload {
  strategyType: 'promote';
  changes: RecommendationChangeRequest[];
  experiment: ExecutionExperiment;
  summary: string;
  requiresReview: boolean;
  evidenceRefs: string[];
}

export interface DecideStyleStatusExecutionPayload {
  strategyType: 'list' | 'unlist';
  changes: {
    styleId: string;
    action: 'list' | 'unlist';
    newStatus: 'listed' | 'candidate';
    reason: string;
  }[];
  experiment: ExecutionExperiment;
  summary: string;
  requiresReview: boolean;
  evidenceRefs: string[];
}

export type ExecutionPayload =
  | AdjustRecommendationExecutionPayload
  | DecideStyleStatusExecutionPayload;

export interface ExecutionPlan {
  executionTool: ExecutionToolName | null;
  executionPayload: ExecutionPayload | null;
}

export function selectRecentHistoryRows<T extends HeatHistoryRow>(
  rows: T[],
  currentRunId: string,
  historyRounds: number,
): T[] {
  const selectedWindows: string[] = [];
  const selectedWindowSet = new Set<string>();

  for (const row of rows) {
    if (row.agent_run_id === currentRunId) continue;
    if (!selectedWindowSet.has(row.window_end)) {
      if (selectedWindows.length >= historyRounds) continue;
      selectedWindows.push(row.window_end);
      selectedWindowSet.add(row.window_end);
    }
  }

  return rows.filter(row => row.agent_run_id !== currentRunId && selectedWindowSet.has(row.window_end));
}

export function evaluateProposalGuards(
  proposal: ProposalGuardInput,
  targetStyles: TargetStyle[],
  activeGlobalSnapshotExists: boolean,
): ProposalGuardResult {
  const rulesChecked: ProposalGuardResult['rulesChecked'] = [];
  const fail = (rule: string, detail: string) => {
    rulesChecked.push({ rule, status: 'failed', detail });
  };
  const pass = (rule: string) => {
    rulesChecked.push({ rule, status: 'passed' });
  };

  if (!proposal.intendedAction.trim()) fail('intended_action_present', 'Missing intended action');
  else pass('intended_action_present');

  if (!proposal.hypothesis.trim()) fail('hypothesis_present', 'Missing hypothesis');
  else pass('hypothesis_present');

  if (proposal.expectedMetrics.length === 0) fail('expected_metrics_present', 'Expected metrics are required');
  else pass('expected_metrics_present');

  if (!proposal.rollbackCondition.trim()) fail('rollback_condition_present', 'Missing rollback condition');
  else pass('rollback_condition_present');

  if (proposal.confidence == null || proposal.confidence < 0.5) fail('confidence_threshold', 'Confidence must be at least 0.5');
  else pass('confidence_threshold');

  if (proposal.proposalType !== 'no_action' && proposal.targetIds.length === 0) {
    fail('target_ids_present', 'Action proposals require at least one target');
  } else {
    pass('target_ids_present');
  }

  if (!activeGlobalSnapshotExists && proposal.proposalType !== 'no_action') {
    fail('active_global_snapshot_exists', 'No active global_main snapshot exists');
  } else {
    pass('active_global_snapshot_exists');
  }

  const targetStyleById = new Map(targetStyles.map(style => [style.style_id, style]));
  const missingTargets = proposal.targetIds.filter(id => !targetStyleById.has(id));
  if (missingTargets.length > 0) fail('target_exists', `Missing targets: ${missingTargets.join(', ')}`);
  else pass('target_exists');

  if (proposal.proposalType === 'list_candidate') {
    const invalid = targetStyles.filter(style => !proposal.targetIds.includes(style.style_id) ? false : style.status !== 'candidate');
    if (invalid.length > 0) fail('target_status', 'list_candidate requires candidate targets');
    else pass('target_status');
    if (proposal.targetIds.length > 3) fail('action_limit', 'At most 3 candidates can be listed per proposal');
    else pass('action_limit');
  } else if (proposal.proposalType === 'unlist_to_candidate') {
    const invalid = targetStyles.filter(style => !proposal.targetIds.includes(style.style_id) ? false : style.status !== 'listed');
    if (invalid.length > 0) fail('target_status', 'unlist_to_candidate requires listed targets');
    else pass('target_status');
    if (proposal.targetIds.length > 3) fail('action_limit', 'At most 3 styles can be unlisted per proposal');
    else pass('action_limit');
  } else if (proposal.proposalType === 'adjust_recommendation') {
    const invalid = targetStyles.filter(style => !proposal.targetIds.includes(style.style_id) ? false : style.status !== 'listed');
    if (invalid.length > 0) fail('target_status', 'adjust_recommendation requires listed targets');
    else pass('target_status');
    if (proposal.targetIds.length > 10) fail('action_limit', 'At most 10 styles can be adjusted per proposal');
    else pass('action_limit');
  }

  return {
    passed: rulesChecked.every(rule => rule.status === 'passed'),
    rulesChecked,
  };
}

function extractTargetMetrics(expectedMetrics: unknown[]): string[] {
  const metrics: string[] = [];

  for (const metric of expectedMetrics) {
    if (
      typeof metric === 'object'
      && metric !== null
      && 'metric' in metric
      && typeof metric.metric === 'string'
      && !metrics.includes(metric.metric)
    ) {
      metrics.push(metric.metric);
    }
  }

  return metrics;
}

export interface BuildExecutionPlanInput extends ProposalGuardInput {
  /** Optional fine-grained per-style adjustment hints from the LLM. */
  recommendationChanges?: Array<Pick<RecommendationChangeRequest, 'styleId' | 'action' | 'targetRank' | 'maxDelta'> & { reason?: string }>;
}

export function buildExecutionPlanForProposal(proposal: BuildExecutionPlanInput): ExecutionPlan {
  const reviewWindowHours = proposal.reviewWindowHours ?? 24;
  const targetMetrics = extractTargetMetrics(proposal.expectedMetrics);
  const reason = proposal.intendedAction;

  if (proposal.proposalType === 'adjust_recommendation') {
    // Prefer LLM-provided per-change targets, falling back to default "promote" for each targetId.
    const llmChanges = (proposal.recommendationChanges ?? [])
      .filter(c => proposal.targetIds.includes(c.styleId));
    const llmChangeByStyle = new Map(llmChanges.map(c => [c.styleId, c]));
    const changes: RecommendationChangeRequest[] = proposal.targetIds.map(styleId => {
      const hint = llmChangeByStyle.get(styleId);
      return {
        styleId,
        action: (hint?.action === 'demote' ? 'demote' : 'promote'),
        targetRank: hint?.targetRank,
        maxDelta: hint?.maxDelta,
        reason: hint?.reason || reason,
      };
    });
    return {
      executionTool: 'adjust_recommendation',
      executionPayload: {
        strategyType: 'promote',
        changes,
        experiment: {
          experimentType: 'recommendation_boost',
          reviewWindowHours,
          targetMetrics,
        },
        summary: `Adjust ${proposal.targetIds.length} style(s) in the main recommendation snapshot (fine-grained).`,
        requiresReview: true,
        evidenceRefs: [],
      },
    };
  }

  if (proposal.proposalType === 'list_candidate' || proposal.proposalType === 'unlist_to_candidate') {
    const newStatus = proposal.proposalType === 'list_candidate' ? 'listed' : 'candidate';
    const action = proposal.proposalType === 'list_candidate' ? 'list' : 'unlist';

    return {
      executionTool: 'decide_style_status',
      executionPayload: {
        strategyType: action,
        changes: proposal.targetIds.map(styleId => ({
          styleId,
          action,
          newStatus,
          reason,
        })),
        experiment: {
          experimentType: 'style_status_change',
          reviewWindowHours,
          targetMetrics,
        },
        summary: `Change ${proposal.targetIds.length} style(s) to ${newStatus}.`,
        requiresReview: true,
        evidenceRefs: [],
      },
    };
  }

  return { executionTool: null, executionPayload: null };
}

/**
 * Apply fine-grained per-style recommendation adjustments to the current rank list.
 *
 * For each change:
 * - resolve target rank: explicit targetRank wins; otherwise default = current ± defaultDelta
 *   (promote: current - defaultDelta; demote: current + defaultDelta).
 * - clamp target rank to [1, N] and to [current - maxDelta, current + maxDelta]
 *   (maxDelta defaults to options.maxDeltaDefault, default 10).
 * - move the style to its target rank, shifting the rest accordingly.
 *
 * Optional diversity guard: if `options.tagsByStyle` is supplied along with
 * `maxSameTagInWindow` and `diversityWindow`, the post-move arrangement is
 * checked — for every window of `diversityWindow` consecutive ranks, no single
 * tag may appear more than `maxSameTagInWindow` times. Adjustments that would
 * violate this are rolled back individually.
 */
export interface ApplyAdjustmentOptions {
  maxDeltaDefault?: number;
  defaultDelta?: number;
  diversityWindow?: number;
  maxSameTagInWindow?: number;
  /** styleId → tag list (use a denormalised list of color+length tags). */
  tagsByStyle?: Map<string, string[]>;
}

export interface AppliedChangeReport {
  styleId: string;
  applied: boolean;
  rankBefore: number | null;
  rankAfter: number | null;
  reason: string;
  rejectionReason?: string;
}

export interface ApplyAdjustmentResult {
  ranks: RecommendationRankItem[];
  reports: AppliedChangeReport[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function violatesDiversity(
  ranks: RecommendationRankItem[],
  tagsByStyle: Map<string, string[]>,
  windowSize: number,
  maxSameInWindow: number,
): boolean {
  if (windowSize <= 1 || maxSameInWindow <= 0) return false;
  for (let i = 0; i <= ranks.length - windowSize; i++) {
    const counts = new Map<string, number>();
    for (let j = i; j < i + windowSize; j++) {
      const tags = tagsByStyle.get(ranks[j]!.styleId) ?? [];
      for (const tag of tags) {
        const next = (counts.get(tag) ?? 0) + 1;
        if (next > maxSameInWindow) return true;
        counts.set(tag, next);
      }
    }
  }
  return false;
}

export function applyRecommendationAdjustments(
  baseRanks: RecommendationRankItem[],
  changes: RecommendationChangeRequest[],
  options: ApplyAdjustmentOptions = {},
): ApplyAdjustmentResult {
  const maxDeltaDefault = options.maxDeltaDefault ?? 10;
  const defaultDelta = options.defaultDelta ?? 5;

  // Working copy keyed by original index for stable indexOf lookups.
  let working = baseRanks.map(r => ({ ...r }));
  const reports: AppliedChangeReport[] = [];

  for (const change of changes) {
    const idx = working.findIndex(r => r.styleId === change.styleId);
    if (idx < 0) {
      reports.push({
        styleId: change.styleId,
        applied: false,
        rankBefore: null,
        rankAfter: null,
        reason: change.reason,
        rejectionReason: 'style not in current ranks',
      });
      continue;
    }

    const currentRank = idx + 1;
    const maxDelta = Math.max(0, change.maxDelta ?? maxDeltaDefault);
    const direction = change.action === 'demote' ? +1 : -1;

    let targetRank: number;
    if (typeof change.targetRank === 'number' && Number.isFinite(change.targetRank)) {
      targetRank = Math.round(change.targetRank);
    } else {
      targetRank = currentRank + direction * defaultDelta;
    }
    targetRank = clamp(targetRank, 1, working.length);
    targetRank = clamp(targetRank, currentRank - maxDelta, currentRank + maxDelta);

    if (targetRank === currentRank) {
      reports.push({
        styleId: change.styleId,
        applied: false,
        rankBefore: currentRank,
        rankAfter: currentRank,
        reason: change.reason,
        rejectionReason: 'no-op after clamping',
      });
      continue;
    }

    const proposed = working.slice();
    const [picked] = proposed.splice(idx, 1);
    proposed.splice(targetRank - 1, 0, picked!);

    // Diversity guard: roll back this change if it would violate the window constraint.
    if (options.tagsByStyle && options.diversityWindow && options.maxSameTagInWindow) {
      if (violatesDiversity(proposed, options.tagsByStyle, options.diversityWindow, options.maxSameTagInWindow)) {
        reports.push({
          styleId: change.styleId,
          applied: false,
          rankBefore: currentRank,
          rankAfter: currentRank,
          reason: change.reason,
          rejectionReason: `would violate diversity (window=${options.diversityWindow}, max=${options.maxSameTagInWindow})`,
        });
        continue;
      }
    }

    working = proposed;
    reports.push({
      styleId: change.styleId,
      applied: true,
      rankBefore: currentRank,
      rankAfter: targetRank,
      reason: change.reason,
    });
  }

  const finalRanks = working.map((r, i) => ({ ...r, rankNo: i + 1 }));
  return { ranks: finalRanks, reports };
}

export function rebuildRanksForStatusChange(
  currentItems: RecommendationRankItem[],
  changedStyleId: string,
  newStatus: 'listed' | 'candidate',
): RecommendationRankItem[] {
  const withoutChanged = currentItems.filter(item => item.styleId !== changedStyleId);
  const nextItems = withoutChanged.slice();

  if (newStatus === 'listed') {
    const insertAt = Math.min(10, nextItems.length);
    nextItems.splice(insertAt, 0, {
      styleId: changedStyleId,
      rankNo: insertAt + 1,
      score: 0.5,
      reason: 'Agent listed candidate and inserted it after top 10',
    });
  }

  return nextItems.map((item, index) => ({
    ...item,
    rankNo: index + 1,
  }));
}

export function rebuildRanksForStatusChanges(
  currentItems: RecommendationRankItem[],
  changes: StyleStatusChange[],
): RecommendationRankItem[] {
  const changedStyleIds = new Set(changes.map(change => change.styleId));
  const nextItems = currentItems.filter(item => !changedStyleIds.has(item.styleId));
  let listedInsertions = 0;

  for (const change of changes) {
    if (change.newStatus !== 'listed') continue;

    const insertAt = Math.min(10 + listedInsertions, nextItems.length);
    nextItems.splice(insertAt, 0, {
      styleId: change.styleId,
      rankNo: insertAt + 1,
      score: 0.5,
      reason: 'Agent listed candidate and inserted it after top 10',
    });
    listedInsertions += 1;
  }

  return nextItems.map((item, index) => ({
    ...item,
    rankNo: index + 1,
  }));
}
