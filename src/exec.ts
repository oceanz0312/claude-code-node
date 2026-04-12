import { spawn } from "node:child_process";
import readline from "node:readline";
import type { SessionOptions } from "./options.js";

export type ExecArgs = {
  input: string;
  images?: string[];

  /** Resume an existing session by ID. */
  resumeSessionId?: string | null;
  /** Continue the most recent session in cwd. */
  continueSession?: boolean;

  /** Merged session options. */
  sessionOptions?: SessionOptions;

  /** CLI binary path. */
  cliPath: string;
  /** Environment variables for the process. */
  env?: Record<string, string>;
  /** API key. */
  apiKey?: string;
  /** AbortSignal. */
  signal?: AbortSignal;
};

const DEFAULT_CLI_PATH = "claude";

export class ClaudeCodeExec {
  private cliPath: string;
  private envOverride?: Record<string, string>;
  private apiKey?: string;

  constructor(
    cliPath?: string,
    env?: Record<string, string>,
    apiKey?: string,
  ) {
    this.cliPath = cliPath ?? DEFAULT_CLI_PATH;
    this.envOverride = env;
    this.apiKey = apiKey;
  }

  async *run(args: ExecArgs): AsyncGenerator<string> {
    const commandArgs = buildArgs(args);

    const env: Record<string, string> = {};
    if (this.envOverride) {
      Object.assign(env, this.envOverride);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
    }
    if (args.apiKey ?? this.apiKey) {
      env.ANTHROPIC_API_KEY = (args.apiKey ?? this.apiKey)!;
    }

    const child = spawn(args.cliPath ?? this.cliPath, commandArgs, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      signal: args.signal,
    });

    let spawnError: unknown | null = null;

    // In -p mode, prompt is passed via the flag; close stdin immediately.
    try {
      child.stdin.end();
    } catch {
      // ignore
    }

    const stderrChunks: Buffer[] = [];
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        stderrChunks.push(data);
      });
    }

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    // If spawn fails (e.g. binary not found), the error event fires
    // but readline may never close. Force-close it on spawn error.
    child.once("error", (err) => {
      spawnError = err;
      rl.close();
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
        yield line as string;
      }

      if (spawnError) throw spawnError;
      const { code, signal } = await exitPromise;
      if (code !== 0 || signal) {
        const stderrText = Buffer.concat(stderrChunks).toString("utf8");
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        throw new Error(
          `Claude CLI exited with ${detail}${stderrText ? `: ${stderrText}` : ""}`,
        );
      }
    } finally {
      rl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) child.kill();
      } catch {
        // ignore
      }
    }
  }
}

function buildArgs(args: ExecArgs): string[] {
  const cmd: string[] = [];
  const opts = args.sessionOptions;

  // --- Prompt ---
  cmd.push("-p", args.input);

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

  // --- Model ---
  if (opts?.model) {
    cmd.push("--model", opts.model);
  }

  // --- Working directory ---
  if (opts?.cwd) {
    cmd.push("--cd", opts.cwd);
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

  if (opts?.tools) {
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
  if (opts?.settings) {
    cmd.push("--settings", opts.settings);
  }
  if (opts?.settingSources) {
    cmd.push("--setting-sources", opts.settingSources);
  }

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

  // --- Images (structured input) ---
  if (args.images?.length) {
    for (const image of args.images) {
      cmd.push("--image", image);
    }
  }

  return cmd;
}
