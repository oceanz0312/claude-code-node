# claude-code-node

[![npm version](https://img.shields.io/npm/v/claude-code-node.svg)](https://www.npmjs.com/package/claude-code-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> A **TypeScript SDK that wraps the Claude Code CLI** — letting you drive Claude Code programmatically from Node.js/Bun with a clean async API.

[中文文档](./README.zh-CN.md)

---

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

---

## How It Compares

We reviewed [9 Claude Code wrapper projects](https://github.com/oceanz0312/claude-code-node). Key takeaway:

- **Only TypeScript SDK** in the ecosystem — Python has the official Agent SDK; TypeScript has this
- **Highest CLI parameter coverage** (35+ vs ~10 for alternatives)
- **Only project with dual-layer events** (raw process events + semantic relay events)
- **Only project with stream deduplication** (no duplicate text from CLI verbose mode)
- **Only project with real tests that run without a CLI** (900+ lines, fake-claude.mjs simulator)

---

## Tested & Reliable

| Metric | Detail |
|--------|--------|
| **39 test cases** | 28 unit tests + 11 real-model E2E tests |
| **1,690 lines** of test code | Across 3 test files, covering session lifecycle, streaming, abort, error detection, image input, structured output, and CLI argument forwarding |
| **Fake CLI simulator** | 378-line `fake-claude.mjs` that emulates the full `stream-json` protocol — unit tests run without a real CLI or API key |
| **Real E2E suite** | Hits the actual Claude CLI with real credentials — tests multi-turn memory, auth paths, system prompts, image understanding, agent identity, and 15+ CLI flag forwarding |
| **E2E test artifacts** | Every run saves NDJSON logs, relay events, and final responses to `tests/e2e/artifacts/` for post-mortem analysis |
| **Coverage** | `bun run test:coverage` — built-in Bun coverage on all unit tests |

```
File                  | % Funcs | % Lines
----------------------|---------|--------
All files             |  100.00 |   99.71
 src/claude-code.ts   |  100.00 |  100.00
 src/exec.ts          |  100.00 |  100.00
 src/raw-event-log.ts |  100.00 |   98.84
 src/session.ts       |  100.00 |  100.00
```

**40 tests passed, 0 failed, 183 expect() calls.**

---

## What It's NOT

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

---

## Prerequisites

- Node.js >= 22
- Claude Code CLI installed and `claude` available on your `PATH` (or specify `cliPath` explicitly)

## Installation

```bash
# npm
npm install claude-code-node

# pnpm
pnpm add claude-code-node

# bun
bun add claude-code-node
```

## Guide & API Reference

For full API reference, all SessionOptions, and 10 usage examples (streaming, structured output, sub-agents, MCP, image input, etc.):

**[API Reference & Usage Guide](./docs/guide/README.md)** | [API 参考与使用指南](./docs/guide/README.zh-CN.md)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/guide/](docs/guide/README.md) | Full API reference and 10 usage examples |
| [docs/why/](docs/why/README.md) | Why this project exists — competitive analysis |
| [docs/agent/](docs/agent/) | Agent-facing docs: architecture, auth, testing, playbook, pitfalls |

---

## E2E Testing

Real end-to-end tests against the Claude Code CLI are included:

```bash
# 1. Copy the example env file
cp .env.example .env

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
