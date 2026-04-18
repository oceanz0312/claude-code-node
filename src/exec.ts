import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
import readline from "node:readline";
import type { RawClaudeEvent, SessionOptions } from "./options";
import type { RawEventLogger } from "./raw-event-log";

type ExecInputItem =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string };

export type ExecArgs = {
  input: string;
  inputItems?: ExecInputItem[];
  images?: string[];

  /** Resume an existing session by ID. */
  resumeSessionId?: string | null;
  /** Continue the most recent session in cwd. */
  continueSession?: boolean;

  /** Merged session options. */
  sessionOptions?: SessionOptions;

  /** CLI binary path. */
  cliPath?: string;
  /** Environment variables for the process. */
  env?: Record<string, string>;
  /** AbortSignal. */
  signal?: AbortSignal;
  /** Sync raw event logger — writes to disk without blocking the stream. */
  rawEventLogger?: RawEventLogger;
  /** Observe raw CLI process events. */
  onRawEvent?: (event: RawClaudeEvent) => void;
  /** Called for each stdout line from the CLI process. */
  onLine: (line: string) => void;
};

const require = createRequire(import.meta.url);

function resolveDefaultCliPath(): string {
  try {
    return require.resolve("@anthropic-ai/claude-code/cli.js");
  } catch {
    return "claude";
  }
}

const DEFAULT_CLI_PATH = resolveDefaultCliPath();

export class ClaudeCodeExec {
  private cliPath: string;
  private envOverride?: Record<string, string>;

  constructor(
    cliPath?: string,
    env?: Record<string, string>,
  ) {
    this.cliPath = cliPath ?? DEFAULT_CLI_PATH;
    this.envOverride = env;
  }

  async run(args: ExecArgs): Promise<void> {
    const stdinPayload = await buildStdinPayload(args);
    const commandArgs = buildArgs(args, {
      useStreamJsonInput: stdinPayload != null,
    });
    const logger = args.rawEventLogger;
    const emitRawEvent = (event: RawClaudeEvent): void => {
      logger?.log(event);
      args.onRawEvent?.(event);
    };

    const env: Record<string, string> = {
      ...(this.envOverride ?? {}),
      ...(args.env ?? {}),
    };

    if (env.PATH === undefined && process.env.PATH !== undefined) {
      env.PATH = process.env.PATH;
    }

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(args.cliPath ?? this.cliPath, commandArgs, {
        cwd: args.sessionOptions?.cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        signal: args.signal,
      });
    } catch (error) {
      emitRawEvent({ type: "process_error", error: error as Error });
      throw error;
    }
    emitRawEvent({
      type: "spawn",
      command: args.cliPath ?? this.cliPath,
      args: commandArgs,
      cwd: args.sessionOptions?.cwd,
    });

    let spawnError: unknown | null = null;
    let stderrChain = Promise.resolve();

    try {
      if (stdinPayload != null) {
        child.stdin.end(stdinPayload);
      } else {
        child.stdin.end();
      }
      emitRawEvent({ type: "stdin_closed" });
    } catch {
      // ignore
    }

    const stderrChunks: Buffer[] = [];
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        stderrChunks.push(data);
        const chunk = data.toString("utf8");
        if (chunk) {
          stderrChain = stderrChain.then(() =>
            emitRawEvent({ type: "stderr_chunk", chunk }),
          );
        }
      });
    }
    const stderrRl = readline.createInterface({
      input: child.stderr,
      crlfDelay: Infinity,
    });
    stderrRl.on("line", (line) => {
      stderrChain = stderrChain.then(() =>
        emitRawEvent({ type: "stderr_line", line }),
      );
    });

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    // If spawn fails (e.g. binary not found), the error event fires
    // but readline may never close. Force-close it on spawn error.
    child.once("error", (err) => {
      spawnError = err;
      stderrChain = stderrChain.then(() =>
        emitRawEvent({ type: "process_error", error: err as Error }),
      );
      rl.close();
      stderrRl.close();
    });

    const exitPromise = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      child.once("exit", (code, sig) => {
        resolve({ code, signal: sig });
      });
    });

    try {
      for await (const line of rl) {
        emitRawEvent({ type: "stdout_line", line });
        args.onLine(line);
      }

      if (spawnError) throw spawnError;
      const { code, signal } = await exitPromise;
      await stderrChain;
      emitRawEvent({ type: "exit", code, signal });
      if (code !== 0 || signal) {
        const stderrText = Buffer.concat(stderrChunks).toString("utf8");
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        throw new Error(
          `Claude CLI exited with ${detail}${stderrText ? `: ${stderrText}` : ""}`,
        );
      }
    } finally {
      rl.close();
      stderrRl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) child.kill();
      } catch {
        // ignore
      }
    }
  }
}

