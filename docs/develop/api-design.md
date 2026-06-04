# Nails-Agent API 接口设计规范文档

本规范详细定义了 **Nails-Agent** 平台前后台交互的 REST API 接口设计。

## 设计规范与约定

1. **传输协议**：基于 HTTP/1.1 协议的 REST API 接口。请求与响应的载荷格式统一为 `application/json`。
2. **命名法约定**：
   - **前端载荷 (Request/Response JSON)**：统一使用 **`camelCase`（小驼峰命名法）**，如 `sessionId`, `styleId`, `imageUrl`。
   - **数据库物理表**：统一使用 **`snake_case`（下划线蛇形命名法）**，如 `session_id`, `style_id`, `image_url`。
   - **数据映射**：后端路由控制器层负责在这两层结构之间进行自动键名命名法的映射与转换。
3. **HTTP 状态码规范**：
   - `200 OK`：请求成功处理并返回。
   - `201 Created`：资源成功创建（如适用）。
   - `400 Bad Request`：请求缺少必要参数或数据格式校验未通过。
   - `404 Not Found`：所请求的目标资源不存在。
   - `500 Internal Server Error`：后端服务执行错误。

---

## 1. 消费者端 (C端) API 接口

### 1.1 获取主推荐美甲列表
获取由运营 Agent 生成并当前处于激活状态的全局主推荐美甲快照列表。

- **请求方式**：`GET`
- **请求路径**：`/api/recommendations/main`
- **查询参数**：
  - `sessionId` (string, 可选)：当前的消费者会话 ID。若传入，系统将异步记录页面曝光数据。
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "snapshotId": "RECS_1780484914_abc",
      "activatedAt": "2026-06-04T12:00:00Z",
      "items": [
        {
          "itemId": "RECI_1780484920_xyz",
          "rankNo": 1,
          "score": 98.5,
          "reason": "Agent 运营位提权推荐",
          "style": {
            "styleId": "STYLE001",
            "sourceType": "internal_seed",
            "status": "listed",
            "imageUrl": "/data/styles/style_01.png",
            "enhancedImageUrl": "/data/styles/enhanced_style_01.png",
            "colorTags": "[\"nude\", \"pink\"]",
            "lengthTags": "[\"medium\"]",
            "isAvailableForTryon": true,
            "listedAt": "2026-06-03T12:00:00Z",
            "createdAt": "2026-06-03T12:00:00Z",
            "updatedAt": "2026-06-03T12:00:00Z"
          }
        }
      ]
    }
    ```
- **数据库操作与副作用**：
  - 检索 `recommendation_snapshots` 表中 `snapshot_type = 'global_main'` 且 `status = 'active'` 的快照。
  - 内联结 `recommendation_items` 表与 `nail_styles` 表，根据 `rank_no`（排序序号）升序排列输出。
  - *异步副作用*：若请求传入了 `sessionId`，则为返回列表中的前 10 个美甲款式在 `behavior_events` 表中写入类型为 `style_view`（曝光）的记录。

---

### 1.2 获取款式详情
获取指定美甲款式的详细元数据、提取的视觉特征以及当前用户的收藏状态。

- **请求方式**：`GET`
- **请求路径**：`/api/styles/:id`
- **查询参数**：
  - `sessionId` (string, 可选)：消费者会话 ID。用以校验该款式是否已被该用户收藏，并记录点击日志。
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "style": {
        "styleId": "STYLE001",
        "sourceType": "internal_seed",
        "status": "listed",
        "imageUrl": "/data/styles/style_01.png",
        "enhancedImageUrl": "/data/styles/enhanced_style_01.png",
        "colorTags": "[\"nude\", \"pink\"]",
        "lengthTags": "[\"medium\"]",
        "isAvailableForTryon": true,
        "listedAt": "2026-06-03T12:00:00Z",
        "createdAt": "2026-06-03T12:00:00Z",
        "updatedAt": "2026-06-03T12:00:00Z"
      },
      "features": {
        "visualFeatureId": "VF001",
        "styleId": "STYLE001",
        "primaryColorFamily": "nude",
        "primaryColorName": "soft nude",
        "primaryColorRgb": "[218,186,170]",
        "dominantPalette": "[[218,186,170], [240,230,220]]",
        "colorConfidence": 0.95,
        "secondaryColorFamily": null,
        "secondaryColorName": null,
        "secondaryColorRgb": null,
        "secondaryColorConfidence": null,
        "nailCropUrl": "/data/crops/crop_01.png",
        "lengthTag": "medium",
        "lengthRatio": 0.42,
        "lengthConfidence": 0.91,
        "extractorVersion": "1.0.0",
        "rawFeatures": "{}",
        "createdAt": "2026-06-03T12:00:00Z"
      },
      "isFavorited": false
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing style ID" }
    ```
  - `404 Not Found`：
    ```json
    { "error": "Style not found" }
    ```
