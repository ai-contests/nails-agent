# 数据库结构草案

版本：DB Schema V1  
最后更新：2026-06-03

## 1. 设计原则

第一版数据库服务两个目标：

- C 端能稳定完成推荐、详情、手型识别、试戴、收藏夹。
- B 端 Agent 能基于平台行为做运营机会发现、推荐位调整、款式状态决策、异常诊断和复盘记忆。

建议技术选择：

```text
开发 / 比赛演示：SQLite + SQLAlchemy
后续扩展：PostgreSQL 兼容设计
```

字段约定：

- 主键统一使用字符串 ID，例如 `STYLE001`、`SESSION_xxx`、`DECISION_xxx`。
- 时间统一使用 ISO8601 字符串或数据库 `datetime`。
- 标签数组在 SQLite 中使用 JSON 字符串，在 PostgreSQL 中可迁移为 `jsonb`。
- 所有重要业务表保留 `created_at`，可变表保留 `updated_at`。

## 2. 核心枚举

### 2.1 StyleStatus

```text
listed      已上架，可在 C 端展示
candidate   候选池，暂不进入主推荐页
```

说明：

- 推荐位提升不写入款式主状态，由 `recommendation_snapshots` 和 `recommendation_items` 表达。
- 继续观察不写入款式主状态，由 `agent_findings` / `agent_pending_reviews` 表达。
- 下架或回退时，将款式从 `listed` 改回 `candidate`，具体原因由 Agent 决策日志记录。

### 2.2 SourceType

```text
internal_seed    初始 50 张内部款式，默认上架
agent_listed     Agent 从候选池决策上架
```

`source_type` 表示上架来源，不表示上传来源。后续 B 端上传并进入候选池的新款，在未被 Agent 上架前可为空；如果需要记录上传来源，后续单独增加上传记录表，不进入第一版核心结构。

### 2.3 HandShape

```text
slender_long
short_wide
square_palm
narrow_palm
unknown
```

### 2.4 SkinTone

```text
cool_fair
warm_fair
natural
warm_yellow
wheat
deep
unknown
```

### 2.5 BehaviorType

```text
style_click
favorite_add
favorite_remove
tryon_start
```

行为含义：

| 枚举值 | 说明 | 主要来源 |
| --- | --- | --- |
| `style_click` | 用户点击款式进入详情或打开款式 | 主推荐页、相似手型弹窗 |
| `favorite_add` | 用户收藏款式（仅在详情页发生） | 详情页 |
| `favorite_remove` | 用户取消收藏 | 详情页、收藏夹 |
| `tryon_start` | 用户发起试戴操作（仅在详情页发生） | 详情页 |

第一版不设计分享行为。

### 2.6 TryOnStatus

```text
pending
running
success
failed
```

### 2.7 AgentRunTrigger

```text
manual_demo              Demo 手动触发
scheduled_12h            正式环境 12 小时定时触发
post_behavior_rollup     行为数据聚合后触发
```

### 2.8 AgentFindingType

```text
opportunity        运营机会
anomaly            异常诊断
tag_trend          标签趋势
candidate_match    候选池机会
```

### 2.9 AgentActionType

```text
promote_recommendation      提升推荐位
demote_recommendation       降低推荐位
list_candidate              候选池上架
unlist_to_candidate         已上架款式回退到候选池
watch_style                 继续观察
start_experiment            开始策略实验
rollback_experiment         回退实验
no_action                   本轮不动作
```

## 3. 表结构总览

```text
nail_styles
nail_visual_features

user_sessions
user_hand_images
user_hand_profiles

behavior_events
session_favorites
tryon_jobs

recommendation_snapshots
recommendation_items
style_heat_snapshots
tag_heat_snapshots

agent_runs
agent_findings
agent_decisions
agent_decision_items
agent_evidence_links
agent_pending_reviews
strategy_memories
agent_chat_sessions
agent_chat_messages
```

## 4. 款式与视觉特征

### 4.1 nail_styles

