# @nails-agent/extraction

把 50 enhanced + 50 Pinterest 共 100 张美甲图过一遍 Roboflow 分割 → 输出
`data/extraction/manifest.json`，作为 `nail_styles` + `nail_visual_features`
两张表的数据源。

## 输出字段（每条对齐 data-model §4.1 / §4.2）

```jsonc
{
  "style_id": "STYLE001",
  "source": "enhanced",                   // 或 "candidate"
  "image_path": "...",
  "image_width": 1024,
  "image_height": 1024,
  "nail_count": 5,                        // Roboflow 检出的指甲数
  "bboxes": [{"x1":..,"y1":..,"x2":..,"y2":..}, ...],
  "primary_color_family": "pink",         // → nail_visual_features.primary_color_family
  "primary_color_name": "粉色",            // → nail_visual_features.primary_color_name
  "primary_color_rgb": [240, 170, 180],   // → nail_visual_features.primary_color_rgb
  "dominant_palette": [[r,g,b], ...],     // top-K cluster centers
  "color_confidence": 0.78,
  "length_tag": "medium",                 // short | medium | long
  "length_ratio": 1.45,                   // bbox h/w 中位数
  "length_confidence": 0.7,
  "extractor_version": "roboflow_seg_v3+kmeans_v1+aspect_v1",
  "extracted_at": "2026-06-03T..."
}
```

## 算法

1. **分割**：Roboflow hosted `fingernail-segmentation-yy1l7/3`，REST 调用，
   返回 polygon points + confidence。
2. **mask**：所有 polygon 用 SVG 合成一张单通道 mask（白=指甲、黑=非指甲），
   交给 sharp 光栅化。
3. **颜色**：mask 内随机采样 1000 像素 → k-means k=5（k-means++ 初始化）→
   最大簇的 centroid 作 primary color → CIE76 Lab 距离映射到 12 个 anchor
   color family（见 `src/colorFamilyMap.ts`，含中文名）。
4. **长度**：每颗指甲 bbox 的 `max(w,h)/min(w,h)` ratio，取中位数 → 阈值
   分桶 `<1.2 short / 1.2-1.8 medium / >1.8 long`。

> ⚠️ 长度阈值是粗起手值（schema §6 标记为 open question），后续需要
> 人工标一批样本校准。

## 跑法

```bash
cd tools/extraction
npm install
cp ../../.env.example ../../.env   # 仓库根 .env，填 ROBOFLOW_API_KEY
npm run extract                    # 全量 100 张
npm run extract -- --only=enhanced # 只跑 50 enhanced
npm run extract -- --max=3         # 只跑前 3 张（dry run）
npm run extract -- --no-resume     # 不读取已有 manifest，重头来
```

## 中间产物

- `data/extraction/manifest.json` — 最终输出
- `data/extraction/raw/STYLE###.roboflow.json` — Roboflow 原始返回，
  方便后续不重打 API 调阈值

## 失败重试

- 单图失败（Roboflow 5xx / 检出 0 颗 / mask 空）不会中断整批，写
  `[warn]` / `[err]` 日志后跳过。
- 每 5 张做一次中间落盘 manifest，断网后 `npm run extract` 续跑。

## 环境变量

仓库根 `.env`：

```
ROBOFLOW_API_KEY=xxx
ROBOFLOW_MODEL_ID=fingernail-segmentation-yy1l7/3   # 默认
ROBOFLOW_CONFIDENCE=0.5                              # 默认
```
