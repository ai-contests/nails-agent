import { COLOR_ANCHORS, classifyColor, rgbToLab, labDistance, anchorCountByFamily } from './colorFamilyMap.ts';
import type { ColorClusterResult, RGB } from './types.ts';

const SAMPLE_BUDGET = 1500;
const PALETTE_SIZE = 5;
// Lab outlier 阈值（关掉肤色误归 + 极端高光黑斑）
const ANCHOR_MAX_DIST = 35;
// 皮肤参考 ΔE 内的甲油像素一律视作"皮肤泄漏"，丢弃
const SKIN_REJECT_DELTA_E = 15;

interface AnchorBucket {
  anchorIdx: number;
  family: string;
  nameZh: string;
  pixelCount: number;
  rSum: number;
  gSum: number;
  bSum: number;
}

function sampleMask(
  rgb: Buffer, mask: Buffer,
  width: number, height: number, channels: number,
): RGB[] {
  const total = width * height;
  const insideIdx: number[] = [];
  for (let i = 0; i < total; i++) if (mask[i]! > 128) insideIdx.push(i);
  if (insideIdx.length === 0) return [];
  const N = Math.min(SAMPLE_BUDGET, insideIdx.length);
  const step = insideIdx.length / N;
  const out: RGB[] = [];
  for (let k = 0; k < N; k++) {
    const px = insideIdx[Math.floor(k * step)]!;
    const base = px * channels;
    out.push({ r: rgb[base]!, g: rgb[base + 1]!, b: rgb[base + 2]! });
  }
  return out;
}

// 环形带 → per-image 皮肤 Lab 中位数
export function computeSkinRefLab(
  rgb: Buffer, ring: Buffer,
  width: number, height: number, channels: number,
): [number, number, number] | null {
  const labs: [number, number, number][] = [];
  const total = width * height;
  for (let i = 0; i < total; i++) {
    if (ring[i]! > 128) {
      const base = i * channels;
      labs.push(rgbToLab({ r: rgb[base]!, g: rgb[base + 1]!, b: rgb[base + 2]! }));
    }
  }
  if (labs.length < 40) return null;
  // 通道独立中位数（鲁棒）
  const sortBy = (k: 0 | 1 | 2) => labs.slice().sort((a, b) => a[k] - b[k]);
  const L = sortBy(0)[Math.floor(labs.length / 2)]![0];
  const A = sortBy(1)[Math.floor(labs.length / 2)]![1];
  const B = sortBy(2)[Math.floor(labs.length / 2)]![2];
  return [L, A, B];
}

function quantize(
  samples: RGB[], skinRefLab: [number, number, number] | null,
): { buckets: AnchorBucket[]; outliers: number; skinFiltered: number; usedTotal: number } {
  const buckets: AnchorBucket[] = COLOR_ANCHORS.map((a, idx) => ({
    anchorIdx: idx, family: a.family, nameZh: a.nameZh,
    pixelCount: 0, rSum: 0, gSum: 0, bSum: 0,
  }));
  let outliers = 0, skinFiltered = 0, used = 0;
  for (const s of samples) {
    if (skinRefLab) {
      const slab = rgbToLab(s);
      if (labDistance(slab, skinRefLab) < SKIN_REJECT_DELTA_E) {
        skinFiltered++;
        continue;
      }
    }
    const cls = classifyColor(s);
    if (cls.distance > ANCHOR_MAX_DIST) {
      outliers++;
      continue;
    }
    const b = buckets[cls.anchorIdx]!;
    b.pixelCount++; b.rSum += s.r; b.gSum += s.g; b.bSum += s.b;
    used++;
  }
  return { buckets, outliers, skinFiltered, usedTotal: used };
}

