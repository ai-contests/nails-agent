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
├── README.md                            # 你正在看的文件
├── .env.example                         # 复制为 .env 后填 ComfyCloud key
├── docs/
│   ├── PRD.md
│   ├── system-flow.md
│   ├── data-model.md
│   ├── confirmed-flow.md
│   └── open-questions.md
├── data/                                # runtime 数据家（SQLite / 上传图 / 试戴结果），git 不跟踪
│   └── .gitkeep                         # 占位用
└── scripts/                             # 试戴/手模生成/批量管线
    ├── comfycloud.py                    # ComfyCloud REST 客户端
    ├── workflow.py                      # Nano Banana 2 workflow 模板
    ├── gen_hand_pool.py                 # 生成 14 canonical 手模
    ├── select_nails.py                  # 从 Pinterest 池自动选 50 设计
    ├── build_pairs.py                   # 生成 100-对 manifest
    ├── batch_tryon.py                   # 并行批量试戴 runner
    ├── batch_sheet.py                   # 总览 contact sheet
    └── (其他 smoke / 工具脚本)
```

## 静态资产（图片）下载

仓库不放大的图片（~224MB）。完整资产（50 styles + 14 手模 + 100 试戴图）见 [`docs/dataset.md`](./docs/dataset.md)：

- **下载链接**：TBD（Google Drive / GitHub Release，待补充）
- **或者自己跑一遍重生成**：参考下文「快速开始 §4」

## 快速开始

```bash
# 1. 安装依赖
pip install requests python-dotenv pillow

# 2. 配置 ComfyCloud API key
cp .env.example .env
# 编辑 .env，填入 COMFYCLOUD_API_KEY=comfyui-xxx

# 3. 试戴一对（hand_canon_fair × nails_24144c1d3a）作为 smoke test
python3 scripts/smoke_canonical.py

# 4. 批量复现 100 张试戴
python3 scripts/build_pairs.py
python3 scripts/batch_tryon.py --workers 6
python3 scripts/batch_sheet.py
# → 输出 data/tryon_v2/batch_contact_sheet.jpg
```

## 后端 / 前端开发

> v1 Demo 的后端和前端尚未启动。技术栈建议：FastAPI + React + SQLite（详见 PRD §9）。
> 下一步首先开发 `scripts/seed_db.py` 把 50 listed + 50 candidate + 第一轮 mock 行为种入 SQLite。

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
