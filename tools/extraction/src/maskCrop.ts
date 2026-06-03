import sharp from 'sharp';
import type { BBox, RoboflowPrediction } from './types.ts';

// 把一张图 + 一组 polygon predictions → 单通道 mask buffer (W*H raw, 1 byte/pixel)
// mask 内 = 255（属于任意一颗指甲），mask 外 = 0
export async function buildCombinedMask(
  imagePath: string,
  predictions: RoboflowPrediction[],
  imageWidth: number,
  imageHeight: number,
): Promise<Buffer> {
  const polygons = predictions
    .map(p =>
      p.points
        .map(pt => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
        .join(' '),
    )
    .filter(pts => pts.length > 0);

  const svgPolys = polygons
    .map(pts => `<polygon points="${pts}" fill="white" />`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}"><rect width="${imageWidth}" height="${imageHeight}" fill="black"/>${svgPolys}</svg>`;

  // SVG rasterize → raw single-channel mask.
  // sharp 默认会保留 alpha；显式拍成灰度 raw 之后下游好处理。
  const maskRaw = await sharp(Buffer.from(svg))
    .resize(imageWidth, imageHeight, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  return maskRaw;
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
  // 强制 3 通道 RGB raw（去 alpha，避免下游索引错位）
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { buf: data, width: info.width, height: info.height, channels: info.channels };
}
