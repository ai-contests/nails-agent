import type { RGB } from './types.ts';

interface ColorAnchor {
  family: string;
  nameZh: string;
  rgb: RGB;
}

// 12 个 color family anchors，覆盖美甲常见色域。
// 取值优先匹配款式 catalog 里高频出现的颜色，不是通用色卡。
// 后续如发现某些常见色（如荧光、金属）被误归类，在这里补 anchor。
export const COLOR_ANCHORS: ColorAnchor[] = [
  { family: 'nude',   nameZh: '裸色',   rgb: { r: 222, g: 184, b: 160 } },
  { family: 'pink',   nameZh: '粉色',   rgb: { r: 240, g: 170, b: 180 } },
  { family: 'red',    nameZh: '红色',   rgb: { r: 180, g: 40,  b: 50  } },
  { family: 'brown',  nameZh: '棕色',   rgb: { r: 110, g: 65,  b: 40  } },
  { family: 'beige',  nameZh: '米白',   rgb: { r: 235, g: 220, b: 200 } },
  { family: 'white',  nameZh: '白色',   rgb: { r: 245, g: 245, b: 245 } },
  { family: 'black',  nameZh: '黑色',   rgb: { r: 30,  g: 30,  b: 30  } },
  { family: 'gray',   nameZh: '灰色',   rgb: { r: 150, g: 150, b: 155 } },
  { family: 'purple', nameZh: '紫色',   rgb: { r: 130, g: 90,  b: 170 } },
  { family: 'blue',   nameZh: '蓝色',   rgb: { r: 70,  g: 110, b: 180 } },
  { family: 'green',  nameZh: '绿色',   rgb: { r: 90,  g: 150, b: 100 } },
  { family: 'yellow', nameZh: '黄色',   rgb: { r: 240, g: 210, b: 100 } },
];

// sRGB → linear → XYZ → Lab。CIEDE2000 太重，用 CIE76 Δ*ab 就够给一个 family。
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToLab(rgb: RGB): [number, number, number] {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // sRGB D65
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDistance(a: [number, number, number], b: [number, number, number]): number {
  const dL = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

const ANCHOR_LABS = COLOR_ANCHORS.map(a => rgbToLab(a.rgb));

export function classifyColor(rgb: RGB): { family: string; nameZh: string; distance: number } {
  const lab = rgbToLab(rgb);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ANCHOR_LABS.length; i++) {
    const d = labDistance(lab, ANCHOR_LABS[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  const anchor = COLOR_ANCHORS[bestIdx]!;
  return { family: anchor.family, nameZh: anchor.nameZh, distance: bestDist };
}
