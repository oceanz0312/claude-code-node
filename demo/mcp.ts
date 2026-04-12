import { ClaudeCode } from "../src/index.js";

const claude = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseUrl: process.env.ANTHROPIC_BASE_URL,
});

const session = claude.startSession({
  cwd: import.meta.dirname,
  dangerouslySkipPermissions: true,
  // permissionMode: 'plan'
});

const turn1 = await session.run("你现在有哪些MCP 和 Skills，哪些是全局的，哪些是项目的，哪些是 plugin 注入的");
console.log(turn1.finalResponse);
console.log(turn1.usage);
console.log(turn1.events);
console.log(turn1.sessionId);
