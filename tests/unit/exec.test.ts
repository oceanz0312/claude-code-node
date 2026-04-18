import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { ClaudeCodeExec } from "../../src/exec";
import type { RawClaudeEvent, SessionOptions } from "../../src/options";

const FAKE_CLAUDE = path.resolve(
  import.meta.dirname,
  "fixtures/fake-claude.mjs",
);
const TEST_CWD = path.resolve(import.meta.dirname);
const RED_SQUARE_IMAGE = path.resolve(
  import.meta.dirname,
  "../e2e/fixtures/images/red-square.png",
);
const SHAPES_IMAGE = path.resolve(
  import.meta.dirname,
  "../e2e/fixtures/images/shapes-demo.png",
);
const INSPECT_PROMPT = "__inspect_exec_options__";
const RAW_EVENTS_PROMPT = "__inspect_raw_events__";
const PARENT_ENV_KEY = "INSPECT_INHERITED_ENV";

type Inspection = {
  args: string[];
  cwd: string;
  flags: {
    resumeSessionId: string | null;
    continueSession: boolean;
  };
  input: {
    prompt: string;
    imageCount: number;
    inputFormat: string | null;
  };
  env: {
    ANTHROPIC_API_KEY: string | null;
    ANTHROPIC_AUTH_TOKEN: string | null;
    ANTHROPIC_BASE_URL: string | null;
    INSPECT_CUSTOM_ENV: string | null;
    INSPECT_INHERITED_ENV: string | null;
  };
};

const EXPLICIT_API_KEY = "explicit-api-key";
const EXPLICIT_AUTH_TOKEN = "explicit-auth-token";
const EXPLICIT_BASE_URL = "https://explicit.example.com";

async function inspectExec(options: {
  exec?: ClaudeCodeExec;
  sessionOptions?: SessionOptions;
  resumeSessionId?: string | null;
  continueSession?: boolean;
  images?: string[];
  inputItems?: Array<{ type: "text"; text: string } | { type: "local_image"; path: string }>;
  env?: Record<string, string>;
} = {}): Promise<Inspection> {
  const exec = options.exec ?? new ClaudeCodeExec(FAKE_CLAUDE);
  const lines: string[] = [];

  await exec.run({
    input: INSPECT_PROMPT,
    cliPath: FAKE_CLAUDE,
    sessionOptions: options.sessionOptions ?? {},
    resumeSessionId: options.resumeSessionId,
    continueSession: options.continueSession,
    images: options.images,
    inputItems: options.inputItems,
    env: options.env,
    onLine: (line) => { lines.push(line); },
  });

  const resultLine = lines.find((line) => JSON.parse(line).type === "result");
  if (!resultLine) {
    throw new Error("Missing result line from fake CLI");
  }

  return JSON.parse(resultLine).inspection as Inspection;
}

function getFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]!);
    }
  }

  return values;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

