# Nails-Agent 智能运营完整运营文档

版本：v1（2026-06-05，对应 commits up to `8856f68`）
范围：B 端 Agent 运营闭环——从行为聚合到策略沉淀的全链路。

---

## 0. 文档目的

本文是 Agent 运营子系统的**单一事实来源**：

- 给后端开发：每个阶段在哪个文件、写哪张表、读哪张表
- 给前端 B 端：哪些表/字段能拿来渲染"为什么 Agent 这么做"
- 给运营/产品：Agent 一轮跑下来到底做了什么决定、有没有学到东西
- 给评委演示：跑哪些步骤、看哪些数据、怎么解释闭环

与 `data-model.md` §4-§8 配套阅读（17+1 张表的字段定义在那）。
与 `agent_operation_pending_design.md` §7 配套阅读（实施进度 + 已知问题）。

---

## 1. 总体架构

### 1.1 三种角色

```
┌─────────────────┐   行为     ┌─────────────────┐
│   C 端用户       │ ────────→ │ behavior_events │
└─────────────────┘            └────────┬────────┘
                                        │ 聚合
                                        ↓
┌──────────────────────────────────────────────────────┐
│                  Agent Orchestrator                   │
│  (src/agent/orchestrator.ts · runOperationCycle)     │
│                                                       │
│  Phase 0  startAgentRun                              │
│  Phase 1  rollupBehaviorWindow      (P1 真实 growth)  │
│  Phase 2  getDueReviewContext + 复盘 (P0 真实 outcome) │
│  Phase 3  getOperationContext       (P2 tag 匹配)     │
│  Phase 4  LLM 工具调用 (Zod 校验)                       │
│  Phase 5  recordActionProposal                       │
│  Phase 6  validateActionProposal    (护栏)            │
│  Phase 7  executeApprovedProposalBatch               │
│           ├─ applyRecommendationAdjustments (P3)     │
│           ├─ rebuildRanksForStatusChanges            │
│           ├─ 写 agent_evidence_links (P4)            │
│           └─ 写 agent_pending_reviews (含 baseline)  │
│  Phase 8  completeAgentRun                           │
└──────────────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│   B 端运营看板 (admin/runs, admin/chat) │
│   渲染 runs / findings / decisions /    │
│   evidence_links / strategy_memories    │
└─────────────────────────────────────────┘
```

### 1.2 数据模型一图流（agent 子图）

```
agent_runs ── 1:N ──┬── agent_findings
                    ├── agent_action_proposals ── 1:1 ── agent_decisions ──┬── agent_decision_items
                    │                                                       ├── agent_evidence_links (P4)
                    │                                                       └── agent_pending_reviews (P0)
                    │                                                              │
                    │                                                              └─ 1:1 ── strategy_memories
                    │
                    ├── style_heat_snapshots (P1 growth_score)
                    └── tag_heat_snapshots   (P1 growth_score)

agent_chat_sessions ── 1:N ── agent_chat_messages
                                  ↑ related_run_ids / related_finding_ids / ...
```

---

## 2. 一次 Cycle 的 8 个阶段（按时间顺序）

每个阶段下：**触发条件 / 读 / 写 / 关键代码 / 失败兜底**。

### Phase 0 — startAgentRun

- **触发**：`triggerType = 'manual_demo' | 'scheduled_12h'`
- **读**：无
- **写**：`agent_runs` 一行（status=`running`, started_at=now）
- **代码**：`tools.startAgentRun`
- **失败兜底**：抛错即终止；不会留下垃圾数据。

### Phase 1 — rollupBehaviorWindow

- **触发**：phase 0 成功
- **读**：
  - `nail_styles WHERE status='listed'`（100 张里约 50 张）
  - `behavior_events WHERE created_at BETWEEN [now-12h, now]`
  - **P1 新增**：`style_heat_snapshots WHERE agent_run_id != currentRun ORDER BY window_end DESC LIMIT 2000` → 计算历史均值
  - **P1 新增**：`tag_heat_snapshots ...` 同上
- **写**：
  - `style_heat_snapshots` 每个 listed style 一行（含真实 `growth_score`）
  - `tag_heat_snapshots` 每个 (color/length, value) 一行
  - 回写 `agent_runs.input_summary`
