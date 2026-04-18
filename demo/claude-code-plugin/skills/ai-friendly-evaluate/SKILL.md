---
name: ai-friendly-evaluate
description: Evaluates a repository's AI-friendliness using a structured rubric, then outputs scores, evidence, analysis, and prioritized optimization recommendations. Use when auditing AI readiness, baselining improvements, or comparing projects over time. Don't use for implementing product features, running unrelated bug triage, or writing generic architecture documents.
---

# AI Friendly Evaluation

## Procedures

**Required Inputs**

1. Require an intake payload JSON that includes questionnaire answers.
2. Require a repository-relative path to a package root (the directory must contain `package.json`). The path may be the repo root (e.g. `.`) for single-repo projects, or a subdirectory in a monorepo.
3. Accept an optional evaluation goal. If empty, generate a default report title with current date.
4. Accept an optional final report save path.
5. Accept an optional report language (`english` or `chinese`). Default to `english`.
6. Reject execution when package root path is missing.

**Step 0: Intake Questionnaire and Confirmation (Unified Entry)**

1. Read `assets/intake-questionnaire.md` and collect all required answers from the user.
2. Execute `node scripts/runtime-workspace.js --action create --target-path "<target_path>"` to initialize a runtime workspace.
3. Save answers to `<runtime_dir>/intake-answers.json` using questionnaire fields from that file.
4. Execute `node scripts/validate-intake.js --input <runtime_dir>/intake-answers.json > <runtime_dir>/intake-context.json` to map answers into canonical execution fields.
5. Treat `<runtime_dir>/intake-context.json` as the only source of truth for downstream scripts, including `report_title` and `report_language`.
6. If validation passes, present a concise execution summary to the user.
7. Ask the user whether to continue evaluation.
8. Continue to Step 1 only after explicit user approval.
9. If validation fails, stop and ask the user to complete missing fields.

**Step 1: Mode Routing**

1. If user provides single-package intake, set `mode=single`.
2. If user provides batch intake, set `mode=batch`.
3. Execute only one mode flow in this run.

## Per-Package Execution Contract (Strict)

This contract must be executed for every package target in order, without skipping or reordering steps.

- In `single` mode, the main agent executes this contract.
- In `batch` mode, each per-package subagent executes this contract.

**Contract Steps**

1. Load references and templates:
   - `references/lark-ai-friendly-scoring-v0.2.md`
   - `references/rubric-quick-map.md`
   - `references/shared-validation.md`
   - `references/shared-evidence-collection.md`
   - `references/shared-scoring-and-calculation.md`
   - `references/shared-report-artifacts.md`
   - `references/shared-runtime-cleanup.md`
2. Execute validation and scope setup from `references/shared-validation.md`.
3. Execute evidence collection from `references/shared-evidence-collection.md`.
4. Execute scoring and correction from `references/shared-scoring-and-calculation.md`.
5. Execute report generation from `references/shared-report-artifacts.md` using selected `report_language`.
6. Always run cleanup from `references/shared-runtime-cleanup.md`.

## Single Mode Flow

Use this flow when evaluating one package.

1. Execute the full **Per-Package Execution Contract (Strict)** once, by the main agent.

## Batch Mode Flow

Use this flow when evaluating multiple packages in one run.

1. Read `assets/batch-intake-questionnaire.md` and collect batch answers.
2. Save payload to `<runtime_dir>/batch-intake-answers.json`.
3. Execute `node scripts/validate-batch-intake.js --input <runtime_dir>/batch-intake-answers.json > <runtime_dir>/batch-intake-context.json`.
4. Present batch summary (targets count, batch id, output dir, language) and ask user for explicit approval.
5. Read `assets/batch-subagent-dispatch-template.md` before dispatching subagents.
6. For each target, generate prompt using:
   ```
   node scripts/generate-subagent-prompt.js \
     --target-path "<target_path>" \
     --output-dir "<package_output_dir>" \
     --report-language "<report_language>" \
     --project-role-preference "<project_role_preference>"
   ```
   Use the generated prompt EXACTLY - do not modify or omit any sections.
7. Use subagents for per-package evaluation in batch mode. Do not rely on script-only summary generation.
8. Run per-package evaluation with queue-based concurrency and at most `max_parallel_subagents` active subagents.
9. For each target in `targets`, dispatch one subagent and require strict execution of the full **Per-Package Execution Contract (Strict)**.
10. Write per-package outputs under:
    - `<batch_output_dir>/packages/<safe-package-name>/summary.md`
    - `<batch_output_dir>/packages/<safe-package-name>/appendix-*.md`
11. Generate batch summary with `assets/batch-summary-template.md` at:

- `<batch_output_dir>/summary.md`

11. Ensure batch summary contains links to each package summary.
12. Validate subagent output contracts before aggregation; failed contracts must be listed in failed targets.
13. Ensure batch summary contains narrative conclusions:

- Cross-package patterns and likely root causes.
- 1-2 shared priorities for the next iteration.
- Clear callouts for outliers and failed targets.

14. Always run cleanup from `references/shared-runtime-cleanup.md`.

## Error Handling

- If intake validation fails, do not continue. Ask for missing answers and rerun `scripts/validate-intake.js`.
- If batch intake validation fails, do not continue. Ask for fixes and rerun `scripts/validate-batch-intake.js`.
- If user does not explicitly approve after summary, stop immediately.
- If runtime workspace creation fails, stop and ask for a writable `--preferred-runtime-dir`.
- If `target_path` is missing, stop and request an explicit path before continuing.
- If `target_path` resolves outside the repository root, stop and reject the input.
- If `target_path` is not a package root (missing `package.json` or invalid package metadata), stop and reject the input.
- If `output_path` resolves outside the repository root, stop and reject the input.
- If `output_path` points to a file instead of a directory, stop and reject the input.
- If role classification is unclear, document both candidate classifications and choose one with a stated rationale.
- If `report_language` is invalid, stop and ask user to choose `english` or `chinese`.
- If D9 activation cannot be confirmed from available evidence, default to `not activated` and state this assumption.
- If score calculation input fails validation, fix the JSON keys and rerun `node scripts/calc-score.js --input <path>`.
- If a per-package task violates the execution contract steps, mark that target as failed and include the reason in batch summary.
- Always cleanup runtime artifacts after success or abort via `node scripts/runtime-workspace.js --action cleanup --runtime-dir "<runtime_dir>"`.
