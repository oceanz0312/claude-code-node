# Shared Evidence Collection

Use this reference in both single and batch per-package execution.

Collect explicit evidence notes for each active dimension:

1. D1: docs discoverability and navigation quality.
2. D2: AI rules, guidance hierarchy, and context filtering quality.
   - Use `ai_config` from validation output (inherited/local/effective).
   - Evaluate "effective config for this package", not "local config file existence".
   - Effective config = Root inherited + Package incremental.
   - Complete root config yields high D2 score even without local files.
3. D3: code structure, naming consistency, and complexity control.
4. D4: TypeScript strictness, `any` usage, API typing, and linting quality.
5. D5: readability and comment quality.
6. D6: testing and verification quality with role-specific criteria.
7. D7: build and development script ergonomics.
8. D8: code noise level and generated artifact isolation quality.
9. D9 (only when activated): workspace dependency navigability quality.

Each evidence record should include:

- source file or command context
- observed fact
- impact on AI friendliness
