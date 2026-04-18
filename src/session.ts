import { parseLine, Translator } from "claude-code-parser";
import type {
  ClaudeEvent,
  RelayEvent,
  TurnCompleteEvent,
  ErrorEvent,
} from "claude-code-parser";
import type {
  ClaudeCodeOptions,
  SessionOptions,
  TurnOptions,
  RawClaudeEvent,
} from "./options";
import { ClaudeCodeExec } from "./exec";
import { createRawEventLogger } from "./raw-event-log";

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
  structuredOutput: unknown | null;
};

export type RunResult = Turn;

export type StreamedTurn = {
  events: AsyncIterable<RelayEvent>;
};

export type RunStreamedResult = StreamedTurn;

type AbortSignalBinding = {
  signal?: AbortSignal;
  cleanup: () => void;
};

// ─── Event Channel ──────────────────────────────────────────────────────────

type EventChannel<T> = AsyncIterable<T> & {
  push(value: T): void;
  end(): void;
  error(err: Error): void;
};

function createEventChannel<T>(): EventChannel<T> {
  const buffer: T[] = [];
  let waiting: {
    resolve: (result: IteratorResult<T>) => void;
    reject: (err: Error) => void;
  } | null = null;
  let done = false;
  let pendingError: Error | null = null;

  return {
    push(value: T) {
      if (waiting) {
        const { resolve } = waiting;
        waiting = null;
        resolve({ value, done: false });
      } else {
        buffer.push(value);
      }
    },
    end() {
      done = true;
      if (waiting) {
        const { resolve } = waiting;
        waiting = null;
        resolve({ value: undefined as T, done: true });
      }
    },
    error(err: Error) {
      pendingError = err;
      if (waiting) {
        const { reject } = waiting;
        waiting = null;
        reject(err);
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift()!, done: false });
          }
          if (pendingError) {
            return Promise.reject(pendingError);
          }
          if (done) {
            return Promise.resolve({ value: undefined as T, done: true });
          }
          return new Promise((resolve, reject) => {
            waiting = { resolve, reject };
          });
        },
      };
    },
  };
}

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
    const events: RelayEvent[] = [];
    let finalResponse = "";
    let usage: TurnUsage | null = null;
    let sessionId: string | null = this._id;
    let streamError: ErrorEvent | null = null;
    const streamResult: StreamProcessResult = { structuredOutput: null };

    await this._processStream(input, turnOptions, streamResult, (event) => {
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
      } else if (event.type === "error") {
        streamError = event as ErrorEvent;
        if (streamError.sessionId) sessionId = streamError.sessionId;
      }
    });

    if (streamError) {
      throw new Error((streamError as ErrorEvent).message);
    }

    return {
      events,
      finalResponse,
      usage,
      sessionId,
      structuredOutput: streamResult.structuredOutput,
    };
  }

  /** Execute a turn and stream RelayEvents. */
  async runStreamed(
    input: Input,
    turnOptions: TurnOptions = {},
  ): Promise<StreamedTurn> {
    const channel = createEventChannel<RelayEvent>();
    const streamResult: StreamProcessResult = { structuredOutput: null };

    this._processStream(input, turnOptions, streamResult, (event) => {
      channel.push(event);
    })
      .then(() => channel.end())
      .catch((err) =>
        channel.error(err instanceof Error ? err : new Error(String(err))),
      );

    return { events: channel };
  }

  private async _processStream(
    input: Input,
    turnOptions: TurnOptions,
    streamResult: StreamProcessResult,
    onEvent: (event: RelayEvent) => void,
  ): Promise<void> {
    const { prompt, images } = normalizeInput(input);
    const inputItems = Array.isArray(input) ? input : undefined;
    const translator = new Translator();
    const streamState = createStreamState();
    const rawEventLogger = await createRawEventLogger(this._sessionOptions.rawEventLog);
    let fatalCliError: string | null = null;
    let stderrText = "";

    const cliAbortController = turnOptions.failFastOnCliApiError
      ? new AbortController()
      : null;
    const abortSignalBinding = createAbortSignalBinding(
      turnOptions.signal,
      cliAbortController?.signal,
    );

    const onRawEvent = turnOptions.failFastOnCliApiError
      ? (event: RawClaudeEvent): void => {
          if (!fatalCliError) {
            stderrText = appendStderrText(stderrText, event);
            const detectedError = extractFatalCliApiError(stderrText);
            if (detectedError) {
              fatalCliError = detectedError;
              cliAbortController?.abort();
            }
          }

          turnOptions.onRawEvent?.(event);
        }
      : turnOptions.onRawEvent;

    try {
      await this._exec.run({
        input: prompt,
        inputItems,
        images: images.length > 0 ? images : undefined,
        resumeSessionId: this._hasRun ? this._id : (this._id && !this._continueMode ? this._id : null),
        continueSession: !this._hasRun && this._continueMode,
        sessionOptions: this._sessionOptions,
        cliPath: this._globalOptions.cliPath,
        env: this._globalOptions.env,
        signal: abortSignalBinding.signal,
        rawEventLogger,
        onRawEvent,
        onLine: (line) => {
          const parsed = parseLine(line);
          if (!parsed) return;

          if (parsed.type === "result") {
            const rawResult = parsed as ClaudeEvent & { structured_output?: unknown };
            if (rawResult.structured_output !== undefined) {
              streamResult.structuredOutput = rawResult.structured_output;
            }
          }

          if (!fatalCliError && turnOptions.failFastOnCliApiError) {
            const detectedError = extractFatalCliApiErrorFromStdoutEvent(parsed);
            if (detectedError) {
              fatalCliError = detectedError;
              if (!this._id && typeof parsed.session_id === "string") {
                this._id = parsed.session_id;
              }
              cliAbortController?.abort();
              onEvent({
                type: "error",
                message: fatalCliError,
                sessionId: this._id ?? translator.sessionId,
              } as ErrorEvent);
              return;
            }
          }

          const relayEvents = translateRelayEvents(parsed, translator, streamState);

          if (translator.sessionId && !this._id) {
            this._id = translator.sessionId;
          }

          for (const event of relayEvents) {
            if (event.type === "turn_complete") {
              const tc = event as TurnCompleteEvent;
              if (tc.sessionId && !this._id) {
                this._id = tc.sessionId;
              }
            }
            onEvent(event);
          }
        },
      });
    } catch (error) {
      if (fatalCliError) {
        onEvent({
          type: "error",
          message: fatalCliError,
          sessionId: this._id ?? translator.sessionId,
        } as ErrorEvent);
        return;
      }
      throw error;
    } finally {
      await rawEventLogger.close();
      abortSignalBinding.cleanup();
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

type StreamedMessageState = {
  textStreamed: boolean;
  thinkingStreamed: boolean;
};

type StreamState = {
  activeMessageId: string | null;
  lastCompletedMessageId: string | null;
  messages: Map<string, StreamedMessageState>;
};

type StreamProcessResult = {
  structuredOutput: unknown | null;
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
    activeMessageId: null,
    lastCompletedMessageId: null,
    messages: new Map<string, StreamedMessageState>(),
  };
}

function ensureStreamedMessageState(
  streamState: StreamState,
  messageId: string,
): StreamedMessageState {
  const existing = streamState.messages.get(messageId);
  if (existing) {
    return existing;
  }

  const nextState: StreamedMessageState = {
    textStreamed: false,
    thinkingStreamed: false,
  };
  streamState.messages.set(messageId, nextState);
  return nextState;
}

function createAbortSignalBinding(
  ...signals: Array<AbortSignal | undefined>
): AbortSignalBinding {
  const activeSignals = signals.filter(
    (signal): signal is AbortSignal => signal != null,
  );

  if (activeSignals.length === 0) {
    return { signal: undefined, cleanup: noop };
  }

  if (activeSignals.length === 1) {
    return { signal: activeSignals[0], cleanup: noop };
  }

  const controller = new AbortController();
  const cleanupFns: Array<() => void> = [];

  const abort = (source: AbortSignal): void => {
    if (controller.signal.aborted) return;

    const reason = (
      source as AbortSignal & {
        reason?: unknown;
      }
    ).reason;

    if (reason === undefined) {
      controller.abort();
      return;
    }

    controller.abort(reason);
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort(signal);
      return { signal: controller.signal, cleanup: noop };
    }

    const onAbort = () => abort(signal);
    signal.addEventListener("abort", onAbort, { once: true });
    cleanupFns.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const cleanup of cleanupFns) {
        cleanup();
      }
    },
  };
}

