import { expect, test } from 'bun:test';
import {
  detectTagTrends,
  matchCandidatesByTagTrend,
  rankCandidateActionsFromTagTrends,
  type TagHeatRow,
  type CandidateStyleRow,
  type ListedStyleRow,
} from './tagTrendMatcher.ts';

const heat = (over: Partial<TagHeatRow>): TagHeatRow => ({
  tag_type: 'color',
  tag_value: 'pink',
  heat_score: 0,
  growth_score: 0,
  click_count: 0,
  tryon_count: 0,
  favorite_count: 0,
  style_count: 0,
  ...over,
});

const cand = (id: string, color: string[], length: string[] = ['short'], tryon = true): CandidateStyleRow => ({
  style_id: id,
  color_tags: JSON.stringify(color),
  length_tags: JSON.stringify(length),
  is_available_for_tryon: tryon,
});

const listed = (id: string, color: string[], length: string[] = ['short']): ListedStyleRow => ({
  style_id: id,
  color_tags: JSON.stringify(color),
  length_tags: JSON.stringify(length),
});

test('detectTagTrends filters low growth and zero-conversion noise', () => {
  const tags: TagHeatRow[] = [
    heat({ tag_value: 'pink',   growth_score: 0.8, tryon_count: 3 }),  // keep
    heat({ tag_value: 'olive',  growth_score: 0.1, tryon_count: 5 }),  // drop: low growth
    heat({ tag_value: 'silver', growth_score: 0.7, tryon_count: 0 }),  // drop: no conversion
    heat({ tag_value: 'rose_gold', growth_score: 0.5, tryon_count: 2 }), // keep
  ];
  const out = detectTagTrends(tags);
  expect(out.map(t => t.tagValue)).toEqual(['pink', 'rose_gold']);
});

test('detectTagTrends respects maxTrends', () => {
  const tags: TagHeatRow[] = [
    heat({ tag_value: 'a', growth_score: 1.0, tryon_count: 1 }),
    heat({ tag_value: 'b', growth_score: 0.9, tryon_count: 1 }),
    heat({ tag_value: 'c', growth_score: 0.8, tryon_count: 1 }),
    heat({ tag_value: 'd', growth_score: 0.7, tryon_count: 1 }),
  ];
  expect(detectTagTrends(tags, { maxTrends: 2 }).map(t => t.tagValue)).toEqual(['a', 'b']);
});

test('matchCandidatesByTagTrend returns empty when no trends or no candidates', () => {
  expect(matchCandidatesByTagTrend([], [cand('S1', ['pink'])], [])).toEqual([]);
  expect(matchCandidatesByTagTrend(
    [{ tagType: 'color', tagValue: 'pink', growthScore: 1, heatScore: 5, tryonCount: 1, favoriteCount: 1 }],
    [],
    [],
  )).toEqual([]);
});

test('candidate with matching tag is ranked, non-matching is dropped', () => {
  const trends = [{ tagType: 'color', tagValue: 'pink', growthScore: 0.8, heatScore: 10, tryonCount: 3, favoriteCount: 2 }];
  const candidates = [
    cand('S1', ['pink']),
    cand('S2', ['black']),
  ];
  const out = matchCandidatesByTagTrend(trends, candidates, []);
  expect(out.length).toBe(1);
  expect(out[0]!.styleId).toBe('S1');
  expect(out[0]!.matchedTags[0]!.tagValue).toBe('pink');
});

test('multi-tag match gets bonus over single-tag', () => {
  const trends = [
    { tagType: 'color',  tagValue: 'pink',  growthScore: 0.5, heatScore: 1, tryonCount: 1, favoriteCount: 0 },
    { tagType: 'length', tagValue: 'short', growthScore: 0.5, heatScore: 1, tryonCount: 1, favoriteCount: 0 },
  ];
  const candidates = [
    cand('S1', ['pink'],  ['long']),   // 1 match → 0.5
    cand('S2', ['pink'],  ['short']),  // 2 matches → 0.5 + 0.5 + 0.1 bonus = 1.1
  ];
  const out = matchCandidatesByTagTrend(trends, candidates, []);
  expect(out[0]!.styleId).toBe('S2');
  expect(out[0]!.matchScore).toBeCloseTo(1.1, 5);
});

test('diversity penalty kicks in when listed pool is already saturated', () => {
  const trends = [{ tagType: 'color', tagValue: 'pink', growthScore: 1.0, heatScore: 10, tryonCount: 3, favoriteCount: 2 }];
  const candidates = [cand('S1', ['pink'])];
  // 8/10 listed styles are already pink → saturation 0.8, well above 0.4 threshold
  const listedPool: ListedStyleRow[] = [
    ...Array.from({ length: 8 }, (_, i) => listed(`L${i}`, ['pink'])),
    listed('L8', ['black']),
    listed('L9', ['white']),
  ];
  const out = matchCandidatesByTagTrend(trends, candidates, listedPool);
  expect(out[0]!.diversityPenalty).toBeGreaterThan(0);
  expect(out[0]!.finalScore).toBeLessThan(out[0]!.matchScore);
});

test('unavailable-for-tryon candidates are skipped', () => {
  const trends = [{ tagType: 'color', tagValue: 'pink', growthScore: 1, heatScore: 5, tryonCount: 1, favoriteCount: 1 }];
  const candidates = [cand('S1', ['pink'], ['short'], false)];
  expect(matchCandidatesByTagTrend(trends, candidates, []).length).toBe(0);
});

test('matchCandidates caps output at maxActions', () => {
  const trends = [{ tagType: 'color', tagValue: 'pink', growthScore: 1, heatScore: 5, tryonCount: 1, favoriteCount: 1 }];
  const candidates = Array.from({ length: 10 }, (_, i) => cand(`S${i}`, ['pink']));
  const out = matchCandidatesByTagTrend(trends, candidates, [], { maxActions: 3 });
  expect(out.length).toBe(3);
});

test('rankCandidateActionsFromTagTrends ties detect + match in one call', () => {
  const tagHeat: TagHeatRow[] = [
    heat({ tag_value: 'rose_gold', growth_score: 0.8, tryon_count: 2 }),
    heat({ tag_value: 'lavender',  growth_score: 0.6, tryon_count: 2 }),
  ];
  const candidates = [
    cand('C1', ['rose_gold']),
    cand('C2', ['lavender']),
    cand('C3', ['black']),
  ];
  const { trends, actions } = rankCandidateActionsFromTagTrends(tagHeat, candidates, []);
  expect(trends.length).toBe(2);
  expect(actions.length).toBe(2);
  expect(actions.map(a => a.styleId).sort()).toEqual(['C1', 'C2']);
});

test('malformed JSON in tag fields is treated as empty array (no throw)', () => {
  const trends = [{ tagType: 'color', tagValue: 'pink', growthScore: 1, heatScore: 5, tryonCount: 1, favoriteCount: 1 }];
  const broken: CandidateStyleRow = {
    style_id: 'BROKEN',
    color_tags: 'not-json',
    length_tags: '[}{',
    is_available_for_tryon: true,
  };
  expect(matchCandidatesByTagTrend(trends, [broken], []).length).toBe(0);
});
