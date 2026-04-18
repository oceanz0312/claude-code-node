# claude-code-node

[![npm version](https://img.shields.io/npm/v/claude-code-node.svg)](https://www.npmjs.com/package/claude-code-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> 用于以编程方式驱动 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 的 TypeScript SDK。

`claude-code-node` 将 Claude Code CLI 封装为清晰的异步 API，提供会话管理、多轮对话、流式事件、工具调用结果和结构化输出能力，适用于脚本、服务端程序和自动化流程。

[English Documentation](./README.md) | [为什么选择 claude-code-node？](./docs/why/README.zh-CN.md)

---

## 目录

- [功能特性](#功能特性)
- [前置要求](#前置要求)
- [安装](#安装)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
  - [ClaudeCode](#claudecode)
  - [Session](#session)
  - [SessionOptions](#sessionoptions)
  - [TurnOptions](#turnoptions)
  - [Turn](#turn)
  - [StreamedTurn](#streamedturn)
  - [RelayEvent](#relayevent)
- [使用示例](#使用示例)
  - [执行并获取完整结果](#1-执行并获取完整结果)
  - [实时流式消费事件](#2-实时流式消费事件)
  - [多轮对话](#3-多轮对话)
  - [文本 + 图片输入](#4-文本--图片输入)
  - [结构化输出（JSON Schema）](#5-结构化输出json-schema)
  - [自定义系统提示词](#6-自定义系统提示词)
  - [子 Agent](#7-子-agent)
  - [MCP 服务器配置](#8-mcp-服务器配置)
  - [中断执行](#9-中断执行)
  - [原始事件调试](#10-原始事件调试)
- [文档](#文档)
- [E2E 测试](#e2e-测试)
- [开发](#开发)
- [许可证](#许可证)

---

## 功能特性

- **会话管理** — 新建会话、按 ID 恢复会话、继续最近一次会话
- **多轮对话** — 首轮结束后自动使用 `--resume` 续聊
- **流式事件** — 通过 `AsyncIterable<RelayEvent>` 实时消费文本、thinking、工具调用和完成事件
- **缓冲执行** — `run()` 一次性返回完整事件列表、最终回复和 usage 信息
- **结构化输出** — 通过 `jsonSchema` 请求符合 JSON Schema 约束的响应
- **图片输入** — 支持本地图片与文本一起传入
- **子 Agent** — 定义和编排自定义子 Agent，支持独立工具集和模型
- **系统提示词控制** — 替换、追加系统提示词，或从文件加载
- **MCP 集成** — 连接外部 MCP 服务器获取扩展工具能力
- **中断控制** — 使用 `AbortSignal` 取消正在执行的 turn
- **权限模式** — 细粒度控制工具执行权限
- **原始事件日志** — 写入 NDJSON 日志，用于调试和回放
- **类型化 CLI 选项** — 大部分常用 Claude Code CLI 标志都提供了类型封装

---

## 前置要求

- Node.js >= 22
- 已安装 Claude Code CLI，且 `claude` 可在 `PATH` 中找到（或通过 `cliPath` 显式指定路径）

---

## 安装

```bash
# npm
npm install claude-code-node

# pnpm
pnpm add claude-code-node

# bun
bun add claude-code-node
```

---

## 快速开始

```typescript
import { ClaudeCode } from "claude-code-node";

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

---

## API 参考

### ClaudeCode

SDK 入口，用于创建和管理会话。

```typescript
const claude = new ClaudeCode({
  cliPath: "/usr/local/bin/claude", // 可选
  apiKey: "sk-ant-...",             // 可选
  authToken: "...",                 // 可选（用于网关/代理）
  baseUrl: "https://proxy.example", // 可选
});

const session = claude.startSession({ model: "sonnet" });
const resumed = claude.resumeSession("session-id", { ... });
const continued = claude.continueSession({ ... });
```

| 选项 | 类型 | 说明 |
|------|------|------|
| `cliPath` | `string` | `claude` 可执行文件路径 |
| `apiKey` | `string` | 注入为 `ANTHROPIC_API_KEY`；用于 `X-Api-Key` 鉴权 |
| `authToken` | `string` | 注入为 `ANTHROPIC_AUTH_TOKEN`；用于 `Authorization: Bearer` 鉴权 |
| `baseUrl` | `string` | 注入为 `ANTHROPIC_BASE_URL` |
| `env` | `Record<string, string>` | 自定义子进程环境变量 |

> 详见 [docs/authentication.md](docs/authentication.md) 认证参数选型指南。

### Session

表示单次 Claude 会话。负责输入归一化、事件翻译和自动 `--resume`。

```typescript
class Session {
  get id(): string | null;
  run(input: Input, options?: TurnOptions): Promise<Turn>;
  runStreamed(input: Input, options?: TurnOptions): Promise<StreamedTurn>;
}
```

- **`startSession()`** — 创建全新会话；首轮不带 resume 标志
- **`resumeSession(id)`** — 按 ID 恢复已有会话
- **`continueSession()`** — 使用 `--continue` 续接最近一次会话

首轮之后，所有后续 turn 自动使用 `--resume <sessionId>`。

### SessionOptions

传入 `startSession()`、`resumeSession()` 或 `continueSession()`。所有字段均为可选。

#### 核心

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | `string` | — | 使用的模型（如 `"sonnet"`、`"opus"`） |
| `cwd` | `string` | — | CLI 进程的工作目录 |
| `additionalDirectories` | `string[]` | — | 模型可访问的额外目录 |
| `maxTurns` | `number` | — | 最大 agentic 轮次 |
| `maxBudgetUsd` | `number` | — | 会话花费上限（美元） |
| `effort` | `Effort` | — | 推理强度：`"low"` \| `"medium"` \| `"high"` \| `"xhigh"` \| `"max"` |
| `fallbackModel` | `string` | — | 主模型过载时的回退模型 |

#### 系统提示词

| 选项 | 类型 | 说明 |
|------|------|------|
| `systemPrompt` | `string` | 替换整个系统提示词 |
| `systemPromptFile` | `string` | 从文件加载系统提示词 |
| `appendSystemPrompt` | `string` | 在默认系统提示词末尾追加文本 |
| `appendSystemPromptFile` | `string` | 从文件加载追加的系统提示词 |

#### 权限与工具

| 选项 | 类型 | 说明 |
|------|------|------|
| `dangerouslySkipPermissions` | `boolean` | 跳过所有权限提示（优先级高于 `permissionMode`） |
| `permissionMode` | `PermissionMode` | `"default"` \| `"acceptEdits"` \| `"plan"` \| `"auto"` \| `"dontAsk"` \| `"bypassPermissions"` |
| `allowedTools` | `string[]` | 无需权限提示即可执行的工具 |
| `disallowedTools` | `string[]` | 完全禁用的工具 |
| `tools` | `string` | 限制可用工具（逗号分隔） |
| `permissionPromptTool` | `string` | 处理权限提示的 MCP 工具 |

#### 结构化输出

| 选项 | 类型 | 说明 |
|------|------|------|
| `jsonSchema` | `string \| object` | JSON Schema 约束输出；结果存入 `Turn.structuredOutput` |

#### MCP 与插件

| 选项 | 类型 | 说明 |
|------|------|------|
| `mcpConfig` | `string \| string[]` | MCP 服务器配置文件路径 |
| `strictMcpConfig` | `boolean` | 仅使用 `mcpConfig` 中定义的 MCP 服务器 |
| `pluginDir` | `string \| string[]` | 插件目录 |

#### 子 Agent

| 选项 | 类型 | 说明 |
|------|------|------|
| `agents` | `Record<string, AgentDefinition> \| string` | 内联定义子 Agent 或传入 JSON 字符串 |
| `agent` | `string` | 指定使用哪个 Agent |

<details>
<summary><b>AgentDefinition</b></summary>

```typescript
type AgentDefinition = {
  description?: string;
  prompt?: string;
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: string;
  effort?: Effort;
  maxTurns?: number;
  permissionMode?: PermissionMode;
  isolation?: "worktree";
  initialPrompt?: string;
  mcpServers?: Record<string, unknown>;
};
```
</details>

#### 会话与调试

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sessionId` | `string` | — | 显式指定会话 UUID |
| `forkSession` | `boolean` | — | 恢复时 fork 会话 |
| `name` | `string` | — | 会话显示名称 |
| `noSessionPersistence` | `boolean` | — | 不将会话持久化到磁盘 |
| `bare` | `boolean` | — | 跳过 hooks、插件、MCP 和 CLAUDE.md 自动发现 |
| `verbose` | `boolean` | `true` | 启用详细输出 |
| `includePartialMessages` | `boolean` | `true` | 包含部分消息事件 |
| `includeHookEvents` | `boolean` | — | 包含 hook 生命周期事件 |
| `rawEventLog` | `boolean \| string` | — | 写入 NDJSON 原始事件到 `./agent_logs/`（`true`）或自定义绝对路径 |
| `debug` | `string \| boolean` | — | 启用调试模式；字符串指定调试分类 |
| `debugFile` | `string` | — | 调试日志文件路径 |

#### 其他

| 选项 | 类型 | 说明 |
|------|------|------|
| `chrome` | `boolean` | 启用/禁用 Chrome 浏览器集成 |
| `worktree` | `string` | 在隔离的 git worktree 中运行 |
| `disableSlashCommands` | `boolean` | 禁用斜杠命令 |
| `excludeDynamicSystemPromptSections` | `boolean` | 提升提示词缓存命中率 |
| `settings` | `string` | 额外设置文件路径或 JSON 字符串 |
| `settingSources` | `string` | 设置来源（默认 `""`） |
| `betas` | `string` | Beta API headers |

### TurnOptions

每轮执行选项，传入 `session.run()` 或 `session.runStreamed()`。

| 选项 | 类型 | 说明 |
|------|------|------|
| `signal` | `AbortSignal` | 取消当前 turn |
| `onRawEvent` | `(event: RawClaudeEvent) => void` | 原始 CLI 进程事件回调（spawn、stdout、stderr、exit） |
| `failFastOnCliApiError` | `boolean` | 遇到 CLI API 错误时立即中止，而非等待重试 |

<details>
<summary><b>RawClaudeEvent</b> 类型</summary>

```typescript
type RawClaudeEvent =
  | { type: "spawn"; command: string; args: string[]; cwd?: string }
  | { type: "stdin_closed" }
  | { type: "stdout_line"; line: string }
  | { type: "stderr_chunk"; chunk: string }
  | { type: "stderr_line"; line: string }
  | { type: "process_error"; error: Error }
  | { type: "exit"; code: number | null; signal: NodeJS.Signals | null };
```
</details>

### Turn

单次 `run()` 调用的返回结果。

```typescript
type Turn = {
  events: RelayEvent[];
  finalResponse: string;
  usage: TurnUsage | null;
  sessionId: string | null;
  structuredOutput: unknown | null;  // 设置 jsonSchema 时填充
};

type TurnUsage = {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
};
```

### StreamedTurn

单次 `runStreamed()` 调用的返回结果。事件到达时实时 yield。

```typescript
type StreamedTurn = {
  events: AsyncIterable<RelayEvent>;
};
```

### RelayEvent

Turn 执行期间发出的所有事件类型。同时用于 `Turn.events`（数组）和 `StreamedTurn.events`（异步可迭代）。

| 类型 | 关键字段 | 说明 |
|------|----------|------|
| `text_delta` | `content: string` | 增量助手文本 |
| `thinking_delta` | `content: string` | 增量思考/推理文本 |
| `tool_use` | `toolUseId`, `toolName`, `input` | 工具调用（input 为 JSON 字符串） |
| `tool_result` | `toolUseId`, `output`, `isError` | 工具执行结果 |
| `session_meta` | `model: string` | 会话模型信息 |
| `turn_complete` | `sessionId?`, `costUsd?`, `inputTokens?`, `outputTokens?`, `contextWindow?` | Turn 完成 |
| `error` | `message`, `sessionId?` | 发生错误 |

---

## 使用示例

### 1. 执行并获取完整结果

```typescript
const turn = await session.run("Fix the failing tests");

console.log(turn.finalResponse);
console.log(turn.sessionId);
console.log(turn.events);
console.log(turn.usage);
```

### 2. 实时流式消费事件

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
    case "session_meta":
      console.log("[model]", event.model);
      break;
    case "turn_complete":
      console.log("[done] cost:", event.costUsd, "tokens:", event.inputTokens);
      break;
    case "error":
      console.error("[error]", event.message);
      break;
  }
}
```

### 3. 多轮对话

```typescript
const session = claude.startSession({ dangerouslySkipPermissions: true });

const first = await session.run("Read the README and summarize it");
console.log(first.finalResponse);

const second = await session.run("Now translate it to Chinese");
console.log(second.finalResponse);
// session.id 会自动在 turn 之间保持
```

### 4. 文本 + 图片输入

```typescript
const turn = await session.run([
  { type: "text", text: "What UI issues do you see in this screenshot?" },
  { type: "local_image", path: "/path/to/screenshot.png" },
]);
```

### 5. 结构化输出（JSON Schema）

```typescript
const session = claude.startSession({
  dangerouslySkipPermissions: true,
  jsonSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      severity: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: ["summary", "tags", "severity"],
  },
});

const turn = await session.run("Analyze the error handling in src/index.ts");
console.log(turn.structuredOutput);
// { summary: "...", tags: ["error-handling", ...], severity: "medium" }
```

### 6. 自定义系统提示词

```typescript
// 替换整个系统提示词
const session = claude.startSession({
  systemPrompt: "You are a code reviewer. Only report bugs, no style suggestions.",
  dangerouslySkipPermissions: true,
});

// 或在默认系统提示词后追加
const session2 = claude.startSession({
  appendSystemPrompt: "Always respond in JSON format.",
  dangerouslySkipPermissions: true,
});
```

### 7. 子 Agent

```typescript
const session = claude.startSession({
  dangerouslySkipPermissions: true,
  agents: {
    reviewer: {
      description: "Reviews code for bugs and security issues",
      prompt: "You are a senior code reviewer. Focus on correctness and security.",
      model: "sonnet",
      allowedTools: ["Read", "Glob", "Grep"],
      maxTurns: 5,
    },
    writer: {
      description: "Writes implementation code",
      prompt: "You are an expert TypeScript developer.",
      model: "sonnet",
      allowedTools: ["Read", "Edit", "Write", "Bash"],
    },
  },
});

const turn = await session.run("Review src/session.ts for potential issues");
```

### 8. MCP 服务器配置

```typescript
const session = claude.startSession({
  mcpConfig: "/path/to/mcp-servers.json",
  strictMcpConfig: true,  // 仅使用配置文件中的服务器
  dangerouslySkipPermissions: true,
});

const turn = await session.run("Query the database for recent users");
```

### 9. 中断执行

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

try {
  const turn = await session.run("Long running task...", {
    signal: controller.signal,
  });
} catch (error) {
  console.error("Turn aborted or failed:", error);
}
```

### 10. 原始事件调试

```typescript
// 将所有原始 CLI 事件输出到控制台
const turn = await session.run("Fix the bug", {
  onRawEvent(event) {
    if (event.type === "stderr_line") {
      console.error("[stderr]", event.line);
    }
  },
  failFastOnCliApiError: true,
});

// 或将 NDJSON 日志写入磁盘，便于后续分析
const session = claude.startSession({
  rawEventLog: true,  // 写入 ./agent_logs/
  dangerouslySkipPermissions: true,
});
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/README.md](docs/README.md) | 文档总索引 |
| [docs/architecture.md](docs/architecture.md) | 架构、职责边界和执行链路 |
| [docs/authentication.md](docs/authentication.md) | 认证参数选型指南（`apiKey`、`authToken`、`baseUrl`） |
| [docs/testing-and-validation.md](docs/testing-and-validation.md) | 测试结构、验证命令和排障建议 |
| [docs/agent-playbook.md](docs/agent-playbook.md) | 面向自动化 agent 的工作顺序和常见风险 |
| [docs/pitfalls.md](docs/pitfalls.md) | 已确认的重大闭坑指南 |

---

## E2E 测试

仓库内置了针对 Claude Code CLI 的真实端到端测试：

```bash
# 1. 复制示例环境文件
cp .env.example.ts .env.ts

# 2. 填写至少一种认证方式（apiKey，或 authToken + baseUrl）

# 3. 运行 E2E 测试套件
bun run test:e2e
```

详见 [tests/e2e/README.md](tests/e2e/README.md)。

---

## 开发

```bash
# 安装依赖
bun install

# 类型检查 + 测试
bun run check

# 构建
bun run build

# 运行测试
bun test

# 运行测试并生成覆盖率报告
bun run test:coverage

# 完整验证（清理 + 构建 + 检查）
bun run verify
```

---

## 许可证

[MIT](LICENSE)
