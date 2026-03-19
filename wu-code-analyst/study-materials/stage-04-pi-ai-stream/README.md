# 阶段 4: 深入 pi-ai 流式 API 与 Provider

**目标**: 理解如何与不同 LLM 提供商通信

## 4.1 流式 API 入口

文件：`packages/ai/src/stream.ts`

这是与 LLM 交互的核心入口。

### 核心函数

```typescript
// 底层流式接口 - 返回完整事件流
export function stream<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ProviderStreamOptions
): AssistantMessageEventStream

// 简化版流式接口 - 推荐使用
export function streamSimple<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: SimpleStreamOptions
): AssistantMessageEventStream

// 非流式版本 - 等待完整响应
export async function complete<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ProviderStreamOptions
): Promise<AssistantMessage>

export async function completeSimple<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: SimpleStreamOptions
): Promise<AssistantMessage>
```

### 使用示例

```typescript
import { getModel, streamSimple } from '@mariozechner/pi-ai';

const model = getModel('anthropic', 'claude-sonnet-4-20250514');
const context = {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }],
};

// 流式消费
const stream = streamSimple(model, context);
for await (const event of stream) {
    switch (event.type) {
        case 'text_delta':
            process.stdout.write(event.delta);
            break;
        case 'toolcall_end':
            console.log('Tool called:', event.toolCall.name);
            break;
    }
}
```

## 4.2 事件流机制

文件：`packages/ai/src/utils/event-stream.ts`

### 事件类型

```typescript
type AssistantMessageEvent =
    // 开始
    | { type: 'start'; partial: Partial<AssistantMessage> }

    // 文本
    | { type: 'text_start' }
    | { type: 'text_delta'; delta: string }
    | { type: 'text_end' }

    // 思考/推理
    | { type: 'thinking_start' }
    | { type: 'thinking_delta'; delta: string }
    | { type: 'thinking_end' }

    // 工具调用
    | { type: 'toolcall_start'; contentIndex: number }
    | { type: 'toolcall_delta'; partial: ... }
    | { type: 'toolcall_end'; toolCall: ToolCall }

    // 完成
    | { type: 'done'; reason: StopReason; usage: Usage }
    | { type: 'error'; error: string };
```

### 事件流迭代

```typescript
// AssistantMessageEventStream 是一个 AsyncIterable
const stream = streamSimple(model, context);

// 方法 1: for await 循环
for await (const event of stream) { ... }

// 方法 2: 手动迭代
const iterator = stream[Symbol.asyncIterator]();
while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    // 处理 event
}

// 方法 3: 获取最终结果
const message = await stream.result();
```

## 4.3 Provider 注册机制

文件：`packages/ai/src/api-registry.ts`

### ApiProvider 接口

```typescript
interface ApiProvider {
    // 流式接口
    stream(model: Model, context: Context, options?: StreamOptions): AssistantMessageEventStream;

    // 简化版流式接口
    streamSimple(model: Model, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;

    // 支持的 API 类型
    api: Api;
}
```

### 注册与获取

```typescript
// 注册 Provider
registerApiProvider('anthropic-messages', anthropicProvider);
registerApiProvider('openai-responses', openaiProvider);

// 获取 Provider
const provider = getApiProvider('anthropic-messages');
if (!provider) {
    throw new Error('No provider registered for anthropic-messages');
}
```

## 4.4 Provider 实现分析

建议按难度顺序学习：

### 4.4.1 OpenAI Provider (基础)

文件：`packages/ai/src/providers/openai-responses.ts`

- 最基础的 Provider 实现
- 理解请求构建和响应解析
- SSE 流处理

### 4.4.2 Anthropic Provider (进阶)

文件：`packages/ai/src/providers/anthropic.ts`

- SSE 事件解析
- Thinking/Reasoning 内容支持
- 工具调用的流式处理

### 4.4.3 Google Provider (复杂)

文件：`packages/ai/src/providers/google.ts`

- 多模态输入支持
- thinking 签名机制
- 复杂的内容结构

## 4.5 消息转换

文件：`packages/ai/src/providers/transform-messages.ts`

不同 Provider 对消息格式有不同要求，这个模块处理转换：

- 过滤系统消息（有些 Provider 不支持）
- 转换附件为 image content
- 处理 thinking content
- 标准化工具调用格式

## 4.6 关键文件

| 文件 | 作用 |
|------|------|
| `packages/ai/src/stream.ts` | 流式 API 入口 |
| `packages/ai/src/utils/event-stream.ts` | 事件流实现 |
| `packages/ai/src/api-registry.ts` | Provider 注册 |
| `packages/ai/src/providers/anthropic.ts` | Anthropic 实现 |
| `packages/ai/src/providers/openai-responses.ts` | OpenAI 实现 |
| `packages/ai/src/providers/transform-messages.ts` | 消息转换 |

## 下一步

理解流式 API 后，进入 [阶段 5：学习 Agent 运行时](../stage-05-agent-runtime/README.md)