function buildArgs(
  args: ExecArgs,
  options: { useStreamJsonInput: boolean },
): string[] {
  const cmd: string[] = [];
  const opts = args.sessionOptions;

  // --- Prompt ---
  cmd.push("-p");
  if (!options.useStreamJsonInput) {
    cmd.push(args.input);
  }

  if (options.useStreamJsonInput) {
    cmd.push("--input-format", "stream-json");
  }

  // --- Output format (always stream-json) ---
  cmd.push("--output-format", "stream-json");

  // --- Verbose (default true) ---
  if (opts?.verbose !== false) {
    cmd.push("--verbose");
  }

  // --- Include partial messages (default true) ---
  if (opts?.includePartialMessages !== false) {
    cmd.push("--include-partial-messages");
  }

  // --- Session management ---
  if (args.continueSession) {
    cmd.push("--continue");
  } else if (args.resumeSessionId) {
    cmd.push("--resume", args.resumeSessionId);
  }

  if (opts?.sessionId) {
    cmd.push("--session-id", opts.sessionId);
  }
  if (opts?.forkSession) {
    cmd.push("--fork-session");
  }

  // --- Model ---
  if (opts?.model) {
    cmd.push("--model", opts.model);
  }

  // --- Additional directories ---
  if (opts?.additionalDirectories?.length) {
    for (const dir of opts.additionalDirectories) {
      cmd.push("--add-dir", dir);
    }
  }

  // --- Max turns ---
  if (opts?.maxTurns != null) {
    cmd.push("--max-turns", String(opts.maxTurns));
  }

  // --- Max budget ---
  if (opts?.maxBudgetUsd != null) {
    cmd.push("--max-budget-usd", String(opts.maxBudgetUsd));
  }

  // --- System prompt ---
  if (opts?.systemPrompt) {
    cmd.push("--system-prompt", opts.systemPrompt);
  } else if (opts?.systemPromptFile) {
    cmd.push("--system-prompt-file", opts.systemPromptFile);
  }
  if (opts?.appendSystemPrompt) {
    cmd.push("--append-system-prompt", opts.appendSystemPrompt);
  }
  if (opts?.appendSystemPromptFile) {
    cmd.push("--append-system-prompt-file", opts.appendSystemPromptFile);
  }

  // --- Permissions ---
  if (opts?.dangerouslySkipPermissions) {
    cmd.push("--dangerously-skip-permissions");
  } else if (opts?.permissionMode) {
    cmd.push("--permission-mode", opts.permissionMode);
  }

  if (opts?.allowedTools?.length) {
    for (const tool of opts.allowedTools) {
      cmd.push("--allowedTools", tool);
    }
  }

  if (opts?.disallowedTools?.length) {
    for (const tool of opts.disallowedTools) {
      cmd.push("--disallowedTools", tool);
    }
  }

  if (opts?.tools != null) {
    cmd.push("--tools", opts.tools);
  }

  if (opts?.permissionPromptTool) {
    cmd.push("--permission-prompt-tool", opts.permissionPromptTool);
  }

  // --- MCP ---
  if (opts?.mcpConfig) {
    const configs = Array.isArray(opts.mcpConfig)
      ? opts.mcpConfig
      : [opts.mcpConfig];
    for (const cfg of configs) {
      cmd.push("--mcp-config", cfg);
    }
  }
  if (opts?.strictMcpConfig) {
    cmd.push("--strict-mcp-config");
  }

  // --- Effort ---
  if (opts?.effort) {
    cmd.push("--effort", opts.effort);
  }

  // --- Fallback model ---
  if (opts?.fallbackModel) {
    cmd.push("--fallback-model", opts.fallbackModel);
  }

  // --- Bare mode ---
  if (opts?.bare) {
    cmd.push("--bare");
  }

  // --- No session persistence ---
  if (opts?.noSessionPersistence) {
    cmd.push("--no-session-persistence");
  }

  // --- Chrome ---
  if (opts?.chrome === true) {
    cmd.push("--chrome");
  } else if (opts?.chrome === false) {
    cmd.push("--no-chrome");
  }

  // --- Agents ---
  if (opts?.agents) {
    const agentsStr =
      typeof opts.agents === "string"
        ? opts.agents
        : JSON.stringify(opts.agents);
    cmd.push("--agents", agentsStr);
  }
  if (opts?.agent) {
    cmd.push("--agent", opts.agent);
  }

  // --- Name ---
  if (opts?.name) {
    cmd.push("--name", opts.name);
  }

  // --- Settings ---
  if (opts?.settings != null) {
    cmd.push("--settings", opts.settings);
  }
  const settingSources = opts?.settingSources ?? "";
  cmd.push("--setting-sources", settingSources);

  // --- Hook events ---
  if (opts?.includeHookEvents) {
    cmd.push("--include-hook-events");
  }

  // --- Betas ---
  if (opts?.betas) {
    cmd.push("--betas", opts.betas);
  }

  // --- Worktree ---
  if (opts?.worktree) {
    cmd.push("--worktree", opts.worktree);
  }

  // --- Disable slash commands ---
  if (opts?.disableSlashCommands) {
    cmd.push("--disable-slash-commands");
  }

  // --- Plugin dir ---
  if (opts?.pluginDir) {
    const dirs = Array.isArray(opts.pluginDir)
      ? opts.pluginDir
      : [opts.pluginDir];
    for (const dir of dirs) {
      cmd.push("--plugin-dir", dir);
    }
  }

  // --- Exclude dynamic system prompt sections ---
  if (opts?.excludeDynamicSystemPromptSections) {
    cmd.push("--exclude-dynamic-system-prompt-sections");
  }

  // --- Debug ---
  if (opts?.debug === true) {
    cmd.push("--debug");
  } else if (typeof opts?.debug === "string") {
    cmd.push("--debug", opts.debug);
  }
  if (opts?.debugFile) {
    cmd.push("--debug-file", opts.debugFile);
  }

  // --- JSON Schema (structured output) ---
  if (opts?.jsonSchema != null) {
    const schemaStr =
      typeof opts.jsonSchema === "string"
        ? opts.jsonSchema
        : JSON.stringify(opts.jsonSchema);
    cmd.push("--json-schema", schemaStr);
  }

  return cmd;
}

