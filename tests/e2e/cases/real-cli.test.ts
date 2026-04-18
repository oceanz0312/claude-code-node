import { describe, expect, test } from "bun:test";
import path from "node:path";
import { ClaudeCode } from "../../../src/index.ts";
import {
  cleanupPath,
  createEmptyPluginDir,
  createTempWorkspace,
  executeBufferedCase,
  executeStreamedCase,
  getFlagValues,
  getSpawnEvent,
  hasFlag,
  parseJsonResponse,
  readDebugFile,
  writeProbeFile,
  writePromptFile,
} from "../harness.ts";
import {
  getClientOptions,
  listAvailableAuthModes,
  loadE2EConfig,
  type AuthMode,
} from "../config.ts";

type AuthResponse = {
  auth_mode: string;
  status: string;
  short_answer: string;
};

type MemoryResponse = {
  remembered: string;
};

type ImageResponse = {
  dominant_color?: string;
  shape?: string;
  confidence?: string;
  shape_count?: number;
  shapes?: string[];
  snippet?: string;
};

const imageDir = path.resolve(import.meta.dirname, "../fixtures/images");
const redSquarePath = path.join(imageDir, "red-square.png");
const shapesDemoPath = path.join(imageDir, "shapes-demo.png");
const receiptDemoPath = path.join(imageDir, "receipt-demo.png");

const configState = await initializeConfigState();


async function requireAuthModes(): Promise<AuthMode[]> {
  if (configState.error) {
    throw configState.error;
  }

  if (configState.authModes.length === 0) {
    throw new Error(
      "No real E2E auth path is configured. Fill apiKey or authToken + baseUrl in tests/e2e/local.secrets.ts before running bun run test:e2e.",
    );
  }

  return configState.authModes;
}

if (configState.error) {
  describe("Real Claude CLI E2E setup", () => {
    test("requires tests/e2e/local.secrets.ts", () => {
      throw configState.error;
    });
  });
} else {
  describe("Real Claude CLI E2E config", () => {
    test("loads local secrets and default session settings", async () => {
      const config = await loadE2EConfig();

      expect(config.model.length).toBeGreaterThan(0);
      expect(config.defaultSessionOptions.bare).toBe(true);
      expect(config.defaultSessionOptions.settingSources).toBe("");
      expect(config.defaultSessionOptions.includePartialMessages).toBe(true);
    });
  });

  describe("Real Claude CLI auth paths", () => {
  test("runs the apiKey path through ClaudeCode options when configured", async () => {
    const modes = await requireAuthModes();
    if (!modes.includes("api-key")) {
      return;
    }

    const result = await executeBufferedCase({
      caseName: "auth-api-key",
      authMode: "api-key",
      poisonHostEnv: true,
      input: [
        {
          type: "text",
          text: "Reply with strict JSON only: {\"auth_mode\":\"api-key\",\"status\":\"ok\",\"short_answer\":\"<one short sentence>\"}. Do not use markdown.",
        },
      ],
    });

    const parsed = parseJsonResponse<AuthResponse>(result.turn.finalResponse);
    expect(parsed.auth_mode).toBe("api-key");
    expect(parsed.status).toBe("ok");
    expect(parsed.short_answer.length).toBeGreaterThan(0);
    expect(result.turn.sessionId).toBeTruthy();
    expect(result.turn.usage).not.toBeNull();

    const spawn = getSpawnEvent(result.rawEvents);
    expect(spawn.command).toContain("@anthropic-ai/claude-code/cli.js");
  });

  test("runs the authToken + baseUrl path through ClaudeCode options when configured", async () => {
    const modes = await requireAuthModes();
    if (!modes.includes("auth-token")) {
      return;
    }

    const result = await executeBufferedCase({
      caseName: "auth-token-base-url",
      authMode: "auth-token",
      poisonHostEnv: true,
      input: [
        {
          type: "text",
          text: "Reply with strict JSON only: {\"auth_mode\":\"auth-token\",\"status\":\"ok\",\"short_answer\":\"<one short sentence>\"}. Do not use markdown.",
        },
      ],
    });

    const parsed = parseJsonResponse<AuthResponse>(result.turn.finalResponse);
    expect(parsed.auth_mode).toBe("auth-token");
    expect(parsed.status).toBe("ok");
    expect(parsed.short_answer.length).toBeGreaterThan(0);
    expect(result.turn.sessionId).toBeTruthy();
  });
});

describe("Real Claude CLI session lifecycle", () => {
  test("preserves context across multiple run calls on the same session", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;
    const config = await loadE2EConfig();
    const client = new ClaudeCode(getClientOptions(config.secrets, authMode));
    const session = client.startSession({
      ...config.defaultSessionOptions,
      model: config.model,
      rawEventLog: false,
    });

    const first = await session.run(
      "Remember this token exactly: E2E_SESSION_TOKEN_314159. Reply with JSON only: {\"remembered\":\"E2E_SESSION_TOKEN_314159\"}",
    );
    expect(parseJsonResponse<MemoryResponse>(first.finalResponse).remembered).toBe(
      "E2E_SESSION_TOKEN_314159",
    );

    const second = await session.run(
      "What token did I ask you to remember in the previous turn? Reply with JSON only: {\"remembered\":\"<token>\"}",
    );
    expect(parseJsonResponse<MemoryResponse>(second.finalResponse).remembered).toBe(
      "E2E_SESSION_TOKEN_314159",
    );
    expect(second.sessionId).toBeTruthy();

    const resumed = client.resumeSession(second.sessionId!, {
      ...config.defaultSessionOptions,
      model: config.model,
      rawEventLog: false,
    });
    const resumedTurn = await resumed.run(
      "Repeat the remembered token as JSON only: {\"remembered\":\"<token>\"}",
    );
    expect(
      parseJsonResponse<MemoryResponse>(resumedTurn.finalResponse).remembered,
    ).toBe("E2E_SESSION_TOKEN_314159");
  });
});

