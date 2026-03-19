# 阶段 7: 研究 TUI 库实现

**目标**: 理解终端 UI 的渲染机制

## 7.1 TUI 库概述

文件：`packages/tui/src/index.ts`

Pi 的 TUI (Terminal User Interface) 库是一个差分渲染的终端 UI 框架。

### 核心特性

- **差分渲染**: 只更新变化的部分，最大化性能
- **组件系统**: Container, Text, Button, Input 等
- **事件系统**: 键盘输入、鼠标点击
- **主题支持**: 颜色、字体可配置

## 7.2 核心类

### Component 基类

```typescript
abstract class Component {
    // 布局属性
    x: number = 0;
    y: number = 0;
    width: number = 0;
    height: number = 0;

    // 样式
    backgroundColor?: string;
    foregroundColor?: string;

    // 生命周期
    abstract render(): void;
    mount(parent: Container): void;
    unmount(): void;

    // 事件
    onKeyDown?(event: KeyEvent): void;
    onClick?(x: number, y: number): void;
}
```

### 容器组件

```typescript
class Container extends Component {
    children: Component[] = [];

    add(child: Component): void;
    remove(child: Component): void;
    clear(): void;
}
```

### 文本组件

```typescript
class Text extends Component {
    content: string;
    style?: TextStyle;

    // 支持格式化
    // [bold]bold[/bold] [italic]italic[/italic]
}
```

### Markdown 组件

```typescript
class Markdown extends Component {
    content: string;  // Markdown 内容
    theme?: MarkdownTheme;

    // 支持代码高亮、链接等
}
```

## 7.3 差分渲染机制

### 渲染流程

```typescript
class TUI {
    private oldTree: RenderTree | null = null;

    render() {
        // 1. 构建新树
        const newTree = this.buildRenderTree();

        // 2. 计算差异
        const diff = diffTrees(this.oldTree, newTree);

        // 3. 应用差异（只更新变化的）
        this.applyDiff(diff);

        // 4. 保存旧树
        this.oldTree = newTree;
    }
}
```

### 差异类型

```typescript
type Diff =
    | { type: 'replace'; old: Node; new: Node }
    | { type: 'update'; node: Node; changes: Partial<Node> }
    | { type: 'insert'; parent: Node; child: Node; index: number }
    | { type: 'remove'; parent: Node; child: Node }
    | { type: 'move'; from: Node; to: Node };
```

### 性能优势

- 不用每次重绘整个屏幕
- 减少终端输出
- 提升响应速度

## 7.4 交互组件

### Editor 组件

```typescript
class Editor extends Component {
    value: string;
    cursorPosition: number;

    // 事件
    onSubmit?(value: string): void;
    onCancel?(): void;

    // 方法
    insert(text: string): void;
    delete(): void;
    moveCursor(dir: 'left' | 'right' | 'word'): void;
}
```

### Input 组件

```typescript
class Input extends Component {
    value: string;
    placeholder?: string;
    password?: boolean;

    onInput?(value: string): void;
    onSubmit?(value: string): void;
}
```

### Overlay 组件

```typescript
class Overlay extends Component {
    content: Component;
    maskColor?: string;

    show(): void;
    hide(): void;
}
```

## 7.5 主题系统

文件：`packages/coding-agent/src/modes/interactive/theme/`

### 主题结构

```typescript
interface Theme {
    name: string;
    colors: {
        background: string;
        foreground: string;
        accent: string;
        error: string;
        warning: string;
        success: string;
        // ...
    };
    fonts: {
        family: string;
        size: number;
    };
}
```

### 使用主题

```typescript
import { theme } from './theme';

const colors = theme.colors;
// theme.foreground
// theme.background
// theme.accent
```

## 7.6 关键文件

| 文件 | 作用 |
|------|------|
| `packages/tui/src/index.ts` | TUI 入口和核心类 |
| `packages/tui/src/component.ts` | Component 基类 |
| `packages/tui/src/container.ts` | Container 实现 |
| `packages/tui/src/text.ts` | Text 组件 |
| `packages/tui/src/diff.ts` | 差分算法 |
| `packages/coding-agent/src/modes/interactive/theme/theme.ts` | 主题系统 |

## 下一步

理解 TUI 库后，进入 [阶段 8：实践与扩展开发](../stage-08-practice-extension/README.md)
