import sharp from 'sharp';
import type { BBox, RoboflowPrediction } from './types.ts';

export interface MaskBundle {
  innerMask: Buffer;     // 蚀刻后只剩指甲中心，安全采样区
  outerRing: Buffer;     // 紧贴 polygon 外侧的环形带，per-image 皮肤参考
  width: number;
  height: number;
  innerErodePx: number;
}

// ---------- chamfer 8-邻 signed distance transform ----------
// 输出 Float32：mask 内为正（到边界的距离），mask 外为负
function chamferDT(binMask: Buffer, w: number, h: number): Float32Array {
  const INF = 1e9;
  const din = new Float32Array(w * h);
  const dout = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const inside = binMask[i]! > 128;
    din[i] = inside ? INF : 0;
    dout[i] = inside ? 0 : INF;
  }
  const D1 = 1, D2 = Math.SQRT2;
  const pass = (d: Float32Array) => {
    // forward
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i]!;
      if (y > 0)             v = Math.min(v, d[i - w]! + D1);
      if (x > 0)             v = Math.min(v, d[i - 1]! + D1);
      if (y > 0 && x > 0)    v = Math.min(v, d[i - w - 1]! + D2);
      if (y > 0 && x < w - 1)v = Math.min(v, d[i - w + 1]! + D2);
      d[i] = v;
    }
    // backward
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i]!;
      if (y < h - 1)              v = Math.min(v, d[i + w]! + D1);
      if (x < w - 1)              v = Math.min(v, d[i + 1]! + D1);
      if (y < h - 1 && x < w - 1) v = Math.min(v, d[i + w + 1]! + D2);
      if (y < h - 1 && x > 0)     v = Math.min(v, d[i + w - 1]! + D2);
      d[i] = v;
    }
  };
  pass(din);
  pass(dout);
  const signed = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    signed[i] = binMask[i]! > 128 ? din[i]! : -dout[i]!;
  }
  return signed;
}

export async function buildMaskBundle(
  _imagePath: string,
  predictions: RoboflowPrediction[],
  imageWidth: number,
  imageHeight: number,
): Promise<MaskBundle> {
  // Roboflow polygon 系统性外扩 5-15px。
  // innerErode 比 short axis 自适应缩进；outer ring 5-18px 接住皮肤参考。
  // 各向同性距离变换，比 blur+threshold 准。
  const polygons = predictions
    .map(p => p.points.map(pt => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' '))
    .filter(pts => pts.length > 0);
  const svgPolys = polygons.map(pts => `<polygon points="${pts}" fill="white" />`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}"><rect width="${imageWidth}" height="${imageHeight}" fill="black"/>${svgPolys}</svg>`;

  const binMask = await sharp(Buffer.from(svg))
    .resize(imageWidth, imageHeight, { fit: 'fill' })
    .greyscale()
    .threshold(128)
    .raw()
    .toBuffer();

  const dt = chamferDT(binMask, imageWidth, imageHeight);

  // 自适应 erode：取 bboxes 短轴中位数 × 0.18，保底 8 px
  const shortAxes = predictions.map(p => {
    const xs = p.points.map(pt => pt.x);
    const ys = p.points.map(pt => pt.y);
    return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }).sort((a, b) => a - b);
  const medShort = shortAxes[Math.floor(shortAxes.length / 2)] ?? 30;
  const innerErodePx = Math.max(8, Math.floor(medShort * 0.18));
  const RING_INNER = 5;
  const RING_OUTER = 18;

  const innerMask = Buffer.alloc(imageWidth * imageHeight);
  const outerRing = Buffer.alloc(imageWidth * imageHeight);
  for (let i = 0; i < dt.length; i++) {
    const d = dt[i]!;
    if (d > innerErodePx) innerMask[i] = 255;
    if (d < -RING_INNER && d > -RING_OUTER) outerRing[i] = 255;
  }

  return { innerMask, outerRing, width: imageWidth, height: imageHeight, innerErodePx };
}

// ---------- 兼容旧接口 ----------
export async function buildCombinedMask(
  imagePath: string,
  predictions: RoboflowPrediction[],
  imageWidth: number,
  imageHeight: number,
): Promise<Buffer> {
  const b = await buildMaskBundle(imagePath, predictions, imageWidth, imageHeight);
  return b.innerMask;
}

export function bboxFromPoints(points: { x: number; y: number }[]): BBox {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of points) {
    if (p.x < x1) x1 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.x > x2) x2 = p.x;
    if (p.y > y2) y2 = p.y;
  }
  return {
    x1: Math.floor(x1),
    y1: Math.floor(y1),
    x2: Math.ceil(x2),
    y2: Math.ceil(y2),
  };
}

export async function readRGB(imagePath: string): Promise<{
  buf: Buffer;
  width: number;
  height: number;
  channels: number;
}> {
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { buf: data, width: info.width, height: info.height, channels: info.channels };
}
