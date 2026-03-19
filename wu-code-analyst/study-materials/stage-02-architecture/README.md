# 阶段 2: 理解整体架构

**目标**: 建立全局视角，理解各包之间的关系

## 2.1 阅读顶层文档

建议按顺序阅读：

1. **[README.md](../../../README.md)** - 项目概述
   - 项目定位：终端 AI 编程助手
   - 包结构介绍
   - 快速开始指南

2. **[packages/ai/README.md](../../../packages/ai/README.md)** - LLM API 文档
   - 支持的 Provider 列表
   - 工具调用定义
   - 流式 API 使用

3. **[packages/coding-agent/README.md](../../../packages/coding-agent/README.md)** - CLI 使用文档
   - 交互模式介绍
   - Providers & Models
   - 会话管理

4. **[packages/agent/README.md](../../../packages/agent/README.md)** - Agent 核心文档
   - Agent 类使用
   - 事件流说明
   - 工具执行

## 2.2 架构分层

Pi 项目采用分层架构：

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

### 各层职责

| 层级 | 包 | 职责 |
|------|-----|------|
| 顶层 | coding-agent | CLI 入口、交互模式、用户界面 |
| 会话层 | coding-agent/core | 会话管理、工具注册、压缩 |
| Agent 层 | agent | 核心循环、状态管理、事件订阅 |
| API 层 | ai | 统一接口、Provider 适配、流式处理 |
|  Provider 层 | ai/providers | 具体 LLM 实现 |

## 2.3 调用链路

理解数据从用户输入到 LLM 响应的完整流程：

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

### 详细流程

1. **用户输入** → TUI 接收用户消息
2. **InteractiveMode** → 处理消息，构建 AgentMessage
3. **AgentSession** → 注入系统提示、处理技能块、管理会话
4. **Agent** → 转换消息、执行循环、处理工具调用
5. **pi-ai** → 获取 Provider、流式调用
6. **Provider** → 构建请求、解析响应
7. **HTTP API** → 发送到 LLM 服务商

## 2.4 包依赖关系

```
packages/coding-agent/
├── depends on: @mariozechner/pi-agent-core
├── depends on: @mariozechner/pi-ai
├── depends on: @mariozechner/pi-tui

packages/agent/
└── depends on: @mariozechner/pi-ai

packages/tui/
└── (独立，无外部依赖)

packages/ai/
└── (独立，无外部依赖)
```

## 2.5 核心概念

- **Agent**: 管理状态、消息历史、工具执行的核心类
- **AgentSession**: 会话生命周期管理，包括持久化
- **Context**: 对话上下文，包含 messages 和 tools
- **ToolCall**: LLM 触发的工具调用请求
- **EventStream**: 流式事件迭代器

## 下一步

理解架构后，进入 [阶段 3：掌握 pi-ai 核心类型](../stage-03-pi-ai-types/README.md)
