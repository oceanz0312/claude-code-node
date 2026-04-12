# CLI stderr Fail-Fast Design

## Background

The SDK currently translates Claude CLI `stdout` NDJSON into `RelayEvent`s, but treats `stderr` only as raw process logs.
When Claude CLI prints a fatal API error such as `API Error: 401 ...` or `API Error: 502 ...` to `stderr`, callers can observe it through `onRawEvent`, but the SDK does not surface it as `RelayEvent.error` until the child process finally exits with a non-zero code.

## Goal

Provide an opt-in mode that:

- detects fatal Claude CLI API errors written to `stderr`
- aborts the child process early instead of waiting for delayed exit
- surfaces the failure as a synthesized `RelayEvent.error`
- keeps the existing default behavior unchanged

## Chosen Approach

Add `TurnOptions.failFastOnCliApiError?: boolean`.

When enabled, `Session` wraps `onRawEvent`, watches `stderr_line`, and matches fatal API error patterns.
On the first fatal match, it aborts the current Claude CLI process via an internal `AbortController`.
If the execution then rejects because of that abort, `Session` converts the captured fatal stderr line into:

```ts
{ type: "error", message, sessionId }
```

This keeps process management in `ClaudeCodeExec` and keeps protocol shaping in `Session`, which matches the repository's current responsibility split.

## Non-Goals

- Do not convert every `stderr` line into a relay error.
- Do not change the default behavior for existing callers.
- Do not move CLI argument or process lifecycle logic into `Session`.

## Validation

- Add a fake CLI scenario that writes a fatal API error to `stderr`, then exits later with code `1`.
- Verify `runStreamed()` yields a synthesized `error` event quickly when the option is enabled.
- Verify `run()` throws the synthesized error quickly when the option is enabled.
