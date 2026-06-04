# Agent 单轮运营周期协议 V1

版本：Agent Cycle V1  
最后更新：2026-06-04  
适用范围：B 端智能运营 Agent，每 12 小时自动运行一次；Demo 阶段可由按钮手动触发。

本文用于定义一次 Agent 运营周期中：

- 每个阶段做什么。
- 调用什么工具。
- 工具返回什么结构化参数。
- 参数落到哪些数据表。
- 写入哪些字段。

## 1. 核心原则

Agent 不是拿到数据后自由发挥，而是在固定运行协议内自主判断。

固定协议：

```text
复盘上一轮
-> 读取本轮数据
-> 自我诊断
-> 记录发现
-> 生成运营想法
-> 执行前检查
-> 执行动作或继续观察
-> 写入本轮总结
```

Agent 的自由度在于：

- 判断是否存在异常。
- 判断是否存在运营机会。
- 判断哪些候选款值得上架。
- 判断哪些已上架款需要推荐位调整。
- 判断证据是否足够执行动作。

Agent 不允许：

- 跳过数据读取直接执行动作。
- 跳过发现记录直接执行动作。
- 没有数据依据、假设、目标指标、回滚条件就执行动作。
- 执行推荐位或款式状态变更后不写入待复盘事项。
- 直接裸写数据库。

## 2. 是否把读表观察设计成工具

需要。

但读表工具必须和执行工具分开：

```text
上下文工具：只读或确定性数据准备，不允许改业务状态
发现工具：记录机会、异常、继续观察
提案工具：记录 Agent 的运营想法
检查工具：执行前护栏校验
执行工具：真正改推荐位或款式状态
复盘工具：写入策略记忆
运行工具：开始/结束一次 Agent run
```

读表观察不能让 Agent 任意写 SQL。应设计成固定输入、固定输出的上下文工具。

实现建议：

- 后端 Orchestrator 强制按顺序调用上下文工具。
- B 端演示时可以把这些调用展示为 Agent 工具调用轨迹。
- Agent 只能基于工具返回的结构化上下文做判断。
- 上下文工具不修改推荐页、不修改款式状态。

## 3. 工具分层

### 3.1 上下文工具

```text
start_agent_run
rollup_behavior_window
get_due_review_context
get_operation_context
```

说明：

- `start_agent_run` 创建本轮运行记录。
- `rollup_behavior_window` 从行为事件聚合热度快照。
- `get_due_review_context` 读取到期待复盘事项。
- `get_operation_context` 读取本轮运营判断所需的完整上下文。

### 3.2 发现工具

```text
discover_opportunity
diagnose_anomaly
continue_observation
```

说明：

- 有机会时调用 `discover_opportunity`。
- 有异常时调用 `diagnose_anomaly`。
- 没有明确发现或证据不足时调用 `continue_observation`。

每一轮至少需要调用一次发现工具。否则 B 端无法解释 Agent 本轮看到了什么。

### 3.3 提案与检查工具

```text
record_action_proposals
validate_action_proposal
```

说明：

- `record_action_proposals` 只记录想法，不改业务数据。
- `validate_action_proposal` 执行前检查提案是否满足动作条件。

这一层用于防止 Agent 从“发现机会”直接跳到“执行动作”。

### 3.4 执行工具

```text
adjust_recommendation
decide_style_status
```

说明：

- `adjust_recommendation` 生成新的主推荐快照。
- `decide_style_status` 处理候选池上架或已上架款式回退候选池。

执行工具只能在提案检查通过后调用。

### 3.5 复盘工具

```text
write_strategy_memory
```

说明：

- 处理到期待复盘事项。
- 对比动作前后数据。
- 写入可复用策略记忆。

### 3.6 运行工具

```text
complete_agent_run
```

说明：

- 写入本轮输出摘要。
- 标记本轮 Agent 运行完成。
- 生成 B 端 Chat 可读总结。

## 4. 单轮运营周期总览

