import type { RGB } from './types.ts';

interface ColorAnchor {
  family: string;
  nameZh: string;
  rgb: RGB;
}

// v5：精简 anchor 字典 + 拉开与皮肤色簇的距离
// - 删 peach 浅 anchor（235,200,175）—— 纯肤色
// - beige 只留 1 个偏冷偏黄（240,228,210）
// - tan 整体往更红更暗挪（160,115,85 / 130,90,70）
// - 多个红/粉/蓝/绿 anchor 增加多样色 family 表达力
export const COLOR_ANCHORS: ColorAnchor[] = [
  // 浅米/奶 —— 偏冷偏黄，避开肤色
  { family: 'beige',      nameZh: '米白',   rgb: { r: 240, g: 228, b: 210 } },
  { family: 'cream',      nameZh: '奶白',   rgb: { r: 235, g: 220, b: 195 } },

  // 桃 —— 偏暖、低饱和
  { family: 'peach',      nameZh: '蜜桃',   rgb: { r: 235, g: 175, b: 145 } },   // 比皮肤更暖更饱和
  { family: 'apricot',    nameZh: '杏色',   rgb: { r: 240, g: 190, b: 160 } },

  // 棕褐 / 焦糖 —— 真深棕，跟肤色拉开
  { family: 'tan',        nameZh: '焦糖',   rgb: { r: 160, g: 115, b:  85 } },
  { family: 'tan',        nameZh: '深焦糖', rgb: { r: 130, g:  90, b:  70 } },

  // 灰粉 / 玫粉
  { family: 'dusty_rose', nameZh: '灰粉',   rgb: { r: 195, g: 145, b: 140 } },
  { family: 'mauve',      nameZh: '玫粉',   rgb: { r: 180, g: 125, b: 125 } },

  // 棕 / 深棕
  { family: 'brown',      nameZh: '棕色',   rgb: { r: 110, g:  65, b:  40 } },
  { family: 'brown',      nameZh: '深棕',   rgb: { r:  75, g:  45, b:  30 } },

  // 粉 / 红 系
  { family: 'pink',       nameZh: '亮粉',   rgb: { r: 240, g: 170, b: 180 } },
  { family: 'pink',       nameZh: '中粉',   rgb: { r: 215, g: 135, b: 155 } },
  { family: 'red_pink',   nameZh: '玫红',   rgb: { r: 200, g:  85, b: 115 } },
  { family: 'hot_pink',   nameZh: '桃红',   rgb: { r: 225, g:  90, b: 165 } },
  { family: 'coral',      nameZh: '珊瑚红', rgb: { r: 230, g: 110, b:  95 } },
  { family: 'red',        nameZh: '正红',   rgb: { r: 195, g:  35, b:  45 } },
  { family: 'red_dark',   nameZh: '酒红',   rgb: { r: 110, g:  25, b:  35 } },
  { family: 'plum',       nameZh: '梅子色', rgb: { r: 140, g:  50, b:  80 } },

  // 中性
  { family: 'white',      nameZh: '白色',   rgb: { r: 245, g: 245, b: 245 } },
  { family: 'gray',       nameZh: '灰色',   rgb: { r: 150, g: 150, b: 155 } },
  { family: 'black',      nameZh: '黑色',   rgb: { r:  30, g:  30, b:  30 } },

  // 绿 系
  { family: 'olive',      nameZh: '橄榄绿', rgb: { r: 100, g:  85, b:  35 } },
  { family: 'khaki',      nameZh: '卡其',   rgb: { r: 165, g: 150, b:  90 } },
  { family: 'dark_green', nameZh: '墨绿',   rgb: { r:  45, g:  75, b:  50 } },
  { family: 'green',      nameZh: '绿色',   rgb: { r:  80, g: 160, b:  95 } },
  { family: 'mint',       nameZh: '薄荷绿', rgb: { r: 175, g: 220, b: 200 } },
  { family: 'emerald',    nameZh: '祖母绿', rgb: { r:  30, g:  95, b:  75 } },

  // 蓝 / 紫
  { family: 'blue',       nameZh: '蓝色',   rgb: { r:  70, g: 110, b: 180 } },
  { family: 'sky_blue',   nameZh: '天蓝',   rgb: { r: 130, g: 180, b: 220 } },
  { family: 'light_blue', nameZh: '浅蓝',   rgb: { r: 180, g: 210, b: 230 } },
  { family: 'turquoise',  nameZh: '蒂芙尼蓝', rgb: { r: 130, g: 200, b: 195 } },
  { family: 'navy',       nameZh: '藏蓝',   rgb: { r:  35, g:  45, b:  75 } },
  { family: 'purple',     nameZh: '紫色',   rgb: { r: 130, g:  90, b: 170 } },
  { family: 'lavender',   nameZh: '薰衣草', rgb: { r: 200, g: 180, b: 220 } },
  { family: 'lilac',      nameZh: '丁香紫', rgb: { r: 210, g: 190, b: 230 } },

  // 黄 / 金属
  { family: 'yellow',     nameZh: '黄色',   rgb: { r: 240, g: 210, b: 100 } },
  { family: 'lemon',      nameZh: '柠檬黄', rgb: { r: 245, g: 230, b: 140 } },
  { family: 'gold',       nameZh: '金色',   rgb: { r: 205, g: 170, b:  90 } },
  { family: 'champagne',  nameZh: '香槟金', rgb: { r: 225, g: 200, b: 175 } },
  { family: 'rose_gold',  nameZh: '玫瑰金', rgb: { r: 210, g: 165, b: 150 } },
  { family: 'silver',     nameZh: '银色',   rgb: { r: 200, g: 205, b: 215 } },
];

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function rgbToLab(rgb: RGB): [number, number, number] {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labDistance(a: [number, number, number], b: [number, number, number]): number {
  const L1 = a[0], a1 = a[1], b1 = a[2];
  const L2 = b[0], a2 = b[1], b2 = b[2];

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);

  const C_bar = (C1 + C2) / 2;

  const C_bar7 = Math.pow(C_bar, 7);
  const G = 0.5 * (1 - Math.sqrt(C_bar7 / (C_bar7 + Math.pow(25, 7))));

  const a1_prime = (1 + G) * a1;
  const a2_prime = (1 + G) * a2;

  const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
  const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);

  const C_bar_prime = (C1_prime + C2_prime) / 2;

  const rad2deg = 180 / Math.PI;
  const deg2rad = Math.PI / 180;

  let h1_prime = Math.atan2(b1, a1_prime) * rad2deg;
  if (h1_prime < 0) h1_prime += 360;

  let h2_prime = Math.atan2(b2, a2_prime) * rad2deg;
  if (h2_prime < 0) h2_prime += 360;

  let delta_h_prime = h2_prime - h1_prime;
  if (Math.abs(delta_h_prime) > 180) {
    if (h2_prime <= h1_prime) {
      delta_h_prime += 360;
    } else {
      delta_h_prime -= 360;
    }
  }

  const delta_L_prime = L2 - L1;
  const delta_C_prime = C2_prime - C1_prime;
  const delta_H_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin((delta_h_prime / 2) * deg2rad);

  let H_bar_prime = (h1_prime + h2_prime) / 2;
  if (Math.abs(h1_prime - h2_prime) > 180) {
    if (h1_prime + h2_prime < 360) {
      H_bar_prime += 180;
    } else {
      H_bar_prime -= 180;
    }
  }

  const T = 1 - 0.17 * Math.cos((H_bar_prime - 30) * deg2rad)
              + 0.24 * Math.cos((2 * H_bar_prime) * deg2rad)
              + 0.32 * Math.cos((3 * H_bar_prime + 6) * deg2rad)
              - 0.20 * Math.cos((4 * H_bar_prime - 63) * deg2rad);

  const delta_theta = 30 * Math.exp(-Math.pow((H_bar_prime - 275) / 25, 2));

  const R_C = 2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7)));

  const L_bar = (L1 + L2) / 2;
  const L_bar_minus_50_sq = Math.pow(L_bar - 50, 2);
  const S_L = 1 + (0.015 * L_bar_minus_50_sq) / Math.sqrt(20 + L_bar_minus_50_sq);

  const S_C = 1 + 0.045 * C_bar_prime;
  const S_H = 1 + 0.015 * C_bar_prime * T;

  const R_T = -Math.sin(2 * delta_theta * deg2rad) * R_C;

  const dE00 = Math.sqrt(
    Math.pow(delta_L_prime / (kL * S_L), 2) +
    Math.pow(delta_C_prime / (kC * S_C), 2) +
    Math.pow(delta_H_prime / (kH * S_H), 2) +
    R_T * (delta_C_prime / (kC * S_C)) * (delta_H_prime / (kH * S_H))
  );

  return dE00;
}

const ANCHOR_LABS = COLOR_ANCHORS.map(a => rgbToLab(a.rgb));

export function classifyColor(rgb: RGB): { family: string; nameZh: string; distance: number; anchorIdx: number } {
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
  const a = COLOR_ANCHORS[bestIdx]!;
  return { family: a.family, nameZh: a.nameZh, distance: bestDist, anchorIdx: bestIdx };
}

export function anchorCountByFamily(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of COLOR_ANCHORS) m.set(a.family, (m.get(a.family) ?? 0) + 1);
  return m;
}
