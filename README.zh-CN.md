# claude-code-node

[![npm version](https://img.shields.io/npm/v/claude-code-node.svg)](https://www.npmjs.com/package/claude-code-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **直接封装 Claude Code CLI 的 TypeScript SDK** — 让你在 Node.js/Bun 中以编程方式驱动 Claude Code，干净的异步 API。

[English Documentation](./README.md)

---

## 你能得到什么

```typescript
import { ClaudeCode } from "claude-code-node";

const claude = new ClaudeCode();
const session = claude.startSession({ model: "sonnet", dangerouslySkipPermissions: true });

const turn = await session.run("Fix the failing tests in src/");
console.log(turn.finalResponse);

// 多轮对话：直接继续 run() — 会话恢复是自动的
const turn2 = await session.run("Now add test coverage for edge cases");
```

**没有 HTTP 服务器，没有协议转换，没有过度抽象。** 只是对 Claude Code CLI 的类型化异步封装，替你处理繁琐的部分：

| 能力 | 做了什么 |
|------|----------|
| **会话管理** | 跨轮次自动 `--resume` — 你永远不需要手动管理 session ID |
| **流式输出** | `AsyncIterable<RelayEvent>`，7 种类型化事件 |
| **35+ CLI 选项** | 每个常用 flag 都有类型化字段 — `model`、`systemPrompt`、`allowedTools`、`jsonSchema`、`maxBudgetUsd`、`agents`、`mcpConfig`… |
| **结构化输出** | 传入 JSON Schema，从 `turn.structuredOutput` 拿到解析后的对象 |
| **图片输入** | 截图和文本一起发送 |
| **中断控制** | 用 `AbortSignal` 取消任意 turn |
| **FailFast** | 秒级检测 API 错误，而非等待数分钟（CI/CD 场景关键能力） |

---

## 横向对比

我们调研了 [9 个 Claude Code Wrapper 项目](https://github.com/oceanz0312/claude-code-node)。核心结论：

- **生态中唯一的 TypeScript SDK** — Python 有官方 Agent SDK；TypeScript 只有这个
- **CLI 参数覆盖率最高**（35+ vs 竞品约 10 个）
- **唯一拥有双层事件体系**（原始进程事件 + 语义中继事件）
- **唯一实现流式去重**（消除 CLI verbose 模式的重复文本）
- **唯一无需 CLI 即可运行的真实测试**（900+ 行，fake-claude.mjs 模拟器）

---

## 经过测试，值得信赖

| 指标 | 详情 |
|------|------|
| **39 个测试用例** | 28 个单元测试 + 11 个真实模型 E2E 测试 |
| **1,690 行**测试代码 | 覆盖会话生命周期、流式输出、中断、错误检测、图片输入、结构化输出、CLI 参数转发 |
| **Fake CLI 模拟器** | 378 行 `fake-claude.mjs`，完整模拟 `stream-json` 协议 — 单元测试无需真实 CLI 或 API Key |
| **真实 E2E 测试套件** | 使用真实凭据调用 Claude CLI — 测试多轮记忆、认证路径、系统提示词、图片理解、Agent 身份识别、15+ CLI 参数转发 |
| **E2E 测试产物** | 每次运行保存 NDJSON 日志、中继事件和最终响应到 `tests/e2e/artifacts/`，便于事后分析 |
| **覆盖率** | `bun run test:coverage` — 基于 Bun 内置覆盖率工具 |

```
File                  | % Funcs | % Lines
----------------------|---------|--------
All files             |  100.00 |   99.71
 src/claude-code.ts   |  100.00 |  100.00
 src/exec.ts          |  100.00 |  100.00
 src/raw-event-log.ts |  100.00 |   98.84
 src/session.ts       |  100.00 |  100.00
```

**40 个测试通过，0 失败，183 个 expect() 断言。**

---

## 它不是什么

- 不是 HTTP API 服务（需要的话用 [claude-code-openai-wrapper](https://github.com/RichardAtCT/claude-code-openai-wrapper)）
- 不是多模型网关（它封装的是 Claude Code，仅此而已）
- 不是 CLI 的替代品（它驱动 CLI）

## 相关项目

| 项目 | 说明 |
|------|------|
| [claude-code-openai-wrapper](https://github.com/RichardAtCT/claude-code-openai-wrapper) | Python/FastAPI 服务，将 Claude Code 暴露为 OpenAI 兼容 API，最成熟的 HTTP wrapper |
| [claude-code-api](https://github.com/bethington/claude-code-api) | Node.js/Express 服务，将 Claude Code CLI 桥接为 OpenAI 兼容端点 |
| [claude-code-api-rs](https://github.com/ZhangHanDong/claude-code-api-rs) | Rust/Axum 高性能 API 服务，支持 SSE 流式和 WebSocket |
| [claw-code](https://github.com/ultraworkers/claw-code) | Rust 洁净室重写的 Claude Code，支持多模型和沙箱隔离 |
| [claude-code-any](https://github.com/jiangyurong609/claude-code-any) | Claude Code 修改版，通过 OpenAI 适配层路由到 20+ 模型供应商 |

---

## 前置要求

- Node.js >= 22
- 已安装 Claude Code CLI，且 `claude` 可在 `PATH` 中找到（或通过 `cliPath` 显式指定路径）

## 安装

```bash
# npm
npm install claude-code-node

# pnpm
pnpm add claude-code-node

# bun
bun add claude-code-node
```

## 使用指南与 API 参考

完整的 API 参考、全部 SessionOptions 和 10 个使用示例（流式、结构化输出、子 Agent、MCP、图片输入等）：

**[API 参考与使用指南](./docs/guide/README.zh-CN.md)** | [API Reference & Usage Guide](./docs/guide/README.md)

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/guide/](docs/guide/README.zh-CN.md) | 完整 API 参考和 10 个使用示例 |
| [docs/why/](docs/why/README.zh-CN.md) | 为什么选择这个项目 — 竞品分析 |
| [docs/agent/](docs/agent/) | Agent 文档：架构、认证、测试、工作手册、已知坑点 |

---

## E2E 测试

仓库内置了针对 Claude Code CLI 的真实端到端测试：

```bash
# 1. 复制示例环境文件
cp .env.example .env

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
