# Nails-Agent · 系统流程图

文档版本：v1 · 2026-06-03
配套 PRD：[`docs/PRD.md`](./PRD.md)
配套 schema：[`docs/data-model.md`](./data-model.md)

> 所有图均为 Mermaid 源码，GitHub / VSCode / Obsidian 等可直接渲染。

---

## 1. 高层系统架构

```mermaid
flowchart LR
    subgraph C [C 端]
        C1[主推荐页]
        C2[详情页]
        C3[手图上传 + 识别]
        C4[相似手型弹窗]
        C5[试戴流程]
        C6[收藏夹]
    end

    subgraph B [B 端]
        B1[Agent 看板]
        B2[B 端 Chat]
        B3[「运行下一轮 Agent」按钮]
    end

    subgraph API [后端 API]
        A1[REST / FastAPI]
        A2[试戴 wrap: ComfyCloud + Nano Banana 2]
        A3[Agent runner]
        A4[Heat 聚合 job]
    end

    subgraph DB [(SQLite)]
        D1[nail_styles / visual_features]
        D2[user_sessions / hand_profiles]
        D3[behavior_events / favorites / tryon_jobs]
        D4[recommendation_snapshots / items]
        D5[style_heat / tag_heat snapshots]
        D6[agent_runs / findings / decisions / memories]
    end

    C --> A1
    B --> A1
    A1 --> DB
    A1 --> A2
    A1 --> A3
    A3 --> A4
    A4 --> D5
    A3 --> D6
    A3 --> D4
```

---

## 2. C 端用户旅程

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant W as 前端
    participant API as 后端 API
    participant CF as ComfyCloud
    participant DB as SQLite

    U->>W: 打开主推荐页
    W->>API: GET /recommendations/main
    API->>DB: 取 active global_main snapshot + items + styles
    DB-->>API: 50 styles 排序结果
    API-->>W: 推荐列表
    W-->>U: 渲染卡片
    Note over W,DB: style_view 埋点（异步）

    U->>W: 上传手图
    W->>API: POST /hand-images
    API->>DB: 写 user_sessions / user_hand_images
    API->>API: 调手型识别 + 肤色识别
    API->>DB: 写 user_hand_profiles
    API-->>W: hand_shape / skin_tone
    W-->>U: 显示识别结果 + 弹出"相似手型"

    U->>W: 点击某个款式 → 详情页
    W->>API: GET /styles/:id
    API->>DB: 取 nail_styles + session_favorites
    DB-->>API: 详情
    API-->>W: 渲染
    Note over W,DB: style_click 埋点

    U->>W: 点「试戴」
    W->>API: POST /tryon-jobs
    API->>DB: 写 tryon_jobs(status=running)
    API->>CF: 上传 hand + style 图 → submit workflow
    CF-->>API: prompt_id
    loop poll
        API->>CF: GET /jobs/:id
        CF-->>API: status
    end
    CF-->>API: 输出图
    API->>DB: tryon_jobs.status=success, result_image_url
    Note over W,DB: tryon_success 埋点
    API-->>W: 试戴结果图
    W-->>U: 弹窗展示

    U->>W: 收藏
    W->>API: POST /favorites
    API->>DB: 写 session_favorites + behavior_events(favorite_add)
    API-->>W: ok
```

---

## 3. B 端 Agent 一轮闭环

```mermaid
flowchart TD
    Start([触发：「运行下一轮」按钮 / scheduled_12h]) --> R1[写 agent_runs.start]

    R1 --> AGG[聚合本轮 heat snapshots<br/>从 behavior_events 计算<br/>style_heat / tag_heat]
    AGG --> CTX[读上下文<br/>最近 N 轮 heat<br/>候选池 nail_styles status=candidate<br/>agent_pending_reviews<br/>strategy_memories]

    CTX --> WARMUP{历史快照<br/>是否充足?}
    WARMUP -- 否 --> WO[is_warmup_run = true<br/>只写本轮 heat<br/>findings = 仅观察]
    WO --> RFin([结束])

    WARMUP -- 是 --> REV[先处理已到 review window 的<br/>agent_pending_reviews]
    REV --> REV1[根据 result_metrics 写 strategy_memories<br/>更新 pending_reviews.status = completed]

    REV1 --> ANA[本轮分析]
    ANA --> ANA1[寻找运营机会<br/>→ findings opportunity]
    ANA --> ANA2[异常诊断<br/>→ findings anomaly]
    ANA --> ANA3[tag 趋势分析<br/>→ findings tag_trend]
    ANA --> ANA4[候选池机会匹配<br/>→ findings candidate_match]

    ANA1 --> DEC{需要改数据?}
    ANA2 --> DEC
    ANA3 --> DEC
    ANA4 --> DEC

    DEC -- 否 --> NOACT[no_action / watch_style<br/>只写 finding]
    NOACT --> SNAP

    DEC -- 是 --> ACT[执行动作]
    ACT --> ACT1[promote/demote_recommendation<br/>→ 写新 recommendation_snapshots]
    ACT --> ACT2[list_candidate / unlist_to_candidate<br/>→ 改 nail_styles.status]
    ACT --> ACT3[start_experiment / rollback_experiment<br/>→ 写 decision + 实验配置]

    ACT1 --> EV[写 agent_decisions<br/>+ decision_items<br/>+ evidence_links<br/>+ pending_reviews]
    ACT2 --> EV
    ACT3 --> EV
    EV --> SNAP

    SNAP[切换新 recommendation snapshot<br/>active 状态]
    SNAP --> Sum[写 agent_runs.chat_summary]
    Sum --> RFin