export function extractColorWithRing(
  rgb: Buffer, innerMask: Buffer, outerRing: Buffer,
  width: number, height: number, channels: number,
): ColorClusterResult | null {
  const samples = sampleMask(rgb, innerMask, width, height, channels);
  if (samples.length < 20) return null;

  const skinRefLab = computeSkinRefLab(rgb, outerRing, width, height, channels);
  const { buckets, outliers, skinFiltered, usedTotal } = quantize(samples, skinRefLab);
  if (usedTotal < 20) return null;

  // anchor-count-normalized family vote
  const familyAnchorCount = anchorCountByFamily();
  const familyVotes = new Map<string, number>();
  for (const b of buckets) {
    if (b.pixelCount > 0) {
      familyVotes.set(b.family, (familyVotes.get(b.family) ?? 0) + b.pixelCount);
    }
  }
  if (familyVotes.size === 0) return null;

  let winnerFamily = '';
  let bestScore = -1;
  for (const [fam, v] of familyVotes) {
    const n = familyAnchorCount.get(fam) ?? 1;
    const score = v / n;  // 等价于「平均每锚点票数」
    if (score > bestScore) { bestScore = score; winnerFamily = fam; }
  }

  const winnerBuckets = buckets
    .filter(b => b.family === winnerFamily && b.pixelCount > 0)
    .sort((a, b) => b.pixelCount - a.pixelCount);
  const primary = winnerBuckets[0]!;
  const primaryRgb: RGB = {
    r: Math.round(primary.rSum / primary.pixelCount),
    g: Math.round(primary.gSum / primary.pixelCount),
    b: Math.round(primary.bSum / primary.pixelCount),
  };

  const topBuckets = buckets
    .filter(b => b.pixelCount > 0)
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .slice(0, PALETTE_SIZE);
  const palette: RGB[] = topBuckets.map(b => ({
    r: Math.round(b.rSum / b.pixelCount),
    g: Math.round(b.gSum / b.pixelCount),
    b: Math.round(b.bSum / b.pixelCount),
  }));

  const winnerVotes = familyVotes.get(winnerFamily) ?? 0;
  const familyRatio = winnerVotes / usedTotal;
  const cleanRatio = usedTotal / (usedTotal + outliers + skinFiltered);
  const colorConfidence = +(familyRatio * cleanRatio).toFixed(3);

  // Extract secondary color
  let secondaryFamily: string | null = null;
  let maxSecVotes = 0;
  for (const [fam, v] of familyVotes) {
    if (fam === winnerFamily) continue;
    if (v > maxSecVotes) {
      maxSecVotes = v;
      secondaryFamily = fam;
    }
  }

  let secondaryColorFamily: string | null = null;
  let secondaryColorNameZh: string | null = null;
  let secondaryColorRgb: [number, number, number] | null = null;
  let secondaryColorConfidence: number | null = null;

  if (secondaryFamily && (maxSecVotes / usedTotal) >= 0.05) {
    secondaryColorFamily = secondaryFamily;
    const secBuckets = buckets
      .filter(b => b.family === secondaryFamily && b.pixelCount > 0)
      .sort((a, b) => b.pixelCount - a.pixelCount);
    if (secBuckets.length > 0) {
      const secPrimary = secBuckets[0]!;
      secondaryColorNameZh = secPrimary.nameZh;
      secondaryColorRgb = [
        Math.round(secPrimary.rSum / secPrimary.pixelCount),
        Math.round(secPrimary.gSum / secPrimary.pixelCount),
        Math.round(secPrimary.bSum / secPrimary.pixelCount),
      ];
      const secFamilyRatio = maxSecVotes / usedTotal;
      secondaryColorConfidence = +(secFamilyRatio * cleanRatio).toFixed(3);
    }
  }

  return {
    primaryColorRgb: primaryRgb,
    primaryColorFamily: winnerFamily,
    primaryColorNameZh: primary.nameZh,
    dominantPalette: palette,
    colorConfidence,
    secondaryColorFamily,
    secondaryColorNameZh,
    secondaryColorRgb,
    secondaryColorConfidence,
  };
}