- **数据库操作与副作用**：
  - 查询 `nail_styles` 款式表与 `nail_visual_features` 特征表。
  - 若传入 `sessionId`，则从 `session_favorites` 中检索是否存在该用户对该款式的激活（`is_active = true`）收藏记录。
  - 若传入 `sessionId`，则向 `behavior_events` 中自动插入一条类型为 `style_click`（点击）的行为日志。

---

### 1.3 上传手部照片并提取特征
上传消费者的手部照片，通过图像分析提取其骨骼手型与基础肤色级别。

- **请求方式**：`POST`
- **请求路径**：`/api/hand-images`
- **数据格式**：Multipart FormData（文件表单）
  - `file` (二进制文件)：用户拍摄的手部图片。
  - `clientId` (string, 可选)：物理设备/客户端唯一标识，用于 session 关联。
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "sessionId": "SES_1780484920_abc",
      "handImageId": "IMG_1780484920_xyz",
      "imageUrl": "/data/hand_uploads/IMG_1780484920_xyz_photo.png",
      "handShape": "slender_long",
      "skinTone": "fair"
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "No file uploaded" }
    ```
- **数据库操作与副作用**：
  - 向 `user_sessions` 表中写入一条新的会话记录（并自动生成 `sessionId`）。
  - 将手部照片写入本地持久化目录 `/data/hand_uploads/`，同时向 `user_hand_images` 写入文件记录。
  - 调用 CV 特征分析接口，计算长宽比与皮肤色差。
  - 将计算出的手型与肤色记录保存至 `user_hand_profiles` 中。

---

### 1.4 触发虚拟试戴任务
提交试戴任务，将指定美甲款式的设计花纹渲染到用户上传的手模图片上。

- **请求方式**：`POST`
- **请求路径**：`/api/tryon-jobs`
- **请求体 (JSON)**：
  ```json
  {
    "sessionId": "SES_1780484920_abc",
    "styleId": "STYLE001",
    "handImageId": "IMG_1780484920_xyz"
  }
  ```
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "tryonJobId": "JOB_1780484925_pqr",
      "status": "running"
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing parameters" }
    ```
  - `404 Not Found`：
    ```json
    { "error": "Hand image or Style not found" }
    ```
- **数据库操作与副作用**：
  - 检查 `user_hand_images` 表与 `nail_styles` 表，验证输入的图片与款式主键是否合法存在。
  - 向 `tryon_jobs` 表中写入一条状态为 `pending` 的试戴工作日志，并向 `behavior_events` 写入一条 `tryon_start` 行为事件。
  - *异步后台线程*：调用 ComfyCloud REST 客服端上传图片，提交拼装好的工作流 JSON 图纸，开始退避轮询生图结果，最后下载结果图片写入本地硬盘并改写 `tryon_jobs` 的最终状态为 `success` 或 `failed`。

---

### 1.5 查询虚拟试戴任务状态
前端使用短轮询定期查询试戴任务的状态和最终合成的图片路径。

