# 内部数据驱动主流程：已确认版本

版本：Internal Flow V1  
最后更新：2026-06-03  
项目定位：新项目规划文档，不依赖旧 `nails-agent-platform` 代码结构

## 1. 方向调整

新项目主链路不再依赖外部社媒爬取。小红书 MCP、外部搜索、帖子详情补全、外部互动量等能力不再作为核心交付链路。

新的核心定位：

```text
内部款式数据
-> AI 试戴与推荐
-> 用户行为回流
-> 智能运营监控
-> Agent 生成运营策略
-> 运营动作执行与复盘
```

核心价值：

- C 端：用户上传手图后，快速看到款式试戴效果，并参考相似手型用户的选择做决策。
- B 端：运营人员基于内部款式和平台行为，实时监控热度、分析趋势、生成策略、提升转化。

## 2. 初始款式数据策略

初始 Demo 数据由本地预处理提供，计划准备约 50 张已经处理好的美甲图片。

已确认规则：

- 初始 50 张图片全部入库。
- 初始 50 张图片全部直接上架。
- 初始款式不走外部爬虫。
- 初始款式不进入候选池。
- 初始款式需要配套一批 mock 用户行为，用于解决推荐冷启动问题。
- 初始主推荐页排序随机生成，不做复杂排序算法。
- 初始 mock 行为同步用于生成第一批 `style_heat_snapshots` 和 `tag_heat_snapshots`，供后续 Agent 决策读取。

建议初始状态：

```text
source_type = internal_seed
status = listed
is_available_for_try_on = true
```

初始 mock 行为应覆盖不同手型用户，记录不同手型用户试戴、收藏了哪些款式，用于后续相似手型辅助推荐。

初始推荐快照：

```text
recommendation_snapshots(snapshot_type = global_main)
recommendation_items(rank_no = 随机顺序)
```

后续主推荐位不再沿用随机排序，而是由 Agent 根据热度快照、候选池数据和复盘记忆生成新的推荐快照。

## 3. 后续 B 端新增款式流程

B 端后续上传新美甲款式时，不默认直接上架，也不再走轻量质检分流。

已确认主流程：

```text
B 端上传新款式
-> 单美甲区域提取
-> 视觉特征与长度判断
-> 图片增强
-> 写入候选池 candidate
-> Agent 后续基于平台 tag 热度趋势和候选池数据复判
-> 满足条件后从候选池转为上架 listed
```

图片增强定位：

- 新上传款式上架前必须先走图片增强。
- 增强目标是提升展示效果和试戴可用性。
- 增强后的图片作为用户侧展示和试戴主图。

新增款式不再因为图片质量、重复度或标签完整性被质检流程阻断。只要完成基本视觉特征与增强处理，就先进入候选池。是否上架交给后续 Agent 决策。

## 4. 候选池复判逻辑

候选池款式不一定需要先获得自身用户行为。它的复判依据主要来自平台内已上架款式的 tag 热度变化。

已确认理解：

```text
某个候选款式当前暂未上架
但它具备 color_tags / length_tags
后续一段时间内，平台内相同或相近 tag 的热度上升
Agent 可以判断该候选款式具备重新上架机会
```

示例：

```text
候选款式 A:
color_tags = ["裸粉"]
length_tags = ["短甲"]

一段时间后平台数据发现：
裸粉色系热度上升
短甲收藏率提升

Agent 复判：
候选款式 A 与当前上升趋势匹配，可建议上架或进入小流量测试。
```

因此候选池不是“等待自身数据”，而是“等待平台内相似 tag 机会窗口”。

## 5. 款式核心标签调整

原先较宽泛的 `style_tags` 和 `scene_tags` 不再作为核心展示与推荐字段。

新的核心标签：

```text
color_tags
length_tags
```

含义：

- `color_tags`：颜色标签，如裸粉、酒红、奶白、黑色。
- `length_tags`：美甲长度标签，如短甲、中甲、长甲。

`material_tags` 暂不进入核心数据结构。当前没有稳定自动识别方式，纯人工维护会增加数据成本，也容易让 Demo 主流程变重。

`color_tags` 沿用视觉特征提取后的主色结果，不再单独人工维护一套颜色标签。

展示卡片优先展示：