| 阶段 | 阶段目标 | 工具 | 是否写库 | 主要落库 |
| --- | --- | --- | --- | --- |
| 0. 开始运行 | 创建本轮运行记录 | `start_agent_run` | 是 | `agent_runs` |
| 1. 聚合数据 | 生成本轮热度快照 | `rollup_behavior_window` | 是 | `style_heat_snapshots`、`tag_heat_snapshots` |
| 2. 复盘上一轮 | 处理到期待复盘事项 | `get_due_review_context`、`write_strategy_memory` | 是 | `agent_pending_reviews`、`strategy_memories` |
| 3. 读取上下文 | 看 N 轮数据、排名、候选池、记忆 | `get_operation_context` | 否 | 无，结果写入 `agent_runs.input_summary` |
| 4. 自我诊断 | 判断异常、机会、趋势变化 | Agent 内部推理 | 否 | 无 |
| 5. 记录发现 | 记录异常、机会或继续观察 | `diagnose_anomaly`、`discover_opportunity`、`continue_observation` | 是 | `agent_findings`、`agent_evidence_links` |
| 6. 生成想法 | 形成可执行或不执行提案 | `record_action_proposals` | 是 | `agent_action_proposals` |
| 7. 执行前检查 | 校验证据、假设、指标、回滚条件 | `validate_action_proposal` | 是 | `agent_action_proposals` |
| 8. 执行动作 | 通过检查后才改数据 | `adjust_recommendation`、`decide_style_status` | 是 | `agent_decisions`、`recommendation_snapshots`、`recommendation_items`、`nail_styles`、`agent_pending_reviews` |
| 9. 继续观察 | 提案未通过或不确定 | `continue_observation` | 是 | `agent_findings`、`agent_evidence_links` |
| 10. 结束运行 | 记录本轮总结 | `complete_agent_run` | 是 | `agent_runs` |

## 5. 阶段 0：开始运行

### 5.1 start_agent_run

用途：创建本轮 Agent 运行记录。

输入：

```json
{
  "trigger_type": "manual_demo | scheduled_12h",
  "window_hours": 12,
  "history_rounds": 5
}
```

返回：

```json
{
  "agent_run_id": "RUN202606040001",
  "status": "running",
  "window_hours": 12,
  "history_rounds": 5,
  "started_at": "2026-06-04T10:00:00+08:00"
}
```

落库：

```text
agent_runs.agent_run_id
agent_runs.trigger_type
agent_runs.status = running
agent_runs.started_at
```

## 6. 阶段 1：聚合本轮数据

### 6.1 rollup_behavior_window

用途：读取近 12 小时 `behavior_events`，生成本轮款式热度快照和标签热度快照。

`style_heat_snapshots` 应覆盖当前所有 `listed` 款式，而不是只写入有行为事件的款式。例如当前主库有 50 个已上架款式，本轮就应写入 50 条 `style_heat_snapshots`。没有点击、试戴、收藏的款式也需要写入 0 值记录，便于 Agent 判断冷款、下滑款和推荐位占用问题。

候选池 `candidate` 款式不写入本轮 `style_heat_snapshots`，因为它们尚未在 C 端展示，没有平台行为数据。候选池机会由 `get_operation_context` 单独读取候选池款式及其 `color_tags` / `length_tags`，再与当前 tag 热度趋势匹配。

输入：

```json
{
  "agent_run_id": "RUN202606040001",
  "window_hours": 12,
  "history_rounds": 5
}
```

读取：

```text
behavior_events
nail_styles
nail_visual_features
```

返回：

```json
{
  "window_start": "2026-06-03T22:00:00+08:00",
  "window_end": "2026-06-04T10:00:00+08:00",
  "style_heat_snapshot_ids": ["SH001", "SH002"],
  "tag_heat_snapshot_ids": ["TH001", "TH002"],
  "style_count": 50,
  "tag_count": 12,
  "summary": {
    "total_click_count": 320,
    "total_tryon_count": 86,
    "total_favorite_count": 41
  }
}
```

落库：

```text
style_heat_snapshots.agent_run_id
style_heat_snapshots.style_id
style_heat_snapshots.window_start
style_heat_snapshots.window_end
style_heat_snapshots.click_count
style_heat_snapshots.tryon_count
style_heat_snapshots.favorite_count
style_heat_snapshots.heat_score
style_heat_snapshots.growth_score
style_heat_snapshots.conversion_score

tag_heat_snapshots.agent_run_id
tag_heat_snapshots.tag_type
tag_heat_snapshots.tag_value
tag_heat_snapshots.window_start
tag_heat_snapshots.window_end
tag_heat_snapshots.click_count
tag_heat_snapshots.tryon_count
tag_heat_snapshots.favorite_count
tag_heat_snapshots.heat_score
tag_heat_snapshots.growth_score
tag_heat_snapshots.conversion_score
```

