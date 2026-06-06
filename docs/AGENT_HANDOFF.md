# AI Agent System Handover Documentation

This document summarizes the current status, recent fixes, architecture details, and verification steps of the AI Agent system to facilitate handover to Codex or other developers.

## 1. System Overview

The AI Agent acts as an autonomous Operations Manager for the nail design platform:
- **Metrics Rollup**: Aggregates user behavior events (`style_click`, `tryon_success`, `favorite_add`) from the SQLite database.
- **Self-Diagnosis**: Packages the aggregated data (Style Heat, Tag Heat, Recommendations, Strategy Memories) into a prompt and calls `MiniMax-M2.5` on the ModelScope platform to diagnose anomalies and discover opportunities.
- **Action Proposal**: The model responds with JSON schemas detailing proposed actions (e.g. promoting styles, modifying recommendations).
- **Execution & Guardrails**: Approved proposals are executed, which rebuilds recommendation rankings and persists new active **Recommendation Snapshots** (`RECS_...`) into the database.

---

## 2. Recent Fixes (June 2026)

We resolved the issue where triggering the Agent manually resulted in a silent failure or an endless loading state, falling back to a `Baseline Observation`:

### 2.1 Increased LLM Timeout
- **Location**: [src/services/llm.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/services/llm.ts)
- **Change**: Increased the fetch abort timeout from `50000ms` (50s) to `90000ms` (90s).
- **Rationale**: Miniature prompts reply in ~7s, but processing a real operation cycle context prompt (~2.8KB payload) and generating a lengthy JSON schema with multiple tool calls and descriptive string parameters takes between 60 to 75 seconds on ModelScope's shared inference environment. A 50-second cutoff forced the client to abort prematurely, returning a fallback baseline.

### 2.2 Defensive Markdown Parsing
- **Location**: [src/agent/agentToolRegistry.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/agentToolRegistry.ts)
- **Change**: Added helper logic to check for and strip markdown code block wrappers (e.g. ` ```json ` and ` ``` `) from the raw response text before passing it to `JSON.parse`.
- **Rationale**: If the LLM wraps its JSON inside markdown tags, `JSON.parse` originally crashed. Defensive stripping guarantees robustness.

### 2.3 Verbose Error Logging
- **Location**: [src/agent/orchestrator.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/orchestrator.ts)
- **Change**: Upgraded the generic `console.warn` inside the orchestrator catch block to a full `console.error` and logged the raw LLM response string to make future debugging straightforward.

### 2.4 Human-Readable Decision Summaries
- **Location**: [src/agent/tools.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/tools.ts)
- **Change**: Replaced the dry `"Agent batch generated recommendation snapshot RECS_..."` log string with the descriptive, LLM-generated `"intended_action"` (e.g., `"Add high-heat styles STYLE002 and STYLE047 to active recommendations"`).
- **Rationale**: Displays intuitive operational descriptions in the Admin Dashboard, which is critical for product demonstrations and recordings.

---

## 3. Verification & Debugging Workflow

To manually test the AI Agent execution loop, run the cycle script directly via CLI:
```bash
bun run scripts/run-cycle.ts
```

### Expected Output Logs
If the run succeeds, you will see output similar to this:
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

You can inspect the SQLite database (`data/nails.db`) using tools like Drizzle Studio (`bun run db:studio`) or raw sqlite3 queries to inspect:
- `agent_runs`
- `agent_decisions`
- `agent_findings`
- `agent_action_proposals`

---

## 4. Next Steps & Known Limitations

1. **Model Choices**: MiniMax-M2.5 is the only model supported by ModelScope's shared API-Inference that successfully returns JSON structure payloads. Other models (like Qwen2.5) are currently not configured with active providers.
2. **Context Compression**: Keep payload sizes below 3KB. If new styles or logs are added to the platform, continue limiting top styles, top tag categories, and active recommendations to Top 2 or 3 in [src/agent/orchestrator.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/agent/orchestrator.ts) to prevent the LLM inference from slowing down beyond the 90s limit.