- **请求方式**：`GET`
- **请求路径**：`/api/tryon-jobs/:id`
- **查询参数**：无
- **请求体**：无
- **返回响应**：
  - `200 OK` (试戴生成成功)：
    ```json
    {
      "tryonJobId": "JOB_1780484925_pqr",
      "sessionId": "SES_1780484920_abc",
      "styleId": "STYLE001",
      "handImageId": "IMG_1780484920_xyz",
      "status": "success",
      "inputHandImageUrl": "/data/hand_uploads/IMG_1780484920_xyz_photo.png",
      "styleImageUrl": "/data/styles/style_01.png",
      "resultImageUrl": "/data/tryon_results/JOB_1780484925_pqr.png",
      "errorMessage": null,
      "comfyuiWorkflowId": "prompt-id-12345",
      "createdAt": "2026-06-04T12:01:00Z",
      "startedAt": "2026-06-04T12:01:01Z",
      "finishedAt": "2026-06-04T12:01:21Z"
    }
    ```
  - `200 OK` (试戴任务仍在生成中)：
    ```json
    {
      "tryonJobId": "JOB_1780484925_pqr",
      "sessionId": "SES_1780484920_abc",
      "styleId": "STYLE001",
      "handImageId": "IMG_1780484920_xyz",
      "status": "running",
      "inputHandImageUrl": "/data/hand_uploads/IMG_1780484920_xyz_photo.png",
      "styleImageUrl": "/data/styles/style_01.png",
      "resultImageUrl": null,
      "errorMessage": null,
      "comfyuiWorkflowId": "prompt-id-12345",
      "createdAt": "2026-06-04T12:01:00Z",
      "startedAt": "2026-06-04T12:01:01Z",
      "finishedAt": null
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing job ID" }
    ```
  - `404 Not Found`：
    ```json
    { "error": "Job not found" }
    ```
- **数据库操作与副作用**：
  - 从 `tryon_jobs` 表中根据试戴主键检索当前记录并返回。

---

### 1.6 收藏或取消收藏美甲款式
切换当前会话中对指定美甲款式的收藏状态。

- **请求方式**：`POST`
- **请求路径**：`/api/favorites`
- **请求体 (JSON)**：
  ```json
  {
    "sessionId": "SES_1780484920_abc",
    "styleId": "STYLE001",
    "isActive": true
  }
  ```
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "success": true,
      "isActive": true
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing params" }
    ```
- **数据库操作与副作用**：
  - 向 `session_favorites` 写入或更新收藏数据。如果该行已经存在，更新其 `is_active` 状态与时间戳。
  - 向 `behavior_events` 表中写入 `favorite_add`（收藏）或 `favorite_remove`（取消收藏）事件。

---

### 1.7 获取已收藏美甲列表
拉取当前会话中用户收藏的所有美甲款式。

- **请求方式**：`GET`
- **请求路径**：`/api/favorites`
- **查询参数**：
  - `sessionId` (string, 必填)：会话 ID。
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "items": [
        {
          "styleId": "STYLE001",
          "sourceType": "internal_seed",
          "status": "listed",
          "imageUrl": "/data/styles/style_01.png",
          "enhancedImageUrl": "/data/styles/enhanced_style_01.png",
          "colorTags": "[\"nude\", \"pink\"]",
          "lengthTags": "[\"medium\"]",
          "isAvailableForTryon": true,
          "listedAt": "2026-06-03T12:00:00Z",
          "createdAt": "2026-06-03T12:00:00Z",
          "updatedAt": "2026-06-03T12:00:00Z"
        }
      ]
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing session ID" }
    ```
- **数据库操作与副作用**：
  - 内联结 `session_favorites` 和 `nail_styles` 表，过滤出 `session_id = sessionId` 且 `is_active = true` 状态的美甲。

---

### 1.8 相似手型辅助推荐
获取与当前上传手型匹配的热门推荐美甲款式列表。

- **请求方式**：`GET`
- **请求路径**：`/api/similar-hand-recommendations`
- **查询参数**：
  - `sessionId` (string, 必填)：当前会话 ID。
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "handShape": "slender_long",
      "skinTone": "fair",
      "items": [
        {
          "styleId": "STYLE001",
          "sourceType": "internal_seed",
          "status": "listed",
          "imageUrl": "/data/styles/style_01.png",
          "enhancedImageUrl": "/data/styles/enhanced_style_01.png",
          "colorTags": "[\"nude\", \"pink\"]",
          "lengthTags": "[\"medium\"]",
          "isAvailableForTryon": true,
          "listedAt": "2026-06-03T12:00:00Z",
          "createdAt": "2026-06-03T12:00:00Z",
          "updatedAt": "2026-06-03T12:00:00Z"
        }
      ]
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing session ID" }
    ```
- **数据库操作与副作用**：
  - 从 `user_hand_profiles` 查询会话的手型特征。若手型未知或未找到上传，则降级返回全局最热的 15 款上架款式。
  - 从款式表中检索包含对应标签的美甲集合（例如手型纤长偏好中长及裸粉色）。

---

## 2. 后台管理与 Agent 端 (B端) API 接口

### 2.1 手动触发 Agent 巡检
手动拉起 11 阶段的运营中枢巡检，进行行为数据热度聚合、商机寻找、到期方案复盘与快照更新。

- **请求方式**：`POST`
- **请求路径**：`/api/admin/run`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "status": "triggered",
      "message": "手动触发运营 Agent 巡检任务启动成功。"
    }
    ```
