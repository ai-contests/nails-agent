# Nails-Agent · PRD v1

文档版本：v1 · 2026-06-03
对应交付：美团 AI 比赛「美甲 AI 试戴与智能运营」赛题 Demo
当前所属：`ai-contests/nails-agent`

> 本文是「比赛 Demo 范围内必须实现 / 努力实现 / 范围外」的产品需求口径。
> 数据库结构以 [`docs/data-model.md`](./data-model.md) 为准。
> 流程图以 [`docs/system-flow.md`](./system-flow.md) 为准。
> 未定项见 [`docs/open-questions.md`](./open-questions.md)。

---

## 1. 项目背景

### 1.1 赛题原文要点

> 美甲服务场景两大痛点：
> - 用户在浏览数百款美甲图片时无法想象实际上手效果，担心肤色不搭、手型不配，决策周期长、放弃率高；
> - 运营面对海量款式人工统计费时费力，对热门款式识别滞后，推荐策略粗放。
>
> 交付目标：让用户能快速看到款式试戴效果做出决策，同时让 AI 助手实时监控款式热度、分析趋势、自动生成运营策略，提升用户转化率和运营效率。

### 1.2 评审四维度（直接映射到本 PRD）

| 维度 | 我们如何覆盖 |
|---|---|
| **创新性** | AI 试戴 + 智能运营两条线在一个闭环里联动；Agent 自动执行 + 复盘记忆 |
| **完整性** | C 端（推荐/试戴/收藏）+ B 端（Chat + Agent 看板）+ 后端（试戴管线 / heat 聚合 / Agent 决策）一条龙跑通 |
| **应用效果** | 试戴质量已在 100 张数据集中验证；推荐基于真实 mock + Agent 调整 |
| **商业价值** | 双端价值清晰：C 端缩短决策路径；B 端把"人工统计"换成"实时 Agent 中枢" |

---

## 2. 用户与价值

### 2.1 C 端（消费者）

**典型场景**：用户打开 App / Web → 浏览美甲款式 → 不确定戴在自己手上好不好看 → 上传手图试戴 → 决定是否收藏 / 预约。

**核心价值**：
- 所见即所得：上传一张手图就能看到目标款式的试戴效果。
- 同类参考：「跟你手型相似的用户正在选这些」消除选择焦虑。
- 0 决策成本：不需要登录、不需要预约，浏览到试戴 30 秒内完成。

### 2.2 B 端（运营 / 评委）

**典型场景**：运营人员（或评委演示）打开后台 → 看到 Agent 上一轮发现了什么、做了什么、为什么 → 问 Agent 跟进。

**核心价值**：
- 实时感知：12 小时一轮 Agent 自动聚合数据 + 决策，不再人工统计。
- 解释性：每一个动作都有触发证据链（findings → decisions → evidence_links）。
- 复盘记忆：动作效果验证后形成 strategy_memories，下一轮 Agent 自动复用。

---

## 3. 范围切分

### 3.1 v1 Demo 必须实现（评审能跑通的最小闭环）

**C 端**
- 主推荐页（统一排序、非个性化）
- 款式详情页（图、color/length tag、试戴 / 收藏按钮）
- 手图上传 + 手型识别 + 肤色识别 + Demo session
- 相似手型弹窗（"与您手型相似的用户正在选择这些美甲"）
- 试戴流程（调 ComfyCloud + Nano Banana 2、success/failed 都落库）
- 收藏夹

**B 端**
- 一个手动触发按钮："运行下一轮 Agent 巡检"
- Agent 决策看板（最近一轮的 findings / decisions / pending_reviews / strategy_memories）
- B 端 Chat（围绕某次 agent_run 问 "Agent 这轮做了什么 / 为什么"）

**后端 / 数据**
- 50 styles 初始入库（`internal_seed`、`listed`）+ 50 candidate（来自 Pinterest 池）
- 第一轮 mock 行为种子（~50 sessions × ~15 events，覆盖不同手型）
- 第一轮预计算 `style_heat_snapshots` + `tag_heat_snapshots`
- ComfyCloud 试戴接口的 REST wrap（已就绪，沿用本仓库 `scripts/comfycloud.py`）

### 3.2 v1.5 努力做（时间允许就上）