- **关键公式**：
  - `heat_score = clicks*1 + tryons*2 + favorites*3`
  - `conversion_score = (tryons/clicks)*0.6 + (favorites/clicks)*0.4`
  - **growth_score (P1)** = `growthRatio × confidence`
    - `growthRatio = (currentHeat - baselineHeat) / max(baselineHeat, 1)`
    - `confidence = min(windowsUsed/3, 1) × min(baselineHeat/3, 1)`
  - **冷启动行为**：第一轮无历史 → growth_score = 0（不假装有信号）
- **代码**：`tools.rollupBehaviorWindow` + `trendAnalyzer.computeGrowth`

### Phase 2 — getDueReviewContext + 复盘

文档闭环的"学习"环节，**整个 Agent 唯一的反馈通道**。

- **触发**：phase 1 成功
- **读**：
  - `agent_pending_reviews WHERE status='pending' AND review_window_end <= now`
  - 对每条 review：
    - `agent_decision_items WHERE decision_id = X` → 解析受影响 styles
    - **P0 新增**：`behavior_events WHERE style_id=... AND created_at BETWEEN [review_window_start, review_window_end]` → 计算真实 after_metrics
- **写**：
  - `strategy_memories` 每个到期 review 一行（含真实 outcome/delta/lesson）
  - `agent_pending_reviews.status='completed'` + `result_metrics` JSON
- **判定算法（P0 evaluateReviewOutcome）**：

  ```
  对每个 expectedMetric:
    actualDelta = after[metric] - before[metric]
    hit = direction=='increase' ? actualDelta >= minDelta
        : direction=='decrease' ? actualDelta <= -minDelta
        : abs(actualDelta) <= minDelta

  outcomeScore = hits / total
  outcome = score>=0.7 ? positive : score>=0.3 ? neutral : negative
  ```

- **代码**：`tools.getDueReviewContext` + `reviewEvaluator.evaluateReviewOutcome` + `tools.writeStrategyMemory`
- **失败兜底**：单条 review 处理出错不影响其他 review（建议但当前未实现 try/catch，TODO）

### Phase 3 — getOperationContext

- **触发**：phase 2 完成
- **读**：
  - 本轮 `style_heat_snapshots` / `tag_heat_snapshots`
  - 历史 N 轮 heat（`selectRecentHistoryRows` 去重 + 排序）
  - 当前 active `recommendation_snapshot(snapshot_type='global_main')` + items
  - `nail_styles WHERE status='candidate'`（候选池）
  - `nail_styles WHERE status='listed'`（用于多样性饱和度）
  - `strategy_memories ORDER BY created_at DESC LIMIT 10`
- **写**：无
- **P2 新增**：`rankCandidateActionsFromTagTrends` 输出：
  - `trends`：growth_score≥0.3 且 tryon_count≥1 的 top-5 tag
  - `actions`：每个 trend 找候选池中含该 tag 的款，多 tag 加分、listed 池已饱和则减分，top-3
- **代码**：`tools.getOperationContext` + `tagTrendMatcher.rankCandidateActionsFromTagTrends`

### Phase 4 — LLM 自诊断 + 工具调用

- **触发**：phase 3 完成
- **读**：phase 3 输出的 opCtx
- **写**：通过工具回调写 `agent_findings` + `agent_action_proposals`
- **LLM 协议**（`agentPlanSchema.ts`）：
  - 顶层 `{ toolCalls: [...] }`
  - 4 个允许的工具：
    - `discoverOpportunity` — 写 findings.opportunity
    - `diagnoseAnomaly` — 写 findings.anomaly
    - `continueObservation` — 写 findings.tag_trend (baseline note)
    - `recordActionProposal` — 写 proposals
  - **不允许**调用执行工具或 writeStrategyMemory（强约束在 Zod schema）
- **Prompt 重点上下文**：
  - styleHeat / tagHeat（本轮 + 历史 5 轮）
  - active recommendation top-50
  - **P2**: rising trends + pre-matched candidate actions（LLM 直接照抄用）
  - strategy memories（lesson 文本，soft 复用 ⚠️）
- **失败兜底**：LLM 调用失败或 schema 校验失败 → 写一条 baseline observation finding → 不执行任何 proposal → 走 phase 8

### Phase 5 — recordActionProposal

被工具回调触发，每个 proposal 落一行 `agent_action_proposals(status='pending_check')`。

### Phase 6 — validateActionProposal

