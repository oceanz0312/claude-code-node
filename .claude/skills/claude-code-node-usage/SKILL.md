---
name: claude-code-node-usage
description: "Guide for using the claude-code-node SDK — covers installation, API reference, session management, streaming, structured output, image input, sub-agents, MCP integration, and all 35+ SessionOptions. Use this skill whenever the user asks how to use claude-code-node, wants code examples, needs help with SDK options (model, systemPrompt, allowedTools, jsonSchema, mcpConfig, agents, etc.), asks about authentication (apiKey, authToken, baseUrl), or is building something on top of the SDK. Also trigger when the user asks what this SDK can do, how it compares to alternatives, or whether it fits their use case."
---

# claude-code-node Usage Guide

You are helping someone use the `claude-code-node` TypeScript SDK, which wraps the Claude Code CLI into a programmatic async API for Node.js/Bun.

## Key context files

Read these files from the project root to answer the user's questions:

1. **`README.md`** and **`README.zh-CN.md`** — Project overview, capabilities, installation, and quick start
2. **`docs/guide/README.md`** and **`docs/guide/README.zh-CN.md`** — Full API reference (ClaudeCode, Session, SessionOptions, TurnOptions, Turn, StreamedTurn, RelayEvent) and 10 usage examples
3. **`docs/why/README.md`** and **`docs/why/README.zh-CN.md`** — Why this SDK exists, competitive comparison, test coverage
4. **`docs/authentication.md`** — Auth parameter selection guide (apiKey vs authToken vs baseUrl)

Start by reading the guide doc that matches the user's language preference. If unsure, read the English version. Only read additional files if the guide doesn't cover what the user needs.

## Core concepts to know

- **ClaudeCode** is the entry point — instantiate it with optional `cliPath`, `apiKey`, `authToken`, `baseUrl`, `env`
- **Session** represents a conversation — created via `startSession()`, `resumeSession(id)`, or `continueSession()`
- **Turn** is the result of `session.run()` — contains `events`, `finalResponse`, `usage`, `sessionId`, `structuredOutput`
- **StreamedTurn** is the result of `session.runStreamed()` — `events` is an `AsyncIterable<RelayEvent>`
- Sessions auto-resume after the first turn — the user never manages session IDs manually
- There are 35+ typed SessionOptions covering model, system prompt, permissions, tools, MCP, agents, structured output, debugging, and more
- `TurnOptions` are per-turn: `signal` (abort), `onRawEvent` (debug callback), `failFastOnCliApiError`

## When answering questions

- Provide TypeScript code examples that the user can copy-paste
- If the user asks about a specific option, look it up in the guide doc's SessionOptions tables
- If the user asks "can I do X?", check if there's a matching SessionOption or usage example
- Respond in the user's language — both Chinese and English docs are available