款式主表。所有主推荐页、详情页、候选池、Agent 决策都围绕这张表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `style_id` | string PK | 款式 ID |
| `source_type` | enum nullable | 上架来源；候选池未上架款可为空 |
| `status` | enum | 款式状态 |
| `image_url` | string | 原始/当前可展示图片 |
| `enhanced_image_url` | string nullable | 增强后图片 |
| `color_tags` | json array | 颜色标签，沿用视觉特征提取后的主色结果，展示 2 个 |
| `length_tags` | json array | 长度标签，最多展示 2 个 |
| `visual_feature_id` | string nullable | 关联视觉特征 |
| `is_available_for_tryon` | bool | 是否允许试戴 |
| `listed_at` | datetime nullable | 上架时间 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

索引：

```text
idx_nail_styles_status
idx_nail_styles_source_type
idx_nail_styles_listed_at
```

### 4.2 nail_visual_features

记录从图片中提取出的视觉特征。第一版重点服务颜色和长度。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `visual_feature_id` | string PK | 视觉特征 ID |
| `style_id` | string FK | 关联款式 |
| `primary_color_family` | string | 主色系，如 `pink`、`red`、`nude` |
| `primary_color_name` | string | 中文主色名，如 `裸粉` |
| `primary_color_rgb` | json array | 主色 RGB |
| `dominant_palette` | json array | 主要色板 |
| `color_confidence` | float nullable | 颜色识别置信度，诊断用，第一版不参与 Agent 核心决策 |
| `nail_crop_url` | string nullable | Roboflow 抠出的单美甲图 |
| `length_tag` | enum | `short` / `medium` / `long` / `unknown` |
| `length_ratio` | float nullable | 长度判断所用比例 |
| `length_confidence` | float nullable | 长度识别置信度，诊断用，第一版不参与 Agent 核心决策 |
| `extractor_version` | string | 特征提取版本 |
| `raw_features` | json object | 原始算法输出 |
| `created_at` | datetime | 创建时间 |

索引：

```text
idx_visual_features_style_id
idx_visual_features_primary_color_family
idx_visual_features_length_tag
```

字段补充说明：

- `length_ratio`：长度判断的中间指标。可以理解为单美甲区域的长宽比或长度归一化比例，用来把款式归到 `short` / `medium` / `long`。它不是展示字段，也不直接给 Agent 做决策。
- `extractor_version`：记录本次特征提取使用的算法版本，例如 `color_kmeans_v1`、`roboflow_length_v1`。后续如果算法变化，可以知道某条数据是由哪个版本产出的。
- `raw_features`：保存算法原始输出，例如 Roboflow mask 面积、bbox、颜色聚类结果等。它主要用于调试，不进入前端展示和第一版 Agent 决策。

## 5. 用户 Session 与手型识别

### 5.1 user_sessions

一次手图上传对应一个 session。切换手图即创建新 session。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `session_id` | string PK | Session ID |
| `client_id` | string nullable | 浏览器匿名 ID，用于同一浏览器恢复当前 session，可为空 |
| `status` | string | `active` / `closed` |
| `current_hand_image_id` | string nullable | 当前手图 |
| `created_at` | datetime | 创建时间 |
| `closed_at` | datetime nullable | 关闭时间 |

索引：

```text
idx_user_sessions_client_id
idx_user_sessions_created_at
```

`client_id` 说明：

- 项目第一版没有登录系统，`client_id` 用来表示“同一个浏览器/设备”。
- 前端可以在 localStorage 里保存一个匿名 `client_id`，后端用它查询该浏览器最近一次 active session。
- 如果比赛演示中不需要恢复历史 session，`client_id` 可以为空。
- `idx_user_sessions_client_id` 的作用是快速查询某个浏览器的当前 session。

### 5.2 user_hand_images

保存用户上传的手图。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `hand_image_id` | string PK | 手图 ID |
| `session_id` | string FK | Session ID |
| `image_url` | string | 本地或对象存储路径 |
| `created_at` | datetime | 上传时间 |