同时更新：

```text
agent_runs.input_summary.rollup_summary
```

## 7. 阶段 2：复盘上一轮

### 7.1 get_due_review_context

用途：读取已到复盘窗口的待复盘事项，并准备动作前后指标。

输入：

```json
{
  "agent_run_id": "RUN202606040001",
  "now": "2026-06-04T10:00:00+08:00"
}
```

读取：

```text
agent_pending_reviews
agent_decisions
agent_decision_items
style_heat_snapshots
tag_heat_snapshots
recommendation_items
```

返回：

```json
{
  "due_reviews": [
    {
      "pending_review_id": "PR001",
      "decision_id": "DEC001",
      "review_type": "recommendation_change",
      "style_id": "STYLE018",
      "action_type": "promote_recommendation",
      "before_metrics": {
        "rank_no": 24,
        "click_count": 18,
        "tryon_count": 5,
        "favorite_count": 2
      },
      "after_metrics": {
        "rank_no": 8,
        "click_count": 31,
        "tryon_count": 13,
        "favorite_count": 7
      },
      "metric_delta": {
        "tryon_count_delta": 8,
        "favorite_count_delta": 5
      }
    }
  ]
}
```

不直接落库。

### 7.2 write_strategy_memory

用途：Agent 根据复盘上下文判断动作是否有效，写入复盘记忆。

输入：

```json
{
  "reviews": [
    {
      "pending_review_id": "PR001",
      "outcome": "positive | neutral | negative",
      "outcome_score": 0.76,
      "lesson": "裸粉短甲提升推荐位后试戴和收藏均上涨，下次同类趋势可优先放量。",
      "next_suggestion": "遇到裸粉短甲 tag 增长时，可优先考虑推荐位提升。"
    }
  ],
  "summary": "完成 1 条推荐位调整复盘。"
}
```

返回：

```json
{
  "memory_ids": ["MEM001"],
  "completed_review_ids": ["PR001"]
}
```

落库：

```text
strategy_memories.memory_id
strategy_memories.memory_type
strategy_memories.source_pending_review_id
strategy_memories.source_decision_id
strategy_memories.tag_signature
strategy_memories.style_id
strategy_memories.action_type
strategy_memories.before_metrics
strategy_memories.after_metrics
strategy_memories.outcome_score
strategy_memories.lesson

agent_pending_reviews.status = completed
agent_pending_reviews.result_metrics
agent_pending_reviews.result_summary
agent_pending_reviews.memory_id
agent_pending_reviews.updated_at

agent_evidence_links.owner_type = memory
agent_evidence_links.owner_id = memory_id
agent_evidence_links.source_type = pending_review
agent_evidence_links.source_id = pending_review_id
```

## 8. 阶段 3：读取本轮运营上下文

### 8.1 get_operation_context

用途：一次性读取 Agent 本轮判断需要的全部上下文。

输入：

```json
{
  "agent_run_id": "RUN202606040001",
  "history_rounds": 5,
  "include_candidates": true,
  "include_memories": true
}
```

读取：

```text
recommendation_snapshots
recommendation_items
nail_styles
nail_visual_features
style_heat_snapshots
tag_heat_snapshots
agent_pending_reviews
strategy_memories
agent_findings
agent_decisions
```

返回：

```json
{
  "active_recommendation": {
    "snapshot_id": "RS_ACTIVE_001",
    "snapshot_type": "global_main",
    "items": [
      {
        "style_id": "STYLE018",
        "rank_no": 24,
        "color_tags": ["裸粉"],
        "length_tags": ["short"],
        "heat_score_current": 72.4,
        "growth_score_current": 18.2,
        "conversion_score_current": 0.41,
        "click_count_current": 31,
        "tryon_count_current": 13,
        "favorite_count_current": 7,
        "click_count_prev_avg": 16,
        "tryon_count_prev_avg": 4,
        "favorite_count_prev_avg": 2
      }
    ]
  },
  "tag_trends": [
    {
      "tag_type": "color",
      "tag_value": "裸粉",
      "heat_score_current": 190.2,
      "growth_score_current": 42.1,
      "conversion_score_current": 0.38,
      "style_count": 8
    }
  ],
  "candidate_styles": [
    {
      "style_id": "STYLE081",
      "color_tags": ["裸粉"],
      "length_tags": ["short"],
      "enhanced_image_url": "/images/enhanced/STYLE081.png",
      "matched_hot_tags": ["color:裸粉", "length:short"]
    }
  ],
  "due_review_count": 0,
  "recent_memories": [
    {
      "memory_id": "MEM001",
      "tag_signature": "color:裸粉|length:short",
      "action_type": "promote_recommendation",
      "outcome_score": 0.76,
      "lesson": "裸粉短甲提升推荐位后试戴和收藏均上涨。"
    }
  ],
  "constraints": {
    "max_promote_count": 5,
    "max_demote_count": 5,
    "max_list_candidate_count": 3,
    "review_window_hours_default": 12
  }
}
```