- 主推荐快照定时切换（Agent 全部动作完成后再 active）
- Agent Chat 引用上下文（点开消息能跳到对应 finding / decision）
- 候选池小流量测试（small_traffic experiment）
- 试戴排队中状态展示

### 3.3 v2+ 范围外（赛后再说）

- 用户登录系统、个性化推荐
- B 端人工确认按钮 / 撤销动作
- 多语言 / 国际化
- 真实 ComfyUI 私有部署（替换 ComfyCloud）
- 移动端原生 App

---

## 4. 信息架构（页面树）

```
C 端
├── 主推荐页 (/)
│   └── 款式卡片 (style_id, image, color_tag, length_tag) → 试戴 / 收藏
├── 款式详情页 (/styles/:style_id)
│   ├── 大图（enhanced_image_url）
│   ├── color_tags / length_tags
│   ├── 试戴按钮 → 试戴结果弹窗
│   └── 收藏按钮
├── 手图上传 (/hand)
│   └── 上传 → 识别 → 显示 hand_shape + skin_tone
├── 相似手型弹窗 (overlay)
│   └── ~30 个款式（按相同 hand_shape 的 favorite/tryon 多寡排序）
└── 收藏夹 (/favorites)

B 端
├── Agent 看板 (/admin)
│   ├── 「运行下一轮 Agent 巡检」按钮
│   ├── 最近 N 轮 agent_runs 列表
│   ├── 当前轮的 findings / decisions / pending_reviews / strategy_memories
│   └── 候选池 + 热度 / tag 趋势小图
└── B 端 Chat (/admin/chat)
    └── 围绕 agent_run 问 Agent
```

---

## 5. 功能清单 + 行为埋点

### 5.1 主推荐页

| 项 | 说明 |
|---|---|
| 数据源 | `recommendation_snapshots(type=global_main, status=active)` + 对应 `recommendation_items` + `nail_styles` |
| 排序 | 由 active snapshot 给定 `rank_no`（Agent 生成；冷启动随机） |
| 卡片信息 | image / color_tags[0] / length_tags[0] / 试戴 / 收藏 |
| 埋点 | `behavior_events(style_view)` 进入可见；`behavior_events(style_click)` 卡片点击 |
| 来源 | `source_page=main` |

### 5.2 款式详情页

| 项 | 说明 |
|---|---|
| 数据源 | `nail_styles` + `session_favorites`（当前是否已收藏） |
| 操作 | 试戴 → 调试戴 API → 写 `tryon_jobs` + `behavior_events(tryon_start / tryon_success / tryon_failed)`；收藏 → 写 `session_favorites` + `behavior_events(favorite_add / favorite_remove)` |
| 来源 | `source_page=detail` |

### 5.3 手图上传 + 识别

| 项 | 说明 |
|---|---|
| 上传后写入 | `user_hand_images` |
| 识别后写入 | `user_hand_profiles(hand_shape, skin_tone, *_confidence, raw_metrics)` |
| 识别失败 | `hand_shape=unknown` 或 `skin_tone=unknown`，不阻断后续操作 |
| Session 行为 | 切换手图 → 关闭旧 session → 开新 `user_sessions` |

### 5.4 相似手型弹窗

| 项 | 说明 |
|---|---|
| 触发 | 上传手图成功后弹出；或详情页边栏 |
| 召回逻辑 | 取同 `hand_shape` 的其他 sessions 在 `behavior_events(favorite_add / tryon_success)` 数高的 ~30 个 `style_id` |
| 兜底 | `hand_shape=unknown` → 回退到 global_main 推荐前 30；同手型数据不足 → 用全平台热度补齐 |
| 来源 | `source_page=similar_hand_popup` |

### 5.5 试戴

| 项 | 说明 |
|---|---|
| 后端 | 本仓库 `scripts/comfycloud.py` + `scripts/workflow.build(hand=用户手图, nail=style 图)` |
| 模型 | Nano Banana 2（Gemini 3.1 Flash Image），ComfyCloud 节点 `GeminiImage2Node` |
| 写库 | `tryon_jobs(status=running → success/failed, result_image_url)` |
| 埋点 | `behavior_events(tryon_start / tryon_success / tryon_failed)` |
| 失败处理 | 提示用户重试；不使用原图 fallback |

### 5.6 收藏夹

