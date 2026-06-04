import type { BBox, LengthResult, LengthTag, RoboflowPoint } from './types.ts';

// 基于 polygon PCA 的长短轴比，跟拍摄方向无关。
// 阈值（v2 数据驱动）：跑过 100 张 tryon 实测 ratio 分布后定的分位点。
//   < 1.50  → short   (指甲天然 h/w 1.3-1.4 也算短；STYLE001 实测 1.43)
//   1.50-1.75 → medium
//   > 1.75  → long    (明显竖长指甲 / stiletto / coffin)
// 100 张实测分布 ≈ short 22 / medium 45 / long 33。
const SHORT_MAX = 1.50;
const MEDIUM_MAX = 1.75;


// 协方差矩阵 + 解析特征值（2x2 对称矩阵）
function polygonAxisRatio(points: RoboflowPoint[]): number {
  const n = points.length;
  if (n < 3) return 1;

  let mx = 0, my = 0;
  for (const p of points) { mx += p.x; my += p.y; }
  mx /= n; my /= n;

  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
  }
  cxx /= n; cyy /= n; cxy /= n;

  // 2x2 对称矩阵 [[cxx, cxy], [cxy, cyy]] 的特征值
  const tr = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.max(0, tr * tr / 4 - det);
  const root = Math.sqrt(disc);
  const lam1 = tr / 2 + root;
  const lam2 = tr / 2 - root;
  if (lam2 <= 1e-6) return 1;
  // sqrt(主特征值 / 次特征值) ≈ 长轴标准差 / 短轴标准差
  return Math.sqrt(lam1 / lam2);
}

function classifyRatio(ratio: number): LengthTag {
  if (ratio < SHORT_MAX) return 'short';
  if (ratio < MEDIUM_MAX) return 'medium';
  return 'long';
}

export function extractLength(
  bboxes: BBox[],
  polygons?: RoboflowPoint[][],
): LengthResult {
  if (bboxes.length === 0) {
    return { lengthTag: 'unknown', lengthRatio: 0, lengthConfidence: 0 };
  }

  // 优先 PCA；缺 polygon 时回退到 bbox max/min ratio（保留兼容性）
  const ratios: number[] = [];
  if (polygons && polygons.length === bboxes.length) {
    for (const poly of polygons) {
      ratios.push(polygonAxisRatio(poly));
    }
  } else {
    for (const b of bboxes) {
      const w = Math.max(1, b.x2 - b.x1);
      const h = Math.max(1, b.y2 - b.y1);
      ratios.push(Math.max(w, h) / Math.min(w, h));
    }
  }

  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)]!;

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length;
  const stable = Math.exp(-variance);
  const sampleScore = Math.min(1, ratios.length / 5);
  const lengthConfidence = +(stable * sampleScore).toFixed(3);

  return {
    lengthTag: classifyRatio(median),
    lengthRatio: +median.toFixed(3),
    lengthConfidence,
  };
}