```text
图片
color_tags 第一个
length_tags 第一个
试戴按钮
收藏按钮
```

如果某个标签为空，则对应展示项不显示。

## 6. length_tags 来源

`length_tags` 不再完全依赖人工填写。

已确认方向：

- 先通过 Roboflow 相关程序对图片进行单美甲区域提取。
- 基于抠出的单美甲图片定义长 / 中 / 短标准。
- 后续代码根据标准写入 `length_tags`。

初始长度枚举建议：

```text
short
medium
long
unknown
```

其中具体阈值后续再定。

## 7. 推荐流程调整

原来的“两轮推荐”流程废弃。

新的用户侧推荐不再区分第一轮和第二轮。

主推荐页面的推荐位不再根据单个用户的历史个人行为做个性化排序。也就是说，默认情况下所有用户看到的主推荐页是同一个推荐位序列。

主推荐页排序依据转为：

```text
平台整体用户反馈
+ 平台内 tag 热度趋势
+ Agent 运营策略调整
```

已确认主推荐流程：

```text
平台持续收集用户行为
-> 计算款式热度与 tag 趋势
-> Agent 判断推荐位调整策略
-> 更新主推荐页统一排序
-> 所有用户看到同一套主推荐结果
```

用户上传手图后的手型能力不再用于改写主推荐页全局排序，而是用于辅助决策模块。

辅助决策流程：

```text
用户上传手图
-> 系统识别用户手型
-> 系统查找平台内相似手型用户行为
-> 推荐这些相似手型用户选择/试戴/收藏过的美甲
-> 用户在同一推荐页面继续试戴、收藏
-> 行为继续回流到平台数据
```

关键变化：

- 入库上架的款式图不再做手型提取。
- 不再维护款式参考手画像。
- 用户手图仍然需要做手型提取。
- 主推荐页不做个人级个性化。
- 手型识别用于“相似手型用户选择”这类辅助推荐/弹窗/页面。

## 8. 相似手型辅助推荐页面

相似手型推荐可以设计为弹窗或单独页面，不作为主推荐页全局排序的唯一依据。

页面核心文案方向：

```text
与您手型相似的用户正在选择这些美甲
```

建议展示数量：

```text
约 30 个美甲款式
```

每个款式仍支持：

- 查看
- 试戴
- 收藏

这些行为与主推荐页面使用同一套事件回流逻辑。

## 9. 手型数据职责边界

已确认：

- 用户上传手图需要提取手型。
- 用户上传手图需要提取肤色。
- 手图识别结果只展示手型与肤色。
- `undertone` 不进入新项目核心数据结构。
- 款式图不再提取参考手型。
- 入库款式不再依赖 `reference_hand_profile_id`。
- 推荐逻辑不再依赖款式参考手画像。

保留的数据方向：

```text
user_hand_profiles
behavior_events
nail_styles
nail_visual_features
```

弱化或移除方向：

```text
reference_hand_profiles
款式图 hand_shape / skin_tone 字段
undertone 字段
round_no = 1 / 2 的推荐快照区分
```

## 10. 智能运营闭环方向

智能运营后续基于内部款式和平台行为，而不是外部社媒数据。

运营侧关注：

- 哪些款式点击多。
- 哪些款式试戴多。
- 哪些款式收藏多。
- 哪些颜色、长度组合上升。
- 哪些候选池款式匹配当前 tag 热度窗口。
- 哪些款式需要推荐位提升。
- 哪些款式适合生成营销文案。
- 哪些款式需要降权或继续观察。

Agent 的核心职责从“外部抓取趋势”转为“周期性自动运营中枢”：

```text
每 12 小时读取一次平台数据
-> 聚合本轮款式热度快照与标签热度快照
-> 读取最近 N 轮历史热度快照
-> 读取候选池和历史复盘记忆
-> 自主判断本轮运营机会、异常和款式机会
-> 自动执行推荐位调整 / 款式状态调整
-> 写入决策日志和待复盘事项
-> 下一轮基于真实反馈形成复盘记忆
```

Demo 阶段可以用“运行下一轮 Agent 巡检”按钮替代 12 小时定时任务。

页面更新规则：

