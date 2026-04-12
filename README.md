# @tiktok-fe/agent-sdk

`@tiktok-fe/agent-sdk` 是一个用于以编程方式驱动 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 的 TypeScript SDK。

它通过启动 `claude` 子进程，把 Claude Code 的多轮会话、流式事件、工具调用结果和会话恢复能力封装成清晰的异步 API，方便在脚本、服务端程序或自动化流程中集成。

## 功能特性

- **会话管理**：支持新建会话、按 session ID 恢复会话、继续当前工作目录下最近一次会话
- **多轮对话**：首轮结束后自动使用 `--resume`，无需手动管理续聊参数
- **流式输出**：通过 `AsyncGenerator<RelayEvent>` 实时消费文本、thinking、工具调用与完成事件
- **缓冲执行**：通过 `run()` 一次性拿到完整事件列表、最终回复和 usage 信息
- **图片输入**：支持将本地图片路径与文本一起传入 Claude Code
- **中断控制**：支持使用 `AbortSignal` 取消正在执行的 turn
- **CLI 参数映射**：大部分常用 Claude Code CLI 选项都提供了类型化封装

## 适用场景

- 在 Node.js 服务里调用 Claude Code 完成自动化任务
- 在本地脚本中驱动多轮代码分析或生成流程
- 对 Claude Code 的流式事件做二次封装
- 在已有工程里编排 session、tool use 和输出处理逻辑

## 前置要求

- Node.js >= 18
- 已安装 `Claude Code CLI`，并且 `claude` 可在 PATH 中找到
- 如果 `claude` 不在默认 PATH 中，可以通过 `cliPath` 显式指定路径

## 安装

```bash
# pnpm
pnpm add @tiktok-fe/agent-sdk

# npm
npm install @tiktok-fe/agent-sdk

# bun
bun add @tiktok-fe/agent-sdk
```

## 快速开始

```typescript
import { ClaudeCode } from "@tiktok-fe/agent-sdk";

const claude = new ClaudeCode();
const session = claude.startSession({
  model: "sonnet",
  maxTurns: 10,
  dangerouslySkipPermissions: true,
});

const turn = await session.run("Explain what this project does");

console.log(turn.finalResponse);
console.log(turn.usage);
// { costUsd, inputTokens, outputTokens, contextWindow }
```

## 核心概念

### ClaudeCode

SDK 的入口对象，用于创建和管理 `Session`。

### Session

表示一次 Claude Code 会话，负责保存当前会话 ID、执行多轮对话，并根据上下文自动决定是新会话、`--resume` 还是 `--continue`。

### Turn

一次 `run()` 调用对应一次 turn，包含：

- `events`：这一轮产生的全部 `RelayEvent[]`
- `finalResponse`：拼接后的最终文本输出
- `usage`：成本和 token 统计
- `sessionId`：当前会话 ID

### RelayEvent

Claude Code 输出流在 `claude-code-parser` 转换后的统一事件结构。你可以用它来处理：

- 增量文本输出
- thinking 输出
- 工具调用 / 工具结果
- 会话元信息
- turn 完成事件
- 错误事件

## 使用指南

### 1. 创建客户端

```typescript
import { ClaudeCode } from "@tiktok-fe/agent-sdk";

// 使用默认配置：直接从 PATH 中查找 claude
const claude = new ClaudeCode();

// 指定 Claude CLI 路径与 API Key
const customClaude = new ClaudeCode({
  cliPath: "/usr/local/bin/claude",
  apiKey: "sk-ant-...",
});

// 自定义子进程环境变量
const isolatedClaude = new ClaudeCode({
  env: {
    HOME: "/tmp",
    PATH: process.env.PATH!,
  },
});
```

### 2. 创建或恢复会话

```typescript
// 新建会话
const session = claude.startSession({
  model: "opus",
  cwd: "/path/to/project",
  maxBudgetUsd: 1,
});

// 通过 session ID 恢复历史会话
const resumed = claude.resumeSession("session-abc-123", {
  dangerouslySkipPermissions: true,
});

// 继续当前工作目录最近一次会话
const continued = claude.continueSession({
  dangerouslySkipPermissions: true,
});
```

