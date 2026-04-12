# Agent 操作手册

本文档面向自动化 agent，目标是减少无效探索并降低误改风险。

## 推荐阅读顺序

1. `README.md`
2. `AGENTS.md`
3. `docs/architecture.md`
4. `src/index.ts`
5. `src/options.ts`
6. `src/exec.ts`
7. `src/session.ts`

## 先判断你在改哪一层

### API 面

关注：

- `src/index.ts`
- `README.md`
- 类型导出

### CLI 参数映射

关注：

- `src/options.ts`
- `src/exec.ts`
- `tests/exec.test.ts`

### 会话语义和流式事件

关注：

- `src/session.ts`
- `tests/session.test.ts`

### 文档和排障体验

关注：

- `README.md`
- `AGENTS.md`
- `docs/*.md`

## 安全修改流程

1. 先确认改动属于哪一层
2. 只在该层做改动，不跨层复制逻辑
3. 更新对应文档
4. 补测试
5. 运行 `bun run check`

## 容易犯错的点

### 把 session 逻辑塞进 `ClaudeCode`

不推荐。`ClaudeCode` 应保持轻量，只做全局配置和 Session 创建。

### 在 `Session` 里重复实现 CLI 参数映射

不推荐。参数映射应集中在 `src/exec.ts`。

### 绕过 `claude-code-parser`

只有在协议兼容性确实有问题时才这样做。默认应优先复用 parser 和 translator。

### 只改代码不改 README / AGENTS

这是高频回归点。这个仓库的 AI 友好性高度依赖文档同步。

## 出问题时先看什么

### API 鉴权或长时间重试

先看：

- `docs/authentication.md`
- `docs/testing-and-validation.md`
- `logs/claude-raw-events-*.ndjson`

### `runStreamed()` 长时间没有文本输出

先区分：

- 是否只有 `session_meta`
- 是否存在 `system/api_retry`
- 是否只有 `stderr_chunk`

如果是认证或重试问题，优先开启：

- `SessionOptions.rawEventLog`
- `TurnOptions.failFastOnCliApiError`

### 自动 `--resume` 行为不对

先看：

- `docs/architecture.md`
- `src/session.ts`
- `tests/session.test.ts`

## 建议的输出方式

在提交改动说明时，优先覆盖：

- 改动属于哪一层
- 为什么放在这一层
- 哪些测试覆盖了新行为
- 哪些文档已同步

这样后续 agent 或人工 reviewer 能更快确认边界是否合理。
