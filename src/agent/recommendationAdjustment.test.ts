import { expect, test } from 'bun:test';
import {
  applyRecommendationAdjustments,
  type RecommendationChangeRequest,
  type RecommendationRankItem,
} from './operationRules.ts';

const makeRanks = (ids: string[]): RecommendationRankItem[] =>
  ids.map((id, i) => ({ styleId: id, rankNo: i + 1, score: 1, reason: '' }));

test('promote with explicit targetRank moves style to target', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'D', action: 'promote', targetRank: 2, reason: 'rising trend' },
  ];
  const { ranks, reports } = applyRecommendationAdjustments(base, changes);
  expect(ranks.map(r => r.styleId)).toEqual(['A', 'D', 'B', 'C', 'E']);
  expect(reports[0]!.applied).toBe(true);
  expect(reports[0]!.rankBefore).toBe(4);
  expect(reports[0]!.rankAfter).toBe(2);
});

test('maxDelta clamps movement', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'J', action: 'promote', targetRank: 1, maxDelta: 3, reason: 'trying to top' },
  ];
  const { ranks, reports } = applyRecommendationAdjustments(base, changes);
  // J was at rank 10, maxDelta 3 → can only go to rank 7
  expect(reports[0]!.rankAfter).toBe(7);
  expect(ranks[6]!.styleId).toBe('J');
});

test('default promote uses defaultDelta when no targetRank given', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'I', action: 'promote', reason: 'default' },  // at rank 9
  ];
  const { reports } = applyRecommendationAdjustments(base, changes, { defaultDelta: 4 });
  expect(reports[0]!.rankAfter).toBe(5);
});

test('demote moves style down', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'A', action: 'demote', targetRank: 4, reason: 'declining' },
  ];
  const { ranks } = applyRecommendationAdjustments(base, changes);
  expect(ranks.map(r => r.styleId)).toEqual(['B', 'C', 'D', 'A', 'E']);
});

test('unknown style is reported but not applied', () => {
  const base = makeRanks(['A', 'B', 'C']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'ZZZ', action: 'promote', targetRank: 1, reason: 'ghost' },
  ];
  const { ranks, reports } = applyRecommendationAdjustments(base, changes);
  expect(ranks.map(r => r.styleId)).toEqual(['A', 'B', 'C']);
  expect(reports[0]!.applied).toBe(false);
  expect(reports[0]!.rejectionReason).toContain('not in current ranks');
});

test('no-op (target == current after clamping) is reported as skipped', () => {
  const base = makeRanks(['A', 'B', 'C']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'B', action: 'promote', targetRank: 2, reason: 'no movement' },
  ];
  const { reports } = applyRecommendationAdjustments(base, changes);
  expect(reports[0]!.applied).toBe(false);
  expect(reports[0]!.rejectionReason).toContain('no-op');
});

test('diversity guard rejects move that would cluster same-tag', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  // A, B, C are all "color:pink"; D, E are "color:black". Currently no window of 4 has
  // more than 3 pinks (A,B,C are at 1,2,3 → window 1-4 already has 3 pinks, OK at max=3).
  const tagsByStyle = new Map<string, string[]>([
    ['A', ['color:pink']],
    ['B', ['color:pink']],
    ['C', ['color:pink']],
    ['D', ['color:black']],
    ['E', ['color:pink']],  // moving E to rank 4 would put 4 pinks in window 1-4
  ]);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'E', action: 'promote', targetRank: 4, reason: 'pink trending' },
  ];
  const { reports } = applyRecommendationAdjustments(base, changes, {
    tagsByStyle,
    diversityWindow: 4,
    maxSameTagInWindow: 3,
  });
  expect(reports[0]!.applied).toBe(false);
  expect(reports[0]!.rejectionReason).toContain('diversity');
});

test('diversity guard allows move that keeps variation', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  const tagsByStyle = new Map<string, string[]>([
    ['A', ['color:pink']],
    ['B', ['color:black']],
    ['C', ['color:white']],
    ['D', ['color:pink']],
    ['E', ['color:rose_gold']],
  ]);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'E', action: 'promote', targetRank: 2, reason: 'rose_gold trending' },
  ];
  const { ranks, reports } = applyRecommendationAdjustments(base, changes, {
    tagsByStyle,
    diversityWindow: 4,
    maxSameTagInWindow: 2,
  });
  expect(reports[0]!.applied).toBe(true);
  expect(ranks[1]!.styleId).toBe('E');
});

test('multiple changes apply sequentially', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'E', action: 'promote', targetRank: 1, reason: 'top' },
    { styleId: 'A', action: 'demote', targetRank: 5, reason: 'bottom' },
  ];
  const { ranks } = applyRecommendationAdjustments(base, changes);
  // After change 1: [E, A, B, C, D]; after change 2: [A is at rank 2, demote to 5] → [E, B, C, D, A]
  expect(ranks.map(r => r.styleId)).toEqual(['E', 'B', 'C', 'D', 'A']);
});

test('final rankNo is always 1..N contiguous', () => {
  const base = makeRanks(['A', 'B', 'C', 'D', 'E']);
  const changes: RecommendationChangeRequest[] = [
    { styleId: 'D', action: 'promote', targetRank: 1, reason: 'top' },
  ];
  const { ranks } = applyRecommendationAdjustments(base, changes);
  expect(ranks.map(r => r.rankNo)).toEqual([1, 2, 3, 4, 5]);
});
