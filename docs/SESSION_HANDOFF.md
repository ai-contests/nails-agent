# Session Handoff · 2026-06-04

> 给下一个 session 用：这个 session 做了什么、Antigravity 在后台跑什么、本地哪些状态、起手该做什么。
> 上一个 session context 已经吃满，转交。

---

## 本 session 做了什么（按时间顺序）

### 阶段 1：仓库初始化（已 push）
- `ai-contests/nails-agent` 第一份 main 推完（SSH 通过）
- `docs/` 6 篇文档齐：PRD / system-flow / data-model / confirmed-flow / open-questions / dataset / design-diagrams
- 后来又加了 **`docs/agent_operation_cycle_v1.md`**（13 个 Agent 工具协议，下个 session 重点参考）

### 阶段 2：技术栈锁定 + 老代码清理（已 push）
- 锁定 **Next.js 14 + TypeScript + LangGraph.js + Drizzle + SQLite**（PRD §9）
- 替换之前 FastAPI/React 建议
- `scripts/`（Python 工具集）加入 .gitignore；`extract_nails.py` / `nail_extractor.py` 同
- 数据资产 ~289MB rsync 到 `nails-agent/data/`（gitignored）

### 阶段 3：TS 提取工具 v1（已 push）
- `tools/extraction/` 独立 npm + tsx + sharp
- Roboflow `fingernail-segmentation-yy1l7/3` REST 调用
- 第一版用 catalog 图（50 enhanced + 50 Pinterest）

### 阶段 4：DB scaffold + 一键启动（已 push）
- `db/` 独立 npm + Drizzle + better-sqlite3
- `src/schema/` 17 张表对齐 `data-model.md` §4-§8
- `npm run db:setup` = reset → drizzle-kit push → seed → check
- 根 `package.json` workspaces 串两个子项目

### 阶段 5：迭代修 color/length extractor（**本地 commit 未 push**）
经历 v1 → v5 五代修复：

| 版本 | 关键修复 |
|---|---|
| v1 | k-means k=5 + Lab 最近邻 |
| v2 | 切数据源到 tryon_v2/canon_*.png（pairs.csv 映射 STYLE001-100） |
| v3 | k-means 随机 → anchor 量化 + family vote（确定性）；拆 nude 加 dusty_rose/tan/mauve/peach |
| v4 | 去掉 nude family（"皮肤色 = 无信息" 用户洞察） |
| **v5** | **chamfer signed distance transform** 自适应 erode + **per-image skin reference**（outer ring 5-18px Lab 中位数 → ΔE<15 像素丢弃）+ anchor-normalized voting（票数 / family 锚点数）+ PCA polygon 长短轴比代替 bbox（pose 不变量） |

v5 跑通：100/100 提取，19 family 分布，max single family = **dusty_rose 15 张**（之前 v1 是 nude 50 张）。
低 conf (<0.15) 21 张是"皮肤色化甲油"，机制告诉下游无法分离。
**11 张诊断图入 `docs/figures/`** 每一刀的视觉证据。

### 阶段 6：Antigravity 委托（后台跑，task ID `by2va955u`）
交了一份完整 task brief：
1. **扩 color_family**：silver 严格化（吞了浅紫/浅蓝/粉色 nail art）；加 lavender / light_blue / sky_blue / turquoise / rose_gold / magenta / lilac / champagne 等
2. **加 secondary_color**：四个字段（family/name/rgb/confidence），types + extractor + schema + seed 五处改动
3. 重跑 manifest + 重建 DB

**用户最后说 Antigravity 已经在搭整个项目框架 + mock 数据**——不止之前 brief 的范围，扩到 web + agent + mock 全栈。

---

## Antigravity 已落地的改动（基于 system-reminder diff）

观察到的文件改动：
- `tools/extraction/src/colorExtractor.ts` — secondary_color 字段加完，**dE2000 ΔE 升级**（原来是 CIE76 Lab 距离，现在是完整 CIEDE2000）
- `tools/extraction/src/colorFamilyMap.ts` — anchor 字典扩到 **42 个 anchor**（加 apricot/hot_pink/plum/emerald/sky_blue/light_blue/turquoise/navy/lavender/lilac/lemon/champagne/rose_gold/navy 等）
- `tools/extraction/src/types.ts` — 加 secondary_color_* 字段
- `tools/extraction/src/extractAll.ts` — 写 secondary 进 manifest
- `db/src/schema/styles.ts` — 加 4 个 secondary 列
- `db/src/seed/index.ts` — seed 写 secondary
- `db/src/schema/*` — 所有 schema 文件去掉 `.ts` 后缀 import（适配 commonjs/esm 兼容）
- `db/src/client.ts` / `paths.ts` — 同
- `db/package.json` — 可能改了
- 根 `package.json` — workspaces 改
- `.gitignore` — 加 `data/pairs.csv` / `nail_refs.csv` / `data/extraction/manifest.json` 例外（这三个 seed 关键文件入 git）

**没有验证过 Antigravity 跑完后 silver 是否 ≤4 / secondary 填充率是否 ≥30%**——下个 session 起手要看。

---

## 仓库当前状态

### 已 push 到 main 的 commit
1. 初始 scaffold
2. 技术栈切换 + scripts 移除
3. extraction v1
4. DB scaffold + 17 张表 seed

### 本地 commit 未 push（SSH 被本地代理 198.18.0.43 拦了）
- `feat(extraction): v5 color/length pipeline + 11 诊断图`（约 500 行 + 11 张 PNG）

### Antigravity 改的文件**未 commit**（在工作区）
按 system-reminder 列表，至少 8 个文件 modified。`git status` 跑一下能看全。

