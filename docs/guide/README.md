# API Reference & Usage Guide

> Full API reference and usage examples for [claude-code-node](../../README.md).

---

## Table of Contents

- [API Reference](#api-reference)
  - [ClaudeCode](#claudecode)
  - [Session](#session)
  - [SessionOptions](#sessionoptions)
  - [TurnOptions](#turnoptions)
  - [Turn](#turn)
  - [StreamedTurn](#streamedturn)
  - [RelayEvent](#relayevent)
- [Usage Examples](#usage-examples)
  - [Run and get the full result](#1-run-and-get-the-full-result)
  - [Stream events in real time](#2-stream-events-in-real-time)
  - [Multi-turn conversation](#3-multi-turn-conversation)
  - [Text + image input](#4-text--image-input)
  - [Structured output (JSON Schema)](#5-structured-output-json-schema)
  - [Custom system prompt](#6-custom-system-prompt)
  - [Sub-agents](#7-sub-agents)
  - [MCP server configuration](#8-mcp-server-configuration)
  - [Abort a turn](#9-abort-a-turn)
  - [Raw event debugging](#10-raw-event-debugging)

---

## API Reference

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

> See [authentication.md](../authentication.md) for a detailed auth guide.

### Session

Represents a single Claude conversation. Handles input normalization, event translation, and automatic `--resume`.

```typescript
class Session {
  get id(): string | null;
  run(input: Input, options?: TurnOptions): Promise<Turn>;
  runStreamed(input: Input, options?: TurnOptions): Promise<StreamedTurn>;
}
```

- **`startSession()`** — creates a fresh session; the first turn has no resume flag
- **`resumeSession(id)`** — resumes an existing session by ID
- **`continueSession()`** — continues the most recent session using `--continue`

After the first turn, all subsequent turns automatically use `--resume <sessionId>`.

### SessionOptions

Passed to `startSession()`, `resumeSession()`, or `continueSession()`. All fields are optional.

#### Core

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | — | Model to use (e.g. `"sonnet"`, `"opus"`) |
| `cwd` | `string` | — | Working directory for the CLI process |
| `additionalDirectories` | `string[]` | — | Extra directories the model can access |
| `maxTurns` | `number` | — | Maximum agentic turns |
| `maxBudgetUsd` | `number` | — | Dollar spend cap for the session |
| `effort` | `Effort` | — | Reasoning effort: `"low"` \| `"medium"` \| `"high"` \| `"xhigh"` \| `"max"` |
| `fallbackModel` | `string` | — | Fallback model when primary is overloaded |

#### System Prompt

| Option | Type | Description |
|--------|------|-------------|
| `systemPrompt` | `string` | Replace the entire system prompt |
| `systemPromptFile` | `string` | Load system prompt from a file |
| `appendSystemPrompt` | `string` | Append text to the default system prompt |
| `appendSystemPromptFile` | `string` | Append system prompt content from a file |

#### Permissions & Tools

| Option | Type | Description |
|--------|------|-------------|
| `dangerouslySkipPermissions` | `boolean` | Skip all permission prompts (takes precedence over `permissionMode`) |
| `permissionMode` | `PermissionMode` | `"default"` \| `"acceptEdits"` \| `"plan"` \| `"auto"` \| `"dontAsk"` \| `"bypassPermissions"` |
| `allowedTools` | `string[]` | Tools that execute without permission prompts |
| `disallowedTools` | `string[]` | Tools removed entirely |
| `tools` | `string` | Restrict available tools (comma-separated) |
| `permissionPromptTool` | `string` | MCP tool for handling permission prompts |

#### Structured Output

| Option | Type | Description |
|--------|------|-------------|
| `jsonSchema` | `string \| object` | JSON Schema for structured output; result in `Turn.structuredOutput` |

#### MCP & Plugins

| Option | Type | Description |
|--------|------|-------------|
| `mcpConfig` | `string \| string[]` | MCP server configuration file path(s) |
| `strictMcpConfig` | `boolean` | Only use MCP servers defined in `mcpConfig` |
| `pluginDir` | `string \| string[]` | Plugin directories |

#### Sub-agents

| Option | Type | Description |
|--------|------|-------------|
| `agents` | `Record<string, AgentDefinition> \| string` | Define sub-agents inline or as a JSON string |
| `agent` | `string` | Specify which agent to use |

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

#### Session & Debug

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionId` | `string` | — | Explicit session UUID |
| `forkSession` | `boolean` | — | Fork session on resume |
| `name` | `string` | — | Session display name |
| `noSessionPersistence` | `boolean` | — | Do not persist session to disk |
| `bare` | `boolean` | — | Skip hooks, plugins, MCP, and CLAUDE.md auto-discovery |
| `verbose` | `boolean` | `true` | Enable verbose output |
| `includePartialMessages` | `boolean` | `true` | Include partial message events |
| `includeHookEvents` | `boolean` | — | Include hook lifecycle events |
| `rawEventLog` | `boolean \| string` | — | Write NDJSON raw events to `./agent_logs/` (`true`) or custom absolute path |
| `debug` | `string \| boolean` | — | Enable debug mode; string specifies category |
| `debugFile` | `string` | — | Debug log file path |

#### Other

| Option | Type | Description |
|--------|------|-------------|
| `chrome` | `boolean` | Enable/disable Chrome browser integration |
| `worktree` | `string` | Run in an isolated git worktree |
| `disableSlashCommands` | `boolean` | Disable slash commands |
| `excludeDynamicSystemPromptSections` | `boolean` | Improve prompt cache hit rate |
| `settings` | `string` | Additional settings file path or JSON string |
| `settingSources` | `string` | Setting sources (defaults to `""`) |
| `betas` | `string` | Beta API headers |

### TurnOptions

Per-turn options passed to `session.run()` or `session.runStreamed()`.

| Option | Type | Description |
|--------|------|-------------|
| `signal` | `AbortSignal` | Cancel the turn |
| `onRawEvent` | `(event: RawClaudeEvent) => void` | Callback for raw CLI process events (spawn, stdout, stderr, exit) |
| `failFastOnCliApiError` | `boolean` | Abort immediately on CLI API errors instead of waiting for retries |

<details>
<summary><b>RawClaudeEvent</b> variants</summary>

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

The result of a single `run()` call.

```typescript
type Turn = {
  events: RelayEvent[];
  finalResponse: string;
  usage: TurnUsage | null;
  sessionId: string | null;
  structuredOutput: unknown | null;  // populated when jsonSchema is set
};

type TurnUsage = {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
};
```

### StreamedTurn

The result of a single `runStreamed()` call. Events are yielded in real time as they arrive from the CLI.

```typescript
type StreamedTurn = {
  events: AsyncIterable<RelayEvent>;
};
```

### RelayEvent

All events emitted during a turn. Used by both `Turn.events` (array) and `StreamedTurn.events` (async iterable).

| Type | Key Fields | Description |
|------|------------|-------------|
| `text_delta` | `content: string` | Incremental assistant text |
| `thinking_delta` | `content: string` | Incremental thinking/reasoning text |
| `tool_use` | `toolUseId`, `toolName`, `input` | Tool invocation (input is JSON string) |
| `tool_result` | `toolUseId`, `output`, `isError` | Tool execution result |
| `session_meta` | `model: string` | Model information for the session |
| `turn_complete` | `sessionId?`, `costUsd?`, `inputTokens?`, `outputTokens?`, `contextWindow?` | Turn finished |
| `error` | `message`, `sessionId?` | Error occurred |

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

### 5. Structured output (JSON Schema)

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

### 6. Custom system prompt

```typescript
// Replace the entire system prompt
const session = claude.startSession({
  systemPrompt: "You are a code reviewer. Only report bugs, no style suggestions.",
  dangerouslySkipPermissions: true,
});

// Or append to the default system prompt
const session2 = claude.startSession({
  appendSystemPrompt: "Always respond in JSON format.",
  dangerouslySkipPermissions: true,
});
```

### 7. Sub-agents

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

### 8. MCP server configuration

```typescript
const session = claude.startSession({
  mcpConfig: "/path/to/mcp-servers.json",
  strictMcpConfig: true,  // only use servers from the config file
  dangerouslySkipPermissions: true,
});

const turn = await session.run("Query the database for recent users");
```

### 9. Abort a turn

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

### 10. Raw event debugging

```typescript
// Log all raw CLI events to console
const turn = await session.run("Fix the bug", {
  onRawEvent(event) {
    if (event.type === "stderr_line") {
      console.error("[stderr]", event.line);
    }
  },
  failFastOnCliApiError: true,
});

// Or write NDJSON logs to disk for later analysis
const session = claude.startSession({
  rawEventLog: true,  // writes to ./agent_logs/
  dangerouslySkipPermissions: true,
});
```