### 5.3 user_hand_profiles

保存手型与肤色识别结果。不保留 `undertone`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `hand_profile_id` | string PK | 手部画像 ID |
| `session_id` | string FK | Session ID |
| `hand_image_id` | string FK | 手图 ID |
| `hand_shape` | enum | 手型 |
| `hand_shape_confidence` | float nullable | 手型置信度，诊断用，第一版不参与 Agent 核心决策 |
| `skin_tone` | enum | 肤色 |
| `skin_tone_confidence` | float nullable | 肤色置信度，诊断用，第一版不参与 Agent 核心决策 |
| `skin_rgb` | json array nullable | 肤色 RGB |
| `raw_metrics` | json object | 原始识别指标 |
| `created_at` | datetime | 创建时间 |

索引：

```text
idx_user_hand_profiles_session_id
idx_user_hand_profiles_hand_shape
idx_user_hand_profiles_skin_tone
```

## 6. 用户行为、收藏与试戴

### 6.1 behavior_events

行为事件流水表。C 端所有点击、收藏、试戴都写这里，是运营分析的基础。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_id` | string PK | 事件 ID |
| `session_id` | string nullable | 当前 session；mock 行为可为空或使用 mock session |
| `style_id` | string FK | 款式 ID |
| `event_type` | enum | 行为类型 |
| `source_page` | string | `main` / `detail` / `similar_hand_popup` / `favorites` |
| `metadata` | json object | 附加信息 |
| `created_at` | datetime | 事件时间 |

索引：

```text
idx_behavior_events_style_id
idx_behavior_events_session_id
idx_behavior_events_event_type
idx_behavior_events_created_at
```

### 6.2 session_favorites

收藏状态表，用于快速查询当前 session 收藏夹。收藏/取消收藏仍然同步写 `behavior_events`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `session_id` | string PK part | Session ID |
| `style_id` | string PK part | 款式 ID |
| `is_active` | bool | 当前是否收藏 |
| `created_at` | datetime | 首次收藏时间 |
| `updated_at` | datetime | 最近更新时间 |

### 6.3 tryon_jobs

试戴任务表。ComfyUI 成功或失败都记录。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tryon_job_id` | string PK | 试戴任务 ID |
| `session_id` | string FK | Session ID |
| `style_id` | string FK | 款式 ID |
| `hand_image_id` | string FK | 当前手图 |
| `status` | enum | `pending` / `running` / `success` / `failed` |
| `input_hand_image_url` | string | 输入手图 |
| `style_image_url` | string | 输入款式图 |
| `result_image_url` | string nullable | 试戴结果图 |
| `error_message` | string nullable | 失败提示 |
| `comfyui_workflow_id` | string nullable | ComfyUI workflow ID |
| `created_at` | datetime | 创建时间 |
| `started_at` | datetime nullable | 开始时间 |
| `finished_at` | datetime nullable | 完成时间 |

索引：

```text
idx_tryon_jobs_session_id
idx_tryon_jobs_style_id
idx_tryon_jobs_status
```

## 7. 推荐位与热度快照

### 7.1 recommendation_snapshots

推荐结果快照表。主推荐页和相似手型辅助推荐都可使用。

主推荐页更新采用快照切换方式：

```text
Agent 运行中生成新的 global_main snapshot
-> 写入完整 recommendation_items
-> Agent 全部动作完成后，将新 snapshot 标记为 active
-> 前端刷新后读取新的 active snapshot
```

这样可以避免 Agent 执行过程中用户侧页面出现半更新状态。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `snapshot_id` | string PK | 快照 ID |
| `snapshot_type` | string | `global_main` / `similar_hand` |
| `session_id` | string nullable | 相似手型推荐需要；主推荐为空 |
| `generated_by` | string | `system` / `agent` |
| `agent_run_id` | string nullable | 关联 Agent 运行轮次 |
| `status` | string | `building` / `active` / `archived` |
| `activated_at` | datetime nullable | 生效时间 |
| `expires_at` | datetime nullable | 过期时间，相似手型快照可用 |
| `created_at` | datetime | 创建时间 |

