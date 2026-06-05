/**
 * Trend analysis for style and tag heat snapshots.
 *
 * Replaces the placeholder "growth_score = heat_score" with a real ratio
 * comparing the current window against the average of the most recent N
 * historical windows. Adds a confidence discount when historical sample
 * size is too small to trust.
 */

export interface HistoricalHeatPoint {
  heat_score: number;
  window_end: string;
}

export interface GrowthResult {
  /** Average heat over the recent N windows (0 if no history). */
  baselineHeat: number;
  /** Current window heat. */
  currentHeat: number;
  /** Absolute delta. */
  delta: number;
  /** Relative growth in [-1, +∞). 0 when there is no movement; negative when shrinking. */
  growthRatio: number;
  /** Confidence in [0, 1]. Discounted when history is sparse or volume is low. */
  confidence: number;
  /** Final growth_score combining growthRatio and confidence. */
  growthScore: number;
  /** Number of historical windows actually used. */
  windowsUsed: number;
}

export interface GrowthOptions {
  /** Number of historical windows to average (default 5). */
  historyRounds?: number;
  /** Minimum baseline heat below which we discount the signal (default 3). */
  minBaselineHeat?: number;
  /** Minimum windows required for full confidence (default 3). */
  minWindowsForFullConfidence?: number;
}

/**
 * Compute growth_score for a single style or tag.
 *
 * Algorithm:
 * 1. Take the most recent `historyRounds` historical windows (already excluding
 *    the current run, sorted newest-first).
 * 2. Average their heat_score → baselineHeat.
 * 3. growthRatio = (current - baseline) / max(baseline, 1).
 * 4. Confidence factor combines:
 *    - historyConfidence = min(windowsUsed / minWindowsForFullConfidence, 1)
 *    - volumeConfidence  = min(baselineHeat / minBaselineHeat, 1)
 *    confidence = historyConfidence * volumeConfidence (clamped to [0, 1]).
 * 5. growthScore = growthRatio * confidence.
 *
 * Edge cases:
 * - No history → baselineHeat = 0, growthRatio = currentHeat (treated as "all
 *   movement is new"), but confidence = 0, so growthScore = 0.
 * - Current heat = 0 with prior history → growthRatio = -1, growthScore < 0
 *   (correctly signals decline).
 */
export function computeGrowth(
  currentHeat: number,
  history: HistoricalHeatPoint[],
  options: GrowthOptions = {},
): GrowthResult {
  const historyRounds = options.historyRounds ?? 5;
  const minBaselineHeat = options.minBaselineHeat ?? 3;
  const minWindowsForFullConfidence = options.minWindowsForFullConfidence ?? 3;

  // Take the freshest `historyRounds` windows. We expect caller to have
  // already sorted newest-first, but be defensive.
  const sorted = [...history].sort((a, b) => b.window_end.localeCompare(a.window_end));
  const used = sorted.slice(0, historyRounds);

  const windowsUsed = used.length;
  const baselineHeat = windowsUsed === 0
    ? 0
    : used.reduce((acc, p) => acc + p.heat_score, 0) / windowsUsed;

  const delta = currentHeat - baselineHeat;
  const growthRatio = windowsUsed === 0
    ? 0  // no baseline → no opinion (don't pretend growth)
    : delta / Math.max(baselineHeat, 1);

  const historyConfidence = Math.min(windowsUsed / minWindowsForFullConfidence, 1);
  const volumeConfidence = Math.min(baselineHeat / minBaselineHeat, 1);
  const confidence = Number((historyConfidence * volumeConfidence).toFixed(3));

  const growthScore = Number((growthRatio * confidence).toFixed(4));

  return {
    baselineHeat: Number(baselineHeat.toFixed(4)),
    currentHeat,
    delta: Number(delta.toFixed(4)),
    growthRatio: Number(growthRatio.toFixed(4)),
    confidence,
    growthScore,
    windowsUsed,
  };
}

/**
 * Group historical rows by a key (style_id or tag composite key) and build a
 * map suitable for batch lookups during rollup.
 */
export function indexHistoryByKey<T extends { heat_score: number; window_end: string }>(
  rows: T[],
  keyFn: (row: T) => string,
): Map<string, HistoricalHeatPoint[]> {
  const map = new Map<string, HistoricalHeatPoint[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = map.get(key) ?? [];
    list.push({ heat_score: row.heat_score, window_end: row.window_end });
    map.set(key, list);
  }
  // Sort each list newest-first.
  for (const list of map.values()) {
    list.sort((a, b) => b.window_end.localeCompare(a.window_end));
  }
  return map;
}
