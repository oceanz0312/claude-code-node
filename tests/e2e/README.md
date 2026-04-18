# Real Claude CLI E2E Tests

`bun run test:e2e` runs the SDK against the real Claude Code CLI installed in this repo's `node_modules`.

## Setup

1. Copy `.env.example` to `.env` in the repo root
2. Fill in at least one credential path:
   - `E2E_API_KEY` for direct Anthropic API auth
   - `E2E_AUTH_TOKEN` and `E2E_BASE_URL` for gateway auth
3. Run:

```bash
source .env && bun run test:e2e
```

## Notes

- Tests load the SDK from `src/index.ts`, not from `dist/`.
- Credentials are passed directly to `new ClaudeCode({...})` in the test harness.
- `.env` and `tests/e2e/artifacts/` are gitignored.
- Each case writes transcripts and raw logs into `tests/e2e/artifacts/<run-id>/<case-name>/`.
