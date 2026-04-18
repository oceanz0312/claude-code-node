import { describe, test, expect } from "bun:test";
import { ClaudeCode } from "../../src/claude-code";
import { Session } from "../../src/session";
import { createRawEventLogger } from "../../src/raw-event-log";
import type { RelayEvent } from "claude-code-parser";
import type { RawClaudeEvent } from "../../src/options";
import path from "node:path";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const FAKE_CLAUDE = path.resolve(
  import.meta.dirname,
  "fixtures/fake-claude.mjs",
);
const STDERR_API_ERROR_PROMPT = "__stderr_api_error__";
const STDOUT_API_RETRY_AUTH_PROMPT = "__stdout_api_retry_auth__";

function createTestClient(options: ConstructorParameters<typeof ClaudeCode>[0] = {}) {
  return new ClaudeCode({ cliPath: FAKE_CLAUDE, ...options });
}

class DelayedErrorExec {
  private delayMs: number;
  private error: Error;

  constructor(error: Error, delayMs = 10) {
    this.error = error;
    this.delayMs = delayMs;
  }

  async run(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    throw this.error;
  }
}

class AwaitAbortExec {
  private resolveStarted!: () => void;
  public readonly started: Promise<void>;
  public signal: AbortSignal | undefined;

  constructor() {
    this.started = new Promise((resolve) => {
      this.resolveStarted = resolve;
    });
  }

  async run(args: { signal?: AbortSignal }): Promise<void> {
    this.signal = args.signal;
    this.resolveStarted();

    if (!args.signal) {
      return;
    }

    await new Promise<void>((resolve) => {
      if (args.signal?.aborted) {
        resolve();
        return;
      }

      args.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  }
}

class ManualAbortSignal extends EventTarget {
  public aborted = false;
  public reason: unknown = undefined;
  public addCount = 0;
  public removeCount = 0;

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (type === "abort") {
      this.addCount += 1;
    }

    super.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (type === "abort") {
      this.removeCount += 1;
    }

    super.removeEventListener(type, listener, options);
  }

  abort(reason?: unknown): void {
    this.aborted = true;
    this.reason = reason;
    this.dispatchEvent(new Event("abort"));
  }
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

  test("can fail fast on fatal CLI API errors written to stderr", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const start = Date.now();
    await expect(
      session.run(STDERR_API_ERROR_PROMPT, {
        failFastOnCliApiError: true,
      }),
    ).rejects.toThrow("API Error: 502");
    const durationMs = Date.now() - start;

    expect(durationMs).toBeLessThan(1000);
  });

  test("can fail fast on fatal CLI api_retry events written to stdout", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const start = Date.now();
    await expect(
      session.run(STDOUT_API_RETRY_AUTH_PROMPT, {
        failFastOnCliApiError: true,
      }),
    ).rejects.toThrow("authentication_failed");
    const durationMs = Date.now() - start;

    expect(durationMs).toBeLessThan(1000);
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

  test("can surface fatal CLI API stderr as a RelayEvent error", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const { events } = await session.runStreamed(STDERR_API_ERROR_PROMPT, {
      failFastOnCliApiError: true,
    });

    const start = Date.now();
    const collected: RelayEvent[] = [];
    for await (const event of events) {
      collected.push(event);
    }
    const durationMs = Date.now() - start;

    expect(durationMs).toBeLessThan(1000);
    expect(collected.some((event) => event.type === "error")).toBe(true);

    const errorEvent = collected.find((event) => event.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "error") {
      expect(errorEvent.message).toContain("API Error: 502");
      expect(errorEvent.sessionId).toBe("test-session-001");
    }
  });

