# Pi Mono 学习材料索引

这是一个线性的、相互依赖的学习路径，共 **8 个阶段**。

## 学习路线图

```
stage-01-setup/                    → 环境搭建
    ↓
stage-02-architecture/              → 理解整体架构
    ↓
stage-03-pi-ai-types/              → 掌握 pi-ai 核心类型
    ↓
stage-04-pi-ai-stream/              → 深入 pi-ai 流式 API 与 Provider
    ↓
stage-05-agent-runtime/            → 学习 Agent 运行时
    ↓
stage-06-session-management/        → 理解会话管理与交互模式
    ↓
stage-07-tui-library/               → 研究 TUI 库实现
    ↓
stage-08-practice-extension/        → 实践与扩展开发
```

## 阶段概览

| 阶段 | 目录 | 主题 | 核心文件 |
|------|------|------|----------|
| 1 | stage-01-setup | 环境搭建 | package.json |
| 2 | stage-02-architecture | 整体架构 | README.md 各包 README |
| 3 | stage-03-pi-ai-types | 核心类型 | packages/ai/src/types.ts |
| 4 | stage-04-pi-ai-stream | 流式 API | packages/ai/src/stream.ts |
| 5 | stage-05-agent-runtime | Agent 运行时 | packages/agent/src/agent.ts |
| 6 | stage-06-session-management | 会话管理 | packages/coding-agent/src/core/agent-session.ts |
| 7 | stage-07-tui-library | TUI 库 | packages/tui/src/index.ts |
| 8 | stage-08-practice-extension | 实践开发 | examples/extensions/ |

## 快速开始

1. **环境准备**: 阅读 [stage-01-setup/README.md](stage-01-setup/README.md)
2. **理解架构**: 阅读 [stage-02-architecture/README.md](stage-02-architecture/README.md)
3. **按顺序学习**: 每个阶段依赖前一个阶段的知识

## 前置条件

- Node.js 18+
- npm 或 yarn
- TypeScript 基础知识
- 终端操作经验

## 相关文档

- [项目分析文档](../pi-mono-analysis.md) - 详细的架构分析
- [AGENTS.md](../../../AGENTS.md) - 项目开发规范