- Agent 执行过程中，C 端展示页面不做中途变更。
- Agent 生成新的推荐快照并完成所有写库动作后，才将新快照标记为生效。
- 前端刷新后读取新的 active 推荐快照。

## 11. Agent 能力方向

当前确定的 Agent 能力方向收敛为 5 类：

```text
运营机会发现
推荐位调整
款式状态决策
复盘记忆
异常诊断
```

其中，“候选池复活”和“策略实验”统一并入“款式状态决策”。

重要设计原则：

- 不为五类能力分别写死触发条件。
- Agent 每轮拿到当前窗口热度快照、最近 N 轮历史热度快照、候选池数据、待复盘事项和复盘记忆。
- 五类能力对应多个 Agent 运营工具，由 Agent 根据数据自主选择调用。
- Agent 可以选择不动作，只记录继续观察。
- Agent 所有动作自动执行，B 端 Chat 第一版只展示决策过程，不提供人工确认或手动执行按钮。

Agent 执行方式采用工具调用方案：

```text
OperationAgent
-> 读取结构化运营上下文
-> 自主选择调用运营工具
-> 工具层校验参数、执行写库、生成推荐快照或记录复盘
-> B 端 Chat 读取结构化结果并解释
```

完整单轮运行协议见 `agent_operation_cycle_v1.md`。该文档定义每轮 Agent 从读取数据、复盘、记录发现、生成运营想法、执行前检查到执行动作的固定顺序，避免 Agent 在缺少约束时发生行为漂移。

第一版运营工具：

```text
discover_opportunity     记录运营机会发现
adjust_recommendation    调整推荐位并生成新的推荐快照
decide_style_status      候选池上架 / 已上架款式回退候选池
continue_observation     记录继续观察，不改业务数据
write_strategy_memory    处理到期待复盘事项并写入复盘记忆
diagnose_anomaly         记录异常诊断
```

工具层必须提供硬校验：

- `style_id` 必须真实存在。
- 调整推荐位的款式必须是 `listed`。
- 候选池上架的款式必须是 `candidate`。
- 单轮操作数量不能超过后端设定上限。
- 执行推荐位调整后必须生成完整的新 `global_main` 推荐快照。
- 候选池上架或已上架款式回退候选池后，也必须生成完整的新 `global_main` 推荐快照。
- 需要后续验证的动作必须写入待复盘事项。

### 11.1 Agent 工具 Schema V1

工具共享证据引用结构：

```json
{
  "source_type": "style_heat | tag_heat | style | finding | memory | pending_review",
  "source_id": "对应记录 ID",
  "role": "trigger | supporting_evidence | risk_warning"
}
```

`agent_run_id` 不由 Agent 传入，由后端运行上下文自动注入。

#### 11.1.1 discover_opportunity

用途：记录运营机会发现，不直接改推荐页或款式状态。

参数：

```json
{
  "opportunity_type": "rising_style | rising_tag | candidate_match | recommendation_gap",
  "target_type": "style | tag | tag_combo | candidate | global",
  "target_id": "STYLE001 或 color:裸粉 或 color:裸粉|length:short",
  "title": "裸粉短甲趋势上升",
  "summary": "近几轮裸粉短甲试戴和收藏持续上升。",
  "score": 0.82,
  "evidence_refs": []
}
```

`opportunity_type` 说明：

- `rising_style`：单款热度或转化持续上升。
- `rising_tag`：某个 color / length 标签或标签组合持续上升。
- `candidate_match`：候选池款式命中当前上升标签或历史有效策略。
- `recommendation_gap`：款式表现和当前推荐位不匹配，例如某款增长明显但排名靠后，或某款排名靠前但转化持续偏低。

`target_type` 说明：

- `style`：单个已上架款式出现机会，例如某款试戴和收藏持续上涨。
- `tag`：单个标签出现机会，例如 `color:裸粉` 或 `length:short` 热度上升。
- `tag_combo`：标签组合出现机会，例如 `color:裸粉|length:short` 组合走强。
- `candidate`：候选池款式出现机会，例如候选款命中当前热门标签组合。
- `global`：推荐页整体结构机会，例如短甲整体走强，应提高短甲占比。

落库：

```text
agent_findings
agent_evidence_links
```

#### 11.1.2 adjust_recommendation

