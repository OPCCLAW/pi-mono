# 阶段 6: 理解会话管理与交互模式

**目标**: 理解 pi 如何管理会话和渲染 TUI

## 6.1 会话管理

文件：`packages/coding-agent/src/core/agent-session.ts`

AgentSession 是会话生命周期管理的高级封装。

### 核心功能

```typescript
import { AgentSession } from './core/agent-session';

// 获取或创建会话
const session = agentSessionManager.getOrCreateSession({
    id: 'session-123',
    model: getModel('anthropic', 'claude-sonnet-4-20250514'),
});

// 发送消息
await session.prompt('Hello, help me with coding.');

// 分支会话
const branch = await session.fork('feature-branch');

// 压缩会话
await session.compact();

// 导出为 HTML
const html = await session.exportToHtml();
```

### 会话事件

```typescript
session.subscribe((event) => {
    switch (event.type) {
        case 'message_start':
            // 新消息开始
            break;
        case 'message_update':
            // 消息更新（流式）
            break;
        case 'message_end':
            // 消息结束
            break;
        case 'tool_execution_start':
            // 工具开始执行
            break;
        case 'tool_execution_end':
            // 工具执行结束
            break;
        case 'auto_compaction_start':
            // 自动压缩开始
            break;
        case 'auto_compaction_end':
            // 自动压缩结束
            break;
    }
});
```

## 6.2 会话文件结构

```
.session/
├── session.json      # 元数据和消息
│   ├── header
│   │   ├── id
│   │   ├── version
│   │   ├── model
│   │   ├── createdAt
│   │   └── parentSessionId
│   └── messages
│       ├── { role: 'user', content: '...', timestamp: ... }
│       ├── { role: 'assistant', content: [...], timestamp: ... }
│       └── { role: 'toolResult', toolCallId: '...', content: '...', timestamp: ... }
└── attachments/     # 附件文件（图片等）
    ├── image1.png
    └── image2.jpg
```

## 6.3 交互模式

文件：`packages/coding-agent/src/modes/interactive/interactive-mode.ts`

InteractiveMode 是 TUI 界面的核心实现。

### 核心组件

```typescript
export class InteractiveMode {
    private session: AgentSession;
    private ui: TUI;
    private chatContainer: Container;
    private editor: Editor;
    private footer: Footer;

    async run() {
        // 1. 初始化 TUI
        this.ui = new TUI({
            terminal: this.terminal,
            theme: this.theme,
        });

        // 2. 创建/恢复会话
        this.session = await this.sessionManager.getOrCreateSession();

        // 3. 设置事件监听
        this.session.subscribe(this.handleSessionEvent.bind(this));

        // 4. 渲染界面
        this.ui.setRoot(this.buildLayout());

        // 5. 启动渲染循环
        this.ui.run();
    }
}
```

### 界面布局

```
┌─────────────────────────────────────────┐
│ Header: 快捷键 / 加载的扩展 / 技能       │
├─────────────────────────────────────────┤
│                                         │
│ Messages                                │
│ ├─ User: 你好                          │
│ ├─ Assistant: 你好！有什么可以帮你的？ │
│ ├─ ToolCall: read file.txt             │
│ └─ ToolResult: [文件内容]              │
│                                         │
├─────────────────────────────────────────┤
│ Editor: 用户输入区域                    │
├─────────────────────────────────────────┤
│ Footer: cwd / session / tokens / cost   │
└─────────────────────────────────────────┘
```

## 6.4 内置工具

文件：`packages/coding-agent/src/core/tools/`

### 核心工具

| 工具 | 文件 | 功能 |
|------|------|------|
| read | read.ts | 读取文件内容 |
| write | write.ts | 写入文件 |
| edit | edit.ts | 编辑文件（diff 方式） |
| bash | bash.ts | 执行 shell 命令 |
| grep | grep.ts | 搜索文件内容 |
| find | find.ts | 查找文件 |
| ls | ls.ts | 列出目录 |

### 工具定义示例

```typescript
// read.ts
export const readTool: AgentTool = {
    name: 'read',
    description: 'Read the contents of a file at the given path.',
    parameters: Type.Object({
        path: Type.String({ description: 'Path to the file to read.' }),
        offset: Type.Optional(Type.Number({ description: 'Line offset to start reading from.' })),
        limit: Type.Optional(Type.Number({ description: 'Number of lines to read.' })),
    }),

    async execute(args, context) {
        const content = await fs.promises.readFile(args.path, 'utf-8');
        return truncate(content, args.limit);
    },
};
```

## 6.5 压缩机制

文件：`packages/coding-agent/src/core/compaction/`

### 压缩触发条件

- Token 使用超过阈值
- 上下文溢出

### 压缩流程

```typescript
async function compact(session: AgentSession) {
    // 1. 分析消息，计算 token
    const tokens = calculateContextTokens(session.messages);

    // 2. 如果超过阈值，触发压缩
    if (tokens > THRESHOLD) {
        // 3. 生成分支摘要
        const summary = await generateBranchSummary(olderMessages);

        // 4. 压缩消息
        const compacted = compactMessages(session.messages, summary);

        // 5. 保存
        await session.save(compacted);
    }
}
```

## 6.6 关键文件

| 文件 | 作用 |
|------|------|
| `packages/coding-agent/src/core/agent-session.ts` | 会话管理 |
| `packages/coding-agent/src/modes/interactive/interactive-mode.ts` | 交互模式 |
| `packages/coding-agent/src/core/tools/index.ts` | 工具注册 |
| `packages/coding-agent/src/core/compaction/index.ts` | 压缩机制 |
| `packages/coding-agent/src/core/session-manager.ts` | 会话持久化 |

## 下一步

理解会话管理后，进入 [阶段 7：研究 TUI 库实现](../stage-07-tui-library/README.md)