- **触发**：phase 5 写完
- **读**：proposal 本身 + 目标 styles 状态 + 是否存在 active global snapshot
- **写**：`agent_action_proposals.status = 'approved' | 'rejected'` + `check_result`
- **护栏（`operationRules.evaluateProposalGuards`）**：

  | rule | 说明 |
  |---|---|
  | `intended_action_present` | 必填 |
  | `hypothesis_present` | 必填 |
  | `expected_metrics_present` | 至少 1 个 |
  | `rollback_condition_present` | 必填 |
  | `confidence_threshold` | ≥ 0.5 |
  | `target_ids_present` | no_action 之外必须有 |
  | `active_global_snapshot_exists` | 必须存在 |
  | `target_exists` | 所有 targetId 必须在 nail_styles |
  | `target_status` | list_candidate 要 candidate / unlist 要 listed / adjust 要 listed |
  | `action_limit` | list/unlist ≤3, adjust ≤10 |

- **执行计划生成（P3）**：
  - 若 LLM 在 `executionPayload.changes` 里指定了 `targetRank`/`maxDelta`，传给批处理
  - 否则降级到默认 promote（含默认 delta=5）

### Phase 7 — executeApprovedProposalBatch（最核心）

整个事务包在 `BEGIN IMMEDIATE`...`COMMIT` 里，中途失败全部 ROLLBACK。

```
                  approved proposals
                          │
                          ▼
        ┌──────── 收集 changes ─────────┐
        │ recommendationChanges[]      │
        │ statusChanges[]              │
        └──────────────┬────────────────┘
                       ▼
         applyRecommendationAdjustments  (P3)
            • 解析 targetRank / 默认 delta
            • 应用 maxDelta clamp
            • 滑窗多样性 guard
              (window=5, max=3 同 color)
            • 违反则回退该 change
                       │
                       ▼ postAdjustmentRanks
         rebuildRanksForStatusChanges
            • 移除 unlist 的 style
            • 把 list_candidate 插入 top-10 之后
                       │
                       ▼ finalRanks
            写新 recommendation_snapshot(building)
              + recommendation_items × N
            归档旧 active → 激活新的
                       │
                       ▼
       为每个 proposal:
         • 写 agent_decisions
         • P4: 写 4 类 evidence_links
             - action_proposal (role=source)
             - recommendation_snapshot (role=before)
             - recommendation_snapshot (role=after)
             - style (role=target) × N
         • 写 agent_decision_items (status 变更专属)
         • P0: captureBaselineForReview
             → 聚合 [now-reviewWindow, now] 的真实 behavior
             → 落 pending_review.before_metrics.metrics
         • P0: expected_effect.expectedMetrics ← proposal.expectedMetrics
         • 写 agent_pending_reviews(status=pending)
         • 标 proposal.status='executed'
```

### Phase 8 — completeAgentRun

- 更新 `agent_runs.status='completed'` + `chat_summary` + `completed_at`
- 失败路径：catch 块写 `status='failed'` + `error_message`

---

## 3. 数据流·一图看懂

```
        ┌─────────────────────────────────────────────────────────┐
        │ T-12h ──┬── T0 (cycle K) ──┬── T+12h ──┬── T+24h        │
        │         │                  │           │                │
        │  N 轮历史                Phase 1     Phase 2          │
        │  style_heat  ─────► growth_score  ─► (next cycle)      │
        │  + tag_heat                          基于 review_window │
        │                                      聚合真实 after     │
        │                                                          │
        │  candidate pool ───► Phase 3 tagTrendMatcher ──► LLM    │
        │                                                          │
        │  listed pool ──┐                                         │
        │  active snap ──┴► Phase 7 applyAdjustments               │
        │                                                          │
        │                                  Phase 7 写 pending      │
        │                                  baseline = [T-24h, T0]  │
        │                                                          │
        │  pending review.window_end = T+24h ────────────┐         │
        │                                                 │         │
        │  cycle K+2 phase 2 读到 due ─► after = [T0, T+24h]       │
        └─────────────────────────────────────────────────────────┘
```

---

## 4. 关键决策规则速查

### 4.1 谁能调用什么工具

| 角色 | 允许的工具 |
|---|---|
| LLM | discoverOpportunity, diagnoseAnomaly, continueObservation, recordActionProposal |
| Orchestrator | startAgentRun, rollupBehaviorWindow, getDueReviewContext, writeStrategyMemory, getOperationContext, validateActionProposal, executeApprovedProposalBatch, completeAgentRun |
| 任何人 | **禁止**手动跳过 validateActionProposal 直接执行 |

### 4.2 proposal 数量上限

