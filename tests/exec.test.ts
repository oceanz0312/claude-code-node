import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { ClaudeCodeExec } from "../src/exec.js";
import type { SessionOptions } from "../src/options.js";

const FAKE_CLAUDE = path.resolve(
  import.meta.dirname,
  "fixtures/fake-claude.mjs",
);

const INSPECT_PROMPT = "__inspect_exec_options__";
const PARENT_ENV_KEY = "INSPECT_INHERITED_ENV";

type Inspection = {
  args: string[];
  flags: {
    resumeSessionId: string | null;
    continueSession: boolean;
  };
  env: {
    ANTHROPIC_API_KEY: string | null;
    INSPECT_CUSTOM_ENV: string | null;
    INSPECT_INHERITED_ENV: string | null;
  };
};

async function inspectExec(options: {
  exec?: ClaudeCodeExec;
  sessionOptions?: SessionOptions;
  resumeSessionId?: string | null;
  continueSession?: boolean;
  images?: string[];
  apiKey?: string;
} = {}): Promise<Inspection> {
  const exec = options.exec ?? new ClaudeCodeExec(FAKE_CLAUDE);
  const lines: string[] = [];

  for await (const line of exec.run({
    input: INSPECT_PROMPT,
    cliPath: FAKE_CLAUDE,
    sessionOptions: options.sessionOptions ?? {},
    resumeSessionId: options.resumeSessionId,
    continueSession: options.continueSession,
    images: options.images,
    apiKey: options.apiKey,
  })) {
    lines.push(line);
  }

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

  beforeEach(() => {
    originalInheritedEnv = process.env[PARENT_ENV_KEY];
  });

  afterEach(() => {
    if (originalInheritedEnv === undefined) {
      delete process.env[PARENT_ENV_KEY];
    } else {
      process.env[PARENT_ENV_KEY] = originalInheritedEnv;
    }
  });

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

  test("enables default streaming flags unless explicitly disabled", async () => {
    const inspection = await inspectExec();

    expect(getFlagValues(inspection.args, "-p")).toEqual([INSPECT_PROMPT]);
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

  test("expands repeated flags for list-style options and images", async () => {
    const inspection = await inspectExec({
      images: ["img-1.png", "img-2.png"],
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
    expect(getFlagValues(inspection.args, "--image")).toEqual([
      "img-1.png",
      "img-2.png",
    ]);
  });

  test("passes scalar flags through and serializes object agents", async () => {
    const inspection = await inspectExec({
      sessionOptions: {
        model: "sonnet",
        cwd: "/repo/project",
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
    expect(getFlagValues(inspection.args, "--cd")).toEqual(["/repo/project"]);
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

    const resultLine = lines.find((line) => JSON.parse(line).type === "result");
    expect(resultLine).toBeDefined();
    const result = JSON.parse(resultLine!);
    expect(result.session_id).toBe("my-session-123");
  });

  test("uses explicit env override without inheriting process.env and injects constructor apiKey", async () => {
    process.env[PARENT_ENV_KEY] = "from-parent";

    const exec = new ClaudeCodeExec(
      FAKE_CLAUDE,
      {
        INSPECT_CUSTOM_ENV: "from-override",
        PATH: process.env.PATH ?? "",
      },
      "constructor-key",
    );

    const inspection = await inspectExec({ exec });

    expect(inspection.env.INSPECT_CUSTOM_ENV).toBe("from-override");
    expect(inspection.env.INSPECT_INHERITED_ENV).toBeNull();
    expect(inspection.env.ANTHROPIC_API_KEY).toBe("constructor-key");
  });

  test("allows per-run apiKey to override constructor apiKey", async () => {
    const exec = new ClaudeCodeExec(FAKE_CLAUDE, undefined, "constructor-key");

    const inspection = await inspectExec({
      exec,
      apiKey: "run-key",
    });

    expect(inspection.env.ANTHROPIC_API_KEY).toBe("run-key");
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