### 3. 使用 `run()` 获取完整结果

`run()` 会等待这一轮执行结束，然后返回完整结果对象。

```typescript
const turn = await session.run("Fix the failing tests");

console.log(turn.finalResponse); // 最终文本输出
console.log(turn.sessionId);     // 当前会话 ID
console.log(turn.events);        // 全量 RelayEvent[]
console.log(turn.usage);         // 成本与 token 统计
```

适合：

- 一次性任务
- 只关心最终结果
- 需要统一记录完整事件

### 4. 使用 `runStreamed()` 流式消费事件

`runStreamed()` 会立即返回一个带 `events` 的对象，其中 `events` 是 `AsyncGenerator<RelayEvent>`。

```typescript
const { events } = await session.runStreamed("Refactor this function");

for await (const event of events) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.content);
      break;
    case "thinking_delta":
      console.log("[thinking]", event.content);
      break;
    case "tool_use":
      console.log("[tool]", event.toolName, event.input);
      break;
    case "tool_result":
      console.log("[result]", event.output);
      break;
    case "turn_complete":
      console.log("[done]", event.costUsd);
      break;
    case "error":
      console.error("[error]", event.message);
      break;
  }
}
```

适合：

- 实时输出终端内容
- UI 中增量展示模型回复
- 监听工具调用过程
- 在流式阶段做业务侧处理

### 5. 多轮对话

同一个 `Session` 在首轮结束后会自动记录 `session.id`。后续再次调用 `run()` 或 `runStreamed()` 时，SDK 会自动通过 `--resume` 继续同一个 Claude 会话。

```typescript
const session = claude.startSession({
  dangerouslySkipPermissions: true,
});

const first = await session.run("Read the README and summarize it");
console.log(first.finalResponse);
console.log(session.id);

const second = await session.run("Now translate it to Chinese");
console.log(second.finalResponse);
console.log(session.id);
```

### 6. 结构化输入：文本 + 本地图片

```typescript
const turn = await session.run([
  { type: "text", text: "What UI issues do you see in this screenshot?" },
  { type: "local_image", path: "/path/to/screenshot.png" },
]);
```

SDK 会自动把多段文本拼接成 prompt，并通过 `--image` 把图片参数传给 Claude Code CLI。

### 7. 中断执行

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

try {
  const turn = await session.run("Long running task...", {
    signal: controller.signal,
  });
  console.log(turn.finalResponse);
} catch (error) {
  console.error("Turn aborted or failed:", error);
}
```

## API 使用文档

本节按实际导出 API 说明各个类型与调用方式。

### `ClaudeCode`

主入口类，定义于 `src/claude-code.ts`。

```typescript
class ClaudeCode {
  constructor(options?: ClaudeCodeOptions)
  startSession(options?: SessionOptions): Session
  resumeSession(sessionId: string, options?: SessionOptions): Session
  continueSession(options?: SessionOptions): Session
}
```

#### 构造参数：`ClaudeCodeOptions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cliPath` | `string` | `claude` 可执行文件路径，默认是 `claude` |
| `env` | `Record<string, string>` | 子进程环境变量。设置后不会继承 `process.env` |
| `apiKey` | `string` | 会以 `ANTHROPIC_API_KEY` 注入到 Claude CLI 子进程 |

### `Session`

定义于 `src/session.ts`，封装单个 Claude 会话。

```typescript
class Session {
  get id(): string | null
  run(input: Input, turnOptions?: TurnOptions): Promise<Turn>
  runStreamed(input: Input, turnOptions?: TurnOptions): Promise<StreamedTurn>
}
```

#### `Session.id`

- 类型：`string | null`
- 含义：当前会话 ID
- 行为：初始值通常为 `null`，在首轮执行完成并收到 `session_meta` / `turn_complete` 后更新

#### `session.run(input, turnOptions?)`

执行一轮对话，等待结束后返回完整结果。

**参数：**

- `input: Input`
- `turnOptions?: TurnOptions`

**返回值：** `Promise<Turn>`

#### `session.runStreamed(input, turnOptions?)`

执行一轮对话，并返回可异步迭代的事件流。

**参数：**

- `input: Input`
- `turnOptions?: TurnOptions`

**返回值：** `Promise<StreamedTurn>`

### `Input`

```typescript
type Input = string | UserInput[];