describe("Real Claude CLI streaming", () => {
  test("emits text deltas when includePartialMessages is true", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeStreamedCase({
      caseName: `streaming-partials-${authMode}`,
      authMode,
      input: "Count from 1 to 8 in one sentence, but stream naturally.",
      sessionOptions: {
        includePartialMessages: true,
      },
    });

    expect(
      result.relayEvents.some((event) => event.type === "text_delta"),
    ).toBe(true);
    expect(
      result.relayEvents.some((event) => event.type === "turn_complete"),
    ).toBe(true);
    expect(result.finalResponse.length).toBeGreaterThan(0);
  });

  test("still completes when includePartialMessages is false", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeStreamedCase({
      caseName: `streaming-no-partials-${authMode}`,
      authMode,
      input: "Count from 1 to 8 in one sentence.",
      sessionOptions: {
        includePartialMessages: false,
      },
    });

    expect(
      result.relayEvents.some((event) => event.type === "turn_complete"),
    ).toBe(true);
    expect(result.finalResponse.length).toBeGreaterThan(0);
  });
});

describe("Real Claude CLI image input", () => {
  test("understands a simple red square image", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeBufferedCase({
      caseName: `image-red-square-${authMode}`,
      authMode,
      input: [
        {
          type: "text",
          text: "Look at the image and reply with JSON only: {\"dominant_color\":\"<color>\",\"shape\":\"<shape>\",\"confidence\":\"<high|medium|low>\"}",
        },
        {
          type: "local_image",
          path: redSquarePath,
        },
      ],
    });

    const parsed = parseJsonResponse<ImageResponse>(result.turn.finalResponse);
    const spawn = getSpawnEvent(result.rawEvents);
    expect(getFlagValues(spawn.args, "--input-format")).toContain("stream-json");
    expect(hasFlag(spawn.args, "--image")).toBe(false);
    expect(parsed.dominant_color?.toLowerCase()).toContain("red");
    expect(parsed.shape?.toLowerCase()).toContain("square");
  });

  test("counts obvious shapes from a synthetic image", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeBufferedCase({
      caseName: `image-shapes-${authMode}`,
      authMode,
      input: [
        {
          type: "text",
          text: "Count the obvious geometric shapes in the image. Reply with JSON only: {\"shape_count\":<number>,\"shapes\":[\"...\"]}",
        },
        {
          type: "local_image",
          path: shapesDemoPath,
        },
      ],
    });

    const parsed = parseJsonResponse<ImageResponse>(result.turn.finalResponse);
    expect((parsed.shape_count ?? 0) >= 3).toBe(true);
    expect((parsed.shapes ?? []).length).toBeGreaterThan(0);
  });

  test("extracts a visible snippet from a synthetic receipt image", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeBufferedCase({
      caseName: `image-receipt-${authMode}`,
      authMode,
      input: [
        {
          type: "text",
          text: "Extract one clearly visible short text snippet from the image. Reply with JSON only: {\"snippet\":\"<text>\"}",
        },
        {
          type: "local_image",
          path: receiptDemoPath,
        },
      ],
    });

    const parsed = parseJsonResponse<ImageResponse>(result.turn.finalResponse);
    expect((parsed.snippet ?? "").length).toBeGreaterThan(0);
  });
});