用途：调整主推荐位，并生成新的 `global_main` 推荐快照。

参数：

```json
{
  "strategy_type": "promote | demote | diversify | rebalance | experiment",
  "changes": [
    {
      "style_id": "STYLE012",
      "action": "promote | demote",
      "rank_after": 8,
      "reason": "试戴和收藏增长明显，且所属 tag 热度上升。"
    }
  ],
  "experiment": {
    "experiment_type": "recommendation_boost",
    "review_window_hours": 12,
    "target_metrics": ["tryon_count", "favorite_count"]
  },
  "summary": "提升近期高增长裸粉短甲款式推荐位。",
  "requires_review": true,
  "evidence_refs": []
}
```

`strategy_type` 说明：

- `promote`：提升单个或多个款式推荐位。
- `demote`：降低单个或多个款式推荐位。
- `diversify`：多样性调整，避免推荐页前排颜色或长度过度集中。
- `rebalance`：根据 tag 趋势重平衡推荐页结构，例如提高短甲占比。
- `experiment`：推荐位实验，例如把某款提升到前排并观察后续效果。

后端校验：

- 只能调整 `listed` 款式。
- `rank_after` 必须合法。
- 单轮调整数量不能超过后端上限。
- 后端基于当前 active snapshot 生成完整新 snapshot。
- `requires_review = true` 时必须写入待复盘事项。

落库：

```text
recommendation_snapshots
recommendation_items
agent_decisions
agent_decision_items
agent_pending_reviews
```

#### 11.1.3 decide_style_status

用途：处理候选池上架、已上架款式回退候选池，以及候选池上架实验。这个工具会修改业务数据。

参数：

```json
{
  "actions": [
    {
      "style_id": "STYLE061",
      "action": "list_candidate | unlist_to_candidate | start_listing_experiment | rollback_experiment",
      "reason": "该候选款与当前上升的裸粉短甲趋势匹配。"
    }
  ],
  "experiment": {
    "experiment_type": "candidate_listing",
    "review_window_hours": 12,
    "target_metrics": ["tryon_count", "favorite_count"]
  },
  "summary": "将 1 个候选池款式上架观察。",
  "requires_review": true,
  "evidence_refs": []
}
```

`action` 说明：

- `list_candidate`：将候选池款式从 `candidate` 改为 `listed`。
- `unlist_to_candidate`：将已上架款式从 `listed` 回退为 `candidate`。
- `start_listing_experiment`：候选池上架实验，本质是上架并进入待复盘。
- `rollback_experiment`：实验回退，通常将实验款式或推荐位恢复到较保守状态。

后端校验：

- `list_candidate` / `start_listing_experiment` 的原状态必须是 `candidate`。
- `unlist_to_candidate` 的原状态必须是 `listed`。
- 候选款上架时 `enhanced_image_url` 应存在。
- 单轮上架、回退数量不能超过后端上限。
- `list_candidate` / `start_listing_experiment` / `unlist_to_candidate` 必须基于当前 active snapshot 生成完整新 `global_main` 推荐快照。
- 需要后续验证的动作必须写入待复盘事项。

落库：

```text
nail_styles
recommendation_snapshots
recommendation_items
agent_decisions
agent_decision_items
agent_pending_reviews
```

候选池上架排序规则：

- Agent 只决定是否上架，不传推荐位排名。
- 后端默认把新上架款插入主推荐页第 11 位开始。
- 如果同一轮上架多个款式，则依次插入 `rank_no = 11, 12, 13...`。
- 如果当前推荐列表不足 10 个款式，则插入到列表末尾。
- 后端会基于插入后的完整列表重新生成连续 `rank_no`。

推荐快照重建规则：

```text
读取当前 active global_main snapshot
-> 复制当前 recommendation_items 排序列表
-> 移除本轮回退候选池的 style_id
-> 将本轮新上架 style_id 插入第 11 位开始
-> 对完整列表重新编号 rank_no = 1...N
-> 写入新的 recommendation_snapshot 和完整 recommendation_items
-> 将新 snapshot 标记为 active
-> 将旧 snapshot 标记为 archived
```

#### 11.1.4 continue_observation

