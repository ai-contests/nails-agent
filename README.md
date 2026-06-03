# Nails-Agent

> 美团 AI 比赛参赛项目 · 赛题「美甲 AI 试戴与智能运营」
> 状态：v1 Demo 开发中 · 截止 2026-06-07

把"AI 试戴"和"智能运营"做成一个可落地、可评测、可迭代的完整系统。

## 一句话介绍

- **C 端**：用户上传一张手图，30 秒内看到平台上任意美甲款式戴在自己手上的效果；并能看到"跟你手型相似的用户都在选什么"。
- **B 端**：一个 12 小时一轮自动跑的 Agent 中枢，监控款式热度 / 标签趋势 / 异常，自动调推荐位、做候选池上架决策，并把每个动作的效果在下一轮复盘成可复用经验。

## 文档地图

| 文档 | 角色 |
|---|---|
| [`docs/PRD.md`](./docs/PRD.md) | 产品需求文档（v1 Demo 范围切分 / 功能清单 / 评审映射） |
| [`docs/system-flow.md`](./docs/system-flow.md) | 系统流程图（Mermaid：架构 / C 端旅程 / Agent 一轮 / 试戴管线） |
| [`docs/data-model.md`](./docs/data-model.md) | 数据库模型主稿（沿用 `DB Schema V1` 原稿） |
| [`docs/confirmed-flow.md`](./docs/confirmed-flow.md) | 已确认的数据流方向与策略层结论 |
| [`docs/open-questions.md`](./docs/open-questions.md) | 待讨论项追踪（用户决策后回填） |
| [`docs/dataset.md`](./docs/dataset.md) | 数据资产说明（50 listed + 50 candidate + 14 手模 + 100 演示试戴图，外链 TBD） |

阅读建议：第一次看从 `PRD.md` 开始，看完看 `system-flow.md` 建立直觉，再翻 `data-model.md` 看字段细节。

## 仓库结构

```
nails-agent/
├── README.md                  # 你正在看的文件
├── .env.example               # 复制为 .env 后填 ComfyCloud / LLM key
├── docs/                      # PRD / 流程图 / 数据模型 / 未定项
└── data/                      # runtime 家（SQLite / 上传图 / 试戴结果），git 不跟踪

# 不入仓库（本地辅助）
├── scripts/                   # 一次性 Python 工具集：试戴管线、手模生成、批量 runner
├── extract_nails.py           # OpenCV / Roboflow 单美甲提取脚手架
└── nail_extractor.py          # 同上
```

> v1 Demo 的运行栈是 TypeScript + Next.js + LangGraph.js（见 §技术栈）。
> `scripts/` 是构造 `data/` 资产 + mock 数据的一次性 Python 工具集，**不进运行路径，不入仓库**。

## 静态资产（图片）下载

仓库不放大的图片（~224MB）。完整资产（50 styles + 14 手模 + 100 试戴图）见 [`docs/dataset.md`](./docs/dataset.md)：

- **下载链接**：TBD（Google Drive / GitHub Release，待补充）
- **或者自己跑一遍重生成**：参考下文「快速开始 §4」

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 + 后端 | **Next.js 14（App Router）+ TypeScript** |
| Agent | **LangGraph.js** + OpenAI 兼容 LLM（首选 Qwen via ModelScope） |
| DB | SQLite + Drizzle ORM 或 Prisma（TBD） |
| 试戴管线 | TS 客户端封装 ComfyCloud REST + Nano Banana 2，工作流模板照抄本地 `scripts/workflow.py`（Python 参考实现） |
| 部署 | 本地 `pnpm dev` + 必要时 ngrok 给评委演示 |

> 本地 Python `scripts/` 仅用于一次性产出 `data/` 资产与 mock 种子，**不在生产路径里**。生产代码全部用 TypeScript。

## 快速开始

```bash
# 1. 复制环境变量
cp .env.example .env
# 必须填：ROBOFLOW_API_KEY（用于美甲特征提取）
# 试戴管线再填：COMFYCLOUD_API_KEY

# 2. 装依赖（npm workspaces，一次装好 tools/extraction + db）
npm install

# 3. 一键跑：提取 100 张美甲特征 → 建库 → 种子 → 自检
npm run setup
# ≈ 3-5 分钟（Roboflow 调用 100 次 + DB 建表 + seed）
```

跑完产物：

| 路径 | 内容 |
|---|---|
| `data/extraction/manifest.json` | 98 条美甲特征（color/length/RGB/palette/bbox） |
| `data/extraction/raw/STYLE###.roboflow.json` | Roboflow 原始返回，调阈值不重打 API |
| `data/nails.db` | SQLite，17 张表、98 nail_styles + 98 features + 1 active global_main 快照 + 50 reco items |

### 单步

```bash
npm run extract            # 只提取（不建库）
npm run db:reset           # 删 data/nails.db
npm run db:seed            # 重新 seed（前提：库已建好）
npm run db:check           # 看每张表行数 + 抽样
```

## Next.js 接入（下一步）

> 当前仓库还没有 Next.js 脚手架，下一步是 `npx create-next-app@latest web --ts --tailwind --app` 起 web app 子项目，
> 然后 `web/` 里 import `@nails-agent/db` 拿数据。LangGraph.js 接 Agent 一轮。

## 数据 / 资产复现

> 50 enhanced + 50 Pinterest + 14 手模 + 100 试戴成品图共 ~289MB，**不在 git 里**。
> 下载链接见 [`docs/dataset.md`](./docs/dataset.md)（TBD：GitHub Release）。
> 也可以用本地 `scripts/` 里的 Python 管线自己跑一遍（不属于 v1 运行路径）。

## 关键决策（已锁定）

| 项 | 决策 | 来源 |
|---|---|---|
| 试戴 backend | ComfyCloud + Nano Banana 2 wrap，不等队友 | open-questions Q10 |
| 100 张演示图的角色 | 演示资产（不是 styles 本身），50 enhanced → 主 styles，50 Pinterest → candidate | PRD §8 / docs/dataset.md |
| Mock 行为数据量 | 中等（~50 sessions × ~15 events，仅第一轮种子） | open-questions Q5 |
| `nail_styles.status` | 只 `candidate` / `listed` 两值，不单独 candidate 表 | data-model §2.1 |

未定项追踪：[`docs/open-questions.md`](./docs/open-questions.md)。

## License / 比赛声明

本仓库为美团 AI 比赛参赛作品，遵守比赛规则。
所有素材保证原创或合法使用：
- Pinterest 抓图仅作 v1 Demo 数据示例，不用于生产分发；
- ComfyCloud 调用产生的 Nano Banana 2 输出按 Google AI 使用条款使用；
- 手模图 + 50 catalog 图在赛后会清理重审版权状态。