落库：

```text
agent_runs.input_summary.operation_context_summary
```

注意：

- `active_recommendation.items.rank_no` 是主推荐页当前排序依据。
- Agent 判断推荐位调整时必须读取 `rank_no`，否则无法判断“表现好但排名靠后”或“排名靠前但转化差”。
- 候选池款式不参与主推荐页展示，除非后续调用执行工具上架。

## 9. 阶段 4：自我诊断

这一阶段不直接调用写库工具，Agent 基于 `get_operation_context` 返回的数据做内部判断。

必须回答：

```text
是否存在异常款式？
是否存在运营机会？
是否存在颜色或长度 tag 趋势变化？
是否存在候选池款式与热 tag 匹配？
是否存在推荐位与表现不匹配？
上一轮动作是否已经复盘？
```

输出给下一阶段的内部结论：

```json
{
  "diagnosis": {
    "has_anomaly": true,
    "has_opportunity": true,
    "has_trend_change": true,
    "should_execute_action": false,
    "reason": "存在机会，但证据尚不足以直接执行推荐位调整。"
  }
}
```

## 10. 阶段 5：记录发现

这一阶段必须至少调用一个发现工具。

### 10.1 有异常：diagnose_anomaly

输入：

```json
{
  "anomaly_type": "high_click_low_tryon | high_tryon_low_favorite | tryon_failure_spike | tag_drop | recommendation_negative_effect | data_missing",
  "target_type": "style | tag | system",
  "target_id": "STYLE018",
  "severity": "low | medium | high",
  "summary": "STYLE018 点击增长但试戴转化明显偏低。",
  "suggested_followup": "continue_observation | demote_recommendation | unlist_to_candidate | none",
  "evidence_refs": []
}
```

返回：

```json
{
  "finding_id": "FIND001",
  "finding_type": "anomaly",
  "evidence_link_ids": ["EL001"]
}
```

落库：

```text
agent_findings.finding_id
agent_findings.agent_run_id
agent_findings.finding_type = anomaly
agent_findings.target_type
agent_findings.target_id
agent_findings.title
agent_findings.summary
agent_findings.evidence
agent_findings.score

agent_evidence_links.owner_type = finding
agent_evidence_links.owner_id = finding_id
```

### 10.2 有机会：discover_opportunity

输入：

```json
{
  "opportunity_type": "rising_style | rising_tag | candidate_match | recommendation_gap",
  "target_type": "style | tag | tag_combo | candidate | global",
  "target_id": "color:裸粉|length:short",
  "title": "裸粉短甲趋势上升",
  "summary": "近几轮裸粉短甲试戴与收藏持续上升。",
  "score": 0.82,
  "evidence_refs": []
}
```

返回：

```json
{
  "finding_id": "FIND002",
  "finding_type": "opportunity",
  "evidence_link_ids": ["EL002", "EL003"]
}
```

落库：

```text
agent_findings.finding_type = opportunity
agent_findings.target_type
agent_findings.target_id
agent_findings.title
agent_findings.summary
agent_findings.score
agent_evidence_links
```

### 10.3 无明确发现：continue_observation

输入：

```json
{
  "watch_type": "global_watch",
  "target_type": "global",
  "target_id": "global_main",
  "title": "本轮无明显动作机会，继续观察",
  "summary": "本轮点击、试戴、收藏整体稳定，没有出现足够明确的异常或机会。",
  "reason": "最近 N 轮数据变化不明显，不满足执行动作条件。",
  "evidence_refs": []
}
```

返回：

```json
{
  "finding_id": "FIND003",
  "finding_type": "watch",
  "evidence_link_ids": ["EL004"]
}
```

落库：

```text
agent_findings.finding_type = watch
agent_findings.target_type
agent_findings.target_id
agent_findings.summary
agent_evidence_links
```

