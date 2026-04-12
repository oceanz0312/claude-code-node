import { describe, test, expect } from "bun:test";
import { ClaudeCodeExec } from "../src/exec.js";
import path from "node:path";

const FAKE_CLAUDE = path.resolve(
  import.meta.dirname,
  "fixtures/fake-claude.mjs",
);

describe("ClaudeCodeExec", () => {
  test("yields NDJSON lines from the fake CLI", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE);
    const lines: string[] = [];

    for await (const line of exec.run({
      input: "hello",
      cliPath: FAKE_CLAUDE,
      sessionOptions: {
        dangerouslySkipPermissions: true,
      },
      resumeSessionId: null,
    })) {
      lines.push(line);
    }

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("type");
    }
  });

  test("passes --resume when resumeSessionId is set", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE);
    const lines: string[] = [];

    for await (const line of exec.run({
      input: "resume test",
      cliPath: FAKE_CLAUDE,
      resumeSessionId: "my-session-123",
      sessionOptions: {
        dangerouslySkipPermissions: true,
      },
    })) {
      lines.push(line);
    }

    const resultLine = lines.find((l) => JSON.parse(l).type === "result");
    expect(resultLine).toBeDefined();
    const result = JSON.parse(resultLine!);
    expect(result.session_id).toBe("my-session-123");
  });

  test("handles error exit from nonexistent CLI", async () => {
    const exec = new ClaudeCodeExec("/nonexistent/binary");

    const promise = (async () => {
      for await (const _line of exec.run({
        input: "test",
        cliPath: "/nonexistent/binary",
        sessionOptions: {},
      })) {
        // consume
      }
    })();

    await expect(promise).rejects.toThrow();
  });
});
