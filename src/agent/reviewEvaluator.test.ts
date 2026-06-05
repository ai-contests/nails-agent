import { expect, test } from 'bun:test';
import {
  evaluateReviewOutcome,
  emptyBaseline,
  computeConversionScore,
  type ExpectedMetric,
} from './reviewEvaluator.ts';

test('positive outcome: all expected metrics hit', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'tryon_count', direction: 'increase', minDelta: 3 },
    { metric: 'favorite_count', direction: 'increase', minDelta: 1 },
  ];
  const before = { ...emptyBaseline(), tryon_count: 2, favorite_count: 1, click_count: 10 };
  const after = { ...emptyBaseline(), tryon_count: 8, favorite_count: 4, click_count: 18 };

  const result = evaluateReviewOutcome(expected, before, after);

  expect(result.outcome).toBe('positive');
  expect(result.outcomeScore).toBe(1);
  expect(result.evaluations.every(e => e.hit)).toBe(true);
  expect(result.metricDelta.tryon_count).toBe(6);
  expect(result.metricDelta.favorite_count).toBe(3);
});

test('negative outcome: no expected metrics hit', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'tryon_count', direction: 'increase', minDelta: 5 },
    { metric: 'favorite_count', direction: 'increase', minDelta: 2 },
  ];
  const before = { ...emptyBaseline(), tryon_count: 10, favorite_count: 5, click_count: 20 };
  const after = { ...emptyBaseline(), tryon_count: 9, favorite_count: 4, click_count: 18 };

  const result = evaluateReviewOutcome(expected, before, after);

  expect(result.outcome).toBe('negative');
  expect(result.outcomeScore).toBe(0);
  expect(result.evaluations.every(e => !e.hit)).toBe(true);
});

test('neutral outcome: half of expected metrics hit', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'tryon_count', direction: 'increase', minDelta: 3 },
    { metric: 'favorite_count', direction: 'increase', minDelta: 3 },
  ];
  const before = { ...emptyBaseline(), tryon_count: 5, favorite_count: 5, click_count: 20 };
  const after = { ...emptyBaseline(), tryon_count: 10, favorite_count: 6, click_count: 25 };

  const result = evaluateReviewOutcome(expected, before, after);

  expect(result.outcome).toBe('neutral');
  expect(result.outcomeScore).toBe(0.5);
});

test('decrease direction works for unlist proposals', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'click_count', direction: 'decrease', minDelta: 5 },
  ];
  const before = { ...emptyBaseline(), click_count: 20 };
  const after = { ...emptyBaseline(), click_count: 8 };

  const result = evaluateReviewOutcome(expected, before, after);

  expect(result.outcome).toBe('positive');
  expect(result.evaluations[0]!.hit).toBe(true);
});

test('maintain direction tolerates small swings', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'tryon_count', direction: 'maintain', minDelta: 2 },
  ];
  const before = { ...emptyBaseline(), tryon_count: 10 };
  const after = { ...emptyBaseline(), tryon_count: 11 };

  expect(evaluateReviewOutcome(expected, before, after).outcome).toBe('positive');

  const afterBigDrop = { ...emptyBaseline(), tryon_count: 4 };
  expect(evaluateReviewOutcome(expected, before, afterBigDrop).outcome).toBe('negative');
});

test('empty expectedMetrics falls back to headline movement', () => {
  const before = { ...emptyBaseline(), tryon_count: 5, favorite_count: 3 };
  const afterUp = { ...emptyBaseline(), tryon_count: 8, favorite_count: 4 };
  const afterDown = { ...emptyBaseline(), tryon_count: 3, favorite_count: 1 };
  const afterFlat = { ...emptyBaseline(), tryon_count: 5, favorite_count: 3 };

  expect(evaluateReviewOutcome([], before, afterUp).outcome).toBe('positive');
  expect(evaluateReviewOutcome([], before, afterDown).outcome).toBe('negative');
  expect(evaluateReviewOutcome([], before, afterFlat).outcome).toBe('neutral');
});

test('computeConversionScore uses 60/40 tryon/favorite weighting', () => {
  const score = computeConversionScore({ click_count: 10, tryon_count: 4, favorite_count: 2 });
  // (4/10)*0.6 + (2/10)*0.4 = 0.24 + 0.08 = 0.32
  expect(score).toBeCloseTo(0.32, 5);
});

test('outcomeScore is deterministic (no Math.random anywhere)', () => {
  const expected: ExpectedMetric[] = [
    { metric: 'tryon_count', direction: 'increase', minDelta: 1 },
  ];
  const before = { ...emptyBaseline(), tryon_count: 2 };
  const after = { ...emptyBaseline(), tryon_count: 5 };

  const r1 = evaluateReviewOutcome(expected, before, after);
  const r2 = evaluateReviewOutcome(expected, before, after);
  const r3 = evaluateReviewOutcome(expected, before, after);
  expect(r1.outcomeScore).toBe(r2.outcomeScore);
  expect(r2.outcomeScore).toBe(r3.outcomeScore);
});