type UserInput =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string };
```

#### 使用建议

- 纯文本场景直接传 `string`
- 需要图文混合输入时传 `UserInput[]`
- 多个 `text` 项会被按空行拼接
- `local_image.path` 应为本地可访问路径

### `TurnOptions`

```typescript
type TurnOptions = {
  signal?: AbortSignal;
};
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `signal` | `AbortSignal` | 用于取消当前 turn |

### `Turn`

`run()` 返回的完整结果结构：

```typescript
type Turn = {
  events: RelayEvent[];
  finalResponse: string;
  usage: TurnUsage | null;
  sessionId: string | null;
};
```

#### 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `events` | `RelayEvent[]` | 当前 turn 的全部事件 |
| `finalResponse` | `string` | 所有 `text_delta` 拼接后的最终文本 |
| `usage` | `TurnUsage \| null` | token 与花费信息 |
| `sessionId` | `string \| null` | 当前 turn 对应的会话 ID |

### `StreamedTurn`

```typescript
type StreamedTurn = {
  events: AsyncGenerator<RelayEvent>;
};
```

### `TurnUsage`

```typescript
type TurnUsage = {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
};
```

### `RelayEvent`

SDK 从 `claude-code-parser` 重新导出事件类型与解析工具，因此你既可以直接消费 `Session` 返回的事件，也可以自己处理原始 NDJSON 行。

常见事件如下：

| 事件类型 | 关键字段 | 说明 |
| --- | --- | --- |
| `text_delta` | `content` | 增量文本输出 |
| `thinking_delta` | `content` | thinking 增量输出 |
| `tool_use` | `toolName`, `input` | 工具调用 |
| `tool_result` | `output` | 工具执行结果 |
| `session_meta` | - | 会话元数据 |
| `turn_complete` | `costUsd`, `inputTokens`, `outputTokens`, `contextWindow` | 当前 turn 完成 |
| `error` | `message` | 当前 turn 失败 |

### `SessionOptions`

`SessionOptions` 会映射为 Claude Code CLI 参数，定义于 `src/options.ts`。

#### 常用字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | `string` | 模型名，例如 `sonnet`、`opus`、`claude-sonnet-4-6` |
| `cwd` | `string` | Claude 执行时的工作目录 |
| `additionalDirectories` | `string[]` | 额外可访问目录 |
| `maxTurns` | `number` | 最大 agentic turns |
| `maxBudgetUsd` | `number` | 最大美元预算 |
| `dangerouslySkipPermissions` | `boolean` | 跳过权限检查 |
| `permissionMode` | `PermissionMode` | 权限模式 |
| `allowedTools` | `string[]` | 自动允许的工具 |
| `disallowedTools` | `string[]` | 禁止使用的工具 |
| `systemPrompt` | `string` | 替换默认系统提示词 |
| `appendSystemPrompt` | `string` | 在默认系统提示词后追加内容 |
| `mcpConfig` | `string \| string[]` | MCP 配置文件路径 |
| `strictMcpConfig` | `boolean` | 仅使用指定 MCP 配置 |
| `effort` | `"low" \| "medium" \| "high" \| "max"` | 模型推理强度 |
| `fallbackModel` | `string` | 主模型拥塞时的回退模型 |
| `bare` | `boolean` | 跳过 hooks / plugins / MCP / CLAUDE.md 自动发现 |
| `noSessionPersistence` | `boolean` | 不持久化 session |
| `chrome` | `boolean` | 启用 Chrome 集成 |
| `agents` | `Record<string, AgentDefinition> \| string` | 动态 sub-agent 定义 |
| `agent` | `string` | 指定当前 agent |
| `name` | `string` | 会话显示名 |
| `settings` | `string` | 额外 settings 文件路径或 JSON 字符串 |
| `settingSources` | `string` | 设置来源 |
| `includeHookEvents` | `boolean` | 输出 hook 生命周期事件 |
| `disableSlashCommands` | `boolean` | 禁用 slash commands |
| `pluginDir` | `string \| string[]` | 插件目录 |
| `excludeDynamicSystemPromptSections` | `boolean` | 排除动态 system prompt 片段 |
| `debug` | `string \| boolean` | 调试模式 |
| `debugFile` | `string` | 调试日志输出路径 |
| `worktree` | `string` | 在隔离 worktree 中执行 |