describe("Real Claude CLI option behavior", () => {
  test("applies systemPrompt and appendSystemPrompt behavior to the final output", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const result = await executeBufferedCase({
      caseName: `system-prompt-${authMode}`,
      authMode,
      input: "Reply with JSON only.",
      sessionOptions: {
        systemPrompt: "Always respond with JSON containing system_tag=SYS_TAG_ALPHA.",
        appendSystemPrompt:
          "Also include append_tag=APPEND_TAG_BETA in the JSON.",
      },
    });

    const parsed = parseJsonResponse<Record<string, string>>(result.turn.finalResponse);
    expect((parsed.system_tag ?? "").toLowerCase()).toContain("sys_tag_alpha");
    expect((parsed.append_tag ?? "").toLowerCase()).toContain("append_tag_beta");
  });

  test("reads system prompts from files and can access cwd/additionalDirectories", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;
    const workspace = await createTempWorkspace("agent-sdk-e2e");
    const extraDir = await createTempWorkspace("agent-sdk-e2e-extra");

    try {
      const cwdFile = await writeProbeFile(
        workspace,
        "cwd-probe.txt",
        "CWD_PROBE_TOKEN\n",
      );
      const addDirFile = await writeProbeFile(
        extraDir,
        "additional-probe.txt",
        "ADDITIONAL_PROBE_TOKEN\n",
      );
      const systemPromptFile = await writePromptFile(
        workspace,
        "system-prompt.txt",
        "Always include FILE_TAG_GAMMA in your final answer.",
      );
      const appendSystemPromptFile = await writePromptFile(
        workspace,
        "append-prompt.txt",
        "Also include APPEND_FILE_TAG_DELTA in your final answer.",
      );

      const result = await executeBufferedCase({
        caseName: `file-prompts-and-directories-${authMode}`,
        authMode,
        input: `Read the file at ${cwdFile} and the file at ${addDirFile}. Reply with one JSON object containing cwd_token, additional_token, system_tag, and append_tag.`,
        sessionOptions: {
          cwd: workspace,
          additionalDirectories: [extraDir],
          systemPromptFile,
          appendSystemPromptFile,
        },
      });

      const normalized = result.turn.finalResponse.toLowerCase();
      expect(normalized).toContain("cwd_probe_token");
      expect(normalized).toContain("additional_probe_token");
      expect(normalized).toContain("file_tag_gamma");
      expect(normalized).toContain("append_file_tag_delta");
    } finally {
      await cleanupPath(workspace);
      await cleanupPath(extraDir);
    }
  });

  test("records tool restrictions, debug files, settings and plugin directory in the real spawn args", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;
    const workspace = await createTempWorkspace("agent-sdk-e2e-debug");
    const pluginDir = await createEmptyPluginDir("agent-sdk-plugin");

    try {
      const debugFile = path.join(workspace, "claude-debug.log");
      const settings = JSON.stringify({ env: { E2E_SETTINGS_TAG: "SETTINGS_OK" } });

      const result = await executeBufferedCase({
        caseName: `spawn-args-${authMode}`,
        authMode,
        input: "Reply with JSON only: {\"status\":\"ok\"}",
        sessionOptions: {
          allowedTools: ["Read"],
          disallowedTools: ["Bash"],
          tools: "Read,Edit",
          settings,
          pluginDir,
          debug: true,
          debugFile,
          maxTurns: 2,
          maxBudgetUsd: 1,
          effort: "low",
          fallbackModel: "opus",
          permissionMode: "dontAsk",
          noSessionPersistence: true,
          excludeDynamicSystemPromptSections: true,
          disableSlashCommands: true,
          includeHookEvents: true,
          betas: "beta-test",
          name: "e2e-spawn-args",
        },
      });

      const spawn = getSpawnEvent(result.rawEvents);
      expect(getFlagValues(spawn.args, "--allowedTools")).toContain("Read");
      expect(getFlagValues(spawn.args, "--disallowedTools")).toContain("Bash");
      expect(getFlagValues(spawn.args, "--tools")).toContain("Read,Edit");
      expect(getFlagValues(spawn.args, "--settings")).toContain(settings);
      expect(getFlagValues(spawn.args, "--plugin-dir")).toContain(pluginDir);
      expect(hasFlag(spawn.args, "--debug")).toBe(true);
      expect(getFlagValues(spawn.args, "--debug-file")).toContain(debugFile);
      expect(hasFlag(spawn.args, "--no-session-persistence")).toBe(true);
      expect(
        hasFlag(spawn.args, "--exclude-dynamic-system-prompt-sections"),
      ).toBe(true);
      expect(hasFlag(spawn.args, "--disable-slash-commands")).toBe(true);
      expect(hasFlag(spawn.args, "--include-hook-events")).toBe(true);
      expect(getFlagValues(spawn.args, "--betas")).toContain("beta-test");
      expect(getFlagValues(spawn.args, "--name")).toContain("e2e-spawn-args");
      expect((await readDebugFile(debugFile)).length).toBeGreaterThan(0);
    } finally {
      await cleanupPath(workspace);
      await cleanupPath(pluginDir);
    }
  });
});

