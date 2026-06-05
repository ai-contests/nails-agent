# Agent 智能运营待处理设计文档

更新时间：2026-06-05

本文记录当前 Agent 智能运营模块的阶段性状态、已经接通的执行链路，以及正式形成“策略复盘闭环”前仍需处理的设计问题。

## 1. 当前目标

美甲智能运营 Agent 的目标不是简单生成推荐结果，而是形成可追踪、可复盘、可学习的运营闭环：

```text
行为聚合
-> 读取最近 N 轮历史、候选池、推荐快照、策略记忆
-> LLM 通过工具协议提出发现和动作建议
-> 强 schema 校验
-> 执行前检查/护栏
-> 批量执行推荐调整或款式状态变更
-> 重建推荐快照
-> 写入待复盘事项
-> 下一轮先复盘效果
-> 写入 strategy_memories
-> 后续决策复用策略记忆
```

## 2. 已完成的工程闭环

当前代码已经接通以下能力：

1. Agent 一轮运行入口
   - `startAgentRun`
   - `rollupBehaviorWindow`
   - `getDueReviewContext`
   - `getOperationContext`
   - LLM 分析
   - 提案校验
   - 执行动作
   - `completeAgentRun`

2. LLM 输出协议已改为工具调用结构
   - 顶层必须是 `{ "toolCalls": [...] }`
   - 目前支持：
     - `discoverOpportunity`
     - `diagnoseAnomaly`
     - `continueObservation`
     - `recordActionProposal`
   - 使用 Zod 做强 schema 校验
   - 保留 camelCase 字段格式

3. 动作提案已有执行前检查
   - 必须有 `intendedAction`
   - 必须有 `hypothesis`
   - 必须有 `expectedMetrics`
   - 必须有 `rollbackCondition`
   - `confidence >= 0.5`
   - 目标款式必须存在
   - 上架候选款式必须来自 `candidate`
   - 下架款式必须来自 `listed`
   - 推荐调整目标必须是 `listed`
   - 一次上下架数量有限制
   - 必须存在 active `global_main` 推荐快照

4. 执行动作已从单点执行改为批量执行
   - 多个 approved proposal 会在一次 batch 中执行
   - 推荐快照只重建一次
   - 旧 active snapshot 会归档
   - 新 snapshot 会激活
   - proposal 执行后会标记为 `executed`

5. 执行过程已有 SQLite 事务保护
   - 推荐快照重建、款式状态变更、decision 写入、pending review 写入在同一事务内
   - 中途失败时不会留下半执行状态

6. 相似手型推荐、N 轮历史、推荐快照读取已经按文档方向调整
   - 后端推荐接口会优先读取相似手型行为信号
   - Agent 上下文会读取最近 N 轮历史热度
   - 执行动作会基于 active `global_main` 快照重建新快照

## 3. 当前还不是完整策略闭环的原因

当前系统已经能跑通“工程执行闭环”，但还没有完成“真实运营策略闭环”。主要缺口如下。

### 3.1 复盘结果仍是 mock

当前 `runOperationCycle` 下一轮会先调用 `getDueReviewContext`，并遍历到期的 `agent_pending_reviews`。

但现阶段 outcome 是随机生成：

```text
outcomeScore = Math.random()
```

这意味着：

- `strategy_memories` 会被写入
- `agent_pending_reviews` 会被标记 completed
- 但 `outcome_score` 和 `lesson` 不是基于真实运营指标

这块是最高优先级缺口。

### 3.2 待复盘表中的期望指标需要补齐

文档目标是：Agent 执行决定性动作时，把预期效果写入待复盘信息，下一轮按预期指标判断效果。

当前情况：

- `agent_action_proposals.expected_metrics` 已保存 LLM 提出的预期指标
- `agent_pending_reviews.expected_effect` 已保存执行后的预期影响，如 snapshotId、rankAfter、newStatus
- 但 `agent_pending_reviews` 没有单独 `expected_metrics` 字段
- 当前 pending review 中没有稳定保存“按哪些指标判断成败”的完整结构

建议下一步将 `expectedMetrics` 合并写入 `expected_effect`，例如：

```json
{
  "snapshotId": "RECS001",
  "rankAfter": 8,
  "expectedMetrics": [
    { "metric": "tryon_count", "direction": "increase", "minDelta": 5 },
    { "metric": "favorite_count", "direction": "increase", "minDelta": 2 }
  ],
  "rollbackCondition": "24h 后试戴和收藏无提升则回滚推荐位"
}
```

这样不需要立刻改表结构，也能满足复盘计算需要。

### 3.3 getDueReviewContext 需要计算真实 after_metrics

文档中 `get_due_review_context` 应返回：

- `before_metrics`
- `after_metrics`
- `metric_delta`

当前实现只读取到期的 `agent_pending_reviews`，没有真正计算动作后的指标。

下一步应补：

1. 根据 `review_window_start` / `review_window_end` 获取动作后行为窗口
2. 根据 `style_id`、decision item 或 execution payload 定位目标款式
3. 从 `style_heat_snapshots` / `tag_heat_snapshots` / `recommendation_items` 计算 after 指标
4. 计算 delta
5. 返回给复盘判断器

### 3.4 writeStrategyMemory 需要从单条手写输入升级为复盘工具

当前 `writeStrategyMemory` 接收：

```ts
{
  pendingReviewId,
  outcomeScore,
  lesson
}
```