用途：记录“继续观察”。该工具不修改 `nail_styles.status`，不生成推荐快照，不进入待复盘；只写入 `agent_findings`。

参数：

```json
{
  "watch_type": "style_watch | candidate_watch | tag_watch | global_watch | system_watch",
  "target_type": "style | candidate | tag | tag_combo | global | system",
  "target_id": "STYLE018 或 color:裸粉 或 color:裸粉|length:short",
  "title": "STYLE018 暂不调整，继续观察",
  "summary": "STYLE018 本轮热度有轻微上升，但增长不稳定，暂不提升推荐位。",
  "reason": "最近 N 轮数据波动较大，尚不足以支持推荐位调整。",
  "evidence_refs": []
}
```

`watch_type` 说明：

- `style_watch`：观察某个已上架款式。
- `candidate_watch`：观察某个候选池款式。
- `tag_watch`：观察某个标签或标签组合。
- `global_watch`：观察推荐页整体结构，不针对单款。
- `system_watch`：观察系统链路，例如试戴失败率是否持续异常。

落库：

```text
agent_findings(finding_type = watch)
agent_evidence_links
```

#### 11.1.5 write_strategy_memory

用途：处理已到复盘窗口的待复盘事项，写入复盘记忆。

参数：

```json
{
  "reviews": [
    {
      "pending_review_id": "PENDING001",
      "outcome": "positive | neutral | negative",
      "outcome_score": 0.76,
      "lesson": "裸粉短甲提升推荐位后收藏和试戴均上涨，下次同类趋势可优先放量。",
      "next_suggestion": "遇到相同 tag 上升时，优先提升同类款推荐位。"
    }
  ],
  "summary": "完成 1 条推荐位调整复盘。"
}
```

后端校验：

- `pending_review_id` 必须存在。
- 待复盘事项必须已到 `review_window_end`。
- 必须能读取动作前指标和复盘窗口结果指标。

落库：

```text
agent_pending_reviews
strategy_memories
```

#### 11.1.6 diagnose_anomaly

用途：记录异常诊断。异常诊断本身不一定改数据；如果需要降权或回退，再调用 `adjust_recommendation` 或 `decide_style_status`。

参数：

```json
{
  "anomaly_type": "high_click_low_tryon | high_tryon_low_favorite | tryon_failure_spike | tag_drop | recommendation_negative_effect | data_missing",
  "target_type": "style | tag | system",
  "target_id": "STYLE018 或 color:黑色 或 system:tryon",
  "severity": "low | medium | high",
  "summary": "STYLE018 点击较高但试戴转化低，可能存在图片或试戴适配问题。",
  "suggested_followup": "continue_observation | demote_recommendation | unlist_to_candidate | none",
  "evidence_refs": []
}
```

`target_type` 说明：

- `style`：单款异常，例如点击高但试戴低。
- `tag`：标签异常，例如某个颜色或长度整体转化下降。
- `system`：系统链路异常，例如 ComfyUI 试戴失败率升高。

落库：

```text
agent_findings
agent_evidence_links
```

Agent 每轮运行顺序：

```text
1. 根据 behavior_events 聚合本轮 style_heat_snapshots / tag_heat_snapshots
2. 读取最近 N 轮款式热度快照与标签热度快照
3. 读取当前 active `global_main` 推荐快照和 `recommendation_items.rank_no`
4. 读取候选池数据
5. 读取待复盘事项
6. 读取复盘记忆
7. 先处理已到复盘窗口的待复盘事项
8. 再分析本轮运营机会 / 异常 / 候选池机会 / 推荐位缺口
9. 自动执行推荐位调整、上架、降权、回退候选池等动作
10. 写入新的决策日志和待复盘事项
11. 任务结束后前端刷新并读取新推荐快照
```

第一轮或历史快照不足时，Agent 可以只建立热度快照并继续观察，不做运营动作。

### 11.2 运营机会发现

Agent 需要观察平台内款式行为和 tag 热度变化，识别当前值得运营介入的机会。

关注对象：

- 单款热度上升。
- 单款热度下降。
- `color_tags` 热度上升。
- `length_tags` 热度上升。
- 特定 tag 组合出现增长。

输出示例：

```text
裸粉 + 短甲 近 24 小时试戴完成数提升，收藏表现稳定，具备推荐位提升机会。
```