async function buildStdinPayload(args: ExecArgs): Promise<string | null> {
  const inputItems = getStructuredInputItems(args);
  if (inputItems == null) {
    return null;
  }

  const content: Array<Record<string, unknown>> = [];
  for (const item of inputItems) {
    if (item.type === "text") {
      if (item.text.length > 0) {
        content.push({ type: "text", text: item.text });
      }
      continue;
    }

    const imageBuffer = await readFile(item.path);
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: detectImageMediaType(imageBuffer, item.path),
        data: imageBuffer.toString("base64"),
      },
    });
  }

  if (content.length === 0) {
    return null;
  }

  return `${JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content,
    },
  })}\n`;
}

function getStructuredInputItems(args: ExecArgs): ExecInputItem[] | null {
  if (args.inputItems?.some((item) => item.type === "local_image")) {
    return mergeTextItems(args.inputItems);
  }

  if (args.images?.length) {
    const items: ExecInputItem[] = [];
    if (args.input.length > 0) {
      items.push({ type: "text", text: args.input });
    }
    for (const image of args.images) {
      items.push({ type: "local_image", path: image });
    }
    return items;
  }

  return null;
}

function mergeTextItems(items: ExecInputItem[]): ExecInputItem[] {
  const merged: ExecInputItem[] = [];
  let pendingText: string[] = [];

  const flushPendingText = (): void => {
    if (pendingText.length === 0) {
      return;
    }

    merged.push({
      type: "text",
      text: pendingText.join("\n\n"),
    });
    pendingText = [];
  };

  for (const item of items) {
    if (item.type === "text") {
      pendingText.push(item.text);
      continue;
    }

    flushPendingText();
    merged.push(item);
  }

  flushPendingText();
  return merged;
}

function detectImageMediaType(buffer: Buffer, filePath: string): string {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".png":
    default:
      return "image/png";
  }
}
