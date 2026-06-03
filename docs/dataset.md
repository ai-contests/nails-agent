# Nails-Agent · 数据集

文档版本：v1 · 2026-06-03
关联：[`PRD.md`](./PRD.md) §8 · [`data-model.md`](./data-model.md) §4

> ⚠️ **本仓库不包含任何二进制图片**。
> 仓库里的 `data/` 目录是为后续 runtime（SQLite + 用户上传图 + 试戴结果）预留的家，git 里只保留 `.gitkeep`。
> 下面描述的全套静态资产（~224MB）放在外部图床/网盘，**链接 TBD（待补充 Google Drive / GitHub Release）**。
> 也可以用 `scripts/` 里的管线自己跑一遍重生成（见末尾"复现命令"）。

## 一句话总结

本项目 v1 Demo 用到的所有静态视觉资产：50 listed 款式图、50 candidate 款式图、14 张 canonical 手模、100 张演示用试戴成品图。仅在外部存档，**不入 git**。

## 角色映射（Scheme 2 锁定）

| 资产 | 数量 | 在 v1 Demo 里的角色 | `nail_styles` 写入 |
|---|---|---|---|
| `enhanced_style_01..50.png` | 50 | **主 50 styles 的 `enhanced_image_url`**，初始 `listed`、`source_type=internal_seed` | ✅ seed_db.py 写入 |
| Pinterest 50 张原图（`nail_refs.csv` 列出来源路径） | 50 | **候选池 50 styles 的 `image_url`**，初始 `candidate`、`source_type=null` | ✅ seed_db.py 写入 |
| 14 张 canonical 手模 | 14 | runtime 不直接用，仅作演示资产 / 文档插图 / 用户上传手图的样例 | ❌ |
| 100 张 `canon_*.png` 演示试戴图 | 100 | landing page / B 端 demo 中展示「我们的试戴可以达到这个质量」 | ❌ |
| `batch_contact_sheet.jpg` | 1 | 100 张试戴的总览图 | ❌ |
| 历史迭代图（candidates / rerolls / _smoke） | ~12 | 仅留作迭代过程参考，外链 archive 里 | ❌ |

> 上面这些资产的具体目录布局由 `scripts/` 里各脚本决定，外链下载后按 `scripts/` 期望的路径放好即可。

## 生成管线

```
canonical hand (image 1) ─┐
                          ├─► Nano Banana 2 (Gemini 3.1 Flash Image)  ─► tryon output (square, ~1024)
nail design ref (image 2) ─┘    via ComfyCloud REST API
```

- **模型**：`Nano Banana 2 (Gemini 3.1 Flash Image)` 通过 ComfyCloud 的 `GeminiImage2Node` 调用。
- **prompt 策略**（`workflow.PROMPT_WITH_HAND`）：image 1 是 canonical 手模、严格保留姿势与背景；image 2 只取美甲设计（颜色 / 图案 / 工艺 / 装饰），其手与背景忽略。
- **workflow**：`LoadImage × 2 → ImageBatch → GeminiImage2Node → SaveImage`。
- **batch runner**：[`scripts/batch_tryon.py`](../scripts/batch_tryon.py) — 6 并发 worker、手模上传缓存、可恢复、502/503 重试。

## 手模池（14 张）

5 个姿势 × 3 个肤色 − 1 个废弃 slot：

| pose                 | fair | medium       | deep |
|----------------------|:----:|:------------:|:----:|
| `palm_down_top`      |  ✓   |  ✓           |  ✓   |
| `fist_thumb_up`      |  ✓   |  ✓           |  ✓   |
| `two_hands_clasped`  |  ✓   |  — (dropped) |  ✓   |
| `reaching_down`      |  ✓   |  ✓           |  ✓   |
| `fingers_cupped`     |  ✓   |  ✓           |  ✓   |

背景：在 `offwhite / softblue / softpink / softbeige` 四档之间确定性轮换（参考 Cocomo / Slllight 风），不用纯 #FFFFFF。

废弃：`side_elegant` 全行（指甲被侧拍遮住）；`two_hands_clasped/medium` 这一格（3 个 reroll 都跑成 prayer 姿势，nails 不可见）。

## 100 张演示图的设计参考来源

| 来源 | 数量 | 注释 |
|---|---|---|
| `data/styles/enhanced_style_*.png` | 50 | 已有的 50 张 catalog 摄影（cream / chrome / 花朵 / 闪粉 / 蓝 / lilac 等） |
| Pinterest 自动挑选池 | 50 | 从 140 张原图自动选出，dhash 去重（hamming > 4），日韩美甲均衡 |

Pinterest 选择脚本：[`scripts/select_nails.py`](../scripts/select_nails.py) → 输出 [`data/nail_refs.csv`](./nail_refs.csv)。

## 100 张配对分布

[`scripts/build_pairs.py`](../scripts/build_pairs.py) 把 50 enhanced + 50 Pinterest 交错排列，对 14 个手模做 round-robin：

```
palm_down_top  fair/medium/deep: 7-8 each
fist_thumb_up  fair/medium/deep: 7 each
two_hands_clasped fair/deep:     7 each
reaching_down  fair/medium/deep: 7 each
fingers_cupped fair/medium/deep: 7 each
                                 total = 100
```

## 复现命令

```bash
# 1. 重新生成 14 手模池（如果池被删了）
python3 scripts/gen_hand_pool.py

# 2. 重新从 140 Pinterest 选 50 nail refs
python3 scripts/select_nails.py

# 3. 重新构造 100 配对
python3 scripts/build_pairs.py

# 4. 跑批量（已可恢复）
python3 scripts/batch_tryon.py --workers 6

# 5. 出总览
python3 scripts/batch_sheet.py
```

需要项目根目录的 `.env` 写好 `COMFYCLOUD_API_KEY`（参考 `.env.example`）。

## 结果

- 100/100 张生成成功（0 失败、0 超出 transient 502/503 的重试需要）
- 美学：Cocomo / Slllight K-beauty catalog 质感 — pastel 背景、柔光、单品图
- 试戴忠实度：颜色 / 图案 / 装饰可靠迁移；长 stiletto 原设计会自动适配 canonical 短自然甲（这是 feature 而非 bug，跟「短甲 catalog」定位一致）
