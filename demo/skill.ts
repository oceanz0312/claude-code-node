import * as path from "node:path";
import * as readline from "node:readline";
import { ClaudeCode } from "../src/index.js";
import { secrets } from "../.env.js";

const claude = new ClaudeCode({
  ...(secrets.apiKey ? { apiKey: secrets.apiKey } : {}),
  ...(secrets.authToken ? { authToken: secrets.authToken } : {}),
  ...(secrets.baseUrl ? { baseUrl: secrets.baseUrl } : {}),
});

const pluginDir = path.resolve(import.meta.dirname, "claude-code-plugin");

const session = claude.startSession({
  cwd: import.meta.dirname,
  dangerouslySkipPermissions: true,
  pluginDir,
});

const initialPrompt =
  "使用 ai-friendly-evaluate 技能评估当前仓库的 ai-friendly 分数";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function writeLine(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function formatJsonLine(label: string, value: unknown): string {
  return `[${label}] ${JSON.stringify(value)}`;
}

async function runTurn(userInput: string): Promise<void> {
  writeLine();
  writeLine("Claude:");
  const { events } = await session.runStreamed(userInput, {
    // onRawEvent(event) {
    //   if (event.type === "stdout_line") {
    //     console.log("[claude raw stdout]", event.line);
    //   }
    //   if (event.type === "stderr_line") {
    //     console.error("[claude raw stderr]", event.line);
    //   }
    // },
  });

  let streamingMode: "text_delta" | "thinking_delta" | null = null;
  const flushStreamingLine = (): void => {
    if (streamingMode) {
      writeLine();
      streamingMode = null;
    }
  };

  for await (const event of events) {
    switch (event.type) {
      case "text_delta":
        if (streamingMode !== "text_delta") {
          flushStreamingLine();
          process.stdout.write("[text_delta] ");
          streamingMode = "text_delta";
        }
        process.stdout.write(event.content);
        break;
      case "thinking_delta":
        if (streamingMode !== "thinking_delta") {
          flushStreamingLine();
          process.stdout.write("[thinking_delta] ");
          streamingMode = "thinking_delta";
        }
        process.stdout.write(event.content);
        break;
      case "tool_use":
        flushStreamingLine();
        writeLine(formatJsonLine("tool_use", {
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          input: event.input,
        }));
        break;
      case "tool_result":
        flushStreamingLine();
        writeLine(formatJsonLine("tool_result", {
          toolUseId: event.toolUseId,
          output: event.output,
          isError: event.isError,
        }));
        break;
      case "session_meta":
        flushStreamingLine();
        writeLine(formatJsonLine("session_meta", { model: event.model }));
        break;
      case "turn_complete":
        flushStreamingLine();
        writeLine(formatJsonLine("turn_complete", {
          sessionId: event.sessionId,
          costUsd: event.costUsd,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          contextWindow: event.contextWindow,
        }));
        break;
      case "error":
        flushStreamingLine();
        writeLine(formatJsonLine("error", {
          message: event.message,
          sessionId: event.sessionId,
        }));
        break;
    }
  }
  flushStreamingLine();
  writeLine();
}

writeLine("多轮 skill demo（输入 exit 退出）");
writeLine();

let isFirst = true;
while (true) {
  const userInput = isFirst ? initialPrompt : await ask("\n你: ");

  if (userInput === "exit") break;

  if (isFirst) {
    writeLine(`你: ${userInput}`);
    isFirst = false;
  }

  await runTurn(userInput);
}

writeLine();
writeLine("--- 完成 ---");
writeLine(`Session ID: ${session.id}`);
rl.close();
