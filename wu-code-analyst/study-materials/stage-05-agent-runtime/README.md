# 阶段 5: 学习 Agent 运行时

**目标**: 理解 Agent 的核心循环、状态管理和工具执行

## 5.1 Agent 类

文件：`packages/agent/src/agent.ts`

Agent 是整个运行时的核心，负责管理状态和处理对话。

### 基本使用

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';

const agent = new Agent({
    initialState: {
        systemPrompt: 'You are a helpful coding assistant.',
        model: getModel('anthropic', 'claude-sonnet-4-20250514'),
        thinkingLevel: 'medium',
        tools: [readTool, writeTool, editTool, bashTool],
        messages: [],
    },

    // 可选：自定义消息转换
    convertToLlm: (messages) => {
        return messages.filter(m =>
            m.role === 'user' ||
            m.role === 'assistant' ||
            m.role === 'toolResult'
        );
    },

    // 可选：自定义上下文转换
    transformContext: async (messages) => {
        // 可以在这里注入外部上下文
        return messages;
    },
});

// 发送消息
await agent.prompt('Read package.json');

// 监听事件
agent.subscribe((event) => {
    if (event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta') {
        process.stdout.write(event.assistantMessageEvent.delta);
    }
});
```

### Agent 状态

```typescript
interface AgentState {
    systemPrompt: string;
    model: Model;
    thinkingLevel: ThinkingLevel;
    tools: AgentTool[];
    messages: AgentMessage[];
    isStreaming: boolean;
    streamMessage: AssistantMessage | null;
    pendingToolCalls: Set<string>;
    error: Error | undefined;
}
```

## 5.2 Agent 循环

文件：`packages/agent/src/agent-loop.ts`

核心循环逻辑，处理 LLM 调用和工具执行。

### 循环流程

```typescript
async function runAgentLoop(agent: Agent, config: AgentLoopConfig) {
    while (true) {
        // 1. 转换上下文
        const context = await config.transformContext(agent.state.messages);

        // 2. 转换为 LLM 消息
        const llmMessages = config.convertToLlm(context);

        // 3. 调用 LLM 获取流
        const stream = streamSimple(
            agent.state.model,
            { systemPrompt, messages: llmMessages, tools },
            options
        );

        // 4. 处理流式事件
        for await (const event of stream) {
            agent.emit(event);

            // 5. 如果有工具调用，执行它
            if (event.type === 'toolcall_end') {
                const toolCall = event.toolCall;

                // 验证工具存在
                const tool = agent.state.tools.find(t => t.name === toolCall.name);
                if (!tool) {
                    // 工具不存在，记录错误
                    continue;
                }

                // 执行工具
                const result = await tool.execute(toolCall.arguments, context);

                // 添加工具结果到消息
                agent.state.messages.push({
                    role: 'toolResult',
                    toolCallId: toolCall.id,
                    content: result,
                    timestamp: Date.now(),
                });
            }
        }

        // 6. 检查是否需要继续
        if (stopReason !== 'toolUse') break;
    }
}
```

## 5.3 事件流

Agent 通过事件与外部通信：

### 事件类型

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start      { message: userMessage }
├─ message_end
├─ message_start       { message: assistantMessage }
├─ message_update      { text_delta: "Hello!" }
├─ message_update
├─ message_end
├─ turn_end
└─ agent_end
```

### 带工具调用的事件

```
prompt("Read file.txt")
├─ agent_start
├─ turn_start
├─ message_start/end   { userMessage }
├─ message_start       { assistantMessage with toolCall }
├─ message_update...
├─ message_end
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_end    { toolCallId, result }
├─ message_start         { toolResultMessage }
├─ message_end
├─ turn_start            # 下一轮
├─ message_start         { assistantMessage }
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

## 5.4 工具执行

### 工具定义

```typescript
interface AgentTool {
    name: string;
    description: string;
    parameters: TSchema;  // TypeBox schema
    execute: (args: any, context: AgentContext) => Promise<string>;
}
```

### 执行流程

1. **LLM 返回 ToolCall**
   ```typescript
   { type: 'toolCall', id: 'call_abc', name: 'read', arguments: { path: 'file.txt' } }
   ```

2. **验证工具和参数**
   - 检查工具是否存在
   - 用 TypeBox 验证参数是否符合 schema

3. **beforeToolCall 钩子** (可选)
   ```typescript
   beforeToolCall: async (context) => {
       // 权限检查
       if (!hasPermission(context.toolName)) {
           return { blocked: true, message: 'No permission' };
       }
   }
   ```

4. **执行工具**
   ```typescript
   const result = await tool.execute(args, context);
   ```

5. **afterToolCall 钩子** (可选)
   ```typescript
   afterToolCall: async (context) => {
       // 记录日志
       logToolExecution(context.toolName, context.result);
   }
   ```

6. **构建 ToolResultMessage**
   ```typescript
   {
       role: 'toolResult',
       toolCallId: 'call_abc',
       content: 'file content here...',
       timestamp: Date.now()
   }
   ```

## 5.5 关键文件

| 文件 | 作用 |
|------|------|
| `packages/agent/src/agent.ts` | Agent 类实现 |
| `packages/agent/src/agent-loop.ts` | 核心循环逻辑 |
| `packages/agent/src/types.ts` | Agent 相关类型 |

## 下一步

理解 Agent 运行时后，进入 [阶段 6：理解会话管理与交互模式](../stage-06-session-management/README.md)