function appendStderrText(
  stderrText: string,
  event: RawClaudeEvent,
): string {
  if (event.type === "stderr_chunk") {
    return `${stderrText}${event.chunk}`.slice(-16384);
  }

  if (event.type === "stderr_line") {
    return `${stderrText}${event.line}\n`.slice(-16384);
  }

  return stderrText;
}

function extractFatalCliApiError(stderrText: string): string | null {
  const match = /\bAPI Error:/i.exec(stderrText);
  if (!match) {
    return null;
  }

  const tail = stderrText.slice(match.index).trim();
  if (!tail) {
    return null;
  }

  const [firstLine] = tail.split(/\r?\n/, 1);
  return firstLine?.trim() || tail;
}

function extractFatalCliApiErrorFromStdoutEvent(
  parsed: ClaudeEvent,
): string | null {
  if (parsed.type !== "system" || parsed.subtype !== "api_retry") {
    return null;
  }

  const event = parsed as ClaudeEvent & {
    attempt?: unknown;
    max_retries?: unknown;
    retry_delay_ms?: unknown;
    error_status?: unknown;
    error?: unknown;
  };

  const errorStatus =
    typeof event.error_status === "number" ? event.error_status : null;
  const error =
    typeof event.error === "string" && event.error.trim()
      ? event.error.trim()
      : null;

  if (errorStatus == null && error == null) {
    return null;
  }

  const parts = ["API retry aborted"];
  if (errorStatus != null) {
    parts.push(`status ${errorStatus}`);
  }
  if (error) {
    parts.push(error);
  }

  if (
    typeof event.attempt === "number" &&
    typeof event.max_retries === "number"
  ) {
    parts.push(`attempt ${event.attempt}/${event.max_retries}`);
  }

  if (typeof event.retry_delay_ms === "number") {
    parts.push(`next retry in ${Math.round(event.retry_delay_ms)}ms`);
  }

  return parts.join(" | ");
}

