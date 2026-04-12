# AGENTS.md

本文档面向使用 Claude Code 或其他自动化 agent 参与本仓库开发的协作者，帮助快速理解仓库中的核心“agent / actor”、职责边界以及推荐修改方式。

## 仓库目标

本仓库提供一个 TypeScript SDK，用于以编程方式驱动 Claude Code CLI。它的核心职责不是自己实现模型协议，而是：

1. 启动 `claude` CLI
2. 把 CLI 输出按流式方式读出来
3. 转换成结构化事件
4. 维护多轮 session 状态
5. 向业务侧暴露稳定、易用的 TypeScript API

## 核心角色

### 1. `ClaudeCode`

文件：`src/claude-code.ts`

职责：

- 作为 SDK 主入口
- 保存全局配置（如 `cliPath`、`env`、`apiKey`）
- 创建 `Session`
- 提供三种会话创建模式：新建、恢复、继续最近一次会话

不负责：

- 拼装具体 CLI flags
- 处理流式事件翻译
- 聚合 turn 结果

### 2. `Session`

文件：`src/session.ts`

职责：

- 表示一次 Claude Code 会话
- 管理 `session.id`
- 实现 `run()` 与 `runStreamed()`
- 处理首轮执行、`--resume`、`--continue` 的切换逻辑
- 归一化输入（文本 / 图片）
- 把原始 CLI 输出转换为 `RelayEvent`
- 在缓冲模式下聚合 `finalResponse`、`usage` 和 `events`

不负责：

- 直接 `spawn` 子进程
- 定义 CLI 参数与 flags 的完整映射规则

### 3. `ClaudeCodeExec`

文件：`src/exec.ts`

职责：

- 根据 `SessionOptions` 构建 Claude CLI 参数
- 启动 Claude CLI 子进程
- 处理 `stdout` / `stderr`
- 将 NDJSON 输出按行产出
- 处理 abort、spawn error 和非零退出码

不负责：

- 会话状态持久化策略
- 文本事件聚合
- 业务层语义包装

### 4. `claude-code-parser`

外部依赖，主要在 `src/session.ts` / `src/index.ts` 中使用。

职责：

- 解析 Claude Code 的 NDJSON 输出
- 将原始消息翻译为 `RelayEvent`
- 提供 `Translator`、`parseLine`、`extractContent` 等工具

注意：

- 本仓库只是在其基础上做补充与去重，不应重复实现已有解析逻辑
- 如需调整事件语义，优先确认问题应在本仓库修复，还是应上游修复

## 事件流

标准执行链路如下：

```text
调用方代码
  -> ClaudeCode.startSession()
  -> Session.run() / Session.runStreamed()
  -> ClaudeCodeExec.run()
  -> spawn("claude", args)
  -> 读取 NDJSON stdout
  -> parseLine / Translator
  -> RelayEvent / Turn
```

### 缓冲模式：`run()`

适用于只关心最终结果的场景：

- 收集所有 `RelayEvent`
- 拼接 `text_delta` 为 `finalResponse`
- 从 `turn_complete` 中提取 usage
- 返回 `Turn`

### 流式模式：`runStreamed()`

适用于实时消费事件的场景：

- 立即返回 `AsyncGenerator<RelayEvent>`
- 调用方逐条消费事件
- 不做额外等待与汇总

## 会话恢复规则

`Session` 内部有两个关键状态：

- `_id`：当前 session ID
- `_hasRun`：当前 `Session` 实例是否已经执行过至少一轮

行为规则：

1. `startSession()` 创建的新会话，首轮不带 `--resume`
2. 首轮结束后，如果收到 `session_meta` 或 `turn_complete.sessionId`，则缓存到 `session.id`
3. 后续在同一个 `Session` 上再次执行时，自动带上 `--resume <sessionId>`
4. `continueSession()` 创建的会话，首轮走 `--continue`
5. `resumeSession(id)` 创建的会话，首轮直接走 `--resume <id>`

