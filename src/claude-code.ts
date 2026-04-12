import type { ClaudeCodeOptions, SessionOptions } from "./options.js";
import { ClaudeCodeExec } from "./exec.js";
import { Session } from "./session.js";

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
    this._options = options;
    this._exec = new ClaudeCodeExec(
      options.cliPath,
      options.env,
      options.apiKey,
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
