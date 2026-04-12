import * as readline from "node:readline";
import { ClaudeCode } from "../src/index.js";

const claude = new ClaudeCode();

const session = claude.startSession({
  dangerouslySkipPermissions: true,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

console.log("多轮对话 demo（输入 exit 退出）\n");

let isFirst = true;
while (true) {
  const userInput = isFirst
    ? "请帮我写一篇500字左右的作文"
    : await ask("\n你: ");

  if (userInput === "exit") break;

  if (isFirst) {
    console.log(`你: ${userInput}`);
    isFirst = false;
  }

  console.log("\nClaude:");
  const { events } = await session.runStreamed(userInput);
  for await (const event of events) {
    if (event.type === "text_delta") {
      process.stdout.write(event.content);
    }
  }
  console.log();
}

console.log("\n--- 完成 ---");
console.log("Session ID:", session.id);
rl.close();