索引：

```text
idx_reco_snapshots_type_status
idx_reco_snapshots_session_id
```

数据量说明：

- 一个 `global_main` 快照对应 N 条 `recommendation_items`，N 等于当前展示款式数。
- Demo 中 50 个款式即 50 条明细，数据量很小。
- 后续即使 1000 个款式、每天运行 2 次，30 天也只是约 6 万条明细。
- 第一版可以保留最近 30 天或最近 100 个快照，旧快照设为 `archived` 后定期清理。
- 主推荐页查询只读取 `snapshot_type = global_main AND status = active` 的一条快照，不扫描历史明细。

### 7.2 recommendation_items

推荐快照明细。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `item_id` | string PK | 明细 ID |
| `snapshot_id` | string FK | 快照 ID |
| `style_id` | string FK | 款式 ID |
| `rank_no` | int | 排名 |
| `score` | float | 推荐分 |
| `reason` | string | 推荐理由 |
| `score_detail` | json object | 分数组成 |

索引：

```text
idx_reco_items_snapshot_rank
idx_reco_items_style_id
```

### 7.3 style_heat_snapshots

单款热度快照。它是 Agent 的历史回顾数据来源之一，用来替代原先设想的“上一轮回顾数据”。

每次 Agent 运行前，系统先从 `behavior_events` 聚合当前统计窗口，并写入一批新的 `style_heat_snapshots`。Agent 不只读取上一轮，而是读取最近 N 轮快照来判断持续趋势。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `heat_snapshot_id` | string PK | 快照 ID |
| `agent_run_id` | string FK nullable | 生成该快照的 Agent 运行；初始预计算可为空 |
| `style_id` | string FK | 款式 ID |
| `window_start` | datetime | 统计窗口开始 |
| `window_end` | datetime | 统计窗口结束 |
| `view_count` | int | 浏览数 |
| `click_count` | int | 点击数 |
| `tryon_count` | int | 试戴开始数 |
| `favorite_count` | int | 收藏数 |
| `heat_score` | float | 当前窗口综合热度分 |
| `growth_score` | float | 相比最近 N 轮均值的增长分 |
| `conversion_score` | float | 点击到试戴 / 收藏的转化质量分 |
| `created_at` | datetime | 创建时间 |

索引：

```text
idx_style_heat_run_window
idx_style_heat_style_window
```

score 字段意义：

- `heat_score`：用于快速判断当前窗口哪些款式整体热度高，适合主推荐排序的基础分。
- `growth_score`：用于判断哪些款式正在上升或下降，适合 Agent 做运营机会发现、推荐位提升或降权观察。
- `conversion_score`：用于判断款式是否“点击后真的让用户行动”，适合发现点击高但试戴/收藏低的异常。

第一版建议算法：

```text
heat_score =
  click_count * 1
  + tryon_count * 2
  + favorite_count * 3

growth_score =
  当前窗口 heat_score - 最近 N 轮 heat_score 均值

conversion_score =
  tryon_count / max(click_count, 1) * 0.6
  + favorite_count / max(click_count, 1) * 0.4
```

score 不替代原始计数。Agent 决策时应同时读取原始 `click_count`、`tryon_count`、`favorite_count` 和 score，避免被单个加工分数误导。

### 7.4 tag_heat_snapshots

color / length 标签热度快照。候选池复判依赖这张表，它也是 Agent 判断平台内标签趋势的主要历史数据来源。

