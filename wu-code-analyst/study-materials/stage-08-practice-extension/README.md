# 阶段 8: 实践与扩展开发

**目标**: 能够修改和扩展项目

## 8.1 开发规范

在开始之前，请阅读 `AGENTS.md` 了解项目规范：

### 代码质量

- 禁止使用 `any` 类型
- 使用 TypeBox 进行类型定义和验证
- 运行 `npm run check` 确保代码质量

### Git 操作

- 永远不要使用 `git add -A` 或 `git add .`
- 只提交自己修改的文件
- 提交信息包含 `fixes #<number>` 关闭相关 issue

## 8.2 创建简单扩展

参考：`packages/coding-agent/examples/extensions/`

### 扩展示例结构

```
my-extension/
├── index.ts
└── package.json
```

### 基本扩展实现

```typescript
// index.ts
import type { Extension, ExtensionContext } from '@mariozechner/pi-coding-agent';

export const myExtension: Extension = {
    name: 'my-extension',
    version: '1.0.0',

    async onStart(context: ExtensionContext) {
        // 注册 Slash 命令
        context.registerSlashCommand({
            name: 'hello',
            description: 'Prints a greeting',
            handler: async (args) => {
                context.appendMessage({
                    type: 'user',
                    content: 'Hello from extension!',
                });
            },
        });

        // 注册工具
        context.registerTool({
            name: 'my_tool',
            description: 'A custom tool',
            parameters: Type.Object({
                input: Type.String(),
            }),
            execute: async (args) => {
                return `Processed: ${args.input}`;
            },
        });
    },

    async onDispose() {
        // 清理资源
    },
};
```

### 安装扩展

将扩展放入 `~/.pi/extensions/` 目录。

## 8.3 添加新 Provider (进阶)

参考 AGENTS.md 和现有 Provider 实现：

### 步骤 1: 添加类型

文件：`packages/ai/src/types.ts`

```typescript
export type KnownApi = // ... existing APIs
    | "my-provider-api";

export type KnownProvider = // ... existing providers
    | "my-provider";
```

### 步骤 2: 创建 Provider 文件

文件：`packages/ai/src/providers/my-provider.ts`

```typescript
import type { Api, Context, Model, StreamOptions } from '../types.js';
import type { AssistantMessageEventStream } from '../utils/event-stream.js';

export function stream(
    model: Model<Api>,
    context: Context,
    options?: StreamOptions
): AssistantMessageEventStream {
    // 实现流式接口
}

export function streamSimple(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
): AssistantMessageEventStream {
    // 实现简化版接口
}
```

### 步骤 3: 注册 Provider

文件：`packages/ai/src/providers/register-builtins.ts`

```typescript
// 懒加载导入
import('./my-provider.js').then(({ stream, streamSimple }) => {
    registerApiProvider('my-provider-api', {
        api: 'my-provider-api',
        stream,
        streamSimple,
    });
});
```

### 步骤 4: 添加测试

文件：`packages/ai/test/my-provider.test.ts`

## 8.4 修改核心功能

### 修改工具行为

文件：`packages/coding-agent/src/core/tools/`

```typescript
// 例如：修改 read 工具支持更多选项
export const readTool: AgentTool = {
    name: 'read',
    // ... 修改 description 或 parameters
    async execute(args, context) {
        // 自定义实现
    },
};
```

### 自定义会话压缩

文件：`packages/coding-agent/src/core/compaction/`

```typescript
// 自定义压缩策略
export function customCompact(
    messages: AgentMessage[],
    options: CompactOptions
): CompactionResult {
    // 自定义压缩逻辑
}
```

### 添加新的交互模式

文件：`packages/coding-agent/src/modes/`

```typescript
// 创建新模式
export class MyMode {
    async run() {
        // 实现
    }
}
```

## 8.5 运行测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
# 从包根目录运行
cd packages/ai
npx vitest --run test/stream.test.ts
```

### 调试测试

```bash
npx vitest test/stream.test.ts --inspect-brk
```

## 8.6 构建和发布

### 构建

```bash
npm run build
```

### 检查代码

```bash
npm run check
```

### 发布到 npm (仅维护者)

```bash
npm run release:patch  # 修复和新功能
npm run release:minor  # API 破坏性变更
```

## 8.7 关键资源

| 资源 | 位置 |
|------|------|
| 扩展示例 | `packages/coding-agent/examples/extensions/` |
| Provider 示例 | `packages/ai/src/providers/` |
| 测试示例 | `packages/ai/test/` |
| 文档 | `packages/coding-agent/docs/` |

## 完成

恭喜完成所有 8 个阶段！现在你应该对 Pi 项目有了全面的理解，可以开始：

1. 使用 pi 进行日常开发
2. 创建自己的扩展
3. 为项目贡献代码
4. 添加新的 LLM Provider

祝学习愉快！