  test("can surface fatal CLI api_retry stdout events as a RelayEvent error", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const { events } = await session.runStreamed(STDOUT_API_RETRY_AUTH_PROMPT, {
      failFastOnCliApiError: true,
    });

    const start = Date.now();
    const collected: RelayEvent[] = [];
    for await (const event of events) {
      collected.push(event);
    }
    const durationMs = Date.now() - start;

    expect(durationMs).toBeLessThan(1000);

    const errorEvent = collected.find((event) => event.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "error") {
      expect(errorEvent.message).toContain("authentication_failed");
      expect(errorEvent.message).toContain("status 401");
      expect(errorEvent.sessionId).toBe("test-session-001");
    }
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

  test("sends local_image items through stream-json stdin instead of --image", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const rawStdoutLines: string[] = [];
    const imagePath = path.resolve(
      import.meta.dirname,
      "../e2e/fixtures/images/red-square.png",
    );

    await session.run(
      [
        { type: "text", text: "__inspect_exec_options__" },
        { type: "local_image", path: imagePath },
      ],
      {
        onRawEvent: (event) => {
          if (event.type === "stdout_line") {
            rawStdoutLines.push(event.line);
          }
        },
      },
    );

    const resultLine = rawStdoutLines.find(
      (line) => JSON.parse(line).type === "result",
    );
    expect(resultLine).toBeDefined();

    const inspection = JSON.parse(resultLine!).inspection as {
      args: string[];
      input: { imageCount: number; prompt: string; inputFormat: string | null };
    };

    expect(inspection.args).toContain("--input-format");
    expect(inspection.args).not.toContain("--image");
    expect(inspection.input.inputFormat).toBe("stream-json");
    expect(inspection.input.imageCount).toBe(1);
    expect(inspection.input.prompt).toBe("__inspect_exec_options__");
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

describe("Session global options", () => {
  test("passes only explicit env from ClaudeCodeOptions into the CLI process", async () => {
    const claude = createTestClient({
      apiKey: "global-key",
      authToken: "global-token",
      baseUrl: "https://global.example.com",
    });
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const rawStdoutLines: string[] = [];
    const { events } = await session.runStreamed("__inspect_exec_options__", {
      onRawEvent: (event) => {
        if (event.type === "stdout_line") {
          rawStdoutLines.push(event.line);
        }
      },
    });

    for await (const _event of events) {
      // consume
    }

    const resultLine = rawStdoutLines.find(
      (line) => JSON.parse(line).type === "result",
    );
    expect(resultLine).toBeDefined();

    const inspection = JSON.parse(resultLine!).inspection;
    expect(inspection.env.ANTHROPIC_API_KEY).toBe("global-key");
    expect(inspection.env.ANTHROPIC_AUTH_TOKEN).toBe("global-token");
    expect(inspection.env.ANTHROPIC_BASE_URL).toBe(
      "https://global.example.com",
    );
  });
});

describe("Raw Claude events", () => {
  test("forwards TurnOptions.onRawEvent through runStreamed", async () => {
    const claude = createTestClient();
    const session = claude.startSession({
      dangerouslySkipPermissions: true,
    });

    const rawEvents: RawClaudeEvent[] = [];
    const { events } = await session.runStreamed("__inspect_raw_events__", {
      onRawEvent: (event) => {
        rawEvents.push(event);
      },
    });

    for await (const _event of events) {
      // consume
    }

    expect(rawEvents.some((event) => event.type === "stdout_line")).toBe(true);
    expect(rawEvents.some((event) => event.type === "stderr_line")).toBe(true);
  });

  test("writes raw event logs as NDJSON when enabled", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agent-sdk-raw-events-"));

    try {
      const claude = createTestClient();
      const session = claude.startSession({
        dangerouslySkipPermissions: true,
        rawEventLog: tempDir,
      });

      const { events } = await session.runStreamed("__inspect_raw_events__");

      for await (const _event of events) {
        // consume
      }

      const files = await readdir(tempDir);
      expect(files.length).toBe(1);

      const logPath = path.join(tempDir, files[0]!);
      const logText = await readFile(logPath, "utf8");
      const records = logText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as {
          timestamp: string;
          event: RawClaudeEvent;
        });

      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => typeof record.timestamp === "string")).toBe(
        true,
      );

      const eventTypes = records.map((record) => record.event.type);
      expect(eventTypes).toContain("spawn");
      expect(eventTypes).toContain("stdout_line");
      expect(eventTypes).toContain("stderr_chunk");
      expect(eventTypes).toContain("stderr_line");
      expect(eventTypes).toContain("exit");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Session internal branches", () => {
  test("rejects a pending streamed iterator when processing fails", async () => {
    const session = new Session(
      new DelayedErrorExec(new Error("delayed stream failure")) as never,
      {},
      {},
    );

    const { events } = await session.runStreamed("hello");
    const iterator = events[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow("delayed stream failure");
  });

  test("merges abort signals without a reason and cleans up listeners", async () => {
    const exec = new AwaitAbortExec();
    const session = new Session(exec as never, {}, {});
    const externalSignal = new ManualAbortSignal();

    const runPromise = session.run("hello", {
      signal: externalSignal as never,
      failFastOnCliApiError: true,
    });

    await exec.started;
    expect(externalSignal.addCount).toBe(1);

    externalSignal.abort();

    const turn = await runPromise;
    expect(turn.finalResponse).toBe("");
    expect(turn.events).toEqual([]);
    expect(exec.signal?.aborted).toBe(true);
    expect(externalSignal.removeCount).toBe(1);
  });

  test("preserves abort reasons when merging abort signals", async () => {
    const exec = new AwaitAbortExec();
    const session = new Session(exec as never, {}, {});
    const externalSignal = new ManualAbortSignal();

    const runPromise = session.run("hello", {
      signal: externalSignal as never,
      failFastOnCliApiError: true,
    });

    await exec.started;
    externalSignal.abort("manual-stop");

    await runPromise;

    expect(
      (exec.signal as AbortSignal & { reason?: unknown }).reason,
    ).toBe("manual-stop");
  });
});

describe("Raw event logger", () => {
  test("rejects relative rawEventLog paths", async () => {
    await expect(createRawEventLogger("relative/raw-events")).rejects.toThrow(
      'rawEventLog path must be an absolute path, got: "relative/raw-events"',
    );
  });

  test("uses the default agent_logs directory and serializes process errors", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agent-sdk-default-log-"));
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const logger = await createRawEventLogger(true);
      logger.log({
        type: "process_error",
        error: new Error("raw logger boom"),
      });
      await logger.close();
      logger.log({ type: "spawn", command: "ignored", args: [] });
      await logger.close();

      const logDir = path.join(tempDir, "agent_logs");
      const files = await readdir(logDir);
      expect(files.length).toBe(1);

      const logText = await readFile(path.join(logDir, files[0]!), "utf8");
      const [record] = logText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as {
          timestamp: string;
          event: {
            type: string;
            error?: { name: string; message: string; stack?: string };
          };
        });

      expect(typeof record?.timestamp).toBe("string");
      expect(record?.event.type).toBe("process_error");
      expect(record?.event.error?.name).toBe("Error");
      expect(record?.event.error?.message).toBe("raw logger boom");
      expect(record?.event.error?.stack).toContain("raw logger boom");
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("waits for drain before closing after a backpressured write", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agent-sdk-drain-log-"));

    try {
      const logger = await createRawEventLogger(tempDir);
      logger.log({
        type: "stderr_chunk",
        chunk: "x".repeat(1024 * 1024),
      });
      await logger.close();

      const files = await readdir(tempDir);
      expect(files.length).toBe(1);

      const logText = await readFile(path.join(tempDir, files[0]!), "utf8");
      expect(logText).toContain('"type":"stderr_chunk"');
      expect(logText.length).toBeGreaterThan(1024 * 1024);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("rethrows fatal stream errors captured before close completes", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agent-sdk-close-error-"));
    const RealDate = Date;
    const realRandom = Math.random;

    class FixedDate extends Date {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super("2026-01-02T03:04:05.678Z");
          return;
        }

        super(args[0]);
      }

      static now(): number {
        return new RealDate("2026-01-02T03:04:05.678Z").valueOf();
      }
    }

    try {
      globalThis.Date = FixedDate as DateConstructor;
      Math.random = () => 0.123456789;

      const randomSuffix = (0.123456789).toString(36).slice(2, 8);
      const blockedPath = path.join(
        tempDir,
        `claude-raw-events-2026-01-02T03-04-05-678Z-${process.pid}-${randomSuffix}.ndjson`,
      );
      await mkdir(blockedPath, { recursive: true });

      const logger = await createRawEventLogger(tempDir);
      logger.log({ type: "spawn", command: "claude", args: [] });

      await expect(logger.close()).rejects.toThrow("EISDIR");
    } finally {
      globalThis.Date = RealDate;
      Math.random = realRandom;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("throws close errors when the underlying stream cannot open", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "agent-sdk-error-log-"));

    try {
      await chmod(tempDir, 0o500);

      const logger = await createRawEventLogger(tempDir);
      logger.log({ type: "spawn", command: "claude", args: [] });

      await expect(logger.close()).rejects.toThrow();
    } finally {
      await chmod(tempDir, 0o700).catch(() => {});
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
