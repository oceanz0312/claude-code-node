import { ClaudeCode } from "../src/index.js";

const claude = new ClaudeCode();

const session = claude.startSession({
  dangerouslySkipPermissions: true
});

const turn1 = await session.run("你现在有哪些MCP 和 Skills，哪些是全局的，哪些是项目的，哪些是 plugin 注入的");
console.log(turn1.finalResponse);
console.log(turn1.usage);
const turn = await session.runStreamed("你现在有哪些MCP 和 Skills，哪些是全局的，哪些是项目的，哪些是 plugin 注入的");

for await (const event of turn.events) {
  if (event.type === "text_delta") {
    console.log(event.content);
  }
}
