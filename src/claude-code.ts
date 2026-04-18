import type { ClaudeCodeOptions, SessionOptions } from "./options";
import { ClaudeCodeExec } from "./exec";
import { Session } from "./session";

/**
 * ClaudeCode is the main entry point for the SDK.
 *
 * Use `startSession()` to create a new session, `resumeSession()` to resume
 * an existing one by ID, or `continueSession()` to continue the most recent
 * session in the working directory.
 */
export class ClaudeCode {
  private _exec: ClaudeCodeExec;
  private _options: ClaudeCodeOptions;

  constructor(options: ClaudeCodeOptions = {}) {
    const normalizedEnv = mergeClaudeEnv(options);
    this._options = {
      ...options,
      env: normalizedEnv,
    };
    this._exec = new ClaudeCodeExec(
      options.cliPath,
      normalizedEnv,
    );
  }

  /** Start a new session. */
  startSession(options: SessionOptions = {}): Session {
    return new Session(this._exec, this._options, options);
  }

  /** Resume an existing session by its ID. */
  resumeSession(sessionId: string, options: SessionOptions = {}): Session {
    return new Session(this._exec, this._options, options, sessionId);
  }

  /** Continue the most recent session in the working directory. */
  continueSession(options: SessionOptions = {}): Session {
    return new Session(
      this._exec,
      this._options,
      options,
      null,
      true,
    );
  }
}

function mergeClaudeEnv(options: ClaudeCodeOptions): Record<string, string> {
  const env: Record<string, string> = {
    ...(options.env ?? {}),
  };

  if (options.apiKey !== undefined) {
    env.ANTHROPIC_API_KEY = options.apiKey;
  }

  if (options.authToken !== undefined) {
    env.ANTHROPIC_AUTH_TOKEN = options.authToken;
  }

  if (options.baseUrl !== undefined) {
    env.ANTHROPIC_BASE_URL = options.baseUrl;
  }

  return env;
}