## 11. 阶段 6：生成运营想法

Agent 在这一阶段只记录想法，不执行动作。

建议新增表：

```text
agent_action_proposals
```

### 11.1 record_action_proposals

用途：保存 Agent 想做什么，以及为什么想做。

输入：

```json
{
  "proposals": [
    {
      "proposal_type": "adjust_recommendation | list_candidate | unlist_to_candidate | start_experiment | no_action",
      "target_type": "style | candidate | tag | tag_combo | global",
      "target_ids": ["STYLE018"],
      "intended_action": "promote_recommendation",
      "hypothesis": "将 STYLE018 提升到前 10 后，试戴数和收藏数会继续增长。",
      "expected_metrics": [
        {
          "metric": "tryon_count",
          "direction": "increase",
          "min_delta": 5
        },
        {
          "metric": "favorite_count",
          "direction": "increase",
          "min_delta": 3
        }
      ],
      "rollback_condition": "12 小时后试戴数未增长，或收藏数低于动作前窗口。",
      "review_window_hours": 12,
      "confidence": 0.74,
      "evidence_refs": []
    }
  ],
  "summary": "本轮提出 1 个推荐位提升想法。"
}
```

返回：

```json
{
  "proposal_ids": ["PROP001"]
}
```

落库建议：

```text
agent_action_proposals.proposal_id
agent_action_proposals.agent_run_id
agent_action_proposals.proposal_type
agent_action_proposals.target_type
agent_action_proposals.target_ids
agent_action_proposals.intended_action
agent_action_proposals.hypothesis
agent_action_proposals.expected_metrics
agent_action_proposals.rollback_condition
agent_action_proposals.review_window_hours
agent_action_proposals.confidence
agent_action_proposals.status = pending_check
agent_action_proposals.created_at

agent_evidence_links.owner_type = proposal
agent_evidence_links.owner_id = proposal_id
```

如果本轮不适合行动，也应记录 `proposal_type = no_action`，这样 B 端能解释为什么不作为。

## 12. 阶段 7：执行前检查

### 12.1 validate_action_proposal

用途：检查提案是否允许进入执行阶段。

输入：

```json
{
  "proposal_id": "PROP001"
}
```

检查项：

```text
是否有数据依据
是否有明确假设
是否定义预期指标
是否定义回滚条件
是否定义复盘窗口
是否超过单轮操作上限
目标款式状态是否合法
是否存在互相冲突的动作
```

返回：

```json
{
  "proposal_id": "PROP001",
  "check_status": "approved | rejected",
  "failed_checks": [],
  "execution_tool": "adjust_recommendation",
  "execution_payload": {
    "strategy_type": "promote",
    "changes": [
      {
        "style_id": "STYLE018",
        "action": "promote",
        "reason": "近 N 轮试戴与收藏增长，且当前 rank_no 靠后。"
      }
    ],
    "experiment": {
      "experiment_type": "recommendation_boost",
      "review_window_hours": 12,
      "target_metrics": ["tryon_count", "favorite_count"]
    },
    "summary": "提升 STYLE018 推荐位并进入待复盘。",
    "requires_review": true,
    "evidence_refs": []
  }
}
```

落库：

```text
agent_action_proposals.status = approved | rejected
agent_action_proposals.check_result
agent_action_proposals.execution_tool
agent_action_proposals.execution_payload
agent_action_proposals.updated_at
```

如果 `check_status = rejected`，不得调用执行工具，应调用 `continue_observation` 记录原因。

## 13. 阶段 8：执行动作或继续观察

### 13.1 执行推荐位调整：adjust_recommendation

调用条件：

```text
proposal.check_status = approved
proposal.execution_tool = adjust_recommendation
```

落库：

```text
agent_decisions.action_type = promote_recommendation | demote_recommendation | start_experiment
agent_decision_items.item_action_type = promote | demote
recommendation_snapshots
recommendation_items
agent_pending_reviews
agent_evidence_links.owner_type = decision
```

注意：

- 后端基于当前 active `global_main` 快照生成完整新快照。
- 新快照生成完成前，C 端继续读取旧 active 快照。
- 全部写库完成后，新快照才标记为 `active`。

### 13.2 执行款式状态决策：decide_style_status

调用条件：

```text
proposal.check_status = approved
proposal.execution_tool = decide_style_status
```