export function extractColorDebug(
  rgb: Buffer, innerMask: Buffer, outerRing: Buffer,
  width: number, height: number, channels: number,
) {
  const samples = sampleMask(rgb, innerMask, width, height, channels);
  if (samples.length < 20) return null;
  const skinRefLab = computeSkinRefLab(rgb, outerRing, width, height, channels);
  const { buckets, outliers, skinFiltered, usedTotal } = quantize(samples, skinRefLab);
  const fam = new Map<string, number>();
  for (const b of buckets) if (b.pixelCount > 0) fam.set(b.family, (fam.get(b.family) ?? 0) + b.pixelCount);
  return {
    samples: samples.length, skinFiltered, outliers, usedTotal,
    skinRefLab,
    perAnchor: buckets.filter(b => b.pixelCount > 0).sort((a, b) => b.pixelCount - a.pixelCount),
    perFamily: [...fam.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// 兼容旧接口
export function extractColor(
  rgb: Buffer, mask: Buffer,
  width: number, height: number, channels: number,
): ColorClusterResult | null {
  // 无 ring 时不做皮肤过滤，回退到 v3 行为
  const samples = sampleMask(rgb, mask, width, height, channels);
  if (samples.length < 20) return null;
  const { buckets, outliers, usedTotal } = quantize(samples, null);
  if (usedTotal < 20) return null;
  const familyAnchorCount = anchorCountByFamily();
  const familyVotes = new Map<string, number>();
  for (const b of buckets) {
    if (b.pixelCount > 0) familyVotes.set(b.family, (familyVotes.get(b.family) ?? 0) + b.pixelCount);
  }
  let winnerFamily = '', bestScore = -1;
  for (const [fam, v] of familyVotes) {
    const n = familyAnchorCount.get(fam) ?? 1;
    const score = v / n;
    if (score > bestScore) { bestScore = score; winnerFamily = fam; }
  }
  const winnerBuckets = buckets.filter(b => b.family === winnerFamily && b.pixelCount > 0).sort((a, b) => b.pixelCount - a.pixelCount);
  const primary = winnerBuckets[0]!;
  const primaryRgb: RGB = {
    r: Math.round(primary.rSum / primary.pixelCount),
    g: Math.round(primary.gSum / primary.pixelCount),
    b: Math.round(primary.bSum / primary.pixelCount),
  };
  const topBuckets = buckets.filter(b => b.pixelCount > 0).sort((a, b) => b.pixelCount - a.pixelCount).slice(0, PALETTE_SIZE);
  const palette = topBuckets.map(b => ({
    r: Math.round(b.rSum / b.pixelCount),
    g: Math.round(b.gSum / b.pixelCount),
    b: Math.round(b.bSum / b.pixelCount),
  }));
  const winnerVotes = familyVotes.get(winnerFamily) ?? 0;

  // Extract secondary color
  let secondaryFamily: string | null = null;
  let maxSecVotes = 0;
  for (const [fam, v] of familyVotes) {
    if (fam === winnerFamily) continue;
    if (v > maxSecVotes) {
      maxSecVotes = v;
      secondaryFamily = fam;
    }
  }

  let secondaryColorFamily: string | null = null;
  let secondaryColorNameZh: string | null = null;
  let secondaryColorRgb: [number, number, number] | null = null;
  let secondaryColorConfidence: number | null = null;

  const cleanRatio = usedTotal / (usedTotal + outliers);
  if (secondaryFamily && (maxSecVotes / usedTotal) >= 0.05) {
    secondaryColorFamily = secondaryFamily;
    const secBuckets = buckets
      .filter(b => b.family === secondaryFamily && b.pixelCount > 0)
      .sort((a, b) => b.pixelCount - a.pixelCount);
    if (secBuckets.length > 0) {
      const secPrimary = secBuckets[0]!;
      secondaryColorNameZh = secPrimary.nameZh;
      secondaryColorRgb = [
        Math.round(secPrimary.rSum / secPrimary.pixelCount),
        Math.round(secPrimary.gSum / secPrimary.pixelCount),
        Math.round(secPrimary.bSum / secPrimary.pixelCount),
      ];
      const secFamilyRatio = maxSecVotes / usedTotal;
      secondaryColorConfidence = +(secFamilyRatio * cleanRatio).toFixed(3);
    }
  }

  return {
    primaryColorRgb: primaryRgb,
    primaryColorFamily: winnerFamily,
    primaryColorNameZh: primary.nameZh,
    dominantPalette: palette,
    colorConfidence: +(winnerVotes / (usedTotal + outliers)).toFixed(3),
    secondaryColorFamily,
    secondaryColorNameZh,
    secondaryColorRgb,
    secondaryColorConfidence,
  };
}

export { COLOR_ANCHORS };
