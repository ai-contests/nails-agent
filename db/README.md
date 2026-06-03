# @nails-agent/db

SQLite schema + seed for nails-agent.

- ORM: Drizzle ORM + better-sqlite3
- DB file: `data/nails.db`（gitignored）
- Schema: 17 张表对齐 `docs/data-model.md` §4–§8

## 一键启动

```bash
# 仓库根 .env 已有 SQLITE_PATH（可选；默认 data/nails.db）
cd db
npm install
npm run db:setup
```

`db:setup` 串起：

1. **`db:reset`** —— 删 `data/nails.db`（含 WAL/SHM）
2. **`db:migrate`** —— drizzle-kit push，按 schema 建 17 张表 + 全部索引
3. **`db:seed`** —— 读 `data/extraction/manifest.json`，写：
   - 100 条 `nail_styles`（50 listed + 50 candidate）
   - 100 条 `nail_visual_features`（颜色/长度/raw bbox 全在）
   - 1 条 active `recommendation_snapshots(global_main)` + 50 条 `recommendation_items`（listed 随机排序）
4. **`db:check`** —— 打印每张表的行数 + 抽样

## 单步

```bash
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:check
```

## 前置条件

`tools/extraction` 必须先跑过，产出 `data/extraction/manifest.json`：

```bash
cd ../tools/extraction
npm install
npm run extract
```

## DB schema 总览

| 模块 | 表 |
|---|---|
| 款式 | `nail_styles`, `nail_visual_features` |
| 用户 | `user_sessions`, `user_hand_images`, `user_hand_profiles` |
| 行为 | `behavior_events`, `session_favorites`, `tryon_jobs` |
| 推荐 | `recommendation_snapshots`, `recommendation_items` |
| 热度 | `style_heat_snapshots`, `tag_heat_snapshots` |
| Agent | `agent_runs`, `agent_findings`, `agent_decisions`, `agent_decision_items`, `agent_evidence_links`, `agent_pending_reviews`, `strategy_memories` |
| Chat | `agent_chat_sessions`, `agent_chat_messages` |

字段 / 索引 / 外键完整对齐 `docs/data-model.md`。

## 本次 seed 不写的表

| 表 | 何时写 |
|---|---|
| `user_sessions` / `user_hand_*` / `behavior_events` / `tryon_jobs` / `session_favorites` | 下一轮 mock 行为生成器 |
| `style_heat_snapshots` / `tag_heat_snapshots` | mock 行为之后聚合 |
| `agent_*` / `strategy_memories` / `agent_chat_*` | Agent 跑第一轮时 |