### 数据状态
- `data/extraction/manifest.json` — v5（**v6 from Antigravity 可能已 overwrite**）
- `data/nails.db` — v5 seed 跑过，**Antigravity 可能已重 reset**
- `data/tryon_v2/canon_*.png` 100 张完整
- `data/enhanced_style_01..50.png` 完整
- `data/hand_models/pool/*.png` 14 张完整

---

## 下个 session 起手 checklist

按优先级：

### 1. 摸清 Antigravity 改了什么（必做）
```bash
cd /Users/nev4rb14su/workspace/nails-agent
git status --short
git diff --stat
# 重点看：
#   - web/ 子项目是否建好？（package.json / next.config / src/app/）
#   - mock 数据脚本：tools/mock/ 或 db/src/seed/mock-*.ts？
#   - LangGraph.js Agent：web/src/agent/?
#   - agent_action_proposals 表是否加？
```

### 2. 验证 Antigravity 跑完的 extraction v6 结果
```bash
cd tools/extraction
/Users/nev4rb14su/workspace/nails-agent/tools/extraction/node_modules/.bin/tsc -p . --noEmit  # 必过
python3 -c "
import json, collections
m = json.load(open('../../data/extraction/manifest.json'))
c = collections.Counter(e['primary_color_family'] for e in m)
print('total:', len(m))
print('max single family:', c.most_common(3))
print('silver count:', c.get('silver', 0))
sec = sum(1 for e in m if e.get('secondary_color_family'))
print('secondary fill rate:', sec, '/', len(m))
"
```
**验收**：silver ≤ 4 / secondary ≥ 30 张 / typecheck 过

### 3. push v5 + Antigravity 改动
```bash
git push  # 如果 SSH 还不通，用户得修代理
# 或者 git push -u origin main 单独试
```

### 4. 接 mock 数据（如果 Antigravity 没做完）
按 `docs/agent_operation_cycle_v1.md` §6 / `docs/data-model.md` §11：
- `user_sessions` × ~50 mock（4 种 hand_shape 分布 25/30/25/20%）
- `user_hand_profiles`（用 14 张手模池池的 skin/pose 当 truth）
- `behavior_events` × ~750（按手型×颜色×长度偏好矩阵生成）
- 滚动 7 个 12h 窗口的 `style_heat_snapshots` / `tag_heat_snapshots`
- 第一份 active `recommendation_snapshots(global_main)`

### 5. 搭 web/ 框架（如果 Antigravity 没做）
按之前 task list 计划：
- Next.js 14 App Router + Tailwind
- C 端：主推荐页 / 详情 / 上传 / 试戴 / 收藏 / 相似手型弹窗
- B 端：Agent 看板 / runs 详情 / Chat
- API routes 8 个
- `lib/`：`@nails-agent/db` 接通 + ComfyCloud client port from `scripts/comfycloud.py`
- `agent/`：LangGraph.js state machine + 13 个工具按 `agent_operation_cycle_v1.md`

### 6. agent_action_proposals 新表（agent_operation_cycle_v1 §15.1）
现有 17 张表 + 1 新表 = 18 张。需要 drizzle-kit push 重建。

---

## 关键决策已锁定（不要回退）

| 项 | 决策 |
|---|---|
| 运行栈 | Next.js 14 + TypeScript + LangGraph.js |
| 数据源（特征提取） | `tryon_v2/canon_*.png` 100 张（**不是** catalog） |
| 资产角色 | tryon = styles `image_url`（方案 3）；50 enhanced → STYLE001-050 listed，50 Pinterest → STYLE051-100 candidate |
| nude family | **彻底去掉**（皮肤色 = 无信息） |
| color 算法 | chamfer DT erode + per-image skin ref + anchor 量化 + normalized vote |
| length 算法 | polygon PCA 长短轴比（pose 不变量），阈值 1.50 / 1.75 |
| ΔE 公式 | dE2000（Antigravity 升级，比 CIE76 更感知一致） |
| Mock 数据量 | ~50 sessions × ~15 events = ~750 events（PRD/open-questions §B4 锁定） |

---

## 待讨论项（mirror docs/open-questions.md Part B）

- [ ] **B1**：静态资产分发链接（GitHub Release？）
- [ ] **B6**：是否云端部署给评委（Vercel？）
- [ ] **B8**：v1 Demo MVD 范围最终切分（PRD §3）

截止日：**2026-06-07**（剩 3 天）

---

## 文件地图（速查）

```
nails-agent/
├── docs/
│   ├── PRD.md
│   ├── data-model.md            # 17 张表 schema
│   ├── agent_operation_cycle_v1.md  # 13 工具 + 强制约束 ← 下个 session 重点
│   ├── confirmed-flow.md
│   ├── open-questions.md
│   ├── dataset.md
│   ├── system-flow.md
│   ├── design-diagrams.md
│   └── figures/                 # 11 张诊断图（已 commit 待 push）
├── tools/extraction/            # v5 + Antigravity v6
├── db/                           # 17 张表 + seed
├── data/                         # tryon_v2 / enhanced / extraction (gitignored)
├── scripts/                      # Python 一次性工具（gitignored）
└── (Antigravity 可能新建)
    web/                          # Next.js 14 app
    db/src/schema/agent.ts (扩) 
    tools/mock/ 或 db/src/seed/mock-*.ts
```

---

## 推 commit 用的 SSH 注意

代理路由 `198.18.0.43` 经常拦 GitHub SSH。表现：`Connection closed by 198.18.0.43 port 22`。
处理：用户换网络/关代理后 `git push`。本地 commit 都是齐的，不会丢。
