import type { BBox, LengthResult, LengthTag } from './types.ts';

// 当前粗阈值：bbox 长边 / 短边 ratio
// schema §6 标记为 open question，需要人工校准
const SHORT_MAX = 1.2;
const MEDIUM_MAX = 1.8;

function ratioFromBbox(bbox: BBox): number {
  const w = Math.max(1, bbox.x2 - bbox.x1);
  const h = Math.max(1, bbox.y2 - bbox.y1);
  return Math.max(w, h) / Math.min(w, h);
}

function classifyRatio(ratio: number): LengthTag {
  if (ratio < SHORT_MAX) return 'short';
  if (ratio < MEDIUM_MAX) return 'medium';
  return 'long';
}

// 一张图里有 N 颗指甲，用所有 bbox ratio 的中位数代表整体长度。
// 偶尔会有缩拍的歪指甲，中位数比 mean 鲁棒。
export function extractLength(bboxes: BBox[]): LengthResult {
  if (bboxes.length === 0) {
    return { lengthTag: 'unknown', lengthRatio: 0, lengthConfidence: 0 };
  }
  const ratios = bboxes.map(ratioFromBbox).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)]!;

  // 置信度：N 颗指甲 ratio 的相对方差越小越可靠
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length;
  const stable = Math.exp(-variance);
  const sampleScore = Math.min(1, ratios.length / 5); // 5 颗指甲达上限
  const lengthConfidence = +(stable * sampleScore).toFixed(3);

  return {
    lengthTag: classifyRatio(median),
    lengthRatio: +median.toFixed(3),
    lengthConfidence,
  };
}