function noop(): void {}

function translateRelayEvents(
  parsed: ClaudeEvent,
  translator: Translator,
  streamState: StreamState,
): RelayEvent[] {
  if (isStreamEventEnvelope(parsed)) {
    return translateStreamEvent(parsed, streamState);
  }

  const relayEvents = translator.translate(parsed);

  if (parsed.type === "assistant") {
    return suppressDuplicateAssistantSnapshot(parsed, relayEvents, streamState);
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
  if (!event) {
    return [];
  }

  if (event.type === "message_start") {
    const messageId = getMessageId(event.message);
    if (messageId) {
      streamState.activeMessageId = messageId;
      ensureStreamedMessageState(streamState, messageId);
    }
    return [];
  }

  if (event.type === "message_stop") {
    const messageId = resolveStreamEventMessageId(event, streamState);
    if (messageId) {
      ensureStreamedMessageState(streamState, messageId);
      streamState.lastCompletedMessageId = messageId;
      if (streamState.activeMessageId === messageId) {
        streamState.activeMessageId = null;
      }
    }
    return [];
  }

  if (event.type !== "content_block_delta" || !event.delta) {
    return [];
  }

  const messageId = resolveStreamEventMessageId(event, streamState);
  const messageState = messageId
    ? ensureStreamedMessageState(streamState, messageId)
    : null;
  const { delta } = event;

  if (delta.type === "text_delta") {
    if (!delta.text) {
      return [];
    }
    if (messageState) {
      messageState.textStreamed = true;
    }
    return [{ type: "text_delta", content: delta.text }];
  }

  if (delta.type === "thinking_delta") {
    const content = delta.thinking ?? delta.text ?? "";
    if (!content) {
      return [];
    }
    if (messageState) {
      messageState.thinkingStreamed = true;
    }
    return [{ type: "thinking_delta", content }];
  }

  return [];
}

function suppressDuplicateAssistantSnapshot(
  raw: ClaudeEvent,
  relayEvents: RelayEvent[],
  streamState: StreamState,
): RelayEvent[] {
  const messageId = getMessageId(raw.message) ?? streamState.lastCompletedMessageId;
  if (!messageId) {
    return relayEvents;
  }

  const messageState = streamState.messages.get(messageId);
  if (!messageState) {
    return relayEvents;
  }

  return relayEvents.filter((event) => {
    if (event.type === "text_delta") {
      return !messageState.textStreamed;
    }

    if (event.type === "thinking_delta") {
      return !messageState.thinkingStreamed;
    }

    return true;
  });
}

function getStreamEventMessageId(event: RawStreamEventPayload): string | null {
  if (typeof event.message_id === "string") {
    return event.message_id;
  }
  return getMessageId(event.message);
}

function resolveStreamEventMessageId(
  event: RawStreamEventPayload,
  streamState: StreamState,
): string | null {
  return getStreamEventMessageId(event) ?? streamState.activeMessageId;
}

function getMessageId(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const { id } = message as { id?: unknown };
  return typeof id === "string" ? id : null;
}
