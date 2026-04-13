import { ClaudeCode } from "../src/index.js";

const authToken = "sk-kimi-SdeumX8pBP6fNHfoYZSUB1iY74nXtT8yUq1UXvfXAfBlhPhI1uRURAu4jguhid5u";
const baseUrl = "https://api.kimi.com/coding/";

if (!authToken) {
  throw new Error(
    "Missing KIMI_API_KEY. Export your Kimi API key before running this demo.",
  );
}

const claude = new ClaudeCode({
  authToken,
  baseUrl,
});

const session = claude.startSession({
  cwd: import.meta.dirname,
  dangerouslySkipPermissions: true,
  rawEventLog: true,
});



const { events } = await session.runStreamed(
  "请简要介绍你当前可用的能力，并说明你正在通过哪个 API base URL 提供服务。",
  {
    failFastOnCliApiError: true,
    onRawEvent(event) {
      console.log('===event===', event)
      switch (event.type) {
        case "stderr_chunk":
          process.stderr.write(`[stderr_chunk] ${event.chunk}`);
          break;
        case "stderr_line":
          console.error("[stderr_line]", event.line);
          break;
        case "process_error":
          console.error("[process_error]", event.error.message);
          break;
        case "exit":
          console.error("[exit]", event.code, event.signal);
          break;
      }
    },
  },
);

let usage: {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
} | null = null;

try {
  for await (const event of events) {
    switch (event.type) {
      case "session_meta":
        console.log("===event===", event.type, event.model);
        break;
      case "text_delta":
        process.stdout.write(event.content);
        break;
      case "thinking_delta":
        console.log("===event===", event.type, event.content);
        break;
      case "error":
        console.error("[relay error]", event.message);
        throw new Error(event.message);
      case "turn_complete":
        usage = {
          costUsd: event.costUsd,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          contextWindow: event.contextWindow,
        };
        break;
    }
  }
} finally {
}

process.stdout.write("\n");
console.log(usage);
console.log(session.id);
