import { classifyColor } from './colorFamilyMap.ts';
import type { ColorClusterResult, RGB } from './types.ts';

const SAMPLE_BUDGET = 1000;
const KMEANS_K = 5;
const KMEANS_MAX_ITER = 20;

// 在 mask == 255 的像素里随机采样最多 SAMPLE_BUDGET 个 RGB
function sampleMaskedPixels(
  rgb: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  channels: number,
): RGB[] {
  // 先收集所有 mask 内的索引，再 reservoir / 随机抽 SAMPLE_BUDGET
  const total = width * height;
  const insideIdx: number[] = [];
  for (let i = 0; i < total; i++) {
    if (mask[i]! > 128) insideIdx.push(i);
  }

  if (insideIdx.length === 0) return [];

  const samples: RGB[] = [];
  const N = Math.min(SAMPLE_BUDGET, insideIdx.length);
  // Fisher–Yates 部分洗牌
  for (let k = 0; k < N; k++) {
    const j = k + Math.floor(Math.random() * (insideIdx.length - k));
    const tmp = insideIdx[k]!;
    insideIdx[k] = insideIdx[j]!;
    insideIdx[j] = tmp;
    const px = insideIdx[k]!;
    const base = px * channels;
    samples.push({
      r: rgb[base]!,
      g: rgb[base + 1]!,
      b: rgb[base + 2]!,
    });
  }
  return samples;
}

function rgbDist2(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function kmeans(samples: RGB[], k: number): { centroid: RGB; size: number }[] {
  if (samples.length === 0) return [];
  const realK = Math.min(k, samples.length);

  // k-means++ 初始化
  const centroids: RGB[] = [samples[Math.floor(Math.random() * samples.length)]!];
  while (centroids.length < realK) {
    const d2: number[] = samples.map(s => {
      let best = Infinity;
      for (const c of centroids) {
        const d = rgbDist2(s, c);
        if (d < best) best = d;
      }
      return best;
    });
    const sum = d2.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let picked = 0;
    for (let i = 0; i < d2.length; i++) {
      r -= d2[i]!;
      if (r <= 0) { picked = i; break; }
    }
    centroids.push(samples[picked]!);
  }

  const assignments = new Int32Array(samples.length);
  for (let iter = 0; iter < KMEANS_MAX_ITER; iter++) {
    let moved = 0;
    // assign
    for (let i = 0; i < samples.length; i++) {
      let bestC = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = rgbDist2(samples[i]!, centroids[c]!);
        if (d < bestD) { bestD = d; bestC = c; }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        moved++;
      }
    }
    // recompute centroids
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i]!;
      const s = sums[c]!;
      const px = samples[i]!;
      s.r += px.r; s.g += px.g; s.b += px.b; s.n++;
    }
    for (let c = 0; c < centroids.length; c++) {
      const s = sums[c]!;
      if (s.n > 0) {
        centroids[c] = { r: Math.round(s.r / s.n), g: Math.round(s.g / s.n), b: Math.round(s.b / s.n) };
      }
    }
    if (moved === 0) break;
  }

  const sizes = new Array(centroids.length).fill(0) as number[];
  for (let i = 0; i < samples.length; i++) sizes[assignments[i]!]!++;
  return centroids.map((c, i) => ({ centroid: c, size: sizes[i]! }))
    .sort((a, b) => b.size - a.size);
}

export function extractColor(
  rgb: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  channels: number,
): ColorClusterResult | null {
  const samples = sampleMaskedPixels(rgb, mask, width, height, channels);
  if (samples.length < 20) return null;

  const clusters = kmeans(samples, KMEANS_K);
  if (clusters.length === 0) return null;

  const total = clusters.reduce((acc, c) => acc + c.size, 0);
  const top = clusters[0]!;
  const cls = classifyColor(top.centroid);

  // 颜色置信度 = top cluster 占比 × (1 - normalized lab distance)
  // 远到 anchor 大约 60 lab 单位以上视为很弱
  const ratio = top.size / total;
  const distScore = Math.max(0, 1 - cls.distance / 60);
  const colorConfidence = +(ratio * distScore).toFixed(3);

  return {
    primaryColorRgb: top.centroid,
    primaryColorFamily: cls.family,
    primaryColorNameZh: cls.nameZh,
    dominantPalette: clusters.map(c => c.centroid),
    colorConfidence,
  };
}
