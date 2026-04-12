// ─── Options ──────────────────────────────────────────────────────────────────

/** Global options — passed when creating a ClaudeCode instance. */
export type ClaudeCodeOptions = {
  /** Path to the `claude` CLI binary. Defaults to "claude" (resolved from PATH). */
  cliPath?: string;
  /** Environment variables for the CLI process. When set, process.env is NOT inherited. */
  env?: Record<string, string>;
  /** API key sent as the X-Api-Key header (passed via ANTHROPIC_API_KEY). */
  apiKey?: string;
  /** Auth token sent as the Authorization: Bearer header (passed via ANTHROPIC_AUTH_TOKEN). */
  authToken?: string;
  /** API base URL (passed via ANTHROPIC_BASE_URL environment variable). */
  baseUrl?: string;
};

/** Permission modes supported by Claude Code. */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "dontAsk"
  | "bypassPermissions";

/** Model effort levels. */
export type Effort = "low" | "medium" | "high" | "max";

/** Raw Claude CLI process events exposed during a turn. */
export type RawClaudeEvent =
  | { type: "spawn"; command: string; args: string[]; cwd?: string }
  | { type: "stdin_closed" }
  | { type: "stdout_line"; line: string }
  | { type: "stderr_chunk"; chunk: string }
  | { type: "stderr_line"; line: string }
  | { type: "process_error"; error: Error }
  | { type: "exit"; code: number | null; signal: NodeJS.Signals | null };

/** Dynamic sub-agent definition. */
export type AgentDefinition = {
  description?: string;
  prompt?: string;
  tools?: string[];
  model?: string;
  maxTurns?: number;
};

/** Session options — passed when starting or resuming a session. */
export type SessionOptions = {
  /** Model (e.g. "claude-sonnet-4-6", "sonnet", "opus"). */
  model?: string;
  /** Working directory for the CLI process. */
  cwd?: string;
  /** Additional working directories. */
  additionalDirectories?: string[];
  /** Maximum number of agentic turns. */
  maxTurns?: number;
  /** Maximum dollar amount to spend on API calls. */
  maxBudgetUsd?: number;
  /** Replace the entire system prompt. */
  systemPrompt?: string;
  /** Load system prompt from a file (replaces default). */
  systemPromptFile?: string;
  /** Append to the default system prompt. */
  appendSystemPrompt?: string;
  /** Append system prompt text from a file. */
  appendSystemPromptFile?: string;
  /** Permission mode. */
  permissionMode?: PermissionMode;
  /** Skip all permission checks (equivalent to permissionMode: "bypassPermissions"). */
  dangerouslySkipPermissions?: boolean;
  /** Tools that execute without prompting for permission. */
  allowedTools?: string[];
  /** Tools that are removed and cannot be used. */
  disallowedTools?: string[];
  /** Restrict available tools (e.g. "", "default", "Bash,Edit,Read"). */
  tools?: string;
  /** MCP tool to handle permission prompts in non-interactive mode. */
  permissionPromptTool?: string;
  /** MCP server config file path(s). */
  mcpConfig?: string | string[];
  /** Only use MCP servers from mcpConfig. */
  strictMcpConfig?: boolean;
  /** Model effort level. */
  effort?: Effort;
  /** Fallback model when primary is overloaded. */
  fallbackModel?: string;
  /** Bare mode: skip hooks/plugins/MCP/CLAUDE.md auto-discovery. */
  bare?: boolean;
  /** Do not persist session to disk. */
  noSessionPersistence?: boolean;
  /** Enable Chrome browser integration. */
  chrome?: boolean;
  /** Dynamically define sub-agents. */
  agents?: Record<string, AgentDefinition> | string;
  /** Specify an agent for the session. */
  agent?: string;
  /** Display name for the session. */
  name?: string;
  /** Additional settings file path or JSON string. */
  settings?: string;
  /** Setting sources (e.g. "user,project,local"). */
  settingSources?: string;
  /** Enable verbose output. Defaults to true. */
  verbose?: boolean;
  /** Include partial streaming events. Defaults to true. */
  includePartialMessages?: boolean;
  /** Include hook lifecycle events in output. */
  includeHookEvents?: boolean;
  /** Beta API headers. */
  betas?: string;
  /** Run in an isolated git worktree. */
  worktree?: string;
  /** Disable skills and commands. */
  disableSlashCommands?: boolean;
  /** Plugin directory path(s). */
  pluginDir?: string | string[];
  /** Exclude dynamic system prompt sections (improves cache hit rate). */
  excludeDynamicSystemPromptSections?: boolean;
  /** Debug mode (true or category filter string). */
  debug?: string | boolean;
  /** Debug log output file. */
  debugFile?: string;
  /**
   * Write all RawClaudeEvent records as NDJSON into the consumer project's
   * `logs/` directory. Pass a string to override the target directory.
   */
  rawEventLog?: boolean | string;
};

/** Turn options — passed for each run / runStreamed call. */
export type TurnOptions = {
  /** AbortSignal to cancel the turn. */
  signal?: AbortSignal;
  /** Observe raw Claude CLI process events such as stdout/stderr lines. */
  onRawEvent?: (event: RawClaudeEvent) => void | Promise<void>;
  /**
   * Abort the CLI process and surface a synthesized `RelayEvent.error`
   * as soon as a fatal CLI API error is detected.
   */
  failFastOnCliApiError?: boolean;
};