- **数据库操作与副作用**：
  - *异步后台线程*：异步启动 `runOperationCycle` 工作流。在后台建立热度快照、读取待复盘事项、进行 LLM 逻辑判断、向数据库写入诊断和提案动作，最终将新排布好的快照原子替换上线。

---

### 2.2 获取 Agent 历史运行列表
获取 Agent 历史巡检记录的高层运行摘要列表。

- **请求方式**：`GET`
- **请求路径**：`/api/admin/runs`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "runs": [
        {
          "agentRunId": "RUN_1780484920_abc",
          "triggerType": "manual_demo",
          "status": "completed",
          "isWarmupRun": false,
          "inputSummary": "{\"totalClickCount\":24}",
          "outputSummary": "{}",
          "chatSummary": "指标分析完毕，共执行了 2 项款式状态微调动作。",
          "errorMessage": null,
          "startedAt": "2026-06-04T12:00:00Z",
          "completedAt": "2026-06-04T12:00:15Z"
        }
      ]
    }
    ```
- **数据库操作与副作用**：
  - 查询 `agent_runs` 表，并根据启动时间 `started_at` 降序排列。

---

### 2.3 获取某次 Agent 运行明细
获取指定运营巡检的详细运行状态，包括本轮产生的所有商机发现（findings）、执行决策（decisions）和方案草案（proposals）。

- **请求方式**：`GET`
- **请求路径**：`/api/admin/runs/:id`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "run": {
        "agentRunId": "RUN_1780484920_abc",
        "triggerType": "manual_demo",
        "status": "completed",
        "isWarmupRun": false,
        "inputSummary": "{\"totalClickCount\":24}",
        "outputSummary": "{}",
        "chatSummary": "指标分析完毕，共执行了 2 项款式状态微调动作。",
        "errorMessage": null,
        "startedAt": "2026-06-04T12:00:00Z",
        "completedAt": "2026-06-04T12:00:15Z"
      },
      "findings": [
        {
          "findingId": "FDG_1780484920_f1",
          "agentRunId": "RUN_1780484920_abc",
          "findingType": "opportunity",
          "targetType": "style",
          "targetId": "STYLE001",
          "title": "高热度美甲推荐机会",
          "summary": "美甲 STYLE001 的点击到试戴转化率达 85%，表现极佳",
          "evidence": "{}",
          "score": 0.9,
          "createdAt": "2026-06-04T12:00:05Z"
        }
      ],
      "decisions": [
        {
          "decisionId": "DEC_1780484920_d1",
          "agentRunId": "RUN_1780484920_abc",
          "actionType": "promote_recommendation",
          "targetType": "recommendation_snapshot",
          "targetId": "RECS_1780484920_s1",
          "title": "调升款式 STYLE001 排位",
          "summary": "基于高转化行为，将 STYLE001 调至主推荐第 1 名",
          "status": "executed",
          "requiresReview": false,
          "createdAt": "2026-06-04T12:00:10Z",
          "executedAt": "2026-06-04T12:00:12Z"
        }
      ],
      "proposals": [
        {
          "proposalId": "PPL_1780484920_p1",
          "agentRunId": "RUN_1780484920_abc",
          "proposalType": "adjust_recommendation",
          "targetType": "style",
          "targetIds": "[\"STYLE001\"]",
          "intendedAction": "调升款式至第1位",
          "hypothesis": "将 STYLE001 放在首页第一能进一步缩短用户决策耗时",
          "expectedMetrics": "[]",
          "rollbackCondition": "点击量下降",
          "reviewWindowHours": 24,
          "confidence": 0.85,
          "status": "executed",
          "checkResult": null,
          "executionTool": "adjustRecommendation",
          "executionPayload": null,
          "decisionId": "DEC_1780484920_d1",
          "createdAt": "2026-06-04T12:00:08Z",
          "updatedAt": "2026-06-04T12:00:12Z"
        }
      ]
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing run ID" }
    ```
  - `404 Not Found`：
    ```json
    { "error": "Run not found" }
    ```
