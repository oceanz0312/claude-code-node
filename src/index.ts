// ─── Classes ─────────────────────────────────────────────────────────────────
export { ClaudeCode } from "./claude-code";
export { Session } from "./session";

// ─── SDK types ───────────────────────────────────────────────────────────────
export type {
  ClaudeCodeOptions,
  SessionOptions,
  PermissionMode,
  Effort,
  RawClaudeEvent,
  AgentDefinition,
  TurnOptions,
} from "./options";

export type {
  Input,
  UserInput,
  Turn,
  TurnUsage,
  RunResult,
  StreamedTurn,
  RunStreamedResult,
} from "./session";

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
