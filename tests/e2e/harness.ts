import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ClaudeCode,
  type Input,
  type RawClaudeEvent,
  type RelayEvent,
  type SessionOptions,
  type Turn,
} from "../../src/index.ts";
import { getClientOptions, loadE2EConfig, type AuthMode } from "./config.ts";
import {
  createArtifactDir,
  type TimestampedRawEvent,
  writeCaseArtifacts,
} from "./reporters.ts";

export type BufferedCaseResult = {
  artifactDir: string;
  authMode: AuthMode;
  caseName: string;
  turn: Turn;
  relayEvents: RelayEvent[];
  rawEvents: TimestampedRawEvent[];
  rawEventLogFiles: string[];
};

export type StreamedCaseResult = {
  artifactDir: string;
  authMode: AuthMode;
  caseName: string;
  relayEvents: RelayEvent[];
  rawEvents: TimestampedRawEvent[];
  finalResponse: string;
  rawEventLogFiles: string[];
};

export async function executeBufferedCase(options: {
  caseName: string;
  authMode: AuthMode;
  input: Input;
  sessionOptions?: SessionOptions;
  poisonHostEnv?: boolean;
}): Promise<BufferedCaseResult> {
  return withOptionalPoisonedEnv(options.poisonHostEnv, async () => {
    const config = await loadE2EConfig();
    const artifactDir = await createArtifactDir(config.artifactRoot, options.caseName);
    const sessionOptions = buildSessionOptions(
      config.defaultSessionOptions,
      config.model,
      artifactDir,
      options.sessionOptions,
    );
    const client = new ClaudeCode(getClientOptions(config.secrets, options.authMode));
    const session = client.startSession(sessionOptions);
    const rawEvents: TimestampedRawEvent[] = [];
    const turn = await session.run(options.input, {
      onRawEvent: createRawEventCollector(rawEvents),
    });

    const rawEventLogFiles = await collectRawEventLogFiles(artifactDir);
    await writeCaseArtifacts({
      caseName: options.caseName,
      authMode: options.authMode,
      artifactDir,
      inputSummary: summarizeInput(options.input),
      sessionOptionsSummary: summarizeSessionOptions(sessionOptions),
      rawEvents,
      relayEvents: turn.events,
      finalResponse: turn.finalResponse,
      metadata: {
        sessionId: turn.sessionId,
        usage: turn.usage,
        rawEventLogFiles,
      },
    });

    printCaseSummary({
      caseName: options.caseName,
      authMode: options.authMode,
      artifactDir,
      rawEvents,
      relayEvents: turn.events,
      finalResponse: turn.finalResponse,
      input: options.input,
      sessionOptions,
    });

    return {
      artifactDir,
      authMode: options.authMode,
      caseName: options.caseName,
      turn,
      relayEvents: turn.events,
      rawEvents,
      rawEventLogFiles,
    };
  });
}

export async function executeStreamedCase(options: {
  caseName: string;
  authMode: AuthMode;
  input: Input;
  sessionOptions?: SessionOptions;
}): Promise<StreamedCaseResult> {
  const config = await loadE2EConfig();
  const artifactDir = await createArtifactDir(config.artifactRoot, options.caseName);
  const sessionOptions = buildSessionOptions(
    config.defaultSessionOptions,
    config.model,
    artifactDir,
    options.sessionOptions,
  );
  const client = new ClaudeCode(getClientOptions(config.secrets, options.authMode));
  const session = client.startSession(sessionOptions);
  const rawEvents: TimestampedRawEvent[] = [];
  const relayEvents: RelayEvent[] = [];
  let finalResponse = "";

  const streamed = await session.runStreamed(options.input, {
    onRawEvent: createRawEventCollector(rawEvents),
  });

  for await (const event of streamed.events) {
    relayEvents.push(event);
    if (event.type === "text_delta") {
      finalResponse += event.content;
    }
  }

  const rawEventLogFiles = await collectRawEventLogFiles(artifactDir);
  await writeCaseArtifacts({
    caseName: options.caseName,
    authMode: options.authMode,
    artifactDir,
    inputSummary: summarizeInput(options.input),
    sessionOptionsSummary: summarizeSessionOptions(sessionOptions),
    rawEvents,
    relayEvents,
    finalResponse,
    metadata: {
      rawEventLogFiles,
    },
  });

  printCaseSummary({
    caseName: options.caseName,
    authMode: options.authMode,
    artifactDir,
    rawEvents,
    relayEvents,
    finalResponse,
    input: options.input,
    sessionOptions,
  });

  return {
    artifactDir,
    authMode: options.authMode,
    caseName: options.caseName,
    relayEvents,
    rawEvents,
    finalResponse,
    rawEventLogFiles,
  };
}

export async function createTempWorkspace(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `${prefix}-`));
}

