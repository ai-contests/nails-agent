# 内部数据驱动主流程：待讨论问题

版本：Internal Flow V1  
最后更新：2026-06-03  
项目定位：新项目规划文档，不依赖旧 `nails-agent-platform` 代码结构

本文记录尚未完全定稿的问题。后续一旦讨论出结论，对应内容应迁移到 `internal_data_flow_confirmed.md`。

## 1. B 端新增款式入候选池流程已收敛

已确认方向：

- 初始 50 张预处理图片直接入库上架。
- 后续 B 端上传新款式，不走轻量质检。
- 上传款式统一经过视觉特征与长度判断。
- 上传款式随后走图片增强。
- 增强完成后统一进入候选池 `candidate`。
- 候选池后续由 Agent 基于平台内 tag 热度趋势复判。

待讨论：

- 图片增强失败时是否仍允许进入候选池，还是需要重试。
- 视觉特征缺失时，候选池卡片如何展示空标签。
- 候选池里特征缺失的款式是否允许 Agent 上架。

## 2. 候选池复判与小流量测试关系待定

已澄清：

- 候选池不一定需要自身用户行为。
- Agent 可以基于已上架款式的 tag 热度趋势，把匹配机会窗口的候选款重新推上来。

待讨论：

- 候选池款式是否需要小流量测试？
- 如果需要，小流量测试是否进入 C 端推荐页？
- 小流量测试窗口持续多久？
- 小流量测试是否需要单独标识给 Agent 复盘？

## 3. 主推荐页面算法尚未定稿

已确认方向：

- 不再做两轮推荐。
- 主推荐页面不根据单个用户历史个人行为做个性化排序。
- 默认情况下，所有用户看到的主推荐页是同一个推荐位序列。
- 初始 50 张图的主推荐位随机排序。
- 主推荐页基于平台整体用户反馈和平台内流行趋势判断。
- 后续主推荐位由 Agent 生成新的 `global_main` 推荐快照。
- 用户上传手图识别出的手型，用于相似手型辅助推荐，而不是直接改写主推荐页排序。
- 款式图不再提取参考手型。
- 初始 50 张图会配套 mock 用户行为解决冷启动。

待讨论：

- 点击、试戴、收藏分别给多少权重？
- 是否需要加入款式热度衰减，避免旧款长期霸榜？
- 是否需要加入多样性，避免 30 个款式全是同色或同长度？
- tag 趋势如何影响款式排序？
- Agent 推荐位调整后，新的推荐快照需要保留多久？

相似手型辅助推荐的细节另行讨论：

- 相似手型是只按 `hand_shape` 分桶，还是结合掌宽/手指比例等连续特征？
- 如果新用户手型识别为 `unknown`，辅助推荐如何兜底？
- 如果某个手型历史行为数据不足，辅助推荐如何兜底？

## 4. 初始 mock 行为数据结构待定

已确认：

- 初始 50 张图需要配套 mock 用户行为。
- mock 行为需要覆盖不同手型用户。
- mock 行为需要覆盖不同手型用户试戴、收藏了哪些款式，用于相似手型辅助推荐。
- mock 行为需要同步聚合出第一批 `style_heat_snapshots` 和 `tag_heat_snapshots`，用于 Agent 后续读取。

待讨论：

- 需要 mock 多少用户？
- 每种手型需要多少行为？
- 是否需要 mock 不同偏好人群，如短甲偏好、猫眼偏好、裸粉偏好？

建议行为类型：

```text
style_view
style_click
tryon_start
tryon_success
tryon_failed
favorite_add
favorite_remove
```

## 5. 行为事件定义需要收敛

已确认第一版行为事件：

```text
style_view
style_click
tryon_start
tryon_success
tryon_failed
favorite_add
favorite_remove
```

待确认：

- 是否继续避免曝光量字段？
- `style_view` 和 `style_click` 是否需要同时存在？
- 行为是否按 `session_id`、`user_id`、还是匿名设备 ID 聚合？

## 6. length_tags 具体阈值尚未定稿

已确认方向：

