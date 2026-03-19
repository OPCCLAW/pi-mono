# Pi Mono 项目深度分析文档

## 学习路线总览

以下是一个线性的、相互依赖的学习路径，共 **8 个阶段**，建议按顺序完成。

```
阶段 1: 环境搭建
    ↓
阶段 2: 理解整体架构
    ↓
阶段 3: 掌握 pi-ai 核心类型
    ↓
阶段 4: 深入 pi-ai 流式 API 与 Provider
    ↓
阶段 5: 学习 Agent 运行时
    ↓
阶段 6: 理解会话管理与交互模式
    ↓
阶段 7: 研究 TUI 库实现
    ↓
阶段 8: 实践与扩展开发
```

---

## 阶段 1: 环境搭建

**目标**: 能够编译运行项目

### 1.1 安装依赖

```bash
npm install
npm run build
```

### 1.2 运行测试

```bash
./test.sh              # 运行所有测试
./pi-test.sh           # 从源码运行 pi
```

### 1.3 验证环境

- 尝试启动 `pi` 命令
- 了解项目目录结构

**前置条件**: 无

---

## 阶段 2: 理解整体架构

**目标**: 建立全局视角，理解各包之间的关系

### 2.1 阅读顶层文档

- [README.md](file:///c:/Users/Preface/Documents/GitHub/pi-mono/README.md) - 项目概述
- [packages/ai/README.md](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/README.md) - LLM API 文档
- [packages/coding-agent/README.md](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/README.md) - CLI 使用文档
- [packages/agent/README.md](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/agent/README.md) - Agent 核心文档

### 2.2 理解架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    Coding Agent CLI                     │
│                  (交互模式 / Print / RPC)                │
├─────────────────────────────────────────────────────────┤
│                      AgentSession                       │
│              (会话管理 / 工具执行 / 事件流)               │
├─────────────────────────────────────────────────────────┤
│                        Agent                            │
│            (Agent 循环 / 状态管理 / 工具调用)             │
├─────────────────────────────────────────────────────────┤
│                        Pi-AI                            │
│       (统一 API / 提供商适配 / 流式处理 / 类型转换)       │
├─────────────────────────────────────────────────────────┤
│               LLM Providers (具体实现)                   │
│    OpenAI / Anthropic / Google / Azure / Mistral ...    │
└─────────────────────────────────────────────────────────┘
```

### 2.3 理解调用链路

```
用户输入 → InteractiveMode → AgentSession → Agent → pi-ai → Provider → HTTP API
```

**前置条件**: 阶段 1 完成

---

## 阶段 3: 掌握 pi-ai 核心类型

**目标**: 理解统一类型系统，这是整个项目的基础

### 3.1 阅读核心类型定义

文件: [packages/ai/src/types.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/types.ts)

需要理解的核心类型:
- `Api` - API 端点类型 (openai-responses, anthropic-messages, etc.)
- `Provider` - 提供商类型 (openai, anthropic, google, etc.)
- `Model<TApi>` - 模型定义
- `Context` - 对话上下文
- `Message` - 消息类型 (UserMessage, AssistantMessage, ToolResult)
- `ToolCall` - 工具调用
- `Usage` - Token 使用统计
- `StopReason` - 停止原因

### 3.2 理解消息结构

```
UserMessage
├── role: "user"
├── content: string | (TextContent | ImageContent)[]
└── timestamp

AssistantMessage  
├── role: "assistant"
├── content: (TextContent | ThinkingContent | ToolCall)[]
├── api, provider, model
├── usage
└── stopReason

ToolResult (作为消息)
├── role: "toolResult"
├── toolCallId
├── content
└── timestamp
```

### 3.3 理解模型获取

文件: [packages/ai/src/models.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/models.ts)

```typescript
import { getModel } from '@mariozechner/pi-ai';

const model = getModel('anthropic', 'claude-sonnet-4-20250514');
// 或
const model = getModel('openai', 'gpt-4o-mini');
```

**前置条件**: 阶段 2 完成

---

## 阶段 4: 深入 pi-ai 流式 API 与 Provider

**目标**: 理解如何与不同 LLM 提供商通信

### 4.1 理解流式 API 入口

文件: [packages/ai/src/stream.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/stream.ts)

核心函数:
- `stream()` - 底层流式接口
- `streamSimple()` - 简化版流式接口
- `complete()` / `completeSimple()` - 非流式版本

### 4.2 理解事件流

文件: [packages/ai/src/utils/event-stream.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/utils/event-stream.ts)

事件类型:
```typescript
type AssistantMessageEvent =
    | { type: 'start'; partial: Partial<AssistantMessage> }
    | { type: 'text_start' }
    | { type: 'text_delta'; delta: string }
    | { type: 'text_end' }
    | { type: 'thinking_start' }
    | { type: 'thinking_delta'; delta: string }
    | { type: 'thinking_end' }
    | { type: 'toolcall_start'; contentIndex: number }
    | { type: 'toolcall_delta'; partial: ... }
    | { type: 'toolcall_end'; toolCall: ToolCall }
    | { type: 'done'; reason: StopReason; usage: Usage }
    | { type: 'error'; error: string };
```

### 4.3 理解 Provider 注册机制

文件: [packages/ai/src/api-registry.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/api-registry.ts)

```typescript
// 注册 Provider
registerApiProvider('anthropic-messages', anthropicProvider);

// 获取 Provider
const provider = getApiProvider('anthropic-messages');
```

### 4.4 深入一个 Provider 实现

建议按顺序研究:

1. **OpenAI Provider** - [packages/ai/src/providers/openai-responses.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/providers/openai-responses.ts)
   - 最基础的实现
   - 理解请求构建和响应解析

2. **Anthropic Provider** - [packages/ai/src/providers/anthropic.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/providers/anthropic.ts)
   - SSE 流处理
   - Thinking/Reasoning 支持

3. **Google Provider** - [packages/ai/src/providers/google.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/providers/google.ts)
   - 多模态支持
   - thinking 签名

### 4.5 理解消息转换

文件: [packages/ai/src/providers/transform-messages.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/ai/src/providers/transform-messages.ts)

处理不同 Provider 之间的消息格式差异。

**前置条件**: 阶段 3 完成

---

## 阶段 5: 学习 Agent 运行时

**目标**: 理解 Agent 的核心循环、状态管理和工具执行

### 5.1 理解 Agent 类

文件: [packages/agent/src/agent.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/agent/src/agent.ts)

核心概念:
```typescript
const agent = new Agent({
    initialState: {
        systemPrompt: "You are helpful.",
        model: getModel('anthropic', 'claude-sonnet-4-20250514'),
        thinkingLevel: 'medium',
        tools: [readTool, writeTool, editTool, bashTool],
        messages: [],
    },
    convertToLlm: (msgs) => msgs.filter(m => m.role !== 'system'),
});

// 发送消息
await agent.prompt("Read file.txt");

// 监听事件
agent.subscribe((event) => { ... });
```

### 5.2 理解 Agent 循环

文件: [packages/agent/src/agent-loop.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/agent/src/agent-loop.ts)

核心循环逻辑:
```typescript
while (true) {
    // 1. 调用 LLM
    const stream = streamSimple(model, context, options);
    
    // 2. 处理流式响应
    for await (const event of stream) {
        emit(event);
        
        // 3. 如果有工具调用，执行它
        if (event.type === 'toolcall_end') {
            const result = await executeTool(event.toolCall);
            context.messages.push(toolResultMessage);
        }
    }
    
    // 4. 检查是否需要继续
    if (stopReason !== 'toolUse') break;
}
```

### 5.3 理解事件流

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { userMessage }
├─ message_end
├─ message_start   { assistantMessage }
├─ message_update { text_delta: "Hello!" }
├─ message_end
├─ turn_end
└─ agent_end
```

### 5.4 理解工具执行

文件: [packages/agent/src/types.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/agent/src/types.ts) 中的工具定义

工具执行流程:
1. LLM 返回 ToolCall
2. 验证工具名称和参数 (TypeBox)
3. beforeToolCall 钩子
4. 执行工具
5. afterToolCall 钩子
6. 构建 ToolResultMessage
7. 继续循环

**前置条件**: 阶段 4 完成

---

## 阶段 6: 理解会话管理与交互模式

**目标**: 理解 pi 如何管理会话和渲染 TUI

### 6.1 理解会话管理

文件: [packages/coding-agent/src/core/agent-session.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/src/core/agent-session.ts)

核心功能:
```typescript
const session = agentSessionManager.getOrCreateSession();
await session.prompt("Hello");
await session.fork("feature-branch");
await session.compact();
await session.exportToHtml();
```

### 6.2 理解会话文件结构

```
.session/
├── session.json      # 元数据和消息
└── attachments/     # 附件文件
```

### 6.3 理解交互模式

文件: [packages/coding-agent/src/modes/interactive/interactive-mode.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts)

核心组件:
- TUI 初始化
- 消息容器
- 编辑器
- 事件处理

### 6.4 理解内置工具

文件: [packages/coding-agent/src/core/tools/](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/src/core/tools/index.ts)

核心工具:
- `read` - 读取文件
- `write` - 写入文件
- `edit` - 编辑文件
- `bash` - 执行命令

### 6.5 理解压缩机制

文件: [packages/coding-agent/src/core/compaction/](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/src/core/compaction/index.ts)

- 自动压缩触发条件
- 分支摘要生成
- 消息压缩算法

**前置条件**: 阶段 5 完成

---

## 阶段 7: 研究 TUI 库实现

**目标**: 理解终端 UI 的渲染机制

### 7.1 理解 TUI 核心

文件: [packages/tui/src/index.ts](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/tui/src/index.ts)

核心类:
- `TUI` - 主入口
- `Component` - 组件基类
- `Container` - 容器
- `Text` / `Markdown` - 文本渲染

### 7.2 理解差分渲染

```typescript
// 渲染流程
function render() {
    const newTree = buildRenderTree();
    const diff = diffTrees(oldTree, newTree);
    applyDiff(diff);  // 只更新变化的部分
    oldTree = newTree;
}
```

### 7.3 理解交互组件

- Editor - 文本编辑
- Input - 用户输入
- Overlay - 弹窗
- Tree - 目录树

### 7.4 理解主题系统

文件: [packages/coding-agent/src/modes/interactive/theme/](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/src/modes/interactive/theme/theme.ts)

```typescript
const theme = {
    name: 'dark',
    colors: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        // ...
    }
};
```

**前置条件**: 阶段 6 完成

---

## 阶段 8: 实践与扩展开发

**目标**: 能够修改和扩展项目

### 8.1 创建简单扩展

参考: [packages/coding-agent/examples/extensions/](file:///c:/Users/Preface/Documents/GitHub/pi-mono/packages/coding-agent/examples/extensions/)

```typescript
// my-extension/index.ts
export const myExtension = {
    name: 'my-extension',
    version: '1.0.0',
    
    async onStart(context) {
        context.registerSlashCommand({
            name: 'hello',
            handler: () => console.log('Hello!'),
        });
    },
};
```

### 8.2 添加新 Provider (进阶)

参考 AGENTS.md 和现有 Provider 实现:
1. 在 `types.ts` 添加 API/Provider 类型
2. 创建 Provider 文件
3. 注册 Provider
4. 添加测试

### 8.3 修改核心功能

- 修改工具行为
- 自定义会话压缩
- 添加新的交互模式

### 8.4 运行测试

```bash
npx tsx ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts
```

**前置条件**: 阶段 7 完成

---

## 附录：关键文件索引

| 阶段 | 功能 | 文件路径 |
|------|------|----------|
| 1 | 构建脚本 | `package.json` |
| 2 | 架构入口 | `README.md` |
| 3 | 核心类型 | `packages/ai/src/types.ts` |
| 3 | 模型获取 | `packages/ai/src/models.ts` |
| 4 | 流式 API | `packages/ai/src/stream.ts` |
| 4 | 事件流 | `packages/ai/src/utils/event-stream.ts` |
| 4 | Provider 注册 | `packages/ai/src/api-registry.ts` |
| 4 | Provider 实现 | `packages/ai/src/providers/*.ts` |
| 5 | Agent 核心 | `packages/agent/src/agent.ts` |
| 5 | Agent 循环 | `packages/agent/src/agent-loop.ts` |
| 5 | 工具类型 | `packages/agent/src/types.ts` |
| 6 | 会话管理 | `packages/coding-agent/src/core/agent-session.ts` |
| 6 | 交互模式 | `packages/coding-agent/src/modes/interactive/interactive-mode.ts` |
| 6 | 工具实现 | `packages/coding-agent/src/core/tools/*.ts` |
| 6 | 压缩机制 | `packages/coding-agent/src/core/compaction/*.ts` |
| 7 | TUI 库 | `packages/tui/src/index.ts` |
| 7 | 主题 | `packages/coding-agent/src/modes/interactive/theme/*.ts` |
| 8 | 扩展示例 | `packages/coding-agent/examples/extensions/*/` |

---

## 附录：开发规范

参考: [AGENTS.md](file:///c:/Users/Preface/Documents/GitHub/pi-mono/AGENTS.md)

- 代码质量: 无 `any` 类型，使用 TypeBox
- 构建后检查: `npm run check`
- 测试: `npx tsx ... vitest`
- 提交: 不使用 `git add -A`，只提交自己的文件

---

*文档版本: 2.0*  
*最后更新: 2025-03-19*

### 2.2 调用链路

```
用户输入
    ↓
InteractiveMode (TUI 处理)
    ↓
AgentSession (会话管理)
    ↓
Agent (核心 Agent 循环)
    ↓
pi-ai (streamSimple)
    ↓
Provider 实现 (如 anthropic.ts)
    ↓
HTTP API 调用
```

---

## 3. 核心包详解

### 3.1 packages/ai - 统一 LLM API 层

这是整个项目的基础，负责与各种 LLM 提供商通信。

#### 3.1.1 核心类型定义 (`types.ts`)

```typescript
// API 类型 - 标识不同的 API 端点
export type KnownApi =
    | "openai-completions"
    | "openai-responses"
    | "anthropic-messages"
    | "bedrock-converse-stream"
    | "google-generative-ai"
    | ...;

// Provider 类型 - 标识不同的 LLM 提供商
export type KnownProvider =
    | "openai"
    | "anthropic"
    | "google"
    | "google-vertex"
    | "azure-openai-responses"
    | ...;

// 消息类型
export interface UserMessage {
    role: "user";
    content: string | (TextContent | ImageContent)[];
    timestamp: number;
}

export interface AssistantMessage {
    role: "assistant";
    content: (TextContent | ThinkingContent | ToolCall)[];
    api: Api;
    provider: Provider;
    model: string;
    usage: Usage;
    stopReason: StopReason;
    // ...
}

// 工具调用
export interface ToolCall {
    type: "toolCall";
    id: string;
    name: string;
    arguments: Record<string, any>;
}
```

#### 3.1.2 流式 API 核心 (`stream.ts`)

```typescript
// 主要导出函数
export function stream<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ProviderStreamOptions
): AssistantMessageEventStream;

export async function complete<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ProviderStreamOptions
): Promise<AssistantMessageEventStream>;

export function streamSimple<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: SimpleStreamOptions
): AssistantMessageEventStream;

export async function completeSimple<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: SimpleStreamOptions
): Promise<AssistantMessage>;
```

#### 3.1.3 Provider 注册机制 (`api-registry.ts`)

```typescript
// 每个 Provider 需要实现以下接口
interface ApiProvider {
    stream(model: Model, context: Context, options?: StreamOptions): AssistantMessageEventStream;
    streamSimple(model: Model, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
    // ...
}

// 注册 Provider
export function registerApiProvider(api: Api, provider: ApiProvider): void;
export function getApiProvider(api: Api): ApiProvider | undefined;
```

#### 3.1.4 Provider 实现示例 (`providers/anthropic.ts`)

```typescript
// Anthropic Provider 实现
export function stream<TApi extends Api = "anthropic-messages">(
    model: Model<TApi>,
    context: Context,
    options?: StreamOptions & AnthropicOptions
): AssistantMessageEventStream {
    // 1. 构建请求 payload
    const payload = buildAnthropicPayload(model, context, options);
    
    // 2. 发送 HTTP 请求
    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: buildHeaders(options),
        body: JSON.stringify(payload),
        signal: options?.signal,
    });
    
    // 3. 处理 SSE 流
    return new AssistantMessageEventStream(async (emit) => {
        for await (const line of response.body) {
            const event = parseSSEvent(line);
            switch (event.type) {
                case "content_block_start":
                    emit({ type: "toolcall_start", ... });
                    break;
                case "content_block_delta":
                    if (event.delta.type === "text_delta") {
                        emit({ type: "text_delta", delta: event.delta.text });
                    } else if (event.delta.type === "input_json_delta") {
                        emit({ type: "toolcall_delta", ... });
                    }
                    break;
                // ...
            }
        }
    });
}
```

#### 3.1.5 支持的 Provider 列表

| Provider | API 类型 | 认证方式 | 特色功能 |
|----------|----------|----------|----------|
| OpenAI | openai-responses | API Key | Codex, 推理 |
| Anthropic | anthropic-messages | API Key | Claude, Thinking |
| Google | google-generative-ai | API Key/OAuth | Gemini, Vertex |
| Azure OpenAI | azure-openai-responses | API Key | 企业级 |
| Mistral | mistral-conversations | API Key | |
| Amazon Bedrock | bedrock-converse-stream | AWS SDK | |
| GitHub Copilot | openai-codex-responses | OAuth | |
| xAI | openai-responses | API Key | Grok |
| Groq | openai-responses | API Key | 快速 |
| Cerebras | openai-responses | API Key | 超低延迟 |

### 3.2 packages/agent - Agent 运行时核心

负责 Agent 的核心循环、状态管理和工具执行。

#### 3.2.1 Agent 类 (`agent.ts`)

```typescript
export class Agent {
    private _state: AgentState = {
        systemPrompt: "",
        model: getModel("google", "gemini-2.5-flash-lite-preview-06-17"),
        thinkingLevel: "off",
        tools: [],
        messages: [],
        isStreaming: false,
        streamMessage: null,
        pendingToolCalls: new Set(),
        error: undefined,
    };
    
    // 核心方法
    async prompt(content: string): Promise<void>;
    async continue(): Promise<void>;
    subscribe(listener: (event: AgentEvent) => void): () => void;
}
```

#### 3.2.2 Agent 循环 (`agent-loop.ts`)

```typescript
// 核心循环逻辑
export async function runAgentLoop(
    agent: Agent,
    config: AgentLoopConfig
): Promise<void> {
    while (true) {
        // 1. 获取 LLM 响应
        const stream = streamSimple(model, context, options);
        
        // 2. 处理流式事件
        for await (const event of stream) {
            agent.emit(event);
            
            // 3. 如果有工具调用，处理它
            if (event.type === "toolcall_end") {
                const result = await executeTool(event.toolCall);
                context.messages.push(toolResultMessage);
            }
        }
        
        // 4. 检查是否需要继续（更多工具调用）
        if (stopReason !== "toolUse") break;
    }
}
```

#### 3.2.3 事件流

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }
├─ message_end    { message: userMessage }
├─ message_start  { message: assistantMessage }
├─ message_update { assistantMessageEvent: text_delta }
├─ message_update { ... }
├─ message_end   { message: assistantMessage }
├─ turn_end
└─ agent_end
```

如果涉及工具调用：
```
├─ tool_execution_start { toolCallId, toolName, args }
├─ tool_execution_end  { toolCallId, result }
├─ message_start      { toolResultMessage }
├─ message_end
├─ turn_start         # 下一轮
├─ message_start      { assistantMessage }
...
```

### 3.3 packages/coding-agent - CLI 和交互模式

#### 3.3.1 入口点 (`cli.ts` / `main.ts`)

```typescript
// 支持多种运行模式
export type RunMode = "interactive" | "print" | "rpc" | "sdk";

async function main() {
    const mode = determineRunMode(args);
    
    switch (mode) {
        case "interactive":
            const interactive = new InteractiveMode(options);
            await interactive.run();
            break;
        case "print":
            // ...
        case "rpc":
            // ...
    }
}
```

#### 3.3.2 交互模式 (`modes/interactive/interactive-mode.ts`)

```typescript
export class InteractiveMode {
    private session: AgentSession;
    private ui: TUI;
    private chatContainer: Container;
    // ...
    
    async run(): Promise<void> {
        // 1. 初始化 UI
        this.ui = new TUI({ ... });
        
        // 2. 创建或恢复会话
        this.session = await this.sessionManager.getOrCreateSession();
        
        // 3. 设置事件监听
        this.session.subscribe(this.handleSessionEvent.bind(this));
        
        // 4. 启动渲染循环
        this.ui.run();
        
        // 5. 处理用户输入
        this.editor.onSubmit = async (text) => {
            await this.session.prompt(text);
        };
    }
}
```

#### 3.3.3 会话管理 (`core/agent-session.ts`)

```typescript
export class AgentSession {
    private agent: Agent;
    private sessionManager: SessionManager;
    
    // 核心功能
    async prompt(content: string): Promise<void>;
    async continue(): Promise<void>;
    subscribe(listener: AgentSessionEventListener): () => void;
    
    // 会话操作
    async fork(name: string): Promise<AgentSession>;
    async compact(): Promise<CompactionResult>;
    async exportToHtml(): Promise<string>;
}
```

### 3.4 packages/tui - 终端 UI 库

#### 3.4.1 核心组件

```typescript
// 基础组件
export class Container extends Component { ... }
export class Text extends Component { ... }
export class Button extends Component { ... }
export class Input extends Component { ... }

// 高级组件
export class Markdown extends Component { ... }
export class Editor extends Component { ... }
export class Tree extends Component { ... }
```

#### 3.4.2 差分渲染

TUI 使用差分渲染优化性能，只更新变化的部分：

```typescript
// 渲染流程
function render() {
    const newTree = buildRenderTree();
    const diff = diffTrees(oldTree, newTree);
    applyDiff(diff);
    oldTree = newTree;
}
```

---

## 4. 数据流与核心流程

### 4.1 完整的请求处理流程

```
1. 用户输入
   ↓
2. InteractiveMode 接收输入
   ↓
3. AgentSession.prompt()
   - 解析技能块 (parseSkillBlock)
   - 处理 @file 引用
   - 构建消息
   ↓
4. Agent.prompt()
   - transformContext() - 上下文转换
   - convertToLlm() - 转换为 LLM 消息格式
   - runAgentLoop() - 执行 Agent 循环
   ↓
5. pi-ai streamSimple()
   - 获取 Provider
   - 构建 payload
   - 发送请求
   ↓
6. Provider 处理流式响应
   - 解析 SSE 事件
   - 转换为统一事件格式
   - emit 事件
   ↓
7. Agent 处理事件
   - 更新状态
   - 执行工具调用
   - 发送工具结果
   ↓
8. InteractiveMode 渲染
   - 差分更新 UI
   - 显示消息/工具调用/结果
   ↓
9. 完成
```

### 4.2 工具执行流程

```
1. LLM 返回 ToolCall
   {
     type: "toolCall",
     name: "read",
     arguments: { path: "/path/to/file" }
   }
   ↓
2. Agent 验证工具名称和参数
   - 匹配已注册的工具
   - TypeBox 验证参数
   ↓
3. beforeToolCall 钩子 (可选)
   - 权限检查
   - 参数修改
   ↓
4. 执行工具
   - read: 读取文件内容
   - write: 写入文件
   - edit: 编辑文件
   - bash: 执行 shell 命令
   ↓
5. afterToolCall 钩子 (可选)
   - 结果处理
   ↓
6. 构建 ToolResultMessage
   - 添加到上下文
   ↓
7. 继续 Agent 循环
```

### 4.3 会话管理流程

```
1. 启动时
   - 加载会话目录
   - 读取 session.json
   - 恢复 Agent 状态
   ↓
2. 对话过程中
   - 实时保存消息
   - 计算 token 使用
   - 检查是否需要压缩
   ↓
3. 压缩 (Compaction)
   - 触发条件: token 超过阈值
   - 生成分支摘要
   - 压缩历史消息
   - 保存压缩结果
   ↓
4. 分支 (Fork)
   - 创建新目录
   - 复制会话文件
   - 标记父子关系
```

---

## 5. 关键代码分析

### 5.1 pi-ai 事件流 (`utils/event-stream.ts`)

```typescript
export class AssistantMessageEventStream {
    private emitter: EventEmitter;
    
    async *[Symbol.asyncIterator]() {
        // 异步迭代器实现
        // 逐个 yield 事件
    }
    
    // 获取最终结果
    async result(): Promise<AssistantMessage> {
        const events = await this.toArray();
        return this.assembleMessage(events);
    }
    
    private async *iterate(): AsyncGenerator<AssistantMessageEvent> {
        // 实现事件迭代逻辑
    }
}
```

### 5.2 消息转换 (`providers/transform-messages.ts`)

```typescript
export function transformMessages(
    messages: Message[],
    model: Model
): Message[] {
    // 1. 过滤系统消息（有些 provider 不支持）
    // 2. 转换附件为 image content
    // 3. 处理 thinking content
    // 4. 标准化工具调用格式
    // ...
}
```

### 5.3 工具定义与执行 (`core/tools/`)

```typescript
// 工具定义示例
const readTool: AgentTool = {
    name: "read",
    description: "Read the contents of a file",
    parameters: Type.Object({
        path: Type.String({ description: "Path to the file" }),
        offset: Type.Optional(Type.Number()),
        limit: Type.Optional(Type.Number()),
    }),
    
    async execute(args, context) {
        const content = await fs.promises.readFile(args.path, "utf-8");
        return truncate(content, args.limit);
    },
};
```

### 5.4 会话持久化 (`core/session-manager.ts`)

```typescript
interface SessionHeader {
    id: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    model: string;
    parentSessionId?: string;
    // ...
}

// session.json 结构
{
    "header": { ... },
    "messages": [
        { "role": "user", "content": "...", "timestamp": ... },
        { "role": "assistant", "content": [...], "timestamp": ... },
        { "role": "toolResult", "toolCallId": "...", "content": "...", "timestamp": ... }
    ]
}
```

---

## 6. 扩展机制

### 6.1 扩展 (Extensions)

```typescript
// 扩展接口
interface Extension {
    name: string;
    version: string;
    
    onStart(context: ExtensionContext): Promise<void>;
    onDispose(): Promise<void>;
    
    // 可选: 注册自定义 UI
    registerUI?(ui: ExtensionUIContext): void;
    
    // 可选: 注册自定义工具
    registerTools?(): ToolDefinition[];
    
    // 可选: 注册slash命令
    registerSlashCommands?(): SlashCommand[];
}

// 扩展加载
const loader = new ExtensionLoader();
const extensions = await loader.loadFromDirectory("./extensions");
```

### 6.2 技能 (Skills)

```typescript
// 技能定义
interface Skill {
    name: string;
    description: string;
    prompt: string;
    tools?: string[];
}

// 使用技能
/<skill-name> [参数]
// 或
@skill:<skill-name>
```

### 6.3 主题 (Themes)

```typescript
interface Theme {
    name: string;
    colors: ThemeColors;
    fonts: ThemeFonts;
    // ...
}

// 主题结构
{
    "name": "dark",
    "colors": {
        "background": "#1e1e1e",
        "foreground": "#d4d4d4",
        "accent": "#007acc",
        // ...
    }
}
```

---

## 7. 技术栈与依赖

### 7.1 核心依赖

```json
{
    "dependencies": {
        "@sinclair/typebox": "^0.32.0",     // 类型定义和验证
        "eventsource": "^2.0.0",             // SSE 客户端
        "undici": "^6.0.0",                  // HTTP 客户端
        "oauth": "^0.10.0",                  // OAuth 支持
        "@aws-sdk/client-bedrock-runtime": "^3.0.0"  // AWS Bedrock
    },
    "devDependencies": {
        "typescript": "^5.0.0",
        "vitest": "^1.0.0",
        "biome": "^1.0.0"
    }
}
```

### 7.2 构建系统

- **TypeScript**: 源码编写
- **Vitest**: 测试框架
- **Biome**: Lint 和格式化
- **npm workspaces**: Monorepo 管理

---

## 8. 学习路径建议

### 8.1 阶段一：基础理解（1-2 周）

1. **阅读文档**
   - README.md（项目概述）
   - packages/ai/README.md（LLM API）
   - packages/coding-agent/README.md（使用方式）

2. **运行项目**
   - `npm install`
   - `npm run build`
   - `./pi-test.sh` 或 `npx tsx packages/coding-agent/src/cli.ts`

3. **理解核心概念**
   - Agent 循环
   - 工具调用
   - 事件流

### 8.2 阶段二：深入源码（2-3 周）

1. **pi-ai 层**
   - `types.ts` - 核心类型
   - `stream.ts` - 流式 API
   - `api-registry.ts` - Provider 注册
   - 选择一个 Provider 深入（如 `anthropic.ts`）

2. **agent 层**
   - `agent.ts` - Agent 类
   - `agent-loop.ts` - 核心循环
   - `types.ts` - 类型定义

3. **coding-agent 层**
   - `interactive-mode.ts` - 交互模式
   - `agent-session.ts` - 会话管理
   - 工具实现 (`core/tools/`)

### 8.3 阶段三：扩展开发（1-2 周）

1. **创建简单扩展**
   - 参考 `examples/extensions/`
   - 实现基本功能

2. **添加新 Provider**
   - 按照 AGENTS.md 指南
   - 参考现有 Provider 实现

3. **修改核心功能**
   - 添加新工具
   - 修改会话管理
   - 自定义 UI 组件

### 8.4 关键文件索引

| 功能 | 文件路径 |
|------|----------|
| LLM API 入口 | `packages/ai/src/stream.ts` |
| 类型定义 | `packages/ai/src/types.ts` |
| Provider 注册 | `packages/ai/src/api-registry.ts` |
| Anthropic 实现 | `packages/ai/src/providers/anthropic.ts` |
| OpenAI 实现 | `packages/ai/src/providers/openai-responses.ts` |
| Agent 核心 | `packages/agent/src/agent.ts` |
| Agent 循环 | `packages/agent/src/agent-loop.ts` |
| 交互模式 | `packages/coding-agent/src/modes/interactive/interactive-mode.ts` |
| 会话管理 | `packages/coding-agent/src/core/agent-session.ts` |
| 工具定义 | `packages/coding-agent/src/core/tools/index.ts` |
| TUI 库 | `packages/tui/src/index.ts` |

---

## 附录：常见问题

### Q1: 如何添加新的 LLM Provider？

参考 `AGENTS.md` 中的"Adding a New LLM Provider"部分，需要修改：
1. `packages/ai/src/types.ts` - 添加 API/Provider 类型
2. 创建 `packages/ai/src/providers/<provider>.ts`
3. 在 `register-builtins.ts` 中注册
4. 添加测试

### Q2: 如何调试 Agent 行为？

```bash
# 启用调试日志
export PI_DEBUG=1
pi

# 或者在代码中
agent.subscribe((event) => {
    console.log(JSON.stringify(event, null, 2));
});
```

### Q3: 如何理解会话压缩？

会话压缩是将长对话历史压缩为摘要的技术：
- 减少 token 使用
- 保持上下文连贯性
- 详细内容见 `packages/coding-agent/docs/compaction.md`

---

*文档版本: 1.0*  
*最后更新: 2025-03-19*