每次 Agent 运行前，系统会把同一 `color_tags` 或 `length_tags` 下的款式行为聚合为标签维度快照。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tag_snapshot_id` | string PK | 快照 ID |
| `agent_run_id` | string FK nullable | 生成该快照的 Agent 运行；初始预计算可为空 |
| `tag_type` | string | `color` / `length` |
| `tag_value` | string | 标签值 |
| `window_start` | datetime | 统计窗口开始 |
| `window_end` | datetime | 统计窗口结束 |
| `style_count` | int | 覆盖款式数量 |
| `view_count` | int | 浏览数 |
| `click_count` | int | 点击数 |
| `tryon_count` | int | 试戴开始数 |
| `favorite_count` | int | 收藏数 |
| `heat_score` | float | 当前窗口标签综合热度分 |
| `growth_score` | float | 相比最近 N 轮均值的标签增长分 |
| `conversion_score` | float | 标签维度点击到试戴 / 收藏的转化质量分 |
| `created_at` | datetime | 创建时间 |

索引：

```text
idx_tag_heat_run_window
idx_tag_heat_type_value
idx_tag_heat_window
```

tag score 的作用：

- `heat_score`：判断当前平台内哪些颜色或长度标签最热。
- `growth_score`：判断哪些标签正在升温，用于候选池上架、推荐位多样性调整和趋势解释。
- `conversion_score`：判断某类颜色或长度是否只是被点击，还是能带来试戴和收藏。
- 标签趋势必须结合 `style_count` 看，否则少数款式的偶然波动可能被误判为平台趋势。

## 8. Agent 决策与复盘

Agent 第一版采用“周期性自动运营中枢”设计，而不是给五类能力分别写死触发条件。

```text
每 12 小时运行一次，Demo 中可用按钮手动触发
-> 根据 behavior_events 聚合本轮 style_heat_snapshots / tag_heat_snapshots
-> 读取最近 N 轮款式热度快照与标签热度快照
-> 读取当前 active 推荐快照与 recommendation_items.rank_no
-> 读取候选池数据
-> 读取待复盘事项
-> 读取历史复盘记忆
-> Agent 自主判断本轮需要调用哪些能力
-> 自动执行推荐位调整 / 款式状态调整等动作
-> 写入决策日志、待复盘事项和复盘记忆
-> 生成或切换新的推荐快照
```

第一轮或历史快照不足时，Agent 可以只写入热度快照并选择继续观察，不做运营动作。

Agent 执行采用工具调用方案：

```text
OperationAgent 选择调用五类运营工具
-> tool 参数使用结构化 schema
-> tool 内部做参数校验和执行护栏
-> tool 负责写入 agent_findings / agent_decisions / agent_pending_reviews / strategy_memories
-> 推荐位工具负责生成新的 recommendation_snapshots / recommendation_items
```

这样 Agent 可以自主选择能力，但不会直接裸写数据库。

五类工具的详细参数 schema 以 `internal_data_flow_confirmed.md` 中的 `Agent 工具 Schema V1` 为准。

### 8.1 agent_runs

Agent 每次运行一条记录。B 端 Chat 可以围绕某次运行解释“这一轮 Agent 做了什么”。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `agent_run_id` | string PK | Agent 运行 ID |
| `trigger_type` | enum | `manual_demo` / `scheduled_12h` / `post_behavior_rollup` |
| `status` | string | `running` / `completed` / `failed` |
| `is_warmup_run` | bool | 是否历史快照不足，仅观察或建立初始快照 |
| `input_summary` | json object | 本轮输入数据摘要 |
| `output_summary` | json object | 本轮输出摘要 |
| `chat_summary` | text nullable | 给 B 端 Chat 展示的本轮总结 |
| `error_message` | text nullable | 失败信息 |
| `started_at` | datetime | 开始时间 |
| `completed_at` | datetime nullable | 完成时间 |

### 8.2 agent_findings

Agent 本轮发现了什么。发现不等于动作，例如“某款热度上升”可以只被记录，也可以进一步触发推荐位调整。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `finding_id` | string PK | 发现 ID |
| `agent_run_id` | string FK | 所属 Agent 运行 |
| `finding_type` | enum | `opportunity` / `anomaly` / `tag_trend` / `candidate_match` |
| `target_type` | string | `style` / `tag` / `candidate` / `global` |
| `target_id` | string nullable | 目标 ID，如 `style_id` 或 tag 值 |
| `title` | string | 发现标题 |
| `summary` | text | 发现摘要 |
| `evidence` | json object | 证据数据 |
| `score` | float nullable | 机会分或异常分，仅辅助展示 |
| `created_at` | datetime | 创建时间 |

示例：

```text
finding_type = opportunity
target_type = style
target_id = STYLE018
summary = "STYLE018 在本轮试戴量与收藏量均高于最近几轮均值，具备放量机会。"
```

### 8.3 agent_decisions

Agent 自动执行过的决策主表。B 端 Chat 读取这张表回答“Agent 做了什么动作、为什么做”。

说明：

- Agent 所有动作自动执行，B 端第一版只展示决策流程，不提供人工确认按钮。
- 运营机会发现、异常诊断这类“没有改数据”的结果写入 `agent_findings`。
- 推荐位调整、候选池上架、下架、降权、实验开始等“改数据”的动作写入 `agent_decisions`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `decision_id` | string PK | 决策 ID |
| `agent_run_id` | string FK | 所属 Agent 运行 |
| `action_type` | enum | Agent 动作类型 |
| `target_type` | string | `style` / `recommendation_snapshot` / `global` |
| `target_id` | string nullable | 目标 ID |
| `title` | string | 决策标题 |
| `summary` | text | 决策摘要 |
| `status` | string | `executed` / `failed` / `rolled_back` |
| `execution_result` | json object | 实际执行结果 |
| `requires_review` | bool | 是否需要进入待复盘 |
| `created_at` | datetime | 创建时间 |
| `executed_at` | datetime nullable | 执行时间 |

示例：

```text
action_type = promote_recommendation
target_type = style
target_id = STYLE018
requires_review = true
summary = "STYLE018 本轮试戴量增长，且同色短甲 tag 热度同步上升，已提升到主推荐前 10。"
```

### 8.4 agent_decision_items

Agent 决策明细。一次推荐位调整、候选池上架或已上架款式回退都可能涉及多个款式，因此需要明细表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `decision_item_id` | string PK | 明细 ID |
| `decision_id` | string FK | 决策 ID |
| `style_id` | string FK nullable | 关联款式 |
| `item_action_type` | string | `promote` / `demote` / `list` / `unlist` / `watch` |
| `from_status` | string nullable | 原款式状态 |
| `to_status` | string nullable | 新款式状态 |
| `rank_before` | int nullable | 调整前推荐位；候选池上架前可为空 |
| `rank_after` | int nullable | 调整后推荐位；候选池上架时表示插入位置 |
| `metrics_before` | json object | 执行前指标 |
| `reason` | text | 明细理由 |
| `created_at` | datetime | 创建时间 |

### 8.5 agent_evidence_links

决策证据关联表。避免在 `agent_decisions` 里写死 `source_memory_ids`、`source_experiment_ids` 等大量可空字段。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `evidence_link_id` | string PK | 证据关联 ID |
| `decision_id` | string FK | 决策 ID |
| `source_type` | string | `finding` / `memory` / `pending_review` / `style_heat` / `tag_heat` / `style` |
| `source_id` | string | 来源记录 ID |
| `role` | string | `trigger` / `supporting_evidence` / `risk_warning` |
| `note` | text nullable | 说明 |
| `created_at` | datetime | 创建时间 |

示例：

```text
候选池上架决策可以引用：
- finding: 当前裸粉短甲 tag 热度上升
- style: 候选池 STYLE081 具备裸粉 + 短甲标签
- memory: 上次裸粉短甲放量后收藏率提升
```

### 8.6 agent_pending_reviews

待复盘事项表。凡是已经自动改了用户侧展示或款式状态、但效果需要下一轮数据验证的动作，都进入这里。

进入待复盘的动作包括：

```text
推荐位提升
推荐位降权
候选池上架
已上架款式回退候选池
策略实验开始
策略实验回退
```

候选池上架或已上架款式回退候选池时，除了更新 `nail_styles.status`，还必须生成新的 `global_main` 推荐快照和完整 `recommendation_items`，保证 C 端主推荐页与款式状态一致。

不进入待复盘、可以立即闭环的结果包括：

```text
运营机会发现
异常诊断
继续观察
无动作决策
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `pending_review_id` | string PK | 待复盘 ID |
| `decision_id` | string FK | 触发该事项的决策 |
| `style_id` | string FK nullable | 关联款式 |
| `review_type` | string | `recommendation_change` / `candidate_listing` / `style_unlist` / `experiment` |
| `status` | string | `pending` / `completed` / `cancelled` |
| `before_metrics` | json object | 动作执行前指标 |
| `review_window_start` | datetime | 复盘窗口开始 |
| `review_window_end` | datetime | 复盘窗口结束 |
| `result_metrics` | json object nullable | 复盘时的结果指标 |
| `result_summary` | text nullable | 复盘摘要 |
| `memory_id` | string FK nullable | 完成后写入的复盘记忆 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### 8.7 strategy_memories

