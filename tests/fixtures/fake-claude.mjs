#!/usr/bin/env node

/**
 * Fake Claude CLI for test purposes.
 * Simulates the `claude -p --output-format stream-json --verbose --include-partial-messages` protocol.
 */

const args = process.argv.slice(2);
const promptIndex = args.indexOf("-p");
const prompt = promptIndex >= 0 ? args[promptIndex + 1] ?? "" : "";
const sessionId =
  getArgValue("--resume") ?? getArgValue("--session-id") ?? "test-session-001";

// Wait for stdin to close (the SDK closes it immediately in -p mode)
await waitForStdinClosed();

process.on("SIGINT", () => {
  process.exit(130);
});

// ─── Error scenario ──────────────────────────────────────────────────────────
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

// ─── Slow scenario (for abort tests) ────────────────────────────────────────
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
  // Wait a long time so the test can abort
  await delay(5000);
  emitResult("slow run done", sessionId);
  process.exit(0);
}

// ─── Normal scenario ────────────────────────────────────────────────────────
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

// Tool use cycle
emitToolUse("tool_1", "Read", { file_path: "/tmp/test.txt" }, sessionId);
emitToolResult("tool_1", false, "file contents here", sessionId);

// Final assistant text
emitAssistantText("Here is my response.", sessionId, "msg_main");

// Result
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
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

function waitForStdinClosed() {
  if (process.stdin.destroyed || process.stdin.readableEnded) {
    return Promise.resolve();
  }
  process.stdin.resume();
  return new Promise((resolve) => {
    const done = () => {
      process.stdin.off("end", done);
      process.stdin.off("close", done);
      resolve();
    };
    process.stdin.on("end", done);
    process.stdin.on("close", done);
  });
}