落库：

```text
nail_styles.status
nail_styles.source_type
nail_styles.listed_at
agent_decisions
agent_decision_items
recommendation_snapshots
recommendation_items
agent_pending_reviews
agent_evidence_links.owner_type = decision
```

候选池上架规则：

```text
Agent 只决定上架哪些 candidate style_id
后端默认插入主推荐页第 11 位开始
多个候选款依次插入 11、12、13...
后端重新生成完整连续 rank_no
```

### 13.3 不执行：continue_observation

调用条件：

```text
没有提案
提案未通过检查
证据不足
指标或回滚条件不清晰
Agent 主动选择不作为
```

落库：

```text
agent_findings.finding_type = watch
agent_evidence_links
```

## 14. 阶段 9：结束运行

### 14.1 complete_agent_run

用途：结束本轮 Agent run，写入 B 端 Chat 可展示摘要。

输入：

```json
{
  "agent_run_id": "RUN202606040001",
  "output_summary": {
    "review_count": 1,
    "finding_count": 3,
    "proposal_count": 2,
    "executed_decision_count": 1,
    "watch_count": 1
  },
  "chat_summary": "本轮完成 1 条复盘，发现裸粉短甲趋势上升，提升 1 个款式推荐位，并记录 1 条继续观察。"
}
```

返回：

```json
{
  "agent_run_id": "RUN202606040001",
  "status": "completed",
  "completed_at": "2026-06-04T10:05:00+08:00"
}
```

落库：

```text
agent_runs.status = completed
agent_runs.output_summary
agent_runs.chat_summary
agent_runs.completed_at
```

## 15. 数据表修改建议

为了支持“生成运营想法，只是想法，没有实际行动”，建议新增：

### 15.1 agent_action_proposals

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `proposal_id` | string PK | 提案 ID |
| `agent_run_id` | string FK | 所属 Agent 运行 |
| `proposal_type` | string | `adjust_recommendation` / `list_candidate` / `unlist_to_candidate` / `start_experiment` / `no_action` |
| `target_type` | string | `style` / `candidate` / `tag` / `tag_combo` / `global` |
| `target_ids` | json array | 目标 ID 列表 |
| `intended_action` | string | 想执行的动作 |
| `hypothesis` | text | 明确假设 |
| `expected_metrics` | json array | 预期指标 |
| `rollback_condition` | text | 回滚条件 |
| `review_window_hours` | int nullable | 复盘窗口 |
| `confidence` | float nullable | Agent 对提案的信心 |
| `status` | string | `pending_check` / `approved` / `rejected` / `executed` / `skipped` |
| `check_result` | json object nullable | 执行前检查结果 |
| `execution_tool` | string nullable | 通过检查后要调用的执行工具 |
| `execution_payload` | json object nullable | 通过检查后的执行参数 |
| `decision_id` | string FK nullable | 执行后关联的决策 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

关系：

```text
agent_runs 1 -- N agent_action_proposals
agent_action_proposals 1 -- N agent_evidence_links
agent_action_proposals 0/1 -- 1 agent_decisions
```

对应 `agent_evidence_links.owner_type` 需要增加：

```text
proposal
```

## 16. 强制运行约束

每轮 Agent 必须满足：

```text
必须创建 agent_run
必须聚合本轮 style_heat_snapshots / tag_heat_snapshots
必须读取 active 推荐快照和 rank_no
必须读取候选池数据
必须读取待复盘事项
必须优先处理到期待复盘事项
必须至少调用一次发现工具
执行工具只能在提案通过检查后调用
所有改业务数据的动作必须写入 agent_decisions
所有改推荐页或款式状态的动作必须写入 agent_pending_reviews
证据不足时必须 continue_observation
本轮结束必须 complete_agent_run
```

## 17. B 端 Chat 展示逻辑

B 端 Chat 回答“本轮 Agent 做了什么”时，应按以下顺序读取：

```text
agent_runs
-> strategy_memories
-> agent_findings
-> agent_action_proposals
-> agent_decisions
-> agent_pending_reviews
-> agent_evidence_links
```

展示结构建议：

```text
本轮复盘了什么
本轮观察到什么
本轮提出了哪些运营想法
哪些想法通过检查
哪些动作被执行
哪些动作进入待复盘
哪些地方选择继续观察
```

这样 B 端看到的是 Agent 的完整推理轨迹，而不是只有最终动作。
