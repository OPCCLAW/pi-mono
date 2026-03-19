# 阶段 3: 掌握 pi-ai 核心类型

**目标**: 理解统一类型系统，这是整个项目的基础

## 3.1 核心类型定义文件

主要文件：`packages/ai/src/types.ts`

这是整个项目的类型基础，建议先通读一遍。

## 3.2 核心类型一览

### Api 类型 - API 端点

```typescript
export type KnownApi =
    | "openai-completions"
    | "openai-responses"
    | "azure-openai-responses"
    | "openai-codex-responses"
    | "anthropic-messages"
    | "bedrock-converse-stream"
    | "google-generative-ai"
    | "google-gemini-cli"
    | "google-vertex";
```

### Provider 类型 - LLM 提供商

```typescript
export type KnownProvider =
    | "openai"
    | "anthropic"
    | "google"
    | "google-vertex"
    | "azure-openai-responses"
    | "github-copilot"
    | "xai"
    | "groq"
    | "cerebras"
    | "mistral"
    | ...;
```

### Model 类型 - 模型定义

```typescript
export interface Model<TApi extends Api = Api> {
    api: TApi;
    id: string;
    provider: Provider;
    metadata?: ModelMetadata;
}
```

### Context 类型 - 对话上下文

```typescript
export interface Context {
    systemPrompt?: string;
    messages: Message[];
    tools?: Tool[];
}
```

### Message 类型 - 消息

Message 是三种消息的联合类型：

```typescript
// 用户消息
export interface UserMessage {
    role: "user";
    content: string | (TextContent | ImageContent)[];
    timestamp: number;
}

// 助手消息
export interface AssistantMessage {
    role: "assistant";
    content: (TextContent | ThinkingContent | ToolCall)[];
    api: Api;
    provider: Provider;
    model: string;
    responseId?: string;
    usage: Usage;
    stopReason: StopReason;
    errorMessage?: string;
    timestamp: number;
}

// 工具结果消息
export interface ToolResultMessage {
    role: "toolResult";
    toolCallId: string;
    content: string;
    isError?: boolean;
    timestamp: number;
}
```

### Content 类型 - 消息内容

```typescript
// 文本内容
export interface TextContent {
    type: "text";
    text: string;
}

// 思考内容 (Reasoning)
export interface ThinkingContent {
    type: "thinking";
    thinking: string;
}

// 图片内容
export interface ImageContent {
    type: "image";
    data: string;      // base64 编码
    mimeType: string;  // image/jpeg, image/png 等
}

// 工具调用
export interface ToolCall {
    type: "toolCall";
    id: string;
    name: string;
    arguments: Record<string, any>;
}
```

### Tool 类型 - 工具定义

```typescript
export interface Tool {
    name: string;
    description: string;
    parameters: TSchema;  // TypeBox schema
}
```

### Usage 类型 - Token 使用统计

```typescript
export interface Usage {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
    };
}
```

### StopReason 类型 - 停止原因

```typescript
export type StopReason =
    | "stop"       // 正常完成
    | "length"     // 达到最大 token 限制
    | "toolUse"    // 需要调用工具
    | "error"      // 发生错误
    | "aborted";   // 请求被中止
```

## 3.3 模型获取

文件：`packages/ai/src/models.ts`

```typescript
import { getModel } from '@mariozechner/pi-ai';

// 通过 provider 和 model id 获取模型
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
const model = getModel('openai', 'gpt-4o-mini');
const model = getModel('google', 'gemini-2.0-flash');
```

## 3.4 消息结构图

```
Context
├── systemPrompt: string
├── messages: Message[]
│   ├── UserMessage
│   │   ├── role: "user"
│   │   ├── content: string | (TextContent | ImageContent)[]
│   │   └── timestamp
│   ├── AssistantMessage
│   │   ├── role: "assistant"
│   │   ├── content: (TextContent | ThinkingContent | ToolCall)[]
│   │   ├── api, provider, model
│   │   ├── usage
│   │   ├── stopReason
│   │   └── timestamp
│   └── ToolResultMessage
│       ├── role: "toolResult"
│       ├── toolCallId: string
│       ├── content: string
│       └── timestamp
└── tools: Tool[]
    ├── name: string
    ├── description: string
    └── parameters: TSchema
```

## 3.5 关键文件

| 文件 | 作用 |
|------|------|
| `packages/ai/src/types.ts` | 所有核心类型定义 |
| `packages/ai/src/models.ts` | getModel 函数和模型列表 |
| `packages/ai/src/index.ts` | 包导出入口 |

## 下一步

掌握核心类型后，进入 [阶段 4：深入 pi-ai 流式 API 与 Provider](../stage-04-pi-ai-stream/README.md)
