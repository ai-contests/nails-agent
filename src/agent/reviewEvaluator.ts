export type MetricName = 'tryon_count' | 'favorite_count' | 'click_count' | 'conversion_score';
export type MetricDirection = 'increase' | 'decrease' | 'maintain';

export interface ExpectedMetric {
  metric: MetricName;
  direction: MetricDirection;
  minDelta: number;
}

export interface BaselineMetrics {
  click_count: number;
  tryon_count: number;
  favorite_count: number;
  conversion_score: number;
}

export interface MetricEvaluation {
  metric: MetricName;
  direction: MetricDirection;
  minDelta: number;
  before: number;
  after: number;
  delta: number;
  hit: boolean;
}

export interface ReviewOutcome {
  outcome: 'positive' | 'neutral' | 'negative';
  outcomeScore: number;
  evaluations: MetricEvaluation[];
  metricDelta: Partial<Record<MetricName, number>>;
  lesson: string;
}

export function emptyBaseline(): BaselineMetrics {
  return { click_count: 0, tryon_count: 0, favorite_count: 0, conversion_score: 0 };
}

export function computeConversionScore(b: { click_count: number; tryon_count: number; favorite_count: number }): number {
  const clickDiv = Math.max(b.click_count, 1);
  return (b.tryon_count / clickDiv) * 0.6 + (b.favorite_count / clickDiv) * 0.4;
}

function readMetric(b: BaselineMetrics, metric: MetricName): number {
  return b[metric] ?? 0;
}

function checkHit(direction: MetricDirection, delta: number, minDelta: number): boolean {
  const threshold = Math.max(minDelta, 0);
  if (direction === 'increase') return delta >= threshold;
  if (direction === 'decrease') return delta <= -threshold;
  return Math.abs(delta) <= threshold;
}

export function evaluateReviewOutcome(
  expectedMetrics: ExpectedMetric[],
  before: BaselineMetrics,
  after: BaselineMetrics,
): ReviewOutcome {
  const evaluations: MetricEvaluation[] = [];
  const metricDelta: Partial<Record<MetricName, number>> = {};

  for (const expected of expectedMetrics) {
    const beforeVal = readMetric(before, expected.metric);
    const afterVal = readMetric(after, expected.metric);
    const delta = Number((afterVal - beforeVal).toFixed(4));
    metricDelta[expected.metric] = delta;
    evaluations.push({
      metric: expected.metric,
      direction: expected.direction,
      minDelta: expected.minDelta,
      before: beforeVal,
      after: afterVal,
      delta,
      hit: checkHit(expected.direction, delta, expected.minDelta),
    });
  }

  // Fallback: no expected metrics → score from raw movement of headline metrics.
  if (evaluations.length === 0) {
    const headlineDelta =
      (after.tryon_count - before.tryon_count) +
      (after.favorite_count - before.favorite_count);
    const outcome: ReviewOutcome['outcome'] =
      headlineDelta > 0 ? 'positive' : headlineDelta < 0 ? 'negative' : 'neutral';
    return {
      outcome,
      outcomeScore: outcome === 'positive' ? 0.6 : outcome === 'neutral' ? 0.5 : 0.3,
      evaluations,
      metricDelta: {
        tryon_count: after.tryon_count - before.tryon_count,
        favorite_count: after.favorite_count - before.favorite_count,
        click_count: after.click_count - before.click_count,
      },
      lesson: `No expected metrics declared. Headline tryon+favorite delta = ${headlineDelta}.`,
    };
  }

  const hits = evaluations.filter(e => e.hit).length;
  const outcomeScore = Number((hits / evaluations.length).toFixed(3));

  let outcome: ReviewOutcome['outcome'];
  if (outcomeScore >= 0.7) outcome = 'positive';
  else if (outcomeScore >= 0.3) outcome = 'neutral';
  else outcome = 'negative';

  const lessonParts = evaluations.map(e => {
    const mark = e.hit ? '✓' : '✗';
    return `${mark} ${e.metric} ${e.direction} by ≥${e.minDelta}: before=${e.before}, after=${e.after}, delta=${e.delta}`;
  });
  const lesson = `Outcome=${outcome} (score=${outcomeScore}). ${lessonParts.join('; ')}.`;

  return {
    outcome,
    outcomeScore,
    evaluations,
    metricDelta,
    lesson,
  };
}
