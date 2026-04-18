# Real Claude CLI E2E Tests

`bun run test:e2e` runs the SDK against the real Claude Code CLI installed in this repo's `node_modules`.

## Setup

1. Copy `tests/e2e/local.secrets.example.ts` to `tests/e2e/local.secrets.ts`
2. Fill in at least one credential path:
   - `apiKey` for direct Anthropic API auth
   - `authToken` and `baseUrl` for gateway auth
3. Run:

```bash
bun run test:e2e
```

## Notes

- Tests load the SDK from `src/index.ts`, not from `dist/`.
- Credentials are passed directly to `new ClaudeCode({...})` in the test harness.
- `tests/e2e/local.secrets.ts` and `tests/e2e/artifacts/` are gitignored.
- Each case writes transcripts and raw logs into `tests/e2e/artifacts/<run-id>/<case-name>/`.
