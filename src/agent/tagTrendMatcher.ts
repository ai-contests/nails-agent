/**
 * Tag trend detection and candidate matching.
 *
 * Closes the loop between "tag is rising" (LLM-observable) and "here are
 * concrete candidate styles that ride that trend" (executable).
 *
 * Pipeline:
 *   detectTagTrends     — pick tags with strong growth signal
 *   matchCandidates     — map each trending tag to candidates carrying it
 *   rankCandidateActions — final list of actionable candidate styles
 */

export interface TagHeatRow {
  tag_type: string;
  tag_value: string;
  heat_score: number;
  growth_score: number;
  click_count: number;
  tryon_count: number;
  favorite_count: number;
  style_count: number;
}

export interface CandidateStyleRow {
  style_id: string;
  color_tags: string;   // JSON string of string[]
  length_tags: string;  // JSON string of string[]
  is_available_for_tryon: boolean | null;
}

export interface ListedStyleRow {
  style_id: string;
  color_tags: string;
  length_tags: string;
}

export interface TagTrend {
  tagType: string;
  tagValue: string;
  growthScore: number;
  heatScore: number;
  tryonCount: number;
  favoriteCount: number;
}

export interface CandidateMatch {
  styleId: string;
  matchedTags: Array<{ tagType: string; tagValue: string; growthScore: number }>;
  matchScore: number;            // weighted by tag growth + multi-tag bonus
  diversityPenalty: number;      // how saturated the listed pool already is on these tags
  finalScore: number;            // matchScore * (1 - diversityPenalty)
  reason: string;                // human-readable explanation
}

export interface DetectTagTrendsOptions {
  minGrowthScore?: number;   // default 0.3
  minTryon?: number;         // default 1 — discard "growth" with no real conversion
  maxTrends?: number;        // default 5
}

export interface MatchCandidatesOptions {
  maxActions?: number;       // default 3 — keeps blast radius small
  diversitySaturationThreshold?: number; // default 0.4 — when >40% of listed catalog already has the tag, penalise
}

/**
 * Pick tags with a real rising signal. Filters out:
 * - low growth (growth_score below threshold)
 * - zero conversion (tryon_count == 0 → growth was probably just clicks)
 */
export function detectTagTrends(
  tagHeat: TagHeatRow[],
  options: DetectTagTrendsOptions = {},
): TagTrend[] {
  const minGrowth = options.minGrowthScore ?? 0.3;
  const minTryon = options.minTryon ?? 1;
  const maxTrends = options.maxTrends ?? 5;

  return tagHeat
    .filter(t => t.growth_score >= minGrowth && t.tryon_count >= minTryon)
    .sort((a, b) => b.growth_score - a.growth_score)
    .slice(0, maxTrends)
    .map(t => ({
      tagType: t.tag_type,
      tagValue: t.tag_value,
      growthScore: t.growth_score,
      heatScore: t.heat_score,
      tryonCount: t.tryon_count,
      favoriteCount: t.favorite_count,
    }));
}

function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}

/**
 * Compute, per (tag_type, tag_value), the fraction of currently listed styles
 * that already carry that tag. Used to penalise candidates that would just
 * make the recommendation page more homogeneous.
 */
function computeListedSaturation(listed: ListedStyleRow[]): Map<string, number> {
  const totals = listed.length || 1;
  const counts = new Map<string, number>();
  for (const style of listed) {
    const colors = parseTags(style.color_tags);
    const lengths = parseTags(style.length_tags);
    for (const c of colors) {
      const key = `color:${c}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const l of lengths) {
      const key = `length:${l}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const saturation = new Map<string, number>();
  for (const [key, count] of counts.entries()) {
    saturation.set(key, count / totals);
  }
  return saturation;
}

/**
 * Match trending tags to candidate styles. Returns ranked candidate actions
 * (max `maxActions`, default 3) suitable for proposing as list_candidate.
 */
export function matchCandidatesByTagTrend(
  trends: TagTrend[],
  candidates: CandidateStyleRow[],
  listed: ListedStyleRow[],
  options: MatchCandidatesOptions = {},
): CandidateMatch[] {
  const maxActions = options.maxActions ?? 3;
  const satThreshold = options.diversitySaturationThreshold ?? 0.4;

  if (trends.length === 0 || candidates.length === 0) return [];

  const saturation = computeListedSaturation(listed);
  const trendByKey = new Map<string, TagTrend>();
  for (const t of trends) trendByKey.set(`${t.tagType}:${t.tagValue}`, t);

  const matches: CandidateMatch[] = [];
  for (const cand of candidates) {
    if (cand.is_available_for_tryon === false) continue;

    const colors = parseTags(cand.color_tags);
    const lengths = parseTags(cand.length_tags);
    const candidateTags = [
      ...colors.map(v => ({ tagType: 'color', tagValue: v })),
      ...lengths.map(v => ({ tagType: 'length', tagValue: v })),
    ];

    const matchedTags: CandidateMatch['matchedTags'] = [];
    for (const ct of candidateTags) {
      const key = `${ct.tagType}:${ct.tagValue}`;
      const trend = trendByKey.get(key);
      if (trend) matchedTags.push({ tagType: ct.tagType, tagValue: ct.tagValue, growthScore: trend.growthScore });
    }
    if (matchedTags.length === 0) continue;

    // Base score = sum of growth scores; small multi-match bonus.
    const baseScore = matchedTags.reduce((acc, m) => acc + m.growthScore, 0);
    const multiTagBonus = matchedTags.length > 1 ? 0.1 * (matchedTags.length - 1) : 0;
    const matchScore = Number((baseScore + multiTagBonus).toFixed(4));

    // Diversity penalty: average saturation of matched tags above threshold.
    const overSat = matchedTags
      .map(m => saturation.get(`${m.tagType}:${m.tagValue}`) ?? 0)
      .filter(s => s > satThreshold);
    const diversityPenalty = overSat.length === 0
      ? 0
      : Number((overSat.reduce((a, b) => a + b, 0) / overSat.length - satThreshold).toFixed(4));

    const finalScore = Number((matchScore * Math.max(0, 1 - diversityPenalty)).toFixed(4));

    const reasonParts = matchedTags
      .sort((a, b) => b.growthScore - a.growthScore)
      .map(m => `${m.tagType}:${m.tagValue}(growth=${m.growthScore.toFixed(2)})`);
    const reason = `Candidate matches rising tags ${reasonParts.join(', ')}` +
      (diversityPenalty > 0 ? `; diversity penalty=${diversityPenalty}` : '');

    matches.push({
      styleId: cand.style_id,
      matchedTags,
      matchScore,
      diversityPenalty,
      finalScore,
      reason,
    });
  }

  return matches
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxActions);
}

/**
 * Top-level convenience: detect → match in one call.
 */
export function rankCandidateActionsFromTagTrends(
  tagHeat: TagHeatRow[],
  candidates: CandidateStyleRow[],
  listed: ListedStyleRow[],
  detectOpts: DetectTagTrendsOptions = {},
  matchOpts: MatchCandidatesOptions = {},
): { trends: TagTrend[]; actions: CandidateMatch[] } {
  const trends = detectTagTrends(tagHeat, detectOpts);
  const actions = matchCandidatesByTagTrend(trends, candidates, listed, matchOpts);
  return { trends, actions };
}