- list_candidate：≤3 个 styles
- unlist_to_candidate：≤3
- adjust_recommendation：≤10
- 一个 cycle 内可以提多个 proposal，但批处理顺序执行

### 4.3 推荐调整的物理约束

- `maxDelta` 默认 10（一个 cycle 内单个 style 移动距离上限）
- `defaultDelta` 默认 5（没指定 targetRank 时的默认移动）
- 多样性 guard：任意连续 5 个 rank 内同一 color tag 最多 3 个

### 4.4 复盘判定边界

- `outcomeScore = hits / total`，hits 来自每个 expectedMetric 是否命中 direction+minDelta
- ≥0.7 positive / 0.3-0.7 neutral / <0.3 negative
- 无 expectedMetrics → fallback 看 tryon+favorite 累积变化方向

---

## 5. B 端可渲染的"为什么"链

给前端 admin 看板的查询路径：

```sql
-- 1. 一个 run 干了什么
SELECT * FROM agent_runs WHERE agent_run_id = ?;

-- 2. 一个 run 发现了什么
SELECT * FROM agent_findings WHERE agent_run_id = ?;

-- 3. 一个 run 提出+执行了什么
SELECT p.*, d.*
FROM agent_action_proposals p
LEFT JOIN agent_decisions d ON d.decision_id = p.decision_id
WHERE p.agent_run_id = ?;

-- 4. 一个 decision 的证据（P4 evidence_links 落库）
SELECT source_type, source_id, role, note
FROM agent_evidence_links
WHERE decision_id = ?
ORDER BY created_at;
-- 返回示例:
--   action_proposal      | PPL_xxx        | source  | null
--   recommendation_snapshot | RECS_old   | before  | null
--   recommendation_snapshot | RECS_new   | after   | null
--   style                | STYLE018       | target  | promote → rank 8
--   style                | STYLE042       | target  | promote → rank 10

-- 5. 一个 decision 学到了什么
SELECT m.outcome_score, m.lesson,
       pr.result_metrics
FROM strategy_memories m
JOIN agent_pending_reviews pr ON pr.memory_id = m.memory_id
WHERE pr.decision_id = ?;
```

---

## 6. 演示流程（评委评审用）

> 前置：`bun run db:setup` 已跑过，nails.db 有 100 styles + 50 sessions + 611 events。

### 6.1 跑出闭环的标准序列

**生产/在线 demo 模式**（推荐）：

```bash
# Step 1: 部署 C 端到 Vercel，让评委或队友访问产生真实 events
# Step 2: 用 cron 或手动每 12h 跑一次 cycle
bun run -e "import {runOperationCycle} from './src/agent/orchestrator'; await runOperationCycle('scheduled_12h');"
# 第一轮 growth_score=0 没决策，第 2-3 轮开始有 trend，第 3 轮起复盘真实生效
```

**纯本地无外部用户 demo 模式**：

```bash
# Step 1: 跑预热 3-5 轮，让历史窗口充满
for i in 1 2 3 4; do
  bun run -e "import {runOperationCycle} from './src/agent/orchestrator'; await runOperationCycle('manual_demo');"
done

# Step 2: 手动操作 C 端制造 events（or 跑 mockBehaviorSimulator 若已实现）
# 关键：要针对最新 active snapshot 的 top styles 产生反馈，否则复盘是 0 delta

# Step 3: 跑展示轮
bun run -e "import {runOperationCycle} from './src/agent/orchestrator'; const r = await runOperationCycle('manual_demo'); console.log(r);"
```

### 6.2 B 端看板该展示的 5 个画面

1. **Run 列表**：最近 10 轮 cycle，状态/触发方式/耗时
2. **Run 详情**：input_summary + findings 列表 + proposals 列表（含 status 颜色）
3. **Decision 解释页**：从 evidence_links 还原"为什么"——前后快照对比 + 受影响 styles
4. **Strategy Memories 看板**：按 outcome 分组（positive/neutral/negative），显示 lesson + 真实 metric_delta
5. **Pending Reviews 列表**：还没到期的 review + 倒计时

### 6.3 评委可能问的问题 + 回答

