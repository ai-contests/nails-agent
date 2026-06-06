# AI 运营智能体系统交接文档

本篇文档总结了 AI 运营智能体（Agent）系统的当前运行状态、最近的异常修复、系统架构细节及验证流程，以便交接给 Codex 或其他开发人员进行后续维护。

## 1. 系统架构概述

AI 运营智能体在平台中充当自主运营经理的角色：
- **指标聚合**：从 SQLite 数据库中按窗口期聚合用户的行为事件（包括款式点击量、试戴成功量、收藏添加量）。
- **自诊断**：将聚合出的数据（如款式热度、标签热度、当前推荐列表、历史决策记忆）组装成上下文 Prompt，调用魔搭（ModelScope）平台上的 `MiniMax-M2.5` 免费大模型。
- **动作提案**：模型分析数据后返回结构化的 JSON 数据，生成发现事项（Findings）及操作提案（Proposals）。
- **执行与守卫**：提案通过安全规则校验后被自动批准并执行，重新计算推荐权重，并将全新的激活状态**推荐快照**（`RECS_...`）持久化写入数据库。

---

## 2. 最近的修复记录（2026年6月）

我们解决了手动触发智能体运行周期时发生无声卡死、前端永久加载，并最终回退为“基线观察（Baseline Observation）”的报错：

### 2.1 提高大模型接口超时阈值
- **对应文件**：[src/services/llm.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/services/llm.ts)
- **修改详情**：将 `fetch` 请求的 Abort 超时限制由原来的 `50000ms`（50秒）合理放宽至 `90000ms`（90秒）。
- **优化原理**：在魔搭平台的共享免费推理环境下，对于 2.8KB 左右的复杂运营上下文 Prompt，模型生成包含多条 tool 调用及长字符串描述的 JSON 时，实际通常需要 60 到 75 秒。之前的 50 秒限制会在模型生成完毕前发出 Abort 信号将其强行掐断，导致 3 次重试全员超时报错。

### 2.2 增加 Markdown 格式防御性过滤
- **对应文件**：[src/agent/agentToolRegistry.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/agentToolRegistry.ts)
- **修改详情**：在将模型返回文本送入 `JSON.parse` 之前，增加防御性清洗过滤，自动剥离头尾可能携带的 markdown 代码块标记（如 ` ```json ` 和 ` ``` `）。
- **优化原理**：防备大模型在偶尔未遵循严格 json 模式输出而带上代码块包裹时，导致解析器直接崩溃而丢失决策。

### 2.3 异常日志透出优化
- **对应文件**：[src/agent/orchestrator.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/orchestrator.ts)
- **修改详情**：将 Orchestrator 捕获异常处的 `console.warn` 升级为带错误堆栈的 `console.error`，并完整打印 LLM 吐出的原始 `responseText`，极大方便以后定位问题。

### 2.4 人类可读的决策描述
- **对应文件**：[src/agent/tools.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/tools.ts)
- **修改详情**：将原本冷冰冰的“系统生成了推荐快照 RECS_...”改为了大模型提供的意图操作字段（例如：“将高热度款式 STYLE002 和 STYLE047 加入激活推荐”）。
- **优化原理**：当快照更新时，决策详情会以极其直观、具有可读性的人类语言展示在管理后台面板中，极大提升了录制演示视频和实际运营时的观感体验。

---

## 3. 系统验证与调试流程

若要在命令行手动测试 Agent 的运行状态，可以直接执行巡检脚本：
```bash
bun run scripts/run-cycle.ts
```

### 正常运行的控制台输出参考
运行成功后，控制台会打印类似下文的日志：
```
[Agent Cycle] Starting run, trigger: manual_demo
[Agent Cycle] Aggregating behavior events for run RUN_1780738145839_mdktb2o
[Agent Cycle] Reviewing past pending actions
[Agent Cycle] Loading current context
[Agent Cycle] Performing self-diagnosis using LLM...
[LLM] Calling API: https://api-inference.modelscope.cn/v1/chat/completions, model: MiniMax/MiniMax-M2.5, payload size: 2816 bytes
[LLM] API response status: 200
[Agent Cycle] LLM Response Content: { "toolCalls": [...] }
[Agent Cycle] Executing 1 approved actions
[Agent Cycle] Completed run RUN_1780738145839_mdktb2o
```

您可以启动 Drizzle Studio (`bun run db:studio`) 或是直接执行 SQLite 客户端连接到 `data/nails.db`，查看以下几张表的数据变化：
- `agent_runs`
- `agent_decisions`
- `agent_findings`
- `agent_action_proposals`

---

## 4. 后续注意事项与已知限制

1. **模型选择**：魔搭平台免费 API-Inference 中，目前仅 `MiniMax-M2.5` 模型能够成功响应 JSON 格式 payload。其他大语言模型（如 Qwen2.5 系列）暂时由于未配置 active provider 无法使用。
2. **Context 体积控制**：将输入 Payload 严格限制在 3KB 以下。若以后新增款式或标签，请继续在 [src/agent/orchestrator.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/orchestrator.ts) 中将 top 款式数量、top 标签数量等维持在 2-3 个以内，避免因输入数据过长导致模型推理延迟超过 90 秒。