- **数据库操作与副作用**：
  - 从 `agent_runs`、`agent_findings`、`agent_decisions` 和 `agent_action_proposals` 等表中联合查询 `agent_run_id = runId` 的数据明细并返回。

---

### 2.4 获取候选池列表
拉取美甲候选池中尚未上架的所有美甲款式。

- **请求方式**：`GET`
- **请求路径**：`/api/admin/candidates`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "candidates": [
        {
          "styleId": "STYLE101",
          "sourceType": null,
          "status": "candidate",
          "imageUrl": "/data/styles/style_101.png",
          "enhancedImageUrl": null,
          "colorTags": "[\"red\"]",
          "lengthTags": "[\"long\"]",
          "isAvailableForTryon": true,
          "listedAt": null,
          "createdAt": "2026-06-03T12:00:00Z",
          "updatedAt": "2026-06-03T12:00:00Z"
        }
      ]
    }
    ```
- **数据库操作与副作用**：
  - 从 `nail_styles` 表中检索 `status = 'candidate'` 的款式数据。

---

### 2.5 创建后台 Chat 会话
初始化一个与运营助理 AI Agent 进行对话的问答会话上下文。

- **请求方式**：`POST`
- **请求路径**：`/api/admin/chat/session`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "chatSessionId": "CSES_1780484920_xyz"
    }
    ```
- **数据库操作与副作用**：
  - 向 `agent_chat_sessions` 表中写入一条新的会话记录。

---

### 2.6 发送 Chat 对话消息并调用模型回答
发送关于运营动作或性能指标的提问，获取 AI 运营助理结合上下文做出的解释，响应会结构化标出关联的发现（findings）与决策（decisions）。

- **请求方式**：`POST`
- **请求路径**：`/api/admin/chat/messages`
- **请求体 (JSON)**：
  ```json
  {
    "chatSessionId": "CSES_1780484920_xyz",
    "content": "为什么你在上一轮巡检中将款式 STYLE001 调升了权重？"
  }
  ```
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "messageId": "MSG_1780484925_uvw",
      "role": "agent",
      "content": "我在第 RUN_1780484920_abc 轮巡检中调升了 STYLE001 的权重。分析发现，在过去的12小时内该款式的点击到试戴转化率极高（达到了85%），并且相似手型的收藏表现也很抢眼...",
      "relatedRunIds": ["RUN_1780484920_abc"],
      "relatedFindingIds": ["FDG_1780484920_f1"],
      "relatedDecisionIds": ["DEC_1780484920_d1"]
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing params" }
    ```
- **数据库操作与副作用**：
  - 将操作员的用户消息插入到 `agent_chat_messages` 表中。
  - 读取最新的 Agent 巡检汇总、本轮指标及商机发现，拼接出包含历史多轮消息的系统 Prompts，调用 ModelScope 上的 MiniMax 语言模型进行推理回答。
  - 将模型返回的结构化回答插入到 `agent_chat_messages` 表中并返回给前端。

---

### 2.7 获取指定会话的历史 Chat 消息列表
拉取特定 B 端会话的所有对话历史记录。

- **请求方式**：`GET`
- **请求路径**：`/api/admin/chat/sessions/:id/messages`
- **请求体**：无
- **返回响应**：
  - `200 OK`：
    ```json
    {
      "messages": [
        {
          "messageId": "MSG_1780484920_user1",
          "role": "user",
          "content": "为什么你在上一轮巡检中将款式 STYLE001 调升了权重？",
          "relatedRunIds": [],
          "relatedFindingIds": [],
          "relatedDecisionIds": [],
          "createdAt": "2026-06-04T12:05:00Z"
        },
        {
          "messageId": "MSG_1780484925_uvw",
          "role": "agent",
          "content": "我在第 RUN_1780484920_abc 轮巡检中调升了 STYLE001 的权重。分析发现，在过去的12小时内该款式的点击到试戴转化率极高...",
          "relatedRunIds": ["RUN_1780484920_abc"],
          "relatedFindingIds": ["FDG_1780484920_f1"],
          "relatedDecisionIds": ["DEC_1780484920_d1"],
          "createdAt": "2026-06-04T12:05:05Z"
        }
      ]
    }
    ```
  - `400 Bad Request`：
    ```json
    { "error": "Missing session ID" }
    ```
- **数据库操作与副作用**：
  - 从 `agent_chat_messages` 中过滤 `chat_session_id = chatSessionId`，并按照创建时间 `created_at` 升序排列查询。