- `length_tags` 基于 Roboflow 抠出的单美甲图片判断。
- 初始枚举倾向于短甲 / 中甲 / 长甲 / unknown。

待讨论：

- 长度判断使用什么几何指标？
- 是基于单美甲 mask 的长宽比，还是基于指尖延伸比例？
- 阈值如何定义？
- 不同拍摄角度是否会影响长度判断？
- 是否需要人工校准一批样本？

建议初始枚举：

```text
short
medium
long
unknown
```

## 7. nail_styles 补充字段细节待定

已确认：

- 主表命名使用 `nail_styles`。
- 核心标签只保留 `color_tags` 和 `length_tags`。
- 去掉 `style_tags`、`scene_tags`、`material_tags`。
- 去掉 `reference_hand_profile_id`。
- 新增 `source_type`、`listed_at`、`length_tags`。
- 主状态收敛为 `candidate` / `listed`。

待讨论：

- 是否需要单独的 `enhancement_status`。
- 候选池中特征缺失、增强失败、待重试等状态是否通过额外字段或后续任务表表达。

当前建议方向：

```text
style_id
source_type
image_url
enhanced_image_url
color_tags
length_tags
visual_feature_id
status
is_available_for_try_on
created_at
updated_at
listed_at
```

## 8. reference_hand_profiles 已确认移除

已确认：

- 款式图不再做参考手型提取。
- 推荐不再依赖款式参考手画像。
- 新项目主流程不设计 `reference_hand_profiles`。
- 用户手型只进入 `user_hand_profiles`。
- 款式图只进入 `nail_visual_features`。

未来如果需要分析“图片里的手”，应另建独立视觉分析结果表，不参与当前推荐主链路。


## 9. B 端智能运营 Agent 细节待定

已确认方向：

- Agent 不再以外部爬虫为主。
- Agent 重点转向内部平台行为监控、推荐位调整、款式状态决策、复盘记忆和异常诊断。
- 候选池复活和策略实验可以合并为“款式状态决策”。
- 第一版使用一个 `OperationAgent` 承载五类能力。
- `OperationAgent` 采用“能力方向 + 结构化工具调用”方案，而不是散文式输出或直接裸写数据库。
- 运营工具参数 schema 已有初版，后续在实现前继续收敛细节。
- Agent 按 12 小时周期运行，Demo 阶段用按钮手动触发。
- Agent 自动执行动作并写库，B 端 Chat 只展示决策过程，不提供人工确认按钮。
- 第一轮或历史热度快照不足时，Agent 可以只观察，不做动作。
- 推荐位调整、候选池上架、下架回候选池、实验开始、实验回退都进入待复盘。
- 复盘记忆由 Agent 在后续轮次读取，用于下一次判断。

已确认 Agent 能力方向：

- 运营机会发现。
- 推荐位调整。
- 款式状态决策。
- 复盘记忆。
- 异常诊断。

款式状态决策暂定覆盖：

```text
候选池款式是否上架
已上架款式是否降权
已上架款式是否下架回候选池
已上架款式是否进入推荐位放量
实验款式是否继续放量或回退
```

Agent 每轮读取的数据包括：

```text
当前窗口 style_heat_snapshots / tag_heat_snapshots
最近 N 轮历史热度快照
当前 active `global_main` 推荐快照与 `recommendation_items.rank_no`
候选池款式数据
待复盘事项
历史复盘记忆
```

待确认：

- 运营工具 schema 中各枚举和校验规则是否还需要增删。
- 单轮 Agent 操作上限，例如最多提升几个款式、上架几个候选款。
- 推荐位实验窗口持续多久？
- Agent 读取最近 N 轮历史热度快照时，N 的默认值是多少？
- Agent 完整提示词和模型原始输出是否需要保存，用于赛后排查或演示解释？

## 10. 试戴结果与真实 ComfyUI 接口关系待定

待讨论：

- 队友的图片增强和试戴接口何时接入？
- ComfyUI 接口返回失败时，页面提示试戴失败。
- 第一版不使用原图作为试戴成功 fallback。
- 试戴结果是否参与后续运营热度计算？
