# 架构说明

本仓库是一个 TypeScript SDK，用于以编程方式驱动 Claude Code CLI。

它不直接实现模型协议，而是围绕 Claude CLI 做三件事：

1. 组装参数并启动 `claude` 子进程
2. 消费 CLI 输出并翻译成结构化事件
3. 为调用方维护更稳定的会话 API

## 核心对象

### `ClaudeCode`

文件：`src/claude-code.ts`

职责：

- 保存全局配置，例如 `cliPath`、`env`、`apiKey`、`authToken`、`baseUrl`
- 创建 `Session`
- 提供 `startSession()`、`resumeSession()`、`continueSession()`

不负责：

- CLI flag 映射
- 事件翻译
- turn 结果聚合

### `Session`

文件：`src/session.ts`

职责：

- 管理单个 Claude 会话的生命周期
- 在 `run()` 和 `runStreamed()` 中协调输入归一化、事件翻译、会话恢复
- 维护 `session.id`
- 处理 SDK 级增强行为，例如：
  - `failFastOnCliApiError`
  - `rawEventLog`

不负责：

- `spawn()` 子进程
- 定义 CLI 参数到 flags 的映射

### `ClaudeCodeExec`

文件：`src/exec.ts`

职责：

- 从 `SessionOptions` 构建 Claude CLI 参数
- 启动子进程
- 读取 `stdout` / `stderr`
- 产出原始 `RawClaudeEvent`
- 处理非零退出码、spawn error、abort signal

不负责：

- 会话状态持久化语义
- Relay 事件聚合
- 文本去重策略

### `claude-code-parser`

外部依赖，用于：

- 解析 Claude CLI 的 NDJSON 输出
- 把协议层事件翻译为 `RelayEvent`
- 提供 `Translator`、`parseLine()`、`extractContent()`

本仓库应优先复用其能力，而不是重复实现解析逻辑。

## 执行链路

```text
调用方代码
  -> ClaudeCode.startSession()
  -> Session.run() / Session.runStreamed()
  -> ClaudeCodeExec.run()
  -> spawn("claude", args)
  -> stdout / stderr RawClaudeEvent
  -> parseLine / Translator
  -> RelayEvent / Turn
```

## 两层事件

仓库里有两层不同粒度的事件：

### RawClaudeEvent

来源：`src/exec.ts`

用途：

- 子进程级观测
- 调试和排障
- 落盘到 `logs/*.ndjson`

典型事件：

- `spawn`
- `stdout_line`
- `stderr_chunk`
- `stderr_line`
- `process_error`
- `exit`

### RelayEvent

来源：`src/session.ts` + `claude-code-parser`

用途：

- 面向业务消费的稳定事件语义
- 流式 UI、最终聚合结果、工具调用观察

典型事件：

- `session_meta`
- `text_delta`
- `thinking_delta`
- `tool_use`
- `tool_result`
- `turn_complete`
- `error`

## 会话恢复规则

`Session` 用两个字段描述恢复状态：

- `_id`
- `_hasRun`

规则：

1. 新建会话首轮不带 `--resume`
2. 首轮拿到 `session_meta` 或 `turn_complete.sessionId` 后，缓存 `session.id`
3. 同一 `Session` 再次执行时自动带 `--resume <sessionId>`
4. `continueSession()` 首轮走 `--continue`
5. `resumeSession(id)` 首轮直接走 `--resume <id>`

任何改动这部分逻辑时，都应同时更新 `tests/session.test.ts`。

## 错误处理分层

### 进程级错误

处理位置：`src/exec.ts`

包括：

- 子进程启动失败
- 非零退出码
- `stderr` 拼接后的 CLI 失败
- 用户中断

### 协议级错误

处理位置：`src/session.ts`

包括：

- Claude CLI 正常输出的协议错误事件
- SDK 合成的 `RelayEvent.error`
  - `stderr` 中的 `API Error: ...`
  - `stdout` 中的 `system/api_retry` 鉴权失败事件

## 修改建议

### 想新增 CLI 参数支持

按这个顺序改：

1. `src/options.ts`
2. `src/exec.ts`
3. `README.md`
4. `tests/exec.test.ts`

### 想修改事件语义

按这个顺序看：

1. `src/session.ts`
2. `claude-code-parser` 的类型和翻译行为
3. `tests/session.test.ts`

### 想排查认证或重试问题

优先打开：

- `SessionOptions.rawEventLog`
- `TurnOptions.onRawEvent`
- `TurnOptions.failFastOnCliApiError`

然后查看 `logs/claude-raw-events-*.ndjson` 中的：

- `stdout_line` 的 `system/api_retry`
- `stderr_chunk` / `stderr_line`
- 最终 `exit`