```

---

## 4. 试戴管线（最小细节）

```mermaid
sequenceDiagram
    autonumber
    participant FE as 前端
    participant API as 后端
    participant CF as ComfyCloud REST
    participant NB as Nano Banana 2

    FE->>API: POST /tryon-jobs<br/>{session_id, style_id, hand_image_id}
    API->>API: 取出 hand_image_url 与 style_image_url
    API->>CF: POST /upload/image (hand)
    CF-->>API: hand_name
    API->>CF: POST /upload/image (style)
    CF-->>API: nail_name
    API->>CF: POST /prompt<br/>{workflow = LoadImage×2 → ImageBatch → GeminiImage2Node → SaveImage,<br/> extra_data.api_key_comfy_org}
    CF-->>API: prompt_id
    API->>DB: tryon_jobs.status=running

    loop until terminal
        API->>CF: GET /jobs/:prompt_id
        CF-->>API: status
    end

    alt status = completed
        CF->>NB: (内部) 多图 image-edit 调用
        NB-->>CF: 输出图
        API->>CF: GET /view?filename=...
        CF-->>API: PNG bytes
        API->>API: 落盘到 data/tryon_results/
        API->>DB: tryon_jobs.status=success<br/>result_image_url=本地路径
        API-->>FE: 试戴结果 URL
    else status = failed
        API->>DB: tryon_jobs.status=failed<br/>error_message
        API-->>FE: 失败提示
    end
```

---

## 5. 推荐快照切换（避免半更新状态）

```mermaid
flowchart LR
    OLD[(active snapshot v_n)]:::active
    NEW[(new snapshot v_n+1)]:::building

    A1[Agent 决策] --> A2[创建新 snapshot status=building]
    A2 --> A3[写完整 recommendation_items]
    A3 --> A4{所有 Agent 动作完成?}
    A4 -- 否 --> A5[等其他动作]
    A5 --> A4
    A4 -- 是 --> A6[原子切换<br/>OLD.status=archived<br/>NEW.status=active]
    A6 --> A7[前端下次请求拿到 NEW]

    classDef active fill:#cfc,stroke:#393
    classDef building fill:#eee,stroke:#999
```

---

## 6. 数据资产 ↔ 系统组件映射（v1 Demo）

```mermaid
flowchart LR
    subgraph Assets [仓库内静态资产]
        AS1[data/styles/enhanced_style_01..50.png<br/>主 50 styles]
        AS2[data/nail_refs.csv<br/>50 candidate]
        AS3[data/hand_models/pool/*.png<br/>14 canonical hands]
        AS4[data/tryon_v2/canon_*.png<br/>100 演示试戴图]
    end

    subgraph Seed [scripts/seed_db.py]
        S1[写 50 listed styles]
        S2[写 50 candidate styles]
        S3[mock sessions + profiles]
        S4[mock behavior_events]
        S5[第一轮 heat snapshots]
        S6[初始 active snapshot]
    end

    subgraph Runtime [运行时]
        R1[ComfyCloud 试戴 wrap]
        R2[Agent runner]
        R3[前端]
    end

    AS1 --> S1
    AS2 --> S2
    S1 --> Runtime
    S2 --> Runtime
    S3 --> Runtime
    S4 --> Runtime
    S5 --> Runtime
    S6 --> Runtime

    AS4 -.展示用.-> R3
    AS3 -.可作用户上传手图的样例.-> R3
```