| 项 | 说明 |
|---|---|
| 数据源 | `session_favorites(is_active=true)` join `nail_styles` |
| 写入 | 详情页 / 弹窗 / 试戴结果弹窗的收藏按钮 |
| 取消收藏 | `session_favorites.is_active=false`，同步写 `behavior_events(favorite_remove)` |

### 5.7 B 端 Agent 看板

| 项 | 说明 |
|---|---|
| 触发按钮 | 调后端 `/agent/run`，写 `agent_runs(trigger_type=manual_demo)` |
| 展示 | 最近 N 轮 `agent_runs` 列表 + 选中某一轮后下钻 findings / decisions / decision_items / evidence_links / pending_reviews |
| 候选池 | 查 `nail_styles(status=candidate)` 全表 |
| 热度小图 | 最近 N 轮 `style_heat_snapshots` / `tag_heat_snapshots` |

### 5.8 B 端 Chat

| 项 | 说明 |
|---|---|
| 数据源 | 当前轮 agent_runs + 所有关联表（findings / decisions / memories） |
| Prompt 构造 | 后端把"本轮 Agent 做了什么"结构化成 system context 喂给 LLM；用户问题进 user role |
| 写入 | `agent_chat_sessions` + `agent_chat_messages(related_*_ids)` |

---

## 6. Agent 一轮闭环

详细流程图见 [`docs/system-flow.md`](./system-flow.md)。这里只写要点：

1. **触发**：手动按钮 / `manual_demo`（Demo 用）
2. **聚合**：从 `behavior_events` 计算本轮 `style_heat_snapshots` + `tag_heat_snapshots`，写库
3. **读上下文**：最近 N 轮 heat / 候选池 / 待复盘 / 复盘记忆
4. **先复盘**：处理已到 review window 的 `agent_pending_reviews` → 写 `strategy_memories`
5. **再分析**：findings → decisions
6. **执行**：自动改 `nail_styles.status` / 写新 `recommendation_snapshots`
7. **登记待复盘**：促销 / 上下架等动作进 `agent_pending_reviews`
8. **结束**：写 `agent_runs.chat_summary` 供 Chat 引用

> N 的默认值、推荐位实验窗口、Agent prompt 是否持久化、行为权重等参数 → 见 open questions。

---

## 7. 非功能需求

### 7.1 性能（Demo 评测口径）

| 项 | 目标 |
|---|---|
| 主推荐页首屏 | < 1.5s |
| 详情页打开 | < 800ms |
| 试戴单张 | < 30s（ComfyCloud 实测 ~20s + 上传/下载） |
| Agent 一轮（50 styles 规模） | < 30s |
| B 端 Chat 单条回复 | < 5s |

### 7.2 数据规模（Demo）

| 项 | 量级 |
|---|---|
| 上架款式 | 50 |
| 候选池款式 | 50 |
| Mock sessions（第一轮种子） | ~50 |
| Mock behavior_events | ~750（约 50 sessions × 15 events） |
| 第一批 style_heat snapshots | 50（每 style 1 条） |
| 第一批 tag_heat snapshots | ~20（color / length 各若干）|

> Mock 数据只生成第一轮种子，让 Demo 启动时 Agent 有上下文可读；Demo 跑起来后真实用户行为接管。

### 7.3 兜底 / 异常

| 场景 | 兜底 |
|---|---|
| 手型识别失败 | `hand_shape=unknown`，不阻断流程；相似手型弹窗回退全局热门 |
| 肤色识别失败 | `skin_tone=unknown`，详情页正常 |
| 试戴失败 | 提示重试；不用原图替代 |
| 历史快照不足 | Agent 标记 `is_warmup_run=true`，仅观察不执行动作 |

---

## 8. 数据资产对应关系（v1 Demo 用我们已有的 100 张图）

**方案 2 锁定** —— 50 enhanced_style_*.png → 主 50 styles；50 Pinterest pool → 候选池 50 styles。

| 来源 | Schema 角色 | `nail_styles.status` | `source_type` | image_url | enhanced_image_url |
|---|---|---|---|---|---|
| `data/enhanced_style_01..50.png`（已增强 catalog 摄影） | 主 50 styles | `listed` | `internal_seed` | Pinterest 原图 (TBD 是否保留) | 对应 enhanced PNG |
| 50 张来自 `data/nail_refs.csv`（Pinterest 池） | 候选池 50 styles | `candidate` | `null`（候选池未上架） | Pinterest 原图 | (TBD：是否提前生成增强图) |
| `data/tryon_v2/canon_*.png`（100 张试戴 demo 图） | **演示资产**，非款式本体；展示在「试戴效果」/ landing page | — | — | — | — |
| `data/hand_models/pool/*.png`（14 张 canonical 手） | runtime 试戴时不需要；只作展示候选 / 文档 | — | — | — | — |

