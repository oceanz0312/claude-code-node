import { describe, test, expect } from "bun:test";
import { ClaudeCode } from "../src/claude-code.js";
import type { RelayEvent } from "claude-code-parser";
import path from "node:path";

const FAKE_CLAUDE = path.resolve(
  import.meta.dirname,
  "fixtures/fake-claude.mjs",
);

function createTestClient() {
  return new ClaudeCode({ cliPath: FAKE_CLAUDE });
}

describe("Session.run()", () => {
  test("returns a complete Turn with finalResponse and usage", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const turn = await session.run("hello world");

    expect(turn.finalResponse).toBe("Here is my response.");
    expect(turn.events.length).toBeGreaterThan(0);
    expect(turn.sessionId).toBe("test-session-001");
    expect(turn.usage).not.toBeNull();
    expect(turn.usage?.costUsd).toBeGreaterThan(0);
    expect(turn.usage?.inputTokens).toBeGreaterThan(0);
    expect(turn.usage?.outputTokens).toBeGreaterThan(0);
  });

  test("captures session ID from session_meta", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    await session.run("hello");

    expect(session.id).toBe("test-session-001");
  });

  test("throws on error response", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    await expect(session.run("force-error")).rejects.toThrow("Something went wrong");
  });

  test("supports multi-turn via automatic --resume", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const first = await session.run("__inspect_session_flags__");
    expect(first.sessionId).toBe("test-session-001");
    expect(session.id).toBe("test-session-001");
    expect(JSON.parse(first.finalResponse)).toEqual({
      resumeSessionId: null,
      continueSession: false,
    });

    const second = await session.run("__inspect_session_flags__");
    expect(second.sessionId).toBe("test-session-001");
    expect(JSON.parse(second.finalResponse)).toEqual({
      resumeSessionId: "test-session-001",
      continueSession: false,
    });
  });
});

describe("Session.runStreamed()", () => {
  test("yields RelayEvents as AsyncGenerator", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const { events } = await session.runStreamed("hello world");

    const collected: RelayEvent[] = [];
    for await (const event of events) {
      collected.push(event);
    }

    expect(collected.length).toBeGreaterThan(0);

    // Should have different event types
    const types = new Set(collected.map((e) => e.type));
    expect(types.has("session_meta")).toBe(true);
    expect(types.has("turn_complete")).toBe(true);
  });

  test("streams text_delta events incrementally", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const { events } = await session.runStreamed("hello world");
    const textDeltas: string[] = [];

    for await (const event of events) {
      if (event.type === "text_delta") {
        textDeltas.push(event.content);
      }
    }

    expect(textDeltas).toEqual(["Here is ", "my response."]);
    expect(textDeltas.join("")).toBe("Here is my response.");
  });

  test("streams tool_use and tool_result events", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const { events } = await session.runStreamed("hello world");
    let hasToolUse = false;
    let hasToolResult = false;

    for await (const event of events) {
      if (event.type === "tool_use") hasToolUse = true;
      if (event.type === "tool_result") hasToolResult = true;
    }

    expect(hasToolUse).toBe(true);
    expect(hasToolResult).toBe(true);
  });
});

describe("Session resumeSession()", () => {
  test("resumes with given session ID", async () => {
    const claude = createTestClient();
    const session = claude.resumeSession("my-custom-session", {
      dangerouslySkipPermissions: true,
    });

    const turn = await session.run("continue");

    // The fake-claude uses --resume value as session_id
    expect(turn.sessionId).toBe("my-custom-session");
  });
});

describe("Session continueSession()", () => {
  test("uses --continue flag", async () => {
    const claude = createTestClient();
    const session = claude.continueSession({
      dangerouslySkipPermissions: true,
    });

    // The fake-claude doesn't check --continue specifically, but this verifies
    // the code path doesn't crash and produces valid output
    const turn = await session.run("continue from last");
    expect(turn.finalResponse).toBeTruthy();
  });
});

describe("Structured input", () => {
  test("accepts UserInput array with text", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const turn = await session.run([
      { type: "text", text: "First part" },
      { type: "text", text: "Second part" },
    ]);

    expect(turn.finalResponse).toBeTruthy();
  });
});

describe("AbortSignal", () => {
  test("aborts a running session", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const controller = new AbortController();
    // Abort after 100ms
    setTimeout(() => controller.abort(), 100);

    const promise = session.run("slow-run", {
      signal: controller.signal,
    });

    await expect(promise).rejects.toThrow();
  });
});