建议升级为接收结构化 review result：

```ts
{
  pendingReviewId,
  outcome,
  outcomeScore,
  beforeMetrics,
  afterMetrics,
  metricDelta,
  lesson,
  nextSuggestion
}
```

并写入：

- `strategy_memories.before_metrics`
- `strategy_memories.after_metrics`
- `strategy_memories.outcome_score`
- `strategy_memories.lesson`
- `agent_pending_reviews.result_metrics`
- `agent_pending_reviews.result_summary`
- `agent_pending_reviews.memory_id`

### 3.5 growthScore 仍是占位

当前热度增长还没有真实趋势计算，部分地方相当于用当前 heat 分数代替 growth 分数。

后续需要基于最近 N 轮历史计算：

- 当前窗口分数
- 上一窗口分数
- N 轮均值
- 环比增长
- 相对趋势强度
- 数据量不足时的置信度折扣

### 3.6 tag 趋势到款式集合映射尚未成型

当前 LLM 可以发现 tag 机会，但系统还没有一个确定性工具把“tag 趋势”映射到“可执行款式集合”。

需要新增或明确：

- `detectTagTrends`
- `matchCandidatesByTagTrend`
- `rankCandidateStylesForTagTrend`

建议规则：

1. tag 在最近窗口增长明显
2. 候选款式包含该 tag 或相关 tag 组合
3. 款式可试戴
4. 与相似手型偏好匹配
5. 当前推荐页没有过度同质化
6. 输出最多 3 个候选动作

### 3.7 推荐调整仍偏粗

当前只要出现 `adjust_recommendation`，执行批处理会倾向于按全局 `styleHeat` 重排推荐位。

后续应该支持更细的执行 payload：

```json
{
  "changes": [
    {
      "styleId": "STYLE018",
      "action": "promote",
      "targetRank": 8,
      "maxDelta": 10,
      "reason": "相似手型收藏增长"
    }
  ]
}
```

这样能避免一次推荐调整影响过大。

### 3.8 跨 proposal 冲突检查尚未完整

当前已有单个 proposal 的护栏，但还缺少 batch 级冲突检测。

需要检查：

- 同一 style 在同一批次被同时 list 和 unlist
- 同一 style 同时被推荐提升和下架
- 多个 proposal 对推荐位产生过大扰动
- 同一轮动作数量超过运营上限
- 多个动作依赖同一个旧 snapshot，但执行顺序导致含义变化

### 3.9 evidence_links 尚未完整落库

文档要求 findings、decisions、pending_reviews、strategy_memories 都应可追溯证据。

当前主要证据被写在 JSON 字段中，`agent_evidence_links` 还没有完整实现。

后续需要把以下来源显式链接：

- style_heat snapshot
- tag_heat snapshot
- recommendation snapshot
- pending review
- strategy memory
- finding
- decision

## 4. 下一阶段建议优先级

### P0：真实复盘闭环

目标：去掉 `Math.random()`，让 `strategy_memories` 可信。

需要改：

1. pending review 写入时携带 `expectedMetrics`
2. `getDueReviewContext` 计算真实 `after_metrics` 和 `metric_delta`
3. 新增 `evaluateReviewOutcome`
4. `writeStrategyMemory` 写入结构化复盘结果
5. 补测试覆盖 positive / neutral / negative 三种结果

完成后，Agent 才真正具备策略记忆能力。

### P1：趋势分数

目标：让 Agent 不只看当前热度，而是识别增长机会。

需要改：

1. 实现 style/tag growthScore
2. 历史 N 轮窗口做趋势计算
3. 低样本量降权
4. 将 trend context 输入 LLM

### P2：tag 趋势映射到候选款式

目标：让“tag 机会”变成可执行的候选款式上架动作。

需要改：

1. 实现 tag trend detector
2. 实现 candidate matcher
3. 将 matched candidates 放进 LLM context
4. 提案时优先使用 matcher 输出

### P3：精细化推荐调整

目标：从“全局重排”改为“可控局部调整”。

需要改：

1. 支持 `targetRank`
2. 支持 `maxDelta`
3. 支持推荐页多样性约束
4. 支持扰动阈值护栏

### P4：证据链落库

目标：让 B 端可以解释 Agent 为什么这么做，以及复盘为什么这么判断。

需要改：

1. 实现 `agent_evidence_links` 写入
2. findings 链接 heat/tag evidence
3. decisions 链接 proposal/finding evidence
4. memories 链接 pending review 和指标快照

## 5. 当前可继续运行的前提

现阶段可以继续跑 Agent，但要理解其含义：

- 可以验证 LLM tool calling 是否稳定
- 可以验证 proposal schema 是否稳定
- 可以验证执行前护栏是否拦截异常动作
- 可以验证推荐快照重建是否正确
- 可以验证 pending review 是否被登记
- 不应把当前 `strategy_memories` 当成真实运营学习结论

正式进入智能运营策略验证前，必须先完成 P0。

## 6. 建议下一次开工任务

下一次优先任务：

```text
实现真实复盘闭环：
pending review expectedMetrics 持久化
-> getDueReviewContext 计算真实 after_metrics / metric_delta
-> evaluateReviewOutcome 判断正负效果
-> writeStrategyMemory 写结构化策略记忆
-> 删除随机 outcomeScore
```

完成该任务后，再生成“Agent 完整运营文档”会更准确。
