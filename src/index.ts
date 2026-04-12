// ─── Classes ─────────────────────────────────────────────────────────────────
export { ClaudeCode } from "./claude-code.js";
export { Session } from "./session.js";

// ─── SDK types ───────────────────────────────────────────────────────────────
export type {
  ClaudeCodeOptions,
  SessionOptions,
  PermissionMode,
  Effort,
  RawClaudeEvent,
  AgentDefinition,
  TurnOptions,
} from "./options.js";

export type {
  Input,
  UserInput,
  Turn,
  TurnUsage,
  RunResult,
  StreamedTurn,
  RunStreamedResult,
} from "./session.js";

// ─── Re-export claude-code-parser types and utilities ────────────────────────
export type {
  RelayEvent,
  TextDeltaEvent,
  ThinkingDeltaEvent,
  ToolUseEvent,
  ToolResultEvent,
  SessionMetaEvent,
  TurnCompleteEvent,
  ErrorEvent,
  ClaudeEvent,
  ClaudeMessage,
  ClaudeContent,
  ModelUsageEntry,
} from "claude-code-parser";

export { parseLine, Translator, extractContent } from "claude-code-parser";
