# claude-code-node

[![npm version](https://img.shields.io/npm/v/claude-code-node.svg)](https://www.npmjs.com/package/claude-code-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> A TypeScript SDK for programmatically driving the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

`claude-code-node` wraps the Claude Code CLI into a clean async API, providing session management, multi-turn conversations, streaming events, tool-use results, and structured output — ideal for scripts, services, and automation pipelines.

[中文文档](./README.zh-CN.md)

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Overview](#api-overview)
  - [ClaudeCode](#claudecode)
  - [Session](#session)
  - [Turn](#turn)
- [Usage Examples](#usage-examples)
  - [Run and get the full result](#1-run-and-get-the-full-result)
  - [Stream events in real time](#2-stream-events-in-real-time)
  - [Multi-turn conversation](#3-multi-turn-conversation)
  - [Text + image input](#4-text--image-input)
  - [Abort a turn](#5-abort-a-turn)
  - [Specify working directory](#6-specify-working-directory)
- [Documentation](#documentation)
- [E2E Testing](#e2e-testing)
- [Development](#development)
- [License](#license)

---

## Features

- **Session Management** — create, resume by ID, or continue the most recent session
- **Multi-turn Conversations** — automatically uses `--resume` after the first turn
- **Streaming Events** — consume `AsyncIterable<RelayEvent>` for real-time text, thinking, tool calls, and completion events
- **Buffered Execution** — `run()` returns the full event list, final response, and usage in one call
- **Image Input** — send local images alongside text prompts
- **Abort Control** — cancel an in-flight turn with `AbortSignal`
- **Typed CLI Options** — most common Claude Code CLI flags have typed equivalents
- **Structured Output** — request JSON Schema–constrained responses via `jsonSchema`

---

## Prerequisites

- Node.js >= 18
- Claude Code CLI installed and `claude` available on your `PATH` (or specify `cliPath` explicitly)

---

## Installation

```bash
# npm
npm install claude-code-node

# pnpm
pnpm add claude-code-node

# bun
bun add claude-code-node
```

---

## Quick Start

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

## API Overview

### ClaudeCode

The SDK entry point for creating and managing sessions.

```typescript
const claude = new ClaudeCode({
  cliPath: "/usr/local/bin/claude", // optional
  apiKey: "sk-ant-...",             // optional
  authToken: "...",                 // optional (for proxies/gateways)
  baseUrl: "https://proxy.example", // optional
});

const session = claude.startSession({ model: "sonnet" });
const resumed = claude.resumeSession("session-id", { ... });
const continued = claude.continueSession({ ... });
```

| Option | Type | Description |
|--------|------|-------------|
| `cliPath` | `string` | Path to the `claude` executable |
| `apiKey` | `string` | Injected as `ANTHROPIC_API_KEY`; used for `X-Api-Key` auth |
| `authToken` | `string` | Injected as `ANTHROPIC_AUTH_TOKEN`; used for `Authorization: Bearer` auth |
| `baseUrl` | `string` | Injected as `ANTHROPIC_BASE_URL` |
| `env` | `Record<string, string>` | Custom subprocess environment variables |

> See [docs/authentication.md](docs/authentication.md) for a detailed auth guide.

### Session

Represents a single Claude conversation. Handles input normalization, event translation, and automatic `--resume`.

```typescript
class Session {
  get id(): string | null;
  run(input, options?): Promise<Turn>;
  runStreamed(input, options?): Promise<StreamedTurn>;
}
```

### Turn

The result of a single `run()` call.

```typescript
type Turn = {
  events: RelayEvent[];
  finalResponse: string;
  usage: TurnUsage | null;
  sessionId: string | null;
  structuredOutput: unknown | null;
};
```

---

## Usage Examples

### 1. Run and get the full result

```typescript
const turn = await session.run("Fix the failing tests");

console.log(turn.finalResponse);
console.log(turn.sessionId);
console.log(turn.events);
console.log(turn.usage);
```

### 2. Stream events in real time

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

### 3. Multi-turn conversation

```typescript
const session = claude.startSession({ dangerouslySkipPermissions: true });

const first = await session.run("Read the README and summarize it");
console.log(first.finalResponse);

const second = await session.run("Now translate it to Chinese");
console.log(second.finalResponse);
// session.id is automatically persisted across turns
```

### 4. Text + image input

```typescript
const turn = await session.run([
  { type: "text", text: "What UI issues do you see in this screenshot?" },
  { type: "local_image", path: "/path/to/screenshot.png" },
]);
```

### 5. Abort a turn

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

### 6. Specify working directory

```typescript
const session = claude.startSession({
  cwd: "/path/to/project",
  dangerouslySkipPermissions: true,
});

const turn = await session.run("Read package.json and list all dependencies");
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/architecture.md](docs/architecture.md) | Architecture, responsibilities, and execution flow |
| [docs/authentication.md](docs/authentication.md) | Auth parameter selection guide (`apiKey`, `authToken`, `baseUrl`) |
| [docs/testing-and-validation.md](docs/testing-and-validation.md) | Test structure, validation commands, and troubleshooting |
| [docs/agent-playbook.md](docs/agent-playbook.md) | Workflow guidelines for automation agents |
| [docs/pitfalls.md](docs/pitfalls.md) | Confirmed pitfalls and how to avoid them |

---

## E2E Testing

Real end-to-end tests against the Claude Code CLI are included:

```bash
# 1. Copy the example env file
cp .env.example.ts .env.ts

# 2. Fill in at least one auth method (apiKey, or authToken + baseUrl)

# 3. Run the E2E suite
bun run test:e2e
```

See [tests/e2e/README.md](tests/e2e/README.md) for details.

---

## Development

```bash
# Install dependencies
bun install

# Run type check + tests
bun run check

# Build
bun run build

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Full verification (clean + build + check)
bun run verify
```

---

## License

[MIT](LICENSE)
