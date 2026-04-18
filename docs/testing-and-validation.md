# 测试与验证说明

本仓库的验证目标是两件事：

1. 确认 TypeScript API 和类型约束没有被破坏
2. 确认 Claude CLI 参数拼装、事件流和错误处理行为仍然符合预期

## 测试结构

### `tests/exec.test.ts`

覆盖执行层行为：

- CLI 参数构建
- 环境变量注入
- `stdout` / `stderr` 原始事件
- 非交互执行的基础约束

### `tests/session.test.ts`

覆盖会话层行为：

- `run()` / `runStreamed()`
- 自动 `--resume`
- `continueSession()` / `resumeSession()`
- 结构化输入
- `AbortSignal`
- `failFastOnCliApiError`
- `rawEventLog`

### `tests/fixtures/fake-claude.mjs`

这是单测的 fake Claude CLI。

作用：

- 模拟 `claude --output-format stream-json`
- 产出可控的 `stdout` / `stderr`
- 避免单测依赖真实 Claude CLI 或远端服务

## 推荐验证命令

### 日常修改

```bash
bun run check
```

等价于：

```bash
bun run typecheck
bun test
```

适用场景：

- 文档同步后的基础回归
- 普通行为修改
- 提交前快速校验

### 完整验证

```bash
bun run verify
```

执行顺序：

1. `bun run clean`
2. `bun run build`
3. `bun run check`

适用场景：

- 准备发布前
- 修改导出面后
- 修改构建相关逻辑后

### 真实 Claude CLI E2E

```bash
bun run test:e2e
```

适用场景：

- 需要验证真实 Claude CLI 是否能通过 SDK 跑通
- 需要验证 `apiKey` / `authToken + baseUrl` 两条认证路径
- 需要验证图片输入、流式输出和关键 Session 行为
- 需要保留完整终端 transcript 与 raw event 产物

运行前需要准备 `tests/e2e/local.secrets.ts`，具体说明见 `tests/e2e/README.md`。

### 覆盖率观察

```bash
bun run test:coverage
```

适用场景：

- 修改测试时确认覆盖面
- 回应 AI-friendly 评估中关于 D6 的改进建议

## 修改后最少要跑什么

### 只改文档

至少运行：

```bash
bun run typecheck
```

如果示例代码被改动，改为运行：

```bash
bun run check
```

### 改 `src/options.ts` 或 `src/exec.ts`

至少运行：

```bash
bun run check
```

### 改 `src/session.ts`

至少运行：

```bash
bun run check
```

如果改动涉及构建产物或导出类型，再运行：

```bash
bun run verify
```

## 排查建议

### 认证失败但 CLI 长时间不退出

优先检查：

- `SessionOptions.rawEventLog`
- `TurnOptions.failFastOnCliApiError`

重点看日志中的：

- `stdout_line` 里的 `system/api_retry`
- `stderr_chunk`
- `stderr_line`
- `exit`

### 流式内容重复

重点检查：

- `src/session.ts` 中的 `translateRelayEvents()`
- `translateStreamEvent()`
- `hasStreamedMessage()`

### 会话恢复异常

重点检查：

- `_id`
- `_hasRun`
- `resumeSessionId` / `continueSession` 的传参逻辑
- `tests/session.test.ts` 中的自动 `--resume` 用例

## 对自动化 agent 的建议

- 优先使用 `bun run check` 作为统一验证入口，不要自行拼接零散命令
- 需要观察原始 CLI 行为时，优先打开 `rawEventLog`
- 修改协议或错误语义时，先补 fake CLI 场景，再补 session 测试