| Q | A |
|---|---|
| 这不就是个静态推荐系统加了壳？ | 看 evidence_links 表 + strategy_memories.result_metrics，每个决策可追溯到 before/after 真实指标 |
| Agent 怎么知道它的决策对不对？ | Phase 2 复盘逻辑（`evaluateReviewOutcome`），按 LLM 自己提的 expectedMetrics 自己验 |
| 如果 LLM 提出傻 proposal 怎么办？ | 9 条护栏（§4.2、§4.3）会拒，rejected proposal 不进执行 |
| 推荐位会被 Agent 搞乱吗？ | `maxDelta`（默认 10）+ 多样性 guard（5 个连续 rank 内同 color≤3）双保险 |
| Agent 学习的产物是啥？ | `strategy_memories` 表的 outcome_score + lesson，下轮 LLM context 直接读 |

---

## 7. 已知限制（不要藏）

### 7.1 演示场景需要真实交互通道

Seed 是冷启动基线（第 0 轮数据），真闭环依赖后续轮次有新行为补回。

- **生产部署场景**：自然回流（真用户访问 C 端 → 新 events → 下轮聚合）。Agent 的 promote/list 决策直接影响真用户看到什么，从而影响下轮 metric_delta。**无需 mock，正常跑就是闭环。**
- **本地演示 + 评委线上访问**（推荐）：部署到 Vercel，评审窗口期评委自己玩，行为自然回流。
- **本地演示无外部用户**：需要 (a) 队友/演示者手动操作 C 端制造 events，或 (b) 写 `mockBehaviorSimulator` 脚本在 cycle 间注入"针对最新推荐的假反馈"。

PRD §3 demo 评测窗口的策略对应：**优先选生产部署 + 评委访问**这条路。

### 7.2 跨 proposal 冲突未检测

- 同批次两个 proposal 对同一 style 互斥操作（一个 promote 一个 unlist）会都通过单条 guard
- 批处理顺序执行 → 后者覆盖前者，不会报错
- **建议**：补 `detectProposalConflicts(proposals[])` 在 phase 7 入口检查

### 7.3 strategy_memories 复用是软的

- memories.lesson 字符串塞进 LLM prompt，复用与否取决于 LLM
- 没有硬约束（例如"过去 7 天 promote STYLE018 失败 2 次 → 本轮禁止再 promote"）
- **建议**：phase 6 validateActionProposal 加一条 hard guard 检查 negative memories

### 7.4 单点执行路径残留死代码

- `tools.ts` 的 `adjustRecommendation` / `decideStyleStatus` 单条版没接 P0/P3
- orchestrator 不用，但仍可被外部 import 调用
- **建议**：删除或改成 thin wrapper

### 7.5 第一轮总是空轮

- 没历史 → growth_score=0 → tagTrendMatcher 空 → LLM 没候选可用
- **演示前预热 3-5 轮**是 demo 流程的硬要求

### 7.6 调度节奏 lag

- Cycle 12h + review_window 24h → 一个 proposal 要 3 个 cycle 才能复盘
- 不影响正确性但 demo timing 怪
- **建议**：demo 时把 reviewWindowHours 改成 1-2

---

## 8. 关键文件索引

| 文件 | 作用 |
|---|---|
| `src/agent/orchestrator.ts` | 整个 cycle 的入口 `runOperationCycle` |
| `src/agent/tools.ts` | 所有读写工具 + 批处理执行 + baseline 捕获 |
| `src/agent/operationRules.ts` | 护栏、执行计划、推荐重排算法（P3） |
| `src/agent/agentPlanSchema.ts` | LLM 输出 Zod schema |
| `src/agent/agentToolRegistry.ts` | LLM 工具调用分发 |
| `src/agent/reviewEvaluator.ts` | P0 复盘判定纯函数 |
| `src/agent/trendAnalyzer.ts` | P1 growth_score 计算 |
| `src/agent/tagTrendMatcher.ts` | P2 tag 趋势→候选映射 |
| `db/src/schema/agent.ts` | 8 张 agent 表 schema |
| `db/src/schema/heat.ts` | style/tag heat snapshots schema |

测试集中在每个 `*.test.ts` 旁边。当前 57 pass / 0 fail。

---

## 9. 下一阶段（按优先级）

1. **P6 跨 proposal 冲突检测**：phase 7 前置检查，~30 行（最高优先级，工程健壮性）
2. **P7 negative memory hard guard**：phase 6 加规则，~30 行（让 strategy_memories 真正发挥作用）
3. **P8 删除单点执行死代码**：~100 行 net delete
4. **P5（可选）mock 行为模拟器**：仅当 demo 无法部署且现场无人操作 C 端时才需要
5. **B 端实现 §5 的 5 个画面**：前端工作量约 1-2 天

完成 P6 + P7 后工程健壮性达标；P5 看部署策略决定是否需要。
