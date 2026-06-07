# C 端视频素材包

文档版本：v1  
目标：把项目的 C 端链路压缩成可直接交给视频生成 Agent 的说明和素材索引。

## 这条链路讲什么

这套 C 端流程只讲三件事：
1. 用户上传一张手图，系统先识别手型和肤色。
2. 系统再把单款美甲图做特征提取，得到颜色、长度、主辅色和轮廓信息。
3. 最后把手图和美甲图送进试戴工作流，生成可直接展示的虚拟试戴结果。

## 逻辑摘要

### 1) 手型识别

代码入口是 [src/services/handCV.ts](../../src/services/handCV.ts) 和 [src/services/hand_analysis_cli.py](../../src/services/hand_analysis_cli.py)。

核心逻辑：
- TS 服务通过 Python CLI 调用外部手部分析器。
- 外部分析器返回 `hand_shape`、`skin_tone`、`confidence`、`median_rgb` 和原始几何指标。
- 如果 Python 环节失败，或者结果是 `unknown`，TS 会走确定性 fallback。
- fallback 不是随机，而是根据 `imagePath` 的字符串 hash 固定映射出手型、肤色和 RGB，确保演示稳定。

输出重点：
- `handShape`: `slender_long` / `short_wide` / `square_palm` / `narrow_palm` / `unknown`
- `skinTone`: `cool_fair` / `warm_fair` / `natural` / `warm_yellow` / `wheat` / `deep` / `unknown`
- `rawMetrics`: 保留是否 mocked、imagePath、错误信息和外部结果摘要

### 2) 美甲提取

代码入口是 [tools/extraction/src/extractAll.ts](../../tools/extraction/src/extractAll.ts)。

核心逻辑：
- 用 Roboflow segmentation 先把每张美甲图的指甲 polygon 找出来。
- 用 [maskCrop.ts](../../tools/extraction/src/maskCrop.ts) 生成两个区域：
  - `innerMask`: 指甲中心安全采样区
  - `outerRing`: 指甲边缘外侧很薄的一圈皮肤参考区
- 用 [colorExtractor.ts](../../tools/extraction/src/colorExtractor.ts) 做颜色量化：
  - 先过滤掉接近皮肤的像素，避免肤色泄漏
  - 再按色相锚点聚类，算主色、辅色、色板和置信度
- 用 [lengthExtractor.ts](../../tools/extraction/src/lengthExtractor.ts) 做长度分类：
  - 优先基于 polygon PCA 的长短轴比
  - 再把结果分成 `short` / `medium` / `long`

输出重点：
- 主色 family + 中文名 + RGB
- 辅色 family + 中文名 + RGB
- 长度标签 `length_tag`
- `dominant_palette`
- `color_confidence` 和 `length_confidence`

### 3) 虚拟试戴

代码入口是 [src/services/comfycloud.ts](../../src/services/comfycloud.ts)。

当前运行逻辑：
- 上传手图和美甲参考图到 ComfyCloud。
- 构造 `LoadImage × 2 -> ImageBatch -> GeminiImage2Node -> SaveImage` 的工作流。
- 通过 `PROMPT_WITH_HAND` 强约束：
  - IMAGE 1 必须 100% 保留手型、姿势、肤色、构图和背景
  - IMAGE 2 只允许贡献美甲设计，不允许把第二张图的手和背景带进来
- 轮询任务状态，完成后下载结果图落盘。

当前仓库里还有一个更完整的 FLUX 2 Klein 参考工作流：[`public/nail_tryon_klein_9b.json`](../../public/nail_tryon_klein_9b.json)。
- 它体现的是更底层的试戴图纸结构：`UNETLoader`、`Flux2Scheduler`、`NAGuidance`、`CFGZeroStar`、`ReferenceLatent`、`KSampler` 等。
- 这个 JSON 更适合作为“工作流解释素材”。
- 真正对外的试戴封装，当前是 `comfycloud.ts` 里的 Nano Banana 2 路径。

## 给视频 Agent 的一句话指令

把这条 C 端链路拍成“三段式”：
1. 先是手部识别，展示系统真的看懂了手。
2. 再是美甲特征提取，展示系统真的懂款式。
3. 最后是虚拟试戴生成，展示系统真的把款式戴到手上。

画面风格要求：
- 真实、干净、偏产品演示，不要做成概念海报。
- 手部必须是真实照片质感，不要卡通化。
- 试戴前后对比要一眼看懂。
- 不要多余的手、不要多余的指甲、不要把 UI 卡片做得像广告页。

## 可直接复用的素材

### 现成页面与结果图

- [首页对比滑杆](../../frame_10.png)
- [试戴加载弹窗](../../frame_60.png)
- [试戴结果弹窗](../../frame_90.png)
- [样式详情页](../../frame_98.png)
- [放大后的样式页局部](../../frame_105.png)

### 试戴和提取证据图

- [手图 vs 美甲图对照](../../public/images/tryon_v2/compare_sheet.jpg)
- [批量试戴总览](../../public/images/tryon_v2/batch_contact_sheet.jpg)
- [背景清洗前后对照](../../public/images/tryon_v2/bgwash_03_compare.jpg)
- [单款美甲原图示例](../../public/images/tryon_v2/white_nails_85c5f2cafb.png)

### 手图样例

- `data/seed_hands/hands_*.jpg`

推荐优先挑：
- 轮廓清楚的单手正面图
- 手指伸展但不夸张的姿态
- 背景尽量干净

## 视频结构建议

### Scene 1 - 手型识别

画面：
- 用户上传手图
- 左侧显示原图
- 右侧叠加手型、肤色、置信度和关键点

字幕重点：
- “系统先识别手型和肤色，再决定后面的试戴策略”

### Scene 2 - 美甲提取

画面：
- 展示单款美甲图
- 叠出指甲区域 mask
- 显示主色、辅色和长度标签

字幕重点：
- “不是只看图好不好看，而是把款式拆成可计算的特征”

### Scene 3 - 试戴工作流

画面：
- 展示 FLUX 2 Klein 工作流图纸
- 用箭头串起 LoadImage、ImageBatch、ReferenceLatent、Sampler、SaveImage
- 再切到 Nano Banana 2 的 ComfyCloud 执行界面

字幕重点：
- “手图保真，款式迁移，最后生成可展示的虚拟试戴结果”

### Scene 4 - 试戴结果

画面：
- 试戴加载弹窗
- 完成后切到 before / after 对比
- 再补一张相似手型推荐卡片

字幕重点：
- “用户能立刻看见上手效果，也能顺手看到相似手型的人在选什么”

## 生成时的硬约束

- 只允许出现一只主手，除非场景明确展示双手。
- 指甲设计必须和参考图一致，不能自由发挥成别的款式。
- 背景要保持产品级干净，不要做成杂志风拼贴。
- 文字尽量短，给画面让路。
- 如果要做动效，用滑杆、扫描线、加载环、卡片切换这几类最直接的方式。
