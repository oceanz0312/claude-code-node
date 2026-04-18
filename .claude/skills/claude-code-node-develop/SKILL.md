---
name: claude-code-node-develop
description: "Guide for developing and contributing to the claude-code-node SDK itself — covers internal architecture, source code structure, testing strategy, known pitfalls, and agent workflow. Use this skill when working on the SDK's source code (src/session.ts, src/exec.ts, src/claude-code.ts, src/options.ts, src/raw-event-log.ts), writing or fixing tests, debugging internal behavior, understanding the execution flow (ClaudeCode → Session → Exec → CLI process), modifying CLI argument mapping, changing event translation logic, or following the agent playbook for safe modifications. Also trigger when the user asks about the SDK's internals, wants to add a new CLI option, or needs to understand how the dual-layer event system (RawClaudeEvent → RelayEvent) works."
---

# claude-code-node Development Guide

You are helping someone develop, debug, or contribute to the `claude-code-node` SDK itself — not use it as a consumer.

## Key context files

Read these files from the project root to understand the codebase:

### Architecture & workflow docs
1. **`docs/architecture.md`** — Three-layer architecture (ClaudeCode → Session → Exec), execution flow, event translation pipeline, and responsibility boundaries
2. **`docs/testing-and-validation.md`** — Test structure, how to run tests, fake-claude.mjs simulator, E2E test setup, and troubleshooting
3. **`docs/agent-playbook.md`** — Step-by-step workflow for making changes safely: read first, check tests, make changes, verify
4. **`docs/pitfalls.md`** — Confirmed pitfalls that cause behavior to diverge from expectations — read this before making changes

### Source files
5. **`src/index.ts`** — Public API surface: what gets exported to consumers
6. **`src/options.ts`** — All type definitions: ClaudeCodeOptions, SessionOptions, TurnOptions, PermissionMode, Effort, RawClaudeEvent, AgentDefinition
7. **`src/claude-code.ts`** — ClaudeCode class: entry point, creates Sessions, merges auth env vars
8. **`src/session.ts`** — Session class: run/runStreamed, event translation, stream deduplication, failFast detection, abort signal merging
9. **`src/exec.ts`** — ClaudeCodeExec: spawns CLI process, builds CLI arguments from SessionOptions, manages stdin/stdout/stderr
10. **`src/raw-event-log.ts`** — NDJSON raw event logger with backpressure handling

Start by reading `docs/architecture.md` to understand the big picture, then read the specific source files relevant to the task.

## Architecture overview

```
ClaudeCode (claude-code.ts)
  ├── Creates Session instances
  └── Merges apiKey/authToken/baseUrl into env

Session (session.ts)
  ├── run() → buffered execution → Turn
  ├── runStreamed() → streaming → StreamedTurn
  ├── Translates raw CLI events → RelayEvent via claude-code-parser
  ├── Deduplicates stream vs snapshot content
  ├── Detects API errors (failFast) from stderr + stdout
  └── Merges user AbortSignal + failFast signal

ClaudeCodeExec (exec.ts)
  ├── Builds CLI args from SessionOptions (35+ flags)
  ├── Spawns child process with isolated env
  ├── Emits RawClaudeEvent (spawn, stdout_line, stderr_line, exit, etc.)
  └── Handles stdin for text and stream-json (images)
```

## Key patterns to preserve

- **Environment isolation**: Never inherit `process.env` — only explicit env vars + PATH
- **Dual-layer events**: RawClaudeEvent (process level) and RelayEvent (semantic level) are separate concerns
- **Stream deduplication**: Track per-message-ID state to suppress duplicate content from verbose mode snapshots
- **Session auto-resume**: After first turn, all subsequent turns automatically use `--resume <sessionId>`
- **`settingSources` defaults to `""`**: Prevents CLI from loading unexpected config files

## When making changes

1. Read `docs/agent-playbook.md` for the safe modification workflow
2. Read `docs/pitfalls.md` to avoid known traps
3. Run `bun run test:unit` after changes — tests use fake-claude.mjs, no API key needed
4. Run `bun run typecheck` to catch type errors
5. Run `bun run verify` for full validation (clean + build + typecheck + test)

## Adding a new CLI option

1. Add the field to `SessionOptions` in `src/options.ts`
2. Add the argument mapping in `ClaudeCodeExec.buildArgs()` in `src/exec.ts`
3. Add a test case in `tests/exec.test.ts` verifying the flag is forwarded correctly
4. Update `docs/guide/README.md` and `docs/guide/README.zh-CN.md` with the new option