describe("Real Claude CLI session modes and agents", () => {
  test("uses configured agent identity and noSessionPersistence blocks implicit reuse", async () => {
    const modes = await requireAuthModes();
    const authMode = modes[0]!;

    const first = await executeBufferedCase({
      caseName: `agent-role-${authMode}`,
      authMode,
      input: "Reply with JSON only: {\"role\":\"<role>\",\"status\":\"ok\"}",
      sessionOptions: {
        agents: {
          reviewer: {
            description: "Always identify yourself as reviewer-agent.",
            prompt:
              "When answering, include reviewer-agent in a JSON field named role.",
          },
        },
        agent: "reviewer",
        noSessionPersistence: true,
      },
    });

    expect(first.turn.finalResponse.toLowerCase()).toContain("reviewer-agent");

    const second = await executeBufferedCase({
      caseName: `no-session-persistence-${authMode}`,
      authMode,
      input:
        "What token did I ask you to remember previously? Reply with JSON only: {\"remembered\":\"<token or none>\"}",
      sessionOptions: {
        noSessionPersistence: true,
      },
    });

    expect(second.turn.finalResponse.toLowerCase()).not.toContain(
      "e2e_session_token_314159",
    );
  });
});

}


async function initializeConfigState(): Promise<{ authModes: AuthMode[]; error: Error | null }> {
  try {
    const authModes = await listAvailableAuthModes();
    return { authModes, error: null };
  } catch (error) {
    return {
      authModes: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