运营机会发现本身不一定改变数据，可以只写入 Agent 发现记录，供 B 端 Chat 查询或供本轮后续推荐位调整使用。

### 11.3 推荐位调整

Agent 可以基于平台整体反馈和流行趋势，调整主推荐页面的全局推荐位。

主推荐页不是个人个性化页面，而是平台统一推荐页。

Agent 可生成：

- 推荐位提升。
- 推荐位下降。
- 推荐位保持观察。
- 推荐位多样性调整。
- 推荐位实验策略。

推荐位调整属于自动执行动作。执行后需要进入待复盘，等待下一轮数据验证效果。

### 11.4 款式状态决策

款式状态决策负责判断已上架款式或候选池款式是否应该被上架、下架、降权、放量或继续观察。

它合并了原先讨论中的两个方向：

- 候选池复活。
- 策略实验。

决策依据可以包括：

- 运营机会发现结果。
- tag 热度趋势。
- 平台行为反馈。
- 复盘记忆。
- 策略实验结果。
- 异常诊断结果。

可决策动作：

```text
candidate -> listed
listed -> candidate
```

说明：

- 推荐位提升不改变 `nail_styles.status`，由推荐快照表达。
- 继续观察不改变 `nail_styles.status`，由 Agent 发现、决策日志或待复盘事项表达。
- 下架 / 回退时，将款式从 `listed` 改回 `candidate`。

示例：

```text
候选池中有一款裸粉短甲，之前因相似款热度不足暂缓上架。
当前平台裸粉、短甲两个 tag 均出现热度上升，且历史复盘显示同类款上次提升推荐位后收藏率增加。
Agent 建议将该候选款上架，并进入 2 小时观察窗口。
```

款式状态决策属于自动执行动作。候选池上架、下架回候选池、降权、实验开始或实验回退都需要进入待复盘。

### 11.5 复盘记忆

每次运营动作执行后，先写入待复盘事项。只有下一轮或多轮后拿到真实效果数据，才写入复盘记忆。

记录内容：

- 执行动作。
- 触发原因。
- 执行对象。
- 执行前指标。
- 执行后指标。
- 是否达到预期。
- 下次遇到相似场景的建议。

示例：

```text
上次「裸粉 + 短甲」进入首页推荐位前三后，收藏率提升 18%，试戴完成数也同步上升。
下次遇到相同 tag 上升时，可优先推荐位放量。
```

复盘记忆需要被下一轮 Agent 读取，用于辅助判断相似 tag、相似动作或相似异常场景。

### 11.6 异常诊断

Agent 需要识别平台数据中的异常，并判断异常是否来自款式热度变化、试戴链路问题、图片质量问题或推荐位策略问题。

异常示例：

- 点击高但试戴低。
- 试戴高但收藏低。
- 某类 tag 突然下滑。
- 某款上架后无行为。
- 试戴失败率升高。
- 推荐位提升后效果反而下降。

异常诊断结果可以反过来触发款式状态决策。

异常诊断本身可以立即闭环，写入 Agent 发现记录即可。如果异常诊断进一步导致降权、下架或实验回退，则对应动作需要进入待复盘。

## 12. Agent 记录分层

为避免把所有内容混入一张“决策表”，Agent 记录分为三类：

```text
决策日志
待复盘事项
复盘记忆
```

### 12.1 决策日志

记录 Agent 本轮做了什么判断、自动执行了什么动作，以及动作依据。

用于回答：

```text
Agent 这一轮做了什么？
为什么调整这个款式？
为什么把候选池某款上架？
```

### 12.2 待复盘事项

记录已经执行、但效果未知的动作。

需要进入待复盘的动作：

```text
推荐位提升
推荐位降权
候选池上架
已上架款式下架回候选池
策略实验开始
策略实验回退
```

### 12.3 复盘记忆

记录经过后续数据验证后的经验。

示例：

```text
上轮将 STYLE018 提升到主推荐前 10 后，收藏数提升 18%，试戴数提升 12%。
对「裸粉 + 短甲」同类款，后续可以优先考虑放量。
```

复盘记忆不是单纯日志，而是 Agent 下一轮可以读取和复用的经验。
