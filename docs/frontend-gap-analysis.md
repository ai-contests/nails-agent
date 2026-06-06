# 前端 Gap Analysis (差距分析) 报告

**目标文档**：`docs/product/PRD.md`
**分析时间**：2026-06-06
**分析方式**：基于 Playwright 自动化框架的真实交互与 DOM 渲染测试（Interactive Browser Testing）。

---

## 1. 功能逻辑缺失/问题 (Functional/Logic Gaps)

### 1.1 主推荐页未能接入动态数据快照
* **对应PRD模块**：[5.1 主推荐页] & [3.1 v1 Demo 必须实现]
* **现状发现**：`src/app/[locale]/(consumer)/page.tsx` 中，“Trending Styles” 模块被写死了三张静态卡片（`STYLE001`, `STYLE002`, `STYLE003`），并没有接入后端接口获取真实数据。
* **Gap说明**：PRD 要求主推数据源必须是 `recommendation_snapshots(type=global_main, status=active)` 并按照 Agent 生成的 `rank_no` 统一排序。目前的硬编码做法完全违背了 “Agent控制主推荐位” 的核心业务闭环，导致 Agent 决策无法在 C 端首页生效。
* **交互测试验证**：通过 Playwright 访问 `/en` 路由拦截网络请求，发现页面加载期间并未发起针对 `/api/recommendations/main` 的请求；同时提取并断言渲染后的 DOM，页面 HTML 中强制包含了 `STYLE001` 等写死的款式 ID 字符串，证实主推位未使用真实 API 渲染。

### 1.2 图鉴页 (/gallery) 数据接口调用错误与缺失
* **对应PRD模块**：[4. 信息架构] & [3.1 v1 Demo 必须实现]
* **现状发现**：`src/app/[locale]/(consumer)/gallery/page.tsx` 中负责加载款式的 API 错用成了 `/api/recommendations/main`。同时，后端 `src/app/api/` 目录下完全缺失了能全量返回 `listed` 状态的 API 端点。
* **Gap说明**：图鉴页应当作为瀑布流展示所有处于 `listed`（上架）状态的款式，供用户全量浏览。调用推荐快照接口会导致用户在图鉴页只能看到有限的几个被推荐款式，严重阻碍正常的浏览转化。
* **交互测试验证**：使用 Playwright 测试脚本导航至 `/en/gallery` 页面时，成功拦截到页面发起了对 `/api/recommendations/main` 的错误请求；经监听未发现发起 `/api/styles` 或任何全量 API 的网络调用。

### 1.3 B 端看板缺失 Pending Reviews 与 Strategy Memories 独立模块展示
* **对应PRD模块**：[5.7 B 端 Agent 看板]
* **现状发现**：在 `src/app/[locale]/admin/page.tsx` 中，看板主要渲染了 `Findings` 等卡片，代码未实现对 `pending_reviews` 与 `strategy_memories` 列表的独立模块展示。
* **Gap说明**：PRD 要求明确展示 `pending_reviews`（待复盘列表）和 `strategy_memories`（复盘记忆），以此来体现 Agent 的“复盘能力和记忆演进”。当前看板完全没有这两大独立模块的 DOM 结构，无法直观演示闭环的后处理阶段。
* **交互测试验证**：在 Playwright 中加载 `/en/admin` 页面，评估渲染的 DOM 结构，确认缺乏专门的待复盘列表 UI。尽管在自动生成的 Findings 文本中会偶尔提到“strategy memories are empty”，但并没有符合 PRD 要求的独立模块与交互卡片。

---

## 2. 视觉交互差距 (Visual/Interactive Gaps)

### 2.1 B 端看板缺失候选池视觉图与趋势小图
* **对应PRD模块**：[5.7 B 端 Agent 看板] & [4. 信息架构]
* **现状发现**：`src/app/[locale]/admin/page.tsx` 目前只展示了 `DecisionCard`（纯文本形式的 Rollup Stats 汇总，如款式总数、点击数等）。
* **Gap说明**：PRD 要求看板右侧或独立模块展示 “候选池 + 热度 / tag 趋势小图”。当前完全没有涉及 ECharts/Chart.js 等图表组件的引入，也没有针对候选池以图文形式进行的视觉展现。这使得“智能运营”的视觉冲击力大打折扣。
* **交互测试验证**：执行 Playwright 测试脚本对 `/en/admin` 页面进行探查 `document.querySelectorAll('canvas, svg.recharts-surface')`，返回的节点数量为 0，证实完全缺乏相关的数据可视化图表。

### 2.2 试戴排队中状态与失败降级处理粗糙
* **对应PRD模块**：[5.5 试戴] & [7.3 兜底 / 异常]
* **现状发现**：`TryOnModal.tsx` 中遇到 `jobStatus === 'failed'` 时，仅提供了一个普通的文本警告，且遇到错误时只能点“重试”或“返回”。
* **Gap说明**：虽然基本逻辑已跑通，但对于模型生图可能带来的较长排队延迟，缺乏针对性的“排队中（Queueing）”进度感知；失败后也没有给出具体由于姿态或遮挡引起的指导反馈，交互略显生硬。

---

## 总结
整体而言，项目的 C 端基础设施（如手型识别上传 `/hand`、相似手型弹窗 `similar-hand-recommendations` 以及试戴弹窗模型）均已基本实现并成功落库，前后端管道跑通度较高。
**最核心的修复优先级**在于 **首页的数据接入** 和 **Gallery 页全量接口的补齐**，否则 C 端的浏览路径是断裂的；其次是 **B端图表与复盘数据的可视化补充**，这是评委考量业务完整性的关键指标。