### Demo 启动数据 seeding 脚本

```text
seed pipeline（本地 Python `scripts/seed_db.py`，或 `pnpm run seed` TS 版 TBD）
  ├─ 写 50 listed styles （来自 enhanced_style_*）
  ├─ 写 50 candidate styles （来自 nail_refs.csv）
  ├─ 写 mock user_sessions + user_hand_profiles （覆盖 hand_shape 4 种）
  ├─ 写 mock behavior_events （~750 条）
  ├─ 计算 + 写第一批 style_heat_snapshots + tag_heat_snapshots
  └─ 写第一个 active recommendation_snapshots(global_main)（rank_no 随机）
```

> 这个 seed 流程是 v1 Demo 必做项 —— 没有它 Agent 第一轮没数据可读。

---

## 9. 技术栈（已锁定）

| 层 | 技术 | 备注 |
|---|---|---|
| 前端 + 后端 | **Next.js 14（App Router）+ TypeScript** | 单仓单进程；C/B 端走 route group + Server Actions / Route Handlers |
| Agent | **LangGraph.js** + OpenAI 兼容 LLM | 首选 Qwen via ModelScope；状态机定义 Agent 一轮的 finding → decision → review |
| DB | SQLite + Drizzle ORM（或 Prisma，TBD） | 跟 `data-model.md` 一致；JSON 字段用 text 列 + 应用层 parse |
| 试戴管线 | TS 客户端封装 ComfyCloud REST + Nano Banana 2 | 工作流模板照抄本地 `scripts/workflow.py` 的 PROMPT_WITH_HAND，runtime 走 TS |
| Mock 数据 seeding | 本地 Python `scripts/seed_db.py`（一次性，不入 git） | 或迁成 `pnpm run seed`（TS）—— TBD |
| 部署 | 本地 `pnpm dev` + ngrok | Demo 阶段无须云部署 |

> 本地 Python `scripts/` + `extract_nails.py` / `nail_extractor.py` 是**一次性数据工具**，
> 用来生成 `data/` 资产与 mock 种子，不在 v1 运行路径里，也不入仓库。

---

## 10. 风险与依赖

| 风险 | 缓解 |
|---|---|
| ComfyCloud 限流 / 短期不可用 | 试戴接口加 retry + 友好降级提示；批量预生成的 100 张演示图可作为快照展示 |
| Agent LLM 输出不稳定 | 用 structured output（JSON schema）约束；后端 validate + 回退 no_action |
| 12h 自动定时器在 Demo 阶段没法直观演示 | 用「立即跑一轮」按钮替代，跟评委说清楚 |
| 候选池小流量测试方案未定 | v1 不实现，文档标 TBD |

---

## 11. 范围外 / 暂不做

明确不做的事情，避免 scope creep：

- 用户登录系统
- 个性化推荐（除相似手型弹窗）
- material_tags / scene_tags / style_tags
- reference_hand_profiles（款式图提取参考手型）
- 外部社媒数据抓取
- B 端人工确认 / 撤回 Agent 决策的 UI
- 多端原生 App

---

## 12. 待讨论项（汇总）

详细列表与最新状态见 [`docs/open-questions.md`](./open-questions.md)。摘要：

1. 推荐位排序权重（click / tryon / favorite）
2. 主推荐快照保留策略
3. `style_heat_snapshots` 实时聚合 vs 按钮触发
4. Agent prompt + LLM 原始输出是否持久化
5. `length_tags` 的几何阈值
6. 候选池小流量测试是否进 v1
7. Mock 行为人群分布（短甲偏好 / 猫眼偏好 / 裸粉偏好）
8. 试戴接口替换（队友实现 vs 当前 ComfyCloud）

**约定**：用户决策后会回填到 `docs/open-questions.md`，对应小节状态从 TBD 改为 confirmed，并在 PRD 引用处追加一行决策。

---

## 13. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-06-03 | 初始版本，整合数据库草案 + 内部数据流确认稿 + open questions + 我们已生成的 100 张数据集 |
