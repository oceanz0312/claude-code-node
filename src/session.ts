import { parseLine, Translator } from "claude-code-parser";
import type {
  ClaudeEvent,
  RelayEvent,
  TurnCompleteEvent,
  ErrorEvent,
} from "claude-code-parser";
import type { ClaudeCodeOptions, SessionOptions, TurnOptions } from "./options.js";
import { ClaudeCodeExec } from "./exec.js";

// ─── Input types ─────────────────────────────────────────────────────────────

export type UserInput =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string };

export type Input = string | UserInput[];

// ─── Return types ────────────────────────────────────────────────────────────

export type TurnUsage = {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
};

export type Turn = {
  events: RelayEvent[];
  finalResponse: string;
  usage: TurnUsage | null;
  sessionId: string | null;
};

export type RunResult = Turn;

export type StreamedTurn = {
  events: AsyncGenerator<RelayEvent>;
};

export type RunStreamedResult = StreamedTurn;

// ─── Session ─────────────────────────────────────────────────────────────────

export class Session {
  private _exec: ClaudeCodeExec;
  private _globalOptions: ClaudeCodeOptions;
  private _sessionOptions: SessionOptions;
  private _id: string | null;
  private _continueMode: boolean;
  private _hasRun = false;

  /** Session ID, populated after the first run from session_meta event. */
  public get id(): string | null {
    return this._id;
  }

  /** @internal */
  constructor(
    exec: ClaudeCodeExec,
    globalOptions: ClaudeCodeOptions,
    sessionOptions: SessionOptions,
    sessionId: string | null = null,
    continueMode = false,
  ) {
    this._exec = exec;
    this._globalOptions = globalOptions;
    this._sessionOptions = sessionOptions;
    this._id = sessionId;
    this._continueMode = continueMode;
  }

  /** Execute a turn and return the completed result. */
  async run(input: Input, turnOptions: TurnOptions = {}): Promise<Turn> {
    const generator = this._runStreamedInternal(input, turnOptions);
    const events: RelayEvent[] = [];
    let finalResponse = "";
    let usage: TurnUsage | null = null;
    let sessionId: string | null = this._id;

    for await (const event of generator) {
      events.push(event);

      if (event.type === "text_delta") {
        finalResponse += event.content;
      } else if (event.type === "turn_complete") {
        const tc = event as TurnCompleteEvent;
        if (tc.sessionId) sessionId = tc.sessionId;
        usage = {
          costUsd: tc.costUsd,
          inputTokens: tc.inputTokens,
          outputTokens: tc.outputTokens,
          contextWindow: tc.contextWindow,
        };
      } else if (event.type === "session_meta") {
        // session_meta doesn't carry sessionId in RelayEvent,
        // but translator.sessionId captures it
      } else if (event.type === "error") {
        const err = event as ErrorEvent;
        if (err.sessionId) sessionId = err.sessionId;
        throw new Error(err.message);
      }
    }

    return { events, finalResponse, usage, sessionId };
  }

  /** Execute a turn and stream RelayEvents. */
  async runStreamed(
    input: Input,
    turnOptions: TurnOptions = {},
  ): Promise<StreamedTurn> {
    return { events: this._runStreamedInternal(input, turnOptions) };
  }

  private async *_runStreamedInternal(
    input: Input,
    turnOptions: TurnOptions = {},
  ): AsyncGenerator<RelayEvent> {
    const { prompt, images } = normalizeInput(input);
    const translator = new Translator();
    const streamState = createStreamState();

    const generator = this._exec.run({
      input: prompt,
      images: images.length > 0 ? images : undefined,
      resumeSessionId: this._hasRun ? this._id : (this._id && !this._continueMode ? this._id : null),
      continueSession: !this._hasRun && this._continueMode,
      sessionOptions: this._sessionOptions,
      cliPath: this._globalOptions.cliPath ?? "claude",
      env: this._globalOptions.env,
      apiKey: this._globalOptions.apiKey,
      signal: turnOptions.signal,
    });

    try {
      for await (const line of generator) {
        const parsed = parseLine(line);
        if (!parsed) continue;

        const relayEvents = translateRelayEvents(parsed, translator, streamState);

        // Capture session ID from translator state
        if (translator.sessionId && !this._id) {
          this._id = translator.sessionId;
        }

        for (const event of relayEvents) {
          // Also capture sessionId from turn_complete
          if (event.type === "turn_complete") {
            const tc = event as TurnCompleteEvent;
            if (tc.sessionId && !this._id) {
              this._id = tc.sessionId;
            }
          }
          yield event;
        }
      }
    } finally {
      this._hasRun = true;
    }
  }
}

function normalizeInput(input: Input): { prompt: string; images: string[] } {
  if (typeof input === "string") {
    return { prompt: input, images: [] };
  }
  const promptParts: string[] = [];
  const images: string[] = [];
  for (const item of input) {
    if (item.type === "text") {
      promptParts.push(item.text);
    } else if (item.type === "local_image") {
      images.push(item.path);
    }
  }
  return { prompt: promptParts.join("\n\n"), images };
}

type StreamState = {
  streamedMessageIds: Set<string>;
};

type RawStreamEventEnvelope = ClaudeEvent & {
  type: "stream_event";
  event?: RawStreamEventPayload;
};

type RawStreamEventPayload = {
  type?: string;
  message?: unknown;
  message_id?: string;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
  };
};

function createStreamState(): StreamState {
  return {
    streamedMessageIds: new Set<string>(),
  };
}

function translateRelayEvents(
  parsed: ClaudeEvent,
  translator: Translator,
  streamState: StreamState,
): RelayEvent[] {
  if (isStreamEventEnvelope(parsed)) {
    return translateStreamEvent(parsed, streamState);
  }

  const relayEvents = translator.translate(parsed);

  // Claude emits a final assistant snapshot after stream_event deltas.
  // Keep tool-related events, but suppress duplicate text/thinking output.
  if (parsed.type === "assistant" && hasStreamedMessage(parsed, streamState)) {
    return relayEvents.filter(
      (event) => event.type !== "text_delta" && event.type !== "thinking_delta",
    );
  }

  return relayEvents;
}

function isStreamEventEnvelope(raw: ClaudeEvent): raw is RawStreamEventEnvelope {
  return raw.type === "stream_event";
}

function translateStreamEvent(
  raw: RawStreamEventEnvelope,
  streamState: StreamState,
): RelayEvent[] {
  const event = raw.event;
  if (!event || event.type !== "content_block_delta" || !event.delta) {
    return [];
  }

  const messageId = getStreamEventMessageId(event);
  const { delta } = event;

  if (delta.type === "text_delta") {
    if (!delta.text) return [];
    if (messageId) streamState.streamedMessageIds.add(messageId);
    return [{ type: "text_delta", content: delta.text }];
  }

  if (delta.type === "thinking_delta") {
    const content = delta.thinking ?? delta.text ?? "";
    if (!content) return [];
    if (messageId) streamState.streamedMessageIds.add(messageId);
    return [{ type: "thinking_delta", content }];
  }

  return [];
}

function hasStreamedMessage(raw: ClaudeEvent, streamState: StreamState): boolean {
  const messageId = getMessageId(raw.message);
  return messageId != null && streamState.streamedMessageIds.has(messageId);
}

function getStreamEventMessageId(event: RawStreamEventPayload): string | null {
  if (typeof event.message_id === "string") {
    return event.message_id;
  }
  return getMessageId(event.message);
}

function getMessageId(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const { id } = message as { id?: unknown };
  return typeof id === "string" ? id : null;
}