复盘记忆表。记录历史动作效果，供下一轮 Agent 决策引用。

只有动作经过下一轮或多轮数据验证后，才写入真正的复盘记忆。单纯“Agent 做了什么”只写入 `agent_decisions`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `memory_id` | string PK | 记忆 ID |
| `memory_type` | string | `strategy_result` / `tag_lesson` / `anomaly_lesson` |
| `source_pending_review_id` | string FK nullable | 来源待复盘事项 |
| `source_decision_id` | string FK nullable | 来源决策 |
| `tag_signature` | string nullable | 如 `color:裸粉|length:short` |
| `style_id` | string nullable | 关联款式 |
| `action_type` | string | 动作类型 |
| `before_metrics` | json object | 执行前指标 |
| `after_metrics` | json object | 执行后指标 |
| `outcome_score` | float | 效果分 |
| `lesson` | text | 可复用经验 |
| `created_at` | datetime | 创建时间 |

示例：

```text
tag_signature = "color:裸粉|length:short"
lesson = "上次裸粉短甲提升推荐位后收藏率提升 18%，下次类似趋势可优先放量。"
```

### 8.8 agent_chat_sessions

B 端 Chat 会话表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `chat_session_id` | string PK | Chat 会话 ID |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### 8.9 agent_chat_messages

