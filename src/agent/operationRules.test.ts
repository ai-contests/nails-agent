import { expect, test } from 'bun:test';
import {
  buildExecutionPlanForProposal,
  evaluateProposalGuards,
  rebuildRanksForStatusChange,
  rebuildRanksForStatusChanges,
  selectRecentHistoryRows,
} from './operationRules.ts';

test('selects rows from the latest N historical windows excluding the current run', () => {
  const rows = [
    { agent_run_id: 'RUN3', window_end: '2026-06-04T12:00:00Z', style_id: 'STYLE001' },
    { agent_run_id: 'RUN2', window_end: '2026-06-04T00:00:00Z', style_id: 'STYLE001' },
    { agent_run_id: 'RUN2', window_end: '2026-06-04T00:00:00Z', style_id: 'STYLE002' },
    { agent_run_id: 'RUN1', window_end: '2026-06-03T12:00:00Z', style_id: 'STYLE001' },
    { agent_run_id: 'RUN0', window_end: '2026-06-03T00:00:00Z', style_id: 'STYLE001' },
  ];

  const selected = selectRecentHistoryRows(rows, 'RUN3', 2);

  expect(selected.map(row => row.style_id)).toEqual(['STYLE001', 'STYLE002', 'STYLE001']);
  expect([...new Set(selected.map(row => row.window_end))]).toEqual([
    '2026-06-04T00:00:00Z',
    '2026-06-03T12:00:00Z',
  ]);
});

test('rejects listing a style that is not in the candidate pool', () => {
  const result = evaluateProposalGuards(
    {
      proposalType: 'list_candidate',
      targetIds: ['STYLE001'],
      intendedAction: 'List candidate',
      hypothesis: 'It matches a rising tag',
      expectedMetrics: [{ metric: 'favorite_count', target: 5 }],
      rollbackCondition: 'Move back if conversion is zero',
      confidence: 0.8,
    },
    [{ style_id: 'STYLE001', status: 'listed' }],
    true,
  );

  expect(result.passed).toBe(false);
  expect(result.rulesChecked).toContainEqual({
    rule: 'target_status',
    status: 'failed',
    detail: 'list_candidate requires candidate targets',
  });
});

test('rejects action proposals without targets', () => {
  const result = evaluateProposalGuards(
    {
      proposalType: 'adjust_recommendation',
      targetIds: [],
      intendedAction: 'Promote hot styles',
      hypothesis: 'More prominent placement improves conversion',
      expectedMetrics: [{ metric: 'tryon_count', target: 10 }],
      rollbackCondition: 'Rollback if conversion drops',
      confidence: 0.8,
    },
    [],
    true,
  );

  expect(result.passed).toBe(false);
  expect(result.rulesChecked).toContainEqual({
    rule: 'target_ids_present',
    status: 'failed',
    detail: 'Action proposals require at least one target',
  });
});

test('inserts a newly listed candidate at rank 11 and renumbers the full snapshot', () => {
  const currentItems = Array.from({ length: 12 }, (_, index) => ({
    styleId: `STYLE${String(index + 1).padStart(3, '0')}`,
    rankNo: index + 1,
    score: 1 - index * 0.01,
  }));

  const rebuilt = rebuildRanksForStatusChange(currentItems, 'STYLE099', 'listed');

  expect(rebuilt.map(item => item.styleId).slice(9, 12)).toEqual(['STYLE010', 'STYLE099', 'STYLE011']);
  expect(rebuilt.map(item => item.rankNo)).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
});

test('combines multiple style status changes into one final rank list', () => {
  const currentItems = Array.from({ length: 12 }, (_, index) => ({
    styleId: `STYLE${String(index + 1).padStart(3, '0')}`,
    rankNo: index + 1,
    score: 1 - index * 0.01,
  }));

  const rebuilt = rebuildRanksForStatusChanges(currentItems, [
    { styleId: 'STYLE002', newStatus: 'candidate' },
    { styleId: 'STYLE099', newStatus: 'listed' },
    { styleId: 'STYLE100', newStatus: 'listed' },
  ]);

  expect(rebuilt.map(item => item.styleId).slice(0, 13)).toEqual([
    'STYLE001',
    'STYLE003',
    'STYLE004',
    'STYLE005',
    'STYLE006',
    'STYLE007',
    'STYLE008',
    'STYLE009',
    'STYLE010',
    'STYLE011',
    'STYLE099',
    'STYLE100',
    'STYLE012',
  ]);
  expect(rebuilt.map(item => item.rankNo)).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
});

test('builds an adjust recommendation execution payload for approved recommendation proposals', () => {
  const plan = buildExecutionPlanForProposal({
    proposalType: 'adjust_recommendation',
    targetIds: ['STYLE009', 'STYLE028'],
    intendedAction: 'Promote hot styles',
    hypothesis: 'Higher ranking will increase try-on count.',
    expectedMetrics: [
      { metric: 'tryon_count', direction: 'increase', minDelta: 5 },
      { metric: 'favorite_count', direction: 'increase', minDelta: 2 },
    ],
    rollbackCondition: 'Rollback if conversion drops.',
    reviewWindowHours: 12,
    confidence: 0.8,
  });

  expect(plan.executionTool).toBe('adjust_recommendation');
  expect(plan.executionPayload).toEqual({
    strategyType: 'promote',
    changes: [
      {
        styleId: 'STYLE009',
        action: 'promote',
        reason: 'Promote hot styles',
      },
      {
        styleId: 'STYLE028',
        action: 'promote',
        reason: 'Promote hot styles',
      },
    ],
    experiment: {
      experimentType: 'recommendation_boost',
      reviewWindowHours: 12,
      targetMetrics: ['tryon_count', 'favorite_count'],
    },
    summary: 'Promote 2 style(s) in the main recommendation snapshot.',
    requiresReview: true,
    evidenceRefs: [],
  });
});

test('builds a style status execution payload for candidate listing proposals', () => {
  const plan = buildExecutionPlanForProposal({
    proposalType: 'list_candidate',
    targetIds: ['STYLE055'],
    intendedAction: 'List candidate style',
    hypothesis: 'Candidate matches current demand.',
    expectedMetrics: [{ metric: 'click_count', direction: 'increase', minDelta: 3 }],
    rollbackCondition: 'Move back if clicks do not increase.',
    reviewWindowHours: 24,
    confidence: 0.7,
  });

  expect(plan.executionTool).toBe('decide_style_status');
  expect(plan.executionPayload).toEqual({
    strategyType: 'list',
    changes: [
      {
        styleId: 'STYLE055',
        action: 'list',
        newStatus: 'listed',
        reason: 'List candidate style',
      },
    ],
    experiment: {
      experimentType: 'style_status_change',
      reviewWindowHours: 24,
      targetMetrics: ['click_count'],
    },
    summary: 'Change 1 style(s) to listed.',
    requiresReview: true,
    evidenceRefs: [],
  });
});

test('does not build an execution payload for no-action proposals', () => {
  const plan = buildExecutionPlanForProposal({
    proposalType: 'no_action',
    targetIds: [],
    intendedAction: 'Keep observing',
    hypothesis: 'Evidence is not strong enough.',
    expectedMetrics: [],
    rollbackCondition: 'No rollback needed.',
    confidence: 0.6,
  });

  expect(plan).toEqual({ executionTool: null, executionPayload: null });
});
