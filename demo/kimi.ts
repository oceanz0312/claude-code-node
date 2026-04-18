import { ClaudeCode } from "../src/index.js";
import { secrets } from "../.env.js";

if (!secrets.authToken || !secrets.baseUrl) {
  throw new Error(
    "Missing authToken or baseUrl in .env.ts. Fill them before running this demo.",
  );
}

const claude = new ClaudeCode({
  authToken: secrets.authToken,
  baseUrl: secrets.baseUrl,
});

const session = claude.startSession({
  model: "ep-20250827194109-gmcjr",
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