B 端 Chat 消息表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message_id` | string PK | 消息 ID |
| `chat_session_id` | string FK | Chat 会话 ID |
| `role` | string | `user` / `agent` |
| `content` | text | 消息正文 |
| `related_run_ids` | json array | 引用的 Agent 运行 |
| `related_finding_ids` | json array | 引用的 Agent 发现 |
| `related_decision_ids` | json array | 引用的 Agent 决策 |
| `related_memory_ids` | json array | 引用的复盘记忆 |
| `created_at` | datetime | 创建时间 |

## 9. 主要关系

```text
nail_styles 1 -- 1 nail_visual_features
nail_styles 1 -- N behavior_events
nail_styles 1 -- N tryon_jobs
nail_styles 1 -- N recommendation_items
nail_styles 1 -- N agent_decision_items

user_sessions 1 -- N user_hand_images
user_sessions 1 -- N user_hand_profiles
user_sessions 1 -- N behavior_events
user_sessions 1 -- N tryon_jobs
user_sessions 1 -- N session_favorites

recommendation_snapshots 1 -- N recommendation_items
agent_runs 1 -- N style_heat_snapshots
agent_runs 1 -- N tag_heat_snapshots
agent_runs 1 -- N agent_findings
agent_runs 1 -- N agent_decisions
agent_runs 1 -- N recommendation_snapshots
agent_decisions 1 -- N agent_decision_items
agent_decisions 1 -- N agent_evidence_links
agent_decisions 1 -- N agent_pending_reviews
agent_pending_reviews 1 -- 0/1 strategy_memories
agent_chat_sessions 1 -- N agent_chat_messages
```

## 10. 页面到表的映射

| 页面 | 主要读取 | 主要写入 |
| --- | --- | --- |
| 主推荐页 | `recommendation_snapshots`、`recommendation_items`、`nail_styles` | `behavior_events(style_view/style_click)` |
| 详情页 | `nail_styles`、`session_favorites` | `behavior_events`、`session_favorites` |
| 手型识别页 | `user_sessions` | `user_sessions`、`user_hand_images`、`user_hand_profiles` |
| 相似手型弹窗 | `user_hand_profiles`、`behavior_events`、`recommendation_snapshots` | `behavior_events` |
| 试戴结果弹窗 | `tryon_jobs`、`nail_styles` | `tryon_jobs`、`behavior_events` |
| 试戴/收藏夹 | `tryon_jobs`、`session_favorites`、`nail_styles` | 无或取消收藏 |
| B 端 Chat | `agent_runs`、`agent_findings`、`agent_decisions`、`agent_pending_reviews`、`strategy_memories` | `agent_chat_sessions`、`agent_chat_messages` |

## 11. 初始数据填充建议

初始 50 张图需要填充：

```text
nail_styles
nail_visual_features
recommendation_snapshots(global_main)
recommendation_items
mock user_sessions
mock user_hand_profiles
mock behavior_events
style_heat_snapshots
tag_heat_snapshots
```

其中：

- `nail_styles.status` 全部为 `listed`。
- `source_type` 全部为 `internal_seed`。
- `recommendation_snapshots` 至少生成一条 `global_main` 当前快照。
- 初始 `recommendation_items.rank_no` 随机生成，不使用复杂排序算法。
- mock 行为需要覆盖不同 `hand_shape`，否则相似手型辅助推荐会冷启动。
- 初始 mock 行为需要记录不同手型用户试戴、收藏了哪些款式。
- 初始 mock 行为需要预计算出第一批 `style_heat_snapshots` 和 `tag_heat_snapshots`，供后续 Agent 决策读取。
- 历史快照不足时，第一轮 Agent 可以只观察和记录发现，不做推荐位或款式状态调整。

## 12. 置信度字段使用原则

第一版不要让置信度字段成为 Agent 核心决策依据。

原因：

- 手型置信度、肤色置信度、长度置信度、颜色置信度都依赖具体算法实现。
- 如果为了 Demo 强行设计精细置信度，容易让业务逻辑被不稳定分数拖住。
- Agent 真正应该关注的是平台行为、tag 热度、款式状态和历史复盘。

第一版建议：

```text
置信度字段可以保留
-> 允许为空
-> 用于算法调试和质量提示
-> 不直接进入推荐位排序
-> 不直接进入 Agent 上架/下架决策
```

如果识别结果不稳定，推荐使用粗粒度状态控制：

```text
识别成功：写入 color_tags / length_tags / hand_shape / skin_tone
识别失败：写入 unknown 或空数组
款式图特征识别失败时仍可进入候选池，由 Agent 后续结合可用标签和平台热度判断是否上架
```

Agent 决策第一版主要读取：

```text
nail_styles.status
nail_styles.color_tags
nail_styles.length_tags
behavior_events
当前 active recommendation_items.rank_no
最近 N 轮 style_heat_snapshots
最近 N 轮 tag_heat_snapshots
agent_pending_reviews
strategy_memories
```

而不是读取各类 `*_confidence`。

## 13. 待讨论点

这版数据库还需要重点确认：

- 是否需要单独的 `candidate_styles` 表，还是只用 `nail_styles.status = candidate`。
- 推荐快照历史保留策略：第一版建议保留最近 30 天或最近 100 个快照。
- `style_heat_snapshots` 和 `tag_heat_snapshots` 第一版是按钮触发生成，还是页面行为写入后实时聚合。
- B 端 Chat 是否需要保存 Agent 完整提示词和模型原始输出，还是只保存结构化结果与最终解释。