#### 权限模式：`PermissionMode`

```typescript
type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "dontAsk"
  | "bypassPermissions";
```

#### 推理强度：`Effort`

```typescript
type Effort = "low" | "medium" | "high" | "max";
```

#### 动态子代理定义：`AgentDefinition`

```typescript
type AgentDefinition = {
  description?: string;
  prompt?: string;
  tools?: string[];
  model?: string;
  maxTurns?: number;
};
```

### SDK 导出项

`src/index.ts` 当前导出以下内容：

- 类：`ClaudeCode`, `Session`
- SDK 类型：`ClaudeCodeOptions`, `SessionOptions`, `PermissionMode`, `Effort`, `AgentDefinition`, `TurnOptions`
- 会话相关类型：`Input`, `UserInput`, `Turn`, `TurnUsage`, `RunResult`, `StreamedTurn`, `RunStreamedResult`
- 从 `claude-code-parser` 透出的类型：`RelayEvent` 及其细分事件类型、`ClaudeEvent`、`ClaudeMessage`、`ClaudeContent`、`ModelUsageEntry`
- 工具方法：`parseLine`, `Translator`, `extractContent`

## 进阶示例

### 示例 1：封装一个同步风格助手调用

```typescript
import { ClaudeCode } from "@tiktok-fe/agent-sdk";

const claude = new ClaudeCode();

export async function askClaude(prompt: string) {
  const session = claude.startSession({
    dangerouslySkipPermissions: true,
    maxTurns: 8,
  });

  const turn = await session.run(prompt);
  return turn.finalResponse;
}
```

### 示例 2：在命令行中流式打印输出

```typescript
import { ClaudeCode } from "@tiktok-fe/agent-sdk";

const claude = new ClaudeCode();
const session = claude.startSession({ dangerouslySkipPermissions: true });
const { events } = await session.runStreamed("Review the current repository");

for await (const event of events) {
  if (event.type === "text_delta") {
    process.stdout.write(event.content);
  }
}
```

### 示例 3：跨 turn 保持上下文

```typescript
const session = claude.startSession({ dangerouslySkipPermissions: true });

await session.run("Read package.json and summarize dependencies");
const next = await session.run("Now suggest a release note in Chinese");

console.log(next.finalResponse);
console.log(session.id);
```

## 执行流程

SDK 内部执行路径如下：

```text
你的业务代码
  ↓
ClaudeCode
  ↓
Session
  ↓
ClaudeCodeExec
  ↓
claude-code-parser
  ↓
claude CLI (--output-format stream-json)
```

其中：

- `ClaudeCodeExec` 负责组装 CLI 参数、启动子进程、读取 stdout NDJSON 行
- `Session` 负责输入归一化、会话恢复逻辑、事件聚合与流式转发
- `claude-code-parser` 负责把 Claude Code 输出转换为结构化事件

## 目录结构

```text
src/
  claude-code.ts   # SDK 主入口
  session.ts       # Session、Turn、输入输出类型与事件处理
  exec.ts          # Claude CLI 子进程执行封装
  options.ts       # 配置类型定义
  index.ts         # 对外导出

demo/
  index.ts         # 多轮流式交互示例

tests/
  exec.test.ts     # CLI 参数与执行层测试
  session.test.ts  # Session 行为测试
```

## 开发

```bash
# 安装依赖
bun install

# 构建
bun run build

# 类型检查
bun run typecheck

# 运行测试
bun test

# 清理产物
bun run clean
```

## 许可证

MIT
