# @tiktok-fe/ttls-agent-sdk

`@tiktok-fe/ttls-agent-sdk` 是一个用于以编程方式驱动 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 的 TypeScript SDK。

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

## 文档地图

如果你不是只想快速上手，而是准备修改或排查这个仓库，建议直接看这些补充文档：

- [docs/README.md](./docs/README.md)：文档总索引
- [docs/architecture.md](./docs/architecture.md)：架构、职责边界和执行链路
- [docs/testing-and-validation.md](./docs/testing-and-validation.md)：测试结构、验证命令和排障建议
- [docs/agent-playbook.md](./docs/agent-playbook.md)：面向自动化 agent 的工作顺序和常见风险
- [docs/authentication.md](./docs/authentication.md)：`apiKey` / `authToken` / `baseUrl` 的选型说明

## 前置要求

- Node.js >= 18
- 已安装 `Claude Code CLI`，并且 `claude` 可在 PATH 中找到
- 如果 `claude` 不在默认 PATH 中，可以通过 `cliPath` 显式指定路径

## 安装

```bash
# pnpm
pnpm add @tiktok-fe/ttls-agent-sdk

# npm
npm install @tiktok-fe/ttls-agent-sdk

# bun
bun add @tiktok-fe/ttls-agent-sdk
```

## 快速开始

```typescript
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

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
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

// 使用默认配置：直接从 PATH 中查找 claude
const claude = new ClaudeCode();

// 指定 Claude CLI 路径，以及直连 Anthropic API 所需的 API Key
const customClaude = new ClaudeCode({
  cliPath: "/usr/local/bin/claude",
  apiKey: "sk-ant-...",
});

// 通过网关 / 代理访问时，使用 authToken + baseUrl
const proxiedClaude = new ClaudeCode({
  authToken: "token-for-your-gateway",
  baseUrl: "https://your-proxy.example.com",
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

`apiKey` / `authToken` / `baseUrl` 属于 `ClaudeCodeOptions`，应在创建 `ClaudeCode` 实例时配置；它们不会出现在 `SessionOptions` 中。

#### 认证参数怎么选

- `apiKey`：当目标服务要求 `X-Api-Key` 鉴权时使用，典型场景是直连 Anthropic API
- `authToken`：当目标服务要求 `Authorization: Bearer <token>` 鉴权时使用，典型场景是网关、代理或第三方兼容层
- `baseUrl`：只负责指定请求发送到哪里，不决定鉴权头类型；应以目标服务文档要求的请求头为准选择 `apiKey` 或 `authToken`

如果你拿不准，先看服务文档或示例请求：

- 写的是 `x-api-key`，就用 `apiKey`
- 写的是 `Authorization: Bearer ...`，就用 `authToken`

更完整的说明见 [docs/authentication.md](./docs/authentication.md)。

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

如果你想观察 `claude -p` 背后的原始输出，也可以通过 `TurnOptions.onRawEvent` 旁路拿到子进程级别的日志：

```typescript
const { events } = await session.runStreamed("Review the current repository", {
  onRawEvent(event) {
    switch (event.type) {
      case "spawn":
        console.log("[claude spawn]", event.command, event.args.join(" "));
        break;
      case "stdout_line":
        console.log("[claude raw stdout]", event.line);
        break;
      case "stderr_chunk":
        console.error("[claude raw stderr chunk]", event.chunk);
        break;
      case "stderr_line":
        console.error("[claude raw stderr]", event.line);
        break;
      case "process_error":
        console.error("[claude process error]", event.error.message);
        break;
      case "exit":
        console.log("[claude exit]", event.code, event.signal);
        break;
    }
  },
});

for await (const event of events) {
  if (event.type === "text_delta") {
    process.stdout.write(event.content);
  }
}
```

如果你希望把完整 `RawClaudeEvent` 落盘到 SDK 使用方项目根目录下的 `logs/` 目录，可以在创建 `Session` 时开启 `rawEventLog`：

```typescript
const session = claude.startSession({
  rawEventLog: true,
});

