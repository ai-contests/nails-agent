import { expect, test } from 'bun:test';
import { computeGrowth, indexHistoryByKey } from './trendAnalyzer.ts';

test('no history → growthScore = 0 regardless of current heat', () => {
  const result = computeGrowth(100, []);
  expect(result.windowsUsed).toBe(0);
  expect(result.baselineHeat).toBe(0);
  expect(result.confidence).toBe(0);
  expect(result.growthScore).toBe(0);
});

test('stable history → growth near zero', () => {
  const history = [
    { heat_score: 10, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 10, window_end: '2026-06-04T00:00:00Z' },
    { heat_score: 10, window_end: '2026-06-03T12:00:00Z' },
  ];
  const result = computeGrowth(10, history);
  expect(result.baselineHeat).toBe(10);
  expect(result.growthRatio).toBe(0);
  expect(result.growthScore).toBe(0);
});

test('current heat doubles baseline → positive growth', () => {
  const history = [
    { heat_score: 5, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 5, window_end: '2026-06-04T00:00:00Z' },
    { heat_score: 5, window_end: '2026-06-03T12:00:00Z' },
  ];
  const result = computeGrowth(10, history);
  expect(result.baselineHeat).toBe(5);
  expect(result.growthRatio).toBe(1);
  // baseline=5 ≥ minBaselineHeat 3 → volume confidence 1; history=3 ≥ 3 → history conf 1
  expect(result.confidence).toBe(1);
  expect(result.growthScore).toBe(1);
});

test('current heat drops to zero → negative growth', () => {
  const history = [
    { heat_score: 8, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 8, window_end: '2026-06-04T00:00:00Z' },
    { heat_score: 8, window_end: '2026-06-03T12:00:00Z' },
  ];
  const result = computeGrowth(0, history);
  expect(result.growthRatio).toBe(-1);
  expect(result.growthScore).toBeLessThan(0);
});

test('sparse history (1 window) discounts confidence', () => {
  const history = [{ heat_score: 5, window_end: '2026-06-04T12:00:00Z' }];
  const result = computeGrowth(10, history);
  expect(result.windowsUsed).toBe(1);
  // historyConfidence = 1/3 ≈ 0.333; volume = 5/3 → clamped 1; conf ≈ 0.333
  expect(result.confidence).toBeCloseTo(0.333, 2);
  expect(result.growthScore).toBeCloseTo(0.333, 2);
});

test('low-volume baseline discounts confidence', () => {
  const history = [
    { heat_score: 1, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 1, window_end: '2026-06-04T00:00:00Z' },
    { heat_score: 1, window_end: '2026-06-03T12:00:00Z' },
  ];
  const result = computeGrowth(5, history);
  // history conf = 1; volume conf = 1/3 ≈ 0.333
  expect(result.confidence).toBeCloseTo(0.333, 2);
  // growthRatio = (5-1)/1 = 4; growthScore = 4 * 0.333 ≈ 1.333
  expect(result.growthScore).toBeCloseTo(1.333, 2);
});

test('takes only freshest N windows when history is longer', () => {
  // Old windows have huge heat that should be ignored
  const history = [
    { heat_score: 5, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 5, window_end: '2026-06-04T00:00:00Z' },
    { heat_score: 5, window_end: '2026-06-03T12:00:00Z' },
    { heat_score: 100, window_end: '2026-06-02T12:00:00Z' },  // ignored
    { heat_score: 100, window_end: '2026-06-02T00:00:00Z' },  // ignored
  ];
  const result = computeGrowth(10, history, { historyRounds: 3 });
  expect(result.windowsUsed).toBe(3);
  expect(result.baselineHeat).toBe(5);
});

test('unsorted history is handled correctly', () => {
  const history = [
    { heat_score: 5, window_end: '2026-06-03T12:00:00Z' },
    { heat_score: 5, window_end: '2026-06-04T12:00:00Z' },
    { heat_score: 5, window_end: '2026-06-04T00:00:00Z' },
  ];
  const result = computeGrowth(10, history);
  expect(result.baselineHeat).toBe(5);
});

test('indexHistoryByKey groups and sorts newest-first', () => {
  const rows = [
    { style_id: 'A', heat_score: 10, window_end: '2026-06-04T00:00:00Z' },
    { style_id: 'A', heat_score: 20, window_end: '2026-06-04T12:00:00Z' },
    { style_id: 'B', heat_score: 5, window_end: '2026-06-04T12:00:00Z' },
  ];
  const map = indexHistoryByKey(rows, r => r.style_id);
  expect(map.get('A')!.length).toBe(2);
  expect(map.get('A')![0]!.heat_score).toBe(20); // newest first
  expect(map.get('B')!.length).toBe(1);
});

test('growth is deterministic across calls', () => {
  const history = [{ heat_score: 5, window_end: '2026-06-04T12:00:00Z' }];
  const r1 = computeGrowth(10, history);
  const r2 = computeGrowth(10, history);
  expect(r1.growthScore).toBe(r2.growthScore);
});
