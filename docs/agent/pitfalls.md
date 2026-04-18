# 闭坑指南

本文件记录使用 `claude-code-node` 和 Claude Code CLI 时已经踩过、且容易反复踩到的重大问题。

## 坑 1：`settingSources` 不能包含全局 `user`，否则传入的 `env` 可能失效

**现象：**

- 通过 `ClaudeCodeOptions.env` 传入的 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` 没有生效
- 或者通过顶层 `apiKey` / `authToken` / `baseUrl` 传入后，Claude CLI 仍然使用了机器上的全局配置
- 最终表现通常是请求打到了错误的网关、带错了凭据，或者出现难以理解的 `401`

**原因：**

Claude Code CLI 会根据 `--setting-sources` 加载外部设置源。只要其中包含全局 `user`，全局配置里的认证信息或 base URL 就可能覆盖你通过 SDK 传入的环境变量，导致看起来像是 `env` 注入失败。

**结论：**

- 如果你希望 SDK 传入的 `env` 绝对生效，不要让 `settingSources` 包含全局 `user`
- 最稳妥的做法是显式传空字符串：`settingSources: ""`

```ts
const session = claude.startSession({
  settingSources: "",
});
```

**推荐做法：**

如果你在对接第三方兼容网关，或者明确要求以代码里传入的环境变量为准，建议同时打开下面几个隔离项：

```ts
const claude = new ClaudeCode({
  env: {
    HOME: "/tmp/claude-isolated-home",
    XDG_CONFIG_HOME: "/tmp/claude-isolated-home/.config",
    XDG_STATE_HOME: "/tmp/claude-isolated-home/.state",
    ANTHROPIC_AUTH_TOKEN: "your-token",
    ANTHROPIC_BASE_URL: "https://your-gateway.example.com",
  },
});

const session = claude.startSession({
  bare: true,
  settingSources: "",
  noSessionPersistence: true,
});
```

**补充说明：**

- SDK 当前默认会传 `--setting-sources ""`，目的是避免全局设置污染
- 一旦你显式把 `settingSources` 设成包含 `user` 的值，就重新引入了这个坑
- 如果确实要加载项目设置，优先考虑只传 `"project,local"`，不要把 `user` 带上
