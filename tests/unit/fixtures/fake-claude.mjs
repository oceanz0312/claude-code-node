#!/usr/bin/env node

/**
 * Fake Claude CLI for test purposes.
 * Simulates the claude stream-json protocol used by the SDK.
 */

const args = process.argv.slice(2);
const inputFormat = getArgValue("--input-format");
const { prompt, imageCount } = await readInput();
const sessionId =
  getArgValue("--resume") ?? getArgValue("--session-id") ?? "test-session-001";
const inspectPayload = {
  args,
  cwd: process.cwd(),
  flags: {
    resumeSessionId: getArgValue("--resume"),
    continueSession: args.includes("--continue"),
  },
  input: {
    prompt,
    imageCount,
    inputFormat,
  },
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? null,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? null,
    INSPECT_CUSTOM_ENV: process.env.INSPECT_CUSTOM_ENV ?? null,
    INSPECT_INHERITED_ENV: process.env.INSPECT_INHERITED_ENV ?? null,
  },
};

process.on("SIGINT", () => {
  process.exit(130);
});

if (prompt.includes("__inspect_exec_options__")) {
  emit({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "inspect-exec-options",
    session_id: sessionId,
    inspection: inspectPayload,
    total_cost_usd: 0,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    modelUsage: {},
  });
  process.exit(0);
}

if (prompt.includes("__inspect_session_flags__")) {
  const report = JSON.stringify(inspectPayload.flags);

  emit({
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-sonnet-4-20250514",
    tools: ["Read"],
  });
  emitMessageStart("msg_inspect", sessionId);
  emitTextDelta("msg_inspect", report, sessionId);
  emitAssistantText(report, sessionId, "msg_inspect");
  emitResult(report, sessionId);
  process.exit(0);
}

if (prompt.includes("__inspect_raw_events__")) {
  process.stderr.write("raw stderr line\n");
  emit({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "inspect-raw-events",
    session_id: sessionId,
    total_cost_usd: 0,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    modelUsage: {},
  });
  process.exit(0);
}

if (prompt.includes("__stderr_api_error__")) {
  emit({
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-sonnet-4-20250514",
    tools: ["Read"],
  });
  process.stderr.write(
    'API Error: 502 {"error":{"message":"proxy failed","type":"proxy_error"}}',
  );
  await delay(1500);
  process.exit(1);
}

if (prompt.includes("__stdout_api_retry_auth__")) {
  emit({
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-sonnet-4-20250514",
    tools: ["Read"],
  });
  emit({
    type: "system",
    subtype: "api_retry",
    attempt: 1,
    max_retries: 10,
    retry_delay_ms: 600,
    error_status: 401,
    error: "authentication_failed",
    session_id: sessionId,
  });
  await delay(1500);
  process.exit(1);
}

if (prompt.includes("force-error")) {
  emit({
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-sonnet-4-20250514",
    tools: ["Read", "Write", "Bash"],
  });
  emit({
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Something went wrong",
    session_id: sessionId,
  });
  process.exit(0);
}

if (prompt.includes("slow-run")) {
  emit({
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-sonnet-4-20250514",
    tools: ["Read"],
  });
  emitAssistantThinking("Preparing slow run...", sessionId);
  emitMessageStart("msg_slow", sessionId);
  emitTextDelta("msg_slow", "Still working", sessionId);
  await delay(5000);
  emitResult("slow run done", sessionId);
  process.exit(0);
}

emit({
  type: "system",
  subtype: "init",
  session_id: sessionId,
  model: "claude-sonnet-4-20250514",
  tools: ["Read", "Write", "Bash", "Edit", "Glob", "Grep"],
});

emitAssistantThinking("Let me analyze this...", sessionId);
emitMessageStart("msg_main", sessionId);
emitTextDelta("msg_main", "Here is ", sessionId);
emitTextDelta("msg_main", "my response.", sessionId);
emitToolUse("tool_1", "Read", { file_path: "/tmp/test.txt" }, sessionId);
emitToolResult("tool_1", false, "file contents here", sessionId);
emitAssistantText("Here is my response.", sessionId, "msg_main");
emit({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "Here is my response.",
  session_id: sessionId,
  total_cost_usd: 0.003,
  duration_ms: 1200,
  duration_api_ms: 800,
  num_turns: 1,
  modelUsage: {
    "claude-sonnet-4-20250514": {
      inputTokens: 500,
      outputTokens: 100,
      cacheReadInputTokens: 50,
      cacheCreationInputTokens: 10,
      contextWindow: 200000,
    },
  },
});

process.exit(0);

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function getPromptArg() {
  const index = args.indexOf("-p");
  if (index < 0) {
    return "";
  }

  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    return "";
  }

  return next;
}

async function readInput() {
  const stdinText = await readStdinText();
  if (inputFormat !== "stream-json") {
    return { prompt: getPromptArg(), imageCount: 0 };
  }

  const promptParts = [];
  let imageCount = 0;

  for (const line of stdinText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const content = parsed?.message?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }

      if (block.type === "text" && typeof block.text === "string") {
        promptParts.push(block.text);
        continue;
      }

      if (block.type === "image") {
        imageCount += 1;
      }
    }
  }

  return {
    prompt: promptParts.join("\n\n"),
    imageCount,
  };
}

async function readStdinText() {
  process.stdin.setEncoding("utf8");
  let text = "";

  for await (const chunk of process.stdin) {
    text += chunk;
  }

  return text;
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function emitAssistantThinking(text, sid) {
  emit({
    type: "assistant",
    session_id: sid,
    message: { content: [{ type: "thinking", thinking: text }] },
  });
}

function emitMessageStart(messageId, sid) {
  emit({
    type: "stream_event",
    session_id: sid,
    event: {
      type: "message_start",
      message: { id: messageId, type: "message", role: "assistant", content: [] },
    },
  });
  emit({
    type: "stream_event",
    session_id: sid,
    event: {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
  });
}

function emitTextDelta(messageId, text, sid) {
  emit({
    type: "stream_event",
    session_id: sid,
    event: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text },
      message_id: messageId,
    },
  });
}

function emitToolUse(id, name, input, sid) {
  emit({
    type: "assistant",
    session_id: sid,
    message: { content: [{ type: "tool_use", id, name, input }] },
  });
}

function emitToolResult(tool_use_id, is_error, content, sid) {
  emit({
    type: "user",
    session_id: sid,
    message: {
      content: [{ type: "tool_result", tool_use_id, is_error, content }],
    },
  });
}

function emitAssistantText(text, sid, messageId) {
  emit({
    type: "assistant",
    session_id: sid,
    message: { id: messageId, content: [{ type: "text", text }] },
  });
  emit({
    type: "stream_event",
    session_id: sid,
    event: { type: "message_stop", message_id: messageId },
  });
}

function emitResult(text, sid) {
  emit({
    type: "result",
    subtype: "success",
    is_error: false,
    result: text,
    session_id: sid,
    total_cost_usd: 0.001,
    duration_ms: 500,
    duration_api_ms: 300,
    num_turns: 1,
    modelUsage: {
      "claude-sonnet-4-20250514": {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        contextWindow: 200000,
      },
    },
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
