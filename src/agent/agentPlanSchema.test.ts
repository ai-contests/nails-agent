import { expect, test } from 'bun:test';
import { parseAgentPlanResponse } from './agentPlanSchema.ts';

test('parses a valid camelCase agent plan', () => {
  const plan = parseAgentPlanResponse(JSON.stringify({
    findings: [
      {
        findingType: 'opportunity',
        targetType: 'tag',
        targetId: 'color:tan',
        title: 'Tan styles are heating up',
        summary: 'Tan color tag has rising engagement in the current window.',
        score: 0.82,
      },
    ],
    proposals: [
      {
        proposalType: 'list_candidate',
        targetType: 'candidate',
        targetIds: ['STYLE056'],
        intendedAction: 'List candidate style',
        hypothesis: 'Listing this candidate will match current demand.',
        expectedMetrics: [{ metric: 'favorite_count', direction: 'increase', minDelta: 3 }],
        rollbackCondition: 'Move back if favorites do not increase in 12 hours.',
        reviewWindowHours: 12,
        confidence: 0.74,
      },
    ],
  }));

  expect(plan.proposals[0]?.expectedMetrics).toEqual([
    { metric: 'favorite_count', direction: 'increase', minDelta: 3 },
  ]);
});

test('rejects snake_case proposal fields', () => {
  expect(() => parseAgentPlanResponse(JSON.stringify({
    findings: [],
    proposals: [
      {
        proposal_type: 'list_candidate',
        target_type: 'candidate',
        target_ids: ['STYLE056'],
        intended_action: 'List candidate style',
        hypothesis: 'It matches demand.',
        expected_metrics: [{ metric: 'favorite_count', direction: 'increase', min_delta: 3 }],
        rollback_condition: 'Move back if favorites do not increase.',
        confidence: 0.74,
      },
    ],
  }))).toThrow('Invalid agent plan');
});

test('rejects expectedMetrics when it is not an array', () => {
  expect(() => parseAgentPlanResponse(JSON.stringify({
    findings: [],
    proposals: [
      {
        proposalType: 'adjust_recommendation',
        targetType: 'style',
        targetIds: ['STYLE009'],
        intendedAction: 'Promote hot style',
        hypothesis: 'Better rank will increase try-on count.',
        expectedMetrics: { metric: 'tryon_count', direction: 'increase', minDelta: 5 },
        rollbackCondition: 'Rollback if try-on count does not increase.',
        confidence: 0.8,
      },
    ],
  }))).toThrow('Invalid agent plan');
});

test('rejects tag targets in executable proposals', () => {
  expect(() => parseAgentPlanResponse(JSON.stringify({
    findings: [],
    proposals: [
      {
        proposalType: 'adjust_recommendation',
        targetType: 'tag',
        targetIds: ['tan', 'short'],
        intendedAction: 'Promote hot tag',
        hypothesis: 'The tag is trending.',
        expectedMetrics: [{ metric: 'tryon_count', direction: 'increase', minDelta: 5 }],
        rollbackCondition: 'Rollback if try-on count does not increase.',
        confidence: 0.8,
      },
    ],
  }))).toThrow('Invalid agent plan');
});

test('rejects extra top-level fields', () => {
  expect(() => parseAgentPlanResponse(JSON.stringify({
    findings: [],
    proposals: [],
    expectedMetrics: [{ metric: 'tryon_count', direction: 'increase', minDelta: 5 }],
  }))).toThrow('Invalid agent plan');
});