export async function writeProbeFile(
  dir: string,
  fileName: string,
  content: string,
): Promise<string> {
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function writePromptFile(
  dir: string,
  fileName: string,
  content: string,
): Promise<string> {
  return writeProbeFile(dir, fileName, content);
}

export async function createEmptyPluginDir(prefix: string): Promise<string> {
  return createTempWorkspace(prefix);
}

export async function cleanupPath(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}

export function parseJsonResponse<T>(text: string): T {
  const normalized = stripCodeFence(text);

  try {
    return JSON.parse(normalized) as T;
  } catch {
    const extracted = extractFirstJsonValue(normalized);
    if (extracted == null) {
      throw new SyntaxError("JSON Parse error: Unable to parse JSON string");
    }
    return JSON.parse(extracted) as T;
  }
}

export function getSpawnEvent(
  rawEvents: TimestampedRawEvent[],
): Extract<RawClaudeEvent, { type: "spawn" }> {
  const event = rawEvents.find((entry) => entry.event.type === "spawn");
  if (!event || event.event.type !== "spawn") {
    throw new Error("Missing spawn event in raw event stream.");
  }

  return event.event;
}

export function getFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]!);
    }
  }

  return values;
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export async function readDebugFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function listArtifactFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort();
}

function buildSessionOptions(
  defaults: SessionOptions,
  model: string,
  artifactDir: string,
  overrides?: SessionOptions,
): SessionOptions {
  return {
    ...defaults,
    model,
    rawEventLog: artifactDir,
    ...overrides,
  };
}

function createRawEventCollector(
  rawEvents: TimestampedRawEvent[],
): (event: RawClaudeEvent) => void {
  return (event) => {
    rawEvents.push({
      timestamp: new Date().toISOString(),
      event,
    });
  };
}

function summarizeInput(input: Input): Record<string, unknown> {
  if (typeof input === "string") {
    return { prompt: input };
  }

  return {
    items: input.map((item) => {
      if (item.type === "text") {
        return { type: item.type, text: item.text };
      }

      return { type: item.type, path: item.path };
    }),
  };
}

function summarizeSessionOptions(options: SessionOptions): Record<string, unknown> {
  return {
    model: options.model,
    cwd: options.cwd,
    additionalDirectories: options.additionalDirectories,
    maxTurns: options.maxTurns,
    maxBudgetUsd: options.maxBudgetUsd,
    permissionMode: options.permissionMode,
    dangerouslySkipPermissions: options.dangerouslySkipPermissions,
    allowedTools: options.allowedTools,
    disallowedTools: options.disallowedTools,
    tools: options.tools,
    mcpConfig: options.mcpConfig,
    strictMcpConfig: options.strictMcpConfig,
    effort: options.effort,
    fallbackModel: options.fallbackModel,
    bare: options.bare,
    noSessionPersistence: options.noSessionPersistence,
    chrome: options.chrome,
    agent: options.agent,
    name: options.name,
    settings: options.settings,
    settingSources: options.settingSources,
    verbose: options.verbose,
    includePartialMessages: options.includePartialMessages,
    includeHookEvents: options.includeHookEvents,
    betas: options.betas,
    worktree: options.worktree,
    disableSlashCommands: options.disableSlashCommands,
    pluginDir: options.pluginDir,
    excludeDynamicSystemPromptSections: options.excludeDynamicSystemPromptSections,
    debug: options.debug,
    debugFile: options.debugFile,
  };
}

async function collectRawEventLogFiles(artifactDir: string): Promise<string[]> {
  return (await readdir(artifactDir))
    .filter((name) => name.endsWith(".ndjson") && name.startsWith("claude-raw-events-"))
    .sort();
}

async function withOptionalPoisonedEnv<T>(
  enabled: boolean | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) {
    return fn();
  }

  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;

  process.env.ANTHROPIC_API_KEY = "host-api-key-should-not-leak";
  process.env.ANTHROPIC_AUTH_TOKEN = "host-auth-token-should-not-leak";
  process.env.ANTHROPIC_BASE_URL = "https://host-base-url-should-not-leak.invalid";

  try {
    return await fn();
  } finally {
    restoreEnv("ANTHROPIC_API_KEY", originalApiKey);
    restoreEnv("ANTHROPIC_AUTH_TOKEN", originalAuthToken);
    restoreEnv("ANTHROPIC_BASE_URL", originalBaseUrl);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function extractFirstJsonValue(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const start = trimmed.search(/[\[{]/);
  if (start < 0) {
    return null;
  }

  const opening = trimmed[start]!;
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return null;
}

function printCaseSummary(input: {
  caseName: string;
  authMode: string;
  artifactDir: string;
  rawEvents: TimestampedRawEvent[];
  relayEvents: RelayEvent[];
  finalResponse: string;
  input: Input;
  sessionOptions: SessionOptions;
}): void {
  console.log(`[E2E] case=${input.caseName}`);
  console.log(`[E2E] auth_mode=${input.authMode}`);
  console.log(`[E2E] options=${JSON.stringify(summarizeSessionOptions(input.sessionOptions))}`);
  console.log(`[E2E] input=${JSON.stringify(summarizeInput(input.input))}`);
  console.log(`[E2E] raw_event_count=${input.rawEvents.length}`);
  console.log(`[E2E] relay_event_count=${input.relayEvents.length}`);
  console.log(`[E2E] final_response=${input.finalResponse}`);
  console.log(`[E2E] artifact_dir=${input.artifactDir}`);
}
