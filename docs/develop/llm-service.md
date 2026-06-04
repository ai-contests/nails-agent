# LLM 服务模块

本模块定义了在 **Nails-Agent** 平台中调用大语言模型（LLM）的接口与集成细节。

## 模块概述

LLM 服务存放在 [llm.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/services/llm.ts) 中。它主要满足系统中的两个核心业务需求：
1. **Agent 自我诊断（B端）**：在 11 阶段的 Agent 运营巡检周期中，用于分析当前的行为指标（款式热度、标签趋势）并推荐运营动作（款式提权、上架候选款式、将差款式下架回候选池）。
2. **助手交互对话（B端）**：在 B 端管理控制台的 Chat 面板中，用于回答操作员关于系统指标以及 Agent 历史决策的问答追问。

---

## 模型选择与接口端点

- **服务商**：ModelScope Inference API
- **接口地址**：`https://api-inference.modelscope.cn/v1/chat/completions`
- **模型标识 (Model ID)**：`MiniMax/MiniMax-M2.5`
- **温度值 (Temperature)**：`0.2`（采用较低的温度值，确保 Agent 在进行自我诊断并输出结构化 JSON 时具有确定性）
- **最大 Token 数 (Max Tokens)**：`1024`

---

## 身份验证配置

服务会从环境变量中动态读取 API 密钥，读取优先级如下：
1. `MODELSCOPE_API_KEY`：ModelScope 平台的访问令牌。
2. `NVIDIA_API_KEY`：过渡兼容使用的 NVIDIA 凭据。

若以上环境变量均未被配置，系统将抛出 API Key 缺失的异常。

---

## 接口定义

### `ChatMessage`
代表对话上下文中的单条消息。
```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### `callLlmModel(messages: ChatMessage[])`
异步调用 ModelScope MiniMax 对话补全接口。
- **参数**：包含 `ChatMessage` 对象的数组，代表当前会话的上下文消息队列。
- **返回值**：`Promise<string>`，解析为模型生成的文本回复。

---

## 代码示例

### 1. 单轮调用
```typescript
import { callLlmModel } from './services/llm.js';

const reply = await callLlmModel([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: '你好！' }
]);
console.log(reply);
```

### 2. 多轮历史会话调用
为了在 B 端 Chat 中支持上下文关联的追问，我们需要从 `agent_chat_messages` 表中查询出当前会话的所有历史消息，并按时间正序传入：
```typescript
const history = await db
  .select()
  .from(schema.agentChatMessages)
  .where(eq(schema.agentChatMessages.chat_session_id, sessionId))
  .orderBy(schema.agentChatMessages.created_at);

const messages = history.map(h => ({
  role: h.role as 'system' | 'user' | 'assistant',
  content: h.content
}));

const response = await callLlmModel(messages);
```

