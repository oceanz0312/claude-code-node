# 真实 Claude CLI E2E 测试设计

## 背景

当前仓库已有两类验证：

- `tests/exec.test.ts`：验证 CLI 参数映射与原始事件
- `tests/session.test.ts`：验证 Session 语义、流式事件和错误处理

这些测试都基于 fake CLI，能证明 SDK 本地逻辑正确，但不能证明：

1. `src/index.ts -> src/session.ts -> src/exec.ts -> real claude CLI` 这条链路真实可用
2. 鉴权参数是否真的被真实 CLI 接收
3. 图片输入是否真的传入 Claude 并得到识别结果
4. 关键对外 API 在真实终端环境里是否能跑出完整 transcript

## 目标

新增 `bun run test:e2e`，以独立命令运行真实 Claude CLI 端到端测试，满足：

- 入口必须走 SDK 对外 API，而不是测试代码直接 spawn `claude`
- 认证参数在 test case 内通过 `new ClaudeCode({...})` 直接传入
- 不新增额外环境变量体系，避免理解成本
- 不依赖宿主机默认的 Claude 配置作为测试输入
- 运行时尽量在终端看到完整逻辑输出
- 每个 case 都产出 raw transcript、relay events 和最终结果

## 非目标

- 不把所有内部状态机细节都迁到真实 E2E；这些继续保留在 fake CLI 单测
- 不要求第一版稳定覆盖所有 Claude CLI 外部生态能力，例如复杂 MCP / Chrome 自动化
- 不把测试密钥硬编码入仓库

## 设计原则

### 1. 真实入口必须走 `src/`

E2E case 统一通过：

```ts
import { ClaudeCode } from "../../src/index.js";
```

测试只能调用公开 API：

- `new ClaudeCode(options)`
- `startSession()`
- `resumeSession()`
- `continueSession()`
- `run()`
- `runStreamed()`

不允许测试自己直接 `spawn("claude")`，否则无法验证 SDK 自身逻辑。

### 2. 认证参数直接放进 `ClaudeCodeOptions`

示例：

```ts
const claude = new ClaudeCode({ apiKey });
```

或：

```ts
const claude = new ClaudeCode({ authToken, baseUrl });
```

测试不再引入额外 `CLAUDE_E2E_*` 环境变量体系。

### 3. 使用本地未提交 secrets 文件

新增本地配置文件模板，例如：

- `tests/e2e/local.secrets.example.ts`
- `tests/e2e/local.secrets.ts`（gitignore）

`local.secrets.ts` 由测试执行者手工填写，不提交到仓库。

### 4. transcript-first

每个 E2E case 默认产出：

- `summary.json`
- `raw-events.ndjson`
- `relay-events.json`
- `final-response.txt`
- `terminal-transcript.txt`
- `input.json`

产物目录固定为：

- `tests/e2e/artifacts/<run-id>/<case-name>/`

### 5. 默认纯净执行

E2E 默认使用：

- `bare: true`
- `settingSources: ""`
- `verbose: true`
- `includePartialMessages: true`

这用于尽量隔离宿主机自动发现带来的干扰。

## 目录结构

```text
tests/
  e2e/
    README.md
    local.secrets.example.ts
    config.ts
    harness.ts
    reporters.ts
    fixtures/
      images/
        red-square.png
        shapes-demo.png
        receipt-demo.jpg
    cases/
      auth-api-key.test.ts
      auth-token-base-url.test.ts
      session-lifecycle.test.ts
      streaming.test.ts
      image-input.test.ts
      option-behavior.test.ts
      session-mode-and-agents.test.ts
    artifacts/
      .gitkeep
```

## 脚本设计

`package.json` 只增加一个入口：

```json
{
  "scripts": {
    "test:e2e": "bun test tests/e2e/cases"
  }
}
```

不再增加 `test:e2e:api-key` / `test:e2e:auth-token` 之类的包装脚本。

## 参数分级策略

### Tier A：真实行为 E2E

必须通过真实 Claude 输出或真实会话行为验证：

- `apiKey`
- `authToken`
- `baseUrl`
- `model`
- `maxTurns`
- `systemPrompt`
- `appendSystemPrompt`
- `permissionMode`
- `dangerouslySkipPermissions`
- `allowedTools`
- `disallowedTools`
- `tools`
- `mcpConfig`
- `strictMcpConfig`
- `bare`
- `noSessionPersistence`
- `agent`
- `agents`
- `verbose`
- `includePartialMessages`
- `rawEventLog`
- `Input.local_image`

### Tier B：真实 transcript E2E

主要验证 SDK 真实传参和运行现场留痕：

- `cwd`
- `additionalDirectories`
- `maxBudgetUsd`
- `systemPromptFile`
- `appendSystemPromptFile`
- `permissionPromptTool`
- `effort`
- `fallbackModel`
- `chrome`
- `name`
- `settings`
- `betas`
- `worktree`
- `disableSlashCommands`
- `pluginDir`
- `excludeDynamicSystemPromptSections`
- `debug`
- `debugFile`
- `TurnOptions.onRawEvent`

### Tier C：继续留在 fake CLI 单测

- 精确 flag 拼装边界
- Session 内部状态机细节
- parser 兼容与重复输出去重
- abort 时序边界
- 非零退出码文本拼接

## 第一版 E2E case 列表

1. `config-validation.test.ts`
2. `auth-api-key.test.ts`
3. `auth-token-base-url.test.ts`
4. `session-lifecycle.test.ts`
5. `streaming.test.ts`
6. `image-input.test.ts`
7. `option-behavior.test.ts`
8. `session-mode-and-agents.test.ts`

## 图片 fixture 设计

第一版只使用高可判定性图片：

- `red-square.png`：纯红色正方形，用于颜色和形状识别
- `shapes-demo.png`：少量简单几何图形，用于计数和类别识别
- `receipt-demo.jpg`：简短清晰文字，用于 OCR 弱断言

## 终端输出要求

每个 case 至少打印：

- case 名
- 认证模式
- SessionOptions 摘要
- 输入 prompt / 图片路径摘要
- raw / relay event 数量
- 最终响应摘要
- artifact 目录

## 实施顺序

1. 增加本地 secrets 模板、README 和 harness
2. 先落认证、会话、流式、图片 4 类高信号 case
3. 再补 option-behavior 与 agents case
4. 更新 README 和 testing 文档
5. 保持 fake CLI 单测不回退
