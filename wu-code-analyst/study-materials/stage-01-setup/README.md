# 阶段 1: 环境搭建

**目标**: 能够编译运行项目

## 1.1 安装依赖

在项目根目录执行：

```bash
npm install
```

这会安装所有 packages 的依赖。

## 1.2 构建项目

```bash
npm run build
```

这会编译所有 packages：
- `packages/ai/` - TypeScript 编译为 JS
- `packages/agent/` - TypeScript 编译为 JS
- `packages/coding-agent/` - TypeScript 编译为 JS
- `packages/tui/` - TypeScript 编译为 JS

## 1.3 运行测试

```bash
# 运行所有测试
npm test

# 或使用项目脚本
./test.sh
```

## 1.4 从源码运行 pi

```bash
# 使用项目脚本
./pi-test.sh

# 或直接使用 tsx
npx tsx packages/coding-agent/src/cli.ts
```

## 1.5 验证环境

启动后应该能看到：
- 终端 UI 界面
- 提示输入 API Key 或选择登录方式

## 1.6 了解项目目录结构

```
pi-mono/
├── packages/
│   ├── ai/           # 统一 LLM API
│   ├── agent/        # Agent 运行时
│   ├── coding-agent/ # CLI 和交互模式
│   ├── tui/          # 终端 UI 库
│   ├── web-ui/       # Web UI 组件
│   ├── mom/          # Slack Bot
│   └── pods/         # vLLM 部署管理
├── .pi/              # 用户配置目录
│   ├── extensions/   # 扩展
│   ├── prompts/      # Prompt 模板
│   └── ...
├── node_modules/
└── package.json
```

## 下一步

完成环境搭建后，进入 [阶段 2：理解整体架构](../stage-02-architecture/README.md)