describe("ClaudeCodeExec", () => {
  let originalInheritedEnv: string | undefined;
  let originalAnthropicApiKey: string | undefined;
  let originalAnthropicAuthToken: string | undefined;
  let originalAnthropicBaseUrl: string | undefined;

  beforeEach(() => {
    originalInheritedEnv = process.env[PARENT_ENV_KEY];
    originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
    originalAnthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
    originalAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
  });

  afterEach(() => {
    if (originalInheritedEnv === undefined) {
      delete process.env[PARENT_ENV_KEY];
    } else {
      process.env[PARENT_ENV_KEY] = originalInheritedEnv;
    }

    if (originalAnthropicApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
    }

    if (originalAnthropicAuthToken === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = originalAnthropicAuthToken;
    }

    if (originalAnthropicBaseUrl === undefined) {
      delete process.env.ANTHROPIC_BASE_URL;
    } else {
      process.env.ANTHROPIC_BASE_URL = originalAnthropicBaseUrl;
    }
  });

  test("yields NDJSON lines from the fake CLI", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE);
    const lines: string[] = [];

    await exec.run({
      input: "hello",
      cliPath: FAKE_CLAUDE,
      sessionOptions: {
        dangerouslySkipPermissions: true,
      },
      resumeSessionId: null,
      onLine: (line) => { lines.push(line); },
    });

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("type");
    }
  });

  test("enables default streaming flags unless explicitly disabled", async () => {
    const inspection = await inspectExec();

    expect(getFlagValues(inspection.args, "-p")).toEqual([INSPECT_PROMPT]);
    expect(getFlagValues(inspection.args, "--input-format")).toEqual([]);
    expect(getFlagValues(inspection.args, "--output-format")).toEqual([
      "stream-json",
    ]);
    expect(hasFlag(inspection.args, "--verbose")).toBe(true);
    expect(hasFlag(inspection.args, "--include-partial-messages")).toBe(true);
  });

  test("omits default-on flags when verbose and partial messages are disabled", async () => {
    const inspection = await inspectExec({
      sessionOptions: {
        verbose: false,
        includePartialMessages: false,
      },
    });

    expect(hasFlag(inspection.args, "--verbose")).toBe(false);
    expect(hasFlag(inspection.args, "--include-partial-messages")).toBe(false);
  });

  test("applies precedence for continue, permission mode, and system prompt source", async () => {
    const inspection = await inspectExec({
      continueSession: true,
      resumeSessionId: "resume-me",
      sessionOptions: {
        systemPrompt: "inline prompt",
        systemPromptFile: "/tmp/system-prompt.txt",
        permissionMode: "plan",
        dangerouslySkipPermissions: true,
      },
    });

    expect(hasFlag(inspection.args, "--continue")).toBe(true);
    expect(getFlagValues(inspection.args, "--resume")).toEqual([]);
    expect(getFlagValues(inspection.args, "--system-prompt")).toEqual([
      "inline prompt",
    ]);
    expect(getFlagValues(inspection.args, "--system-prompt-file")).toEqual([]);
    expect(hasFlag(inspection.args, "--dangerously-skip-permissions")).toBe(
      true,
    );
    expect(getFlagValues(inspection.args, "--permission-mode")).toEqual([]);
  });

  test("expands repeated flags for list-style options and uses stream-json stdin for images", async () => {
    const inspection = await inspectExec({
      inputItems: [
        { type: "text", text: INSPECT_PROMPT },
        { type: "local_image", path: RED_SQUARE_IMAGE },
        { type: "local_image", path: SHAPES_IMAGE },
      ],
      sessionOptions: {
        additionalDirectories: ["/repo/packages/a", "/repo/packages/b"],
        allowedTools: ["Read", "Edit"],
        disallowedTools: ["Bash", "Write"],
        mcpConfig: ["mcp-a.json", "mcp-b.json"],
        pluginDir: ["plugins/a", "plugins/b"],
      },
    });

    expect(getFlagValues(inspection.args, "--add-dir")).toEqual([
      "/repo/packages/a",
      "/repo/packages/b",
    ]);
    expect(getFlagValues(inspection.args, "--allowedTools")).toEqual([
      "Read",
      "Edit",
    ]);
    expect(getFlagValues(inspection.args, "--disallowedTools")).toEqual([
      "Bash",
      "Write",
    ]);
    expect(getFlagValues(inspection.args, "--mcp-config")).toEqual([
      "mcp-a.json",
      "mcp-b.json",
    ]);
    expect(getFlagValues(inspection.args, "--plugin-dir")).toEqual([
      "plugins/a",
      "plugins/b",
    ]);
    expect(getFlagValues(inspection.args, "--input-format")).toEqual([
      "stream-json",
    ]);
    expect(getFlagValues(inspection.args, "-p")).toEqual(["--input-format"]);
    expect(inspection.input.prompt).toBe(INSPECT_PROMPT);
    expect(inspection.input.imageCount).toBe(2);
    expect(inspection.input.inputFormat).toBe("stream-json");
  });

  test("passes scalar flags through and serializes object agents", async () => {
    const inspection = await inspectExec({
      sessionOptions: {
        model: "sonnet",
        cwd: TEST_CWD,
        maxTurns: 7,
        maxBudgetUsd: 1.5,
        appendSystemPrompt: "append this",
        appendSystemPromptFile: "/tmp/append.txt",
        tools: "Read,Write",
        permissionPromptTool: "mcp__permissions__prompt",
        mcpConfig: "mcp-single.json",
        strictMcpConfig: true,
        effort: "max",
        fallbackModel: "opus",
        bare: true,
        noSessionPersistence: true,
        chrome: false,
        agents: {
          reviewer: {
            description: "Review code changes",
            tools: ["Read"],
            maxTurns: 2,
          },
        },
        agent: "reviewer",
        name: "review session",
        settings: "{\"source\":\"test\"}",
        settingSources: "user,project",
        includeHookEvents: true,
        betas: "beta-one,beta-two",
        worktree: "feature/review",
        disableSlashCommands: true,
        excludeDynamicSystemPromptSections: true,
        debug: "sdk",
        debugFile: "/tmp/claude-debug.log",
      },
    });

    expect(getFlagValues(inspection.args, "--model")).toEqual(["sonnet"]);
    expect(getFlagValues(inspection.args, "--cd")).toEqual([]);
    expect(inspection.cwd).toBe(TEST_CWD);
    expect(getFlagValues(inspection.args, "--max-turns")).toEqual(["7"]);
    expect(getFlagValues(inspection.args, "--max-budget-usd")).toEqual([
      "1.5",
    ]);
    expect(getFlagValues(inspection.args, "--append-system-prompt")).toEqual([
      "append this",
    ]);
    expect(
      getFlagValues(inspection.args, "--append-system-prompt-file"),
    ).toEqual(["/tmp/append.txt"]);
    expect(getFlagValues(inspection.args, "--tools")).toEqual(["Read,Write"]);
    expect(
      getFlagValues(inspection.args, "--permission-prompt-tool"),
    ).toEqual(["mcp__permissions__prompt"]);
    expect(getFlagValues(inspection.args, "--mcp-config")).toEqual([
      "mcp-single.json",
    ]);
    expect(hasFlag(inspection.args, "--strict-mcp-config")).toBe(true);
    expect(getFlagValues(inspection.args, "--effort")).toEqual(["max"]);
    expect(getFlagValues(inspection.args, "--fallback-model")).toEqual([
      "opus",
    ]);
    expect(hasFlag(inspection.args, "--bare")).toBe(true);
    expect(hasFlag(inspection.args, "--no-session-persistence")).toBe(true);
    expect(hasFlag(inspection.args, "--no-chrome")).toBe(true);
    expect(getFlagValues(inspection.args, "--agent")).toEqual(["reviewer"]);
    expect(getFlagValues(inspection.args, "--name")).toEqual([
      "review session",
    ]);
    expect(getFlagValues(inspection.args, "--settings")).toEqual([
      "{\"source\":\"test\"}",
    ]);
    expect(getFlagValues(inspection.args, "--setting-sources")).toEqual([
      "user,project",
    ]);
    expect(hasFlag(inspection.args, "--include-hook-events")).toBe(true);
    expect(getFlagValues(inspection.args, "--betas")).toEqual([
      "beta-one,beta-two",
    ]);
    expect(getFlagValues(inspection.args, "--worktree")).toEqual([
      "feature/review",
    ]);
    expect(hasFlag(inspection.args, "--disable-slash-commands")).toBe(true);
    expect(
      hasFlag(inspection.args, "--exclude-dynamic-system-prompt-sections"),
    ).toBe(true);
    expect(getFlagValues(inspection.args, "--debug")).toEqual(["sdk"]);
    expect(getFlagValues(inspection.args, "--debug-file")).toEqual([
      "/tmp/claude-debug.log",
    ]);

    const [agentsJson] = getFlagValues(inspection.args, "--agents");
    expect(agentsJson).toBeDefined();
    expect(JSON.parse(agentsJson!)).toEqual({
      reviewer: {
        description: "Review code changes",
        tools: ["Read"],
        maxTurns: 2,
      },
    });
  });

  test("supports chrome, debug, and agents string forms", async () => {
    const rawAgents = "{\"worker\":{\"model\":\"sonnet\"}}";
    const inspection = await inspectExec({
      sessionOptions: {
        chrome: true,
        debug: true,
        agents: rawAgents,
      },
    });

    expect(hasFlag(inspection.args, "--chrome")).toBe(true);
    expect(hasFlag(inspection.args, "--no-chrome")).toBe(false);
    expect(hasFlag(inspection.args, "--debug")).toBe(true);
    expect(getFlagValues(inspection.args, "--agents")).toEqual([rawAgents]);
  });

  test("passes --resume when resumeSessionId is set", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE);
    const lines: string[] = [];

    await exec.run({
      input: "resume test",
      cliPath: FAKE_CLAUDE,
      resumeSessionId: "my-session-123",
      sessionOptions: {
        dangerouslySkipPermissions: true,
      },
      onLine: (line) => { lines.push(line); },
    });

    const resultLine = lines.find((line) => JSON.parse(line).type === "result");
    expect(resultLine).toBeDefined();
    const result = JSON.parse(resultLine!);
    expect(result.session_id).toBe("my-session-123");
  });

  test("emits raw process events including stdout and stderr chunks/lines", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE);
    const rawEvents: RawClaudeEvent[] = [];

    const lines: string[] = [];
    await exec.run({
      input: RAW_EVENTS_PROMPT,
      cliPath: FAKE_CLAUDE,
      sessionOptions: {},
      onRawEvent: (event) => {
        rawEvents.push(event);
      },
      onLine: (line) => { lines.push(line); },
    });

    const eventTypes = rawEvents.map((event) => event.type);
    expect(eventTypes).toContain("spawn");
    expect(eventTypes).toContain("stdin_closed");
    expect(eventTypes).toContain("stdout_line");
    expect(eventTypes).toContain("stderr_chunk");
    expect(eventTypes).toContain("stderr_line");
    expect(eventTypes).toContain("exit");

    const spawnEvent = rawEvents.find((event) => event.type === "spawn");
    expect(spawnEvent).toBeDefined();
    if (spawnEvent?.type === "spawn") {
      expect(spawnEvent.command).toBe(FAKE_CLAUDE);
      expect(spawnEvent.args).toContain(RAW_EVENTS_PROMPT);
    }

    const stdoutLine = rawEvents.find((event) => event.type === "stdout_line");
    expect(stdoutLine).toBeDefined();
    if (stdoutLine?.type === "stdout_line") {
      expect(JSON.parse(stdoutLine.line).type).toBe("result");
    }

    const stderrChunk = rawEvents.find((event) => event.type === "stderr_chunk");
    expect(stderrChunk).toBeDefined();
    if (stderrChunk?.type === "stderr_chunk") {
      expect(stderrChunk.chunk).toBe("raw stderr line\n");
    }

    const stderrLine = rawEvents.find((event) => event.type === "stderr_line");
    expect(stderrLine).toBeDefined();
    if (stderrLine?.type === "stderr_line") {
      expect(stderrLine.line).toBe("raw stderr line");
    }

    const exitEvent = rawEvents.find((event) => event.type === "exit");
    expect(exitEvent).toBeDefined();
    if (exitEvent?.type === "exit") {
      expect(exitEvent.code).toBe(0);
      expect(exitEvent.signal).toBeNull();
    }

    expect(lines).toHaveLength(1);
  });

  test("uses explicit env override without inheriting process.env", async () => {
    process.env[PARENT_ENV_KEY] = "from-parent";
    process.env.ANTHROPIC_API_KEY = "from-parent-api-key";
    process.env.ANTHROPIC_AUTH_TOKEN = "from-parent-auth-token";
    process.env.ANTHROPIC_BASE_URL = "https://from-parent.example.com";

    const exec = new ClaudeCodeExec(
      FAKE_CLAUDE,
      {
        INSPECT_CUSTOM_ENV: "from-override",
        ANTHROPIC_API_KEY: EXPLICIT_API_KEY,
        ANTHROPIC_AUTH_TOKEN: EXPLICIT_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: EXPLICIT_BASE_URL,
      },
    );

    const inspection = await inspectExec({ exec });

    expect(inspection.env.INSPECT_CUSTOM_ENV).toBe("from-override");
    expect(inspection.env.INSPECT_INHERITED_ENV).toBeNull();
    expect(inspection.env.ANTHROPIC_API_KEY).toBe(EXPLICIT_API_KEY);
    expect(inspection.env.ANTHROPIC_AUTH_TOKEN).toBe(EXPLICIT_AUTH_TOKEN);
    expect(inspection.env.ANTHROPIC_BASE_URL).toBe(EXPLICIT_BASE_URL);
  });

  test("allows per-run env to override constructor env", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE, {
      ANTHROPIC_API_KEY: "constructor-key",
      ANTHROPIC_AUTH_TOKEN: "constructor-token",
      ANTHROPIC_BASE_URL: "https://constructor.example.com",
    });

    const inspection = await inspectExec({
      exec,
      env: {
        ANTHROPIC_API_KEY: "run-key",
        ANTHROPIC_AUTH_TOKEN: "run-token",
        ANTHROPIC_BASE_URL: "https://run.example.com",
      },
    });

    expect(inspection.env.ANTHROPIC_API_KEY).toBe("run-key");
    expect(inspection.env.ANTHROPIC_AUTH_TOKEN).toBe("run-token");
    expect(inspection.env.ANTHROPIC_BASE_URL).toBe("https://run.example.com");
  });

  test("does not inherit global env when no explicit env is provided", async () => {
    process.env[PARENT_ENV_KEY] = "from-parent";
    process.env.ANTHROPIC_API_KEY = "from-parent-api-key";
    process.env.ANTHROPIC_AUTH_TOKEN = "from-parent-auth-token";
    process.env.ANTHROPIC_BASE_URL = "https://from-parent.example.com";

    const inspection = await inspectExec({
      exec: new ClaudeCodeExec(FAKE_CLAUDE),
    });

    expect(inspection.env.INSPECT_INHERITED_ENV).toBeNull();
    expect(inspection.env.ANTHROPIC_API_KEY).toBeNull();
    expect(inspection.env.ANTHROPIC_AUTH_TOKEN).toBeNull();
    expect(inspection.env.ANTHROPIC_BASE_URL).toBeNull();
  });

  test("merges constructor env with per-run env without credential mutual exclusion", async () => {
    const exec = new ClaudeCodeExec(
      FAKE_CLAUDE,
      {
        ANTHROPIC_API_KEY: "env-key",
        ANTHROPIC_AUTH_TOKEN: "env-token",
        ANTHROPIC_BASE_URL: "https://env.example.com",
        INSPECT_CUSTOM_ENV: "from-constructor",
      },
    );

    const inspection = await inspectExec({
      exec,
      env: {
        INSPECT_CUSTOM_ENV: "from-run",
      },
    });

    expect(inspection.env.ANTHROPIC_API_KEY).toBe("env-key");
    expect(inspection.env.ANTHROPIC_AUTH_TOKEN).toBe("env-token");
    expect(inspection.env.ANTHROPIC_BASE_URL).toBe("https://env.example.com");
    expect(inspection.env.INSPECT_CUSTOM_ENV).toBe("from-run");
  });

});