如果你修改这部分逻辑，必须同步检查 `tests/session.test.ts`。

## 输入模型

`Session` 支持两类输入：

```ts
type Input = string | UserInput[];

type UserInput =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string };
```

规则：

- `string` 直接作为 prompt
- 多个 `text` 会按空行拼接
- `local_image` 会被收集并映射到 CLI 的 `--image`

如果未来要新增输入类型，请优先评估：

1. Claude CLI 是否已支持对应参数
2. 该输入是否应在 SDK 层做统一建模
3. 是否会破坏现有 `Input` 的简洁性

## 配置分层

### 全局配置：`ClaudeCodeOptions`

适合放在 `ClaudeCode` 实例级别：

- `cliPath`
- `env`
- `apiKey`

### 会话配置：`SessionOptions`

适合放在 `Session` 级别：

- 模型与预算
- 权限控制
- MCP / plugin / settings
- 输出细节
- worktree / debug / hooks 等运行时行为

建议：

- 新增 CLI 参数映射时，先在 `src/options.ts` 增加类型，再在 `src/exec.ts` 的 `buildArgs()` 中补齐转换逻辑
- 文档更新时同步修改 `README.md`

## 修改建议

### 新增 Claude CLI 参数支持

推荐步骤：

1. 在 `src/options.ts` 中增加字段定义
2. 在 `src/exec.ts` 的 `buildArgs()` 中补齐映射
3. 如需对外暴露，检查 `src/index.ts` 是否需要额外导出
4. 更新 README 的 API 使用文档
5. 增加或更新测试

### 修改事件处理逻辑

重点关注：

- `src/session.ts` 中的 `_runStreamedInternal()`
- `translateRelayEvents()`
- `translateStreamEvent()`
- duplicated text/thinking 去重逻辑

注意事项：

- Claude Code 可能同时输出 `stream_event` 增量消息和最终 assistant snapshot
- 当前实现会保留工具相关事件，但抑制重复的 `text_delta` / `thinking_delta`
- 调整去重策略时，要避免让调用方收到重复文本

### 修改错误处理逻辑

重点关注：

- `src/exec.ts` 中 spawn error / exit code / stderr 拼接
- `src/session.ts` 中 `error` 事件抛错行为

建议保持：

- 执行层负责进程级错误
- 会话层负责协议级错误事件

## 测试约定

测试文件：

- `tests/exec.test.ts`
- `tests/session.test.ts`

测试依赖：

- `tests/fixtures/fake-claude.mjs`

建议：

- 任何会影响 CLI 参数拼装、session 恢复、流式事件或错误行为的修改，都应补测试
- 优先通过 fake CLI 验证参数和事件流，不要在单测里依赖真实 Claude CLI

## 文档维护约定

当以下内容变更时，应同步更新 `README.md`：

- 新增或删除导出 API
- `SessionOptions` 字段变化
- 输入模型变化
- 事件类型或语义变化
- 示例代码失效

当以下内容变更时，应同步检查本文件：

- 仓库核心职责边界
- 主要执行链路
- 核心对象分工
- 推荐扩展方式

## 给自动化 agent 的工作建议

1. 先读 `src/index.ts`，确认公开 API 面
2. 再读 `src/options.ts` 与 `src/exec.ts`，确认参数如何下沉到 CLI
3. 修改会话行为前，重点阅读 `src/session.ts`
4. 修改完成后，至少检查：
   - 文档是否与代码一致
   - 测试是否覆盖新增行为
   - 是否引入了重复抽象或职责交叉

## 不建议的做法

- 不要在 `ClaudeCode` 中塞入 session 级状态逻辑
- 不要在 `Session` 中重复实现 CLI 参数映射
- 不要绕过 `claude-code-parser` 重写通用解析逻辑，除非确有协议兼容问题
- 不要只改代码不改文档；本仓库的可用性高度依赖 README 准确性
