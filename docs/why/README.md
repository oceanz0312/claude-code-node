# Why claude-code-node?

`claude-code-node` is a **TypeScript SDK that wraps the Claude Code CLI** — letting you drive Claude Code programmatically from Node.js/Bun with a clean async API.

## What You Get

```typescript
import { ClaudeCode } from "claude-code-node";

const claude = new ClaudeCode();
const session = claude.startSession({ model: "sonnet", dangerouslySkipPermissions: true });

const turn = await session.run("Fix the failing tests in src/");
console.log(turn.finalResponse);

// Multi-turn: just keep calling run() — session resume is automatic
const turn2 = await session.run("Now add test coverage for edge cases");
```

**No HTTP server, no protocol translation, no abstractions over abstractions.** Just a typed, async wrapper around the Claude Code CLI that handles the messy parts for you:

| Capability | What it does |
|------------|-------------|
| **Session management** | Auto `--resume` across turns — you never touch session IDs |
| **Streaming** | `AsyncIterable<RelayEvent>` with 7 typed event kinds |
| **35+ CLI options** | Every useful flag mapped to a typed field — `model`, `systemPrompt`, `allowedTools`, `jsonSchema`, `maxBudgetUsd`, `agents`, `mcpConfig`... |
| **Structured output** | Pass a JSON Schema, get parsed objects back in `turn.structuredOutput` |
| **Image input** | Send screenshots alongside text prompts |
| **Abort** | Cancel any turn with `AbortSignal` |
| **FailFast** | Detect API errors in seconds, not minutes (critical for CI/CD) |

## How It Compares

We reviewed [9 Claude Code wrapper projects](https://github.com/oceanz0312/claude-code-node). Key takeaway:

- **Only TypeScript SDK** in the ecosystem — Python has the official Agent SDK; TypeScript has this
- **Highest CLI parameter coverage** (35+ vs ~10 for alternatives)
- **Only project with dual-layer events** (raw process events + semantic relay events)
- **Only project with stream deduplication** (no duplicate text from CLI verbose mode)
- **Only project with real tests that run without a CLI** (900+ lines, fake-claude.mjs simulator)

### What It's NOT

- Not an HTTP API server (use [claude-code-openai-wrapper](https://github.com/RichardAtCT/claude-code-openai-wrapper) for that)
- Not a multi-model gateway (it wraps Claude Code, period)
- Not a replacement for the CLI (it drives it)

## Related Projects

| Project | Description |
|---------|-------------|
| [claude-code-openai-wrapper](https://github.com/RichardAtCT/claude-code-openai-wrapper) | Python/FastAPI service that exposes Claude Code as an OpenAI-compatible API, the most mature HTTP wrapper |
| [claude-code-api](https://github.com/bethington/claude-code-api) | Node.js/Express server that bridges Claude Code CLI to an OpenAI-compatible endpoint |
| [claude-code-api-rs](https://github.com/ZhangHanDong/claude-code-api-rs) | Rust/Axum high-performance API server with SSE streaming and WebSocket support |
| [claw-code](https://github.com/ultraworkers/claw-code) | Clean-room Rust rewrite of Claude Code with multi-model support and sandbox isolation |
| [claude-code-any](https://github.com/jiangyurong609/claude-code-any) | Patched Claude Code fork that routes to 20+ model providers via an OpenAI adapter layer |