const { events } = await session.runStreamed("Review the current repository", {
  failFastOnCliApiError: true,
});
```

或者显式指定日志目录：

```typescript
const session = claude.startSession({
  rawEventLog: "/path/to/logs",
});

const { events } = await session.runStreamed("Review the current repository");
```

当 `rawEventLog` 为 `true` 时，SDK 会写入 `${process.cwd()}/logs/claude-raw-events-*.ndjson`。
如果你传入字符串，则会把该字符串当作日志目录路径。

如果你希望像 `API Error: 401 ...`、`API Error: 502 ...` 这类写到 `stderr` 的 Claude CLI 致命 API 错误，或者写到 `stdout` 中的 `system/api_retry` 认证失败事件，也走 `RelayEvent.error`，可以开启 `failFastOnCliApiError`：

```typescript
const { events } = await session.runStreamed("Review the current repository", {
  failFastOnCliApiError: true,
});

for await (const event of events) {
  if (event.type === "error") {
    console.error("[relay error]", event.message);
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
| `apiKey` | `string` | 会以 `ANTHROPIC_API_KEY` 注入到 Claude CLI 子进程，用于 `X-Api-Key` 鉴权 |
| `authToken` | `string` | 会以 `ANTHROPIC_AUTH_TOKEN` 注入到 Claude CLI 子进程，用于 `Authorization: Bearer` 鉴权 |
| `baseUrl` | `string` | 会以 `ANTHROPIC_BASE_URL` 注入到 Claude CLI 子进程 |

如果同时传入 `env` 和顶层的 `apiKey` / `authToken` / `baseUrl`，则顶层字段优先，会覆盖 `env` 中同名环境变量。

当你显式传入 `apiKey` 或 `authToken` 时，SDK 还会清理继承环境中的另一种凭据，避免子进程同时看到 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_AUTH_TOKEN` 导致鉴权优先级不明确。

认证参数的适用场景与判断方法，见 [docs/authentication.md](./docs/authentication.md)。

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
type RawClaudeEvent =
  | { type: "spawn"; command: string; args: string[]; cwd?: string }
  | { type: "stdin_closed" }
  | { type: "stdout_line"; line: string }
  | { type: "stderr_chunk"; chunk: string }
  | { type: "stderr_line"; line: string }
  | { type: "process_error"; error: Error }
  | { type: "exit"; code: number | null; signal: NodeJS.Signals | null };

type TurnOptions = {
  signal?: AbortSignal;
  onRawEvent?: (event: RawClaudeEvent) => void | Promise<void>;
  failFastOnCliApiError?: boolean;
};
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `signal` | `AbortSignal` | 用于取消当前 turn |
| `onRawEvent` | `(event: RawClaudeEvent) => void \| Promise<void>` | 监听底层 Claude CLI 的 spawn / stdout / stderr / exit 原始事件 |
| `failFastOnCliApiError` | `boolean` | 检测到致命 CLI API 错误时提前中止重试，并合成 `RelayEvent.error`；覆盖 `stderr` 的 `API Error` 以及 `stdout` 的 `system/api_retry` 失败事件 |

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

`SessionOptions` 定义于 `src/options.ts`。其中大部分字段会映射为 Claude Code CLI 参数，少数字段是 SDK 自己的运行时增强能力，例如 `rawEventLog`。

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
| `rawEventLog` | `boolean \| string` | 为 `true` 时把完整 RawEvent 以 NDJSON 写入 `${process.cwd()}/logs`；传字符串时写入指定目录 |
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
- SDK 类型：`ClaudeCodeOptions`, `SessionOptions`, `PermissionMode`, `Effort`, `RawClaudeEvent`, `AgentDefinition`, `TurnOptions`
- 会话相关类型：`Input`, `UserInput`, `Turn`, `TurnUsage`, `RunResult`, `StreamedTurn`, `RunStreamedResult`
- 从 `claude-code-parser` 透出的类型：`RelayEvent` 及其细分事件类型、`ClaudeEvent`、`ClaudeMessage`、`ClaudeContent`、`ModelUsageEntry`
- 工具方法：`parseLine`, `Translator`, `extractContent`

## 进阶示例

### 示例 1：封装一个同步风格助手调用

```typescript
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

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
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

const claude = new ClaudeCode();
const session = claude.startSession({ dangerouslySkipPermissions: true });
const { events } = await session.runStreamed("Review the current repository");

for await (const event of events) {
  if (event.type === "text_delta") {
    process.stdout.write(event.content);
  }
}
```

### 示例 3：指定工作目录（`cwd`）

`cwd` 决定 Claude Code 子进程的工作目录——Claude 会把这个目录当作"项目根目录"来读写文件、执行命令。

```typescript
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

const claude = new ClaudeCode();

// Claude 会在 /path/to/my-project 目录下工作
const session = claude.startSession({
  cwd: "/path/to/my-project",
  dangerouslySkipPermissions: true,
});

// Claude 会读取 /path/to/my-project/package.json（而非当前脚本所在目录）
const turn = await session.run("Read package.json and list all dependencies");
console.log(turn.finalResponse);
```

如果你的脚本在 A 目录运行，但想让 Claude 操作 B 目录的代码，就用 `cwd` 指定 B 的路径。不设置时默认使用脚本的当前工作目录。

还可以配合 `additionalDirectories` 让 Claude 同时访问多个目录：

```typescript
const session = claude.startSession({
  cwd: "/path/to/main-project",
  additionalDirectories: ["/path/to/shared-lib", "/path/to/config-repo"],
  dangerouslySkipPermissions: true,
});
```

### 示例 4：加载自定义插件目录（`pluginDir`）

`pluginDir` 用于指定 Claude Code 的插件目录，让 Claude 加载自定义的 slash commands 或 skills。

```typescript
import { ClaudeCode } from "@tiktok-fe/ttls-agent-sdk";

const claude = new ClaudeCode();

// 加载单个插件目录
const session = claude.startSession({
  pluginDir: "/path/to/my-plugins",
  dangerouslySkipPermissions: true,
});

// 加载多个插件目录
const session2 = claude.startSession({
  pluginDir: [
    "/path/to/team-plugins",
    "/path/to/project-plugins",
  ],
  dangerouslySkipPermissions: true,
});

const turn = await session.run("Use my custom skill to analyze the codebase");
console.log(turn.finalResponse);
```

插件目录中的 skills/commands 会被 Claude Code 自动发现并注册，之后可以在 prompt 中直接引用。SDK 会按原样把 `bare: true` 和 `pluginDir` 一起透传给 Claude CLI；两者的最终交互行为以 Claude CLI 实际语义为准。

### 示例 5：跨 turn 保持上下文

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
claude CLI (--output-format stream-json)
  ↓
claude-code-parser
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
  skill.ts         # 带固定首轮 prompt 的多轮 skill 示例
  mcp.ts           # MCP / skills 相关示例
  kimi.ts          # 使用 authToken + baseUrl 自定义 ClaudeCodeOptions 的示例

tests/
  exec.test.ts     # CLI 参数与执行层测试
  session.test.ts  # Session 行为测试
```

## 开发

```bash
# 安装依赖
bun install

# 日常检查
bun run check

# 构建
bun run build

# 类型检查
bun run typecheck

# 运行测试
bun test

# 覆盖率
bun run test:coverage

# 完整验证
bun run verify

# 清理产物
bun run clean
```

推荐：

- 日常改动后运行 `bun run check`
- 修改导出面、构建或发布相关逻辑后运行 `bun run verify`
- 想确认测试覆盖变化时运行 `bun run test:coverage`

## 许可证

MIT
