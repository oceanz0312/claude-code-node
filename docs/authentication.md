# 认证参数说明

本 SDK 支持两条不同的鉴权通道：`apiKey` 和 `authToken`。它们不是同一个东西，也不应该互相替代。

## 一句话区别

- `apiKey`：用于 `X-Api-Key`
- `authToken`：用于 `Authorization: Bearer <token>`

## SDK 中的映射关系

当你在 `ClaudeCodeOptions` 中传入这些字段时，SDK 会把它们透传给 Claude CLI 子进程：

- `apiKey` -> `ANTHROPIC_API_KEY`
- `authToken` -> `ANTHROPIC_AUTH_TOKEN`
- `baseUrl` -> `ANTHROPIC_BASE_URL`

如果 SDK 显式收到了 `apiKey` 或 `authToken`，还会清理继承环境中的另一种凭据，避免 Claude CLI 同时收到两套认证信息。

## 什么时候用 `apiKey`

当目标服务文档要求你发送 `X-Api-Key` 请求头时，使用 `apiKey`。

典型场景：

- 直连 Anthropic API
- 文档或示例请求里出现 `x-api-key: ...`
- 你拿到的是 Anthropic 风格的 API Key

示例：

```ts
const claude = new ClaudeCode({
  apiKey: "sk-ant-...",
});
```

## 什么时候用 `authToken`

当目标服务文档要求你发送 `Authorization: Bearer <token>` 请求头时，使用 `authToken`。

典型场景：

- 通过网关或代理访问模型服务
- 使用第三方 Anthropic 兼容层
- 文档或示例请求里出现 `Authorization: Bearer ...`

示例：

```ts
const claude = new ClaudeCode({
  authToken: "token-for-your-gateway",
  baseUrl: "https://your-proxy.example.com",
});
```

## `baseUrl` 不决定鉴权方式

`baseUrl` 只决定请求发往哪个地址，不决定 Claude CLI 最终使用哪种鉴权头。

这意味着：

- 改了 `baseUrl`，不代表一定该用 `authToken`
- 不改 `baseUrl`，也不代表一定该用 `apiKey`

最终仍应以目标服务文档要求的请求头为准。

## 最实用的判断方法

直接看服务文档、curl 示例或网关接入说明：

- 如果写的是 `x-api-key`，用 `apiKey`
- 如果写的是 `Authorization: Bearer ...`，用 `authToken`

如果两种都支持，优先以服务方明确推荐的方式为准。

## Kimi 示例为什么使用 `authToken`

仓库里的 `demo/kimi.ts` 使用的是：

- `authToken`
- `baseUrl`

原因是 Kimi 官方 Claude Code 接入文档要求使用 `ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_BASE_URL`。

这也说明一件事：

- 第三方兼容网关不一定都用 Bearer token
- 是否使用 `apiKey` 还是 `authToken`，必须以目标服务文档要求的请求头为准

## 兼容性说明

SDK 会同时保留 `apiKey` 和 `authToken` 两个字段：

- 现有直连 Anthropic 的调用方式不会被破坏
- 走第三方网关时可以显式改用 `authToken`

如果你不确定该选哪一个，先确认目标服务到底要哪种 HTTP 请求头。
