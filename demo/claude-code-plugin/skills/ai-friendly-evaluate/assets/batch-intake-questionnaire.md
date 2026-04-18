# Batch Intake Questionnaire

Use this questionnaire when evaluating multiple packages in one run.

## Required Question

1. Target package list (string array)
   - Every item must be a repository-relative path to a directory with `package.json` (package root).
   - Single-repo: use `"."` when the repo root has `package.json`. Monorepo: use sub-project paths.
   - Example:
     - `subspaces/webapp_main/libs/webapp-fe-shared`
     - `subspaces/webapp_main/apps/webapp-seo-mobile`

## Optional Questions

1. Batch name (string)
   - If empty, auto-generated as `ai-friendly-batch-YYYY-MM-DD`.
2. Batch output directory (string)
   - If empty, default is `docs/ai-friendly-evaluation-batch/<batch_id>/`.
3. Project role preference (string)
   - Allowed values: `auto`, `infrastructure`, `business`.
4. Report language (string)
   - Allowed values: `english`, `chinese`.
   - Default: `english`.
5. Max parallel subagents (integer)
   - Optional, range `1-4`.
   - Default: `3`.
6. Notes (string)
   - Additional constraints or context.

## Answer Template (User Input)

```json
{
  "targets": ["subspaces/webapp_main/libs/webapp-fe-shared", "subspaces/webapp_main/apps/webapp-seo-mobile"],
  "batch_name": "webapp-main-quarterly-baseline",
  "report_language": "english",
  "max_parallel_subagents": 3
}
```

## Mapping (Questionnaire -> Execution Context)

| Questionnaire Field     | Execution Field         | Notes                                   |
| ----------------------- | ----------------------- | --------------------------------------- |
| targets                 | targets                 | required, at least one package          |
| batch_name              | batch_name              | optional                                |
| (system-generated)      | batch_id                | default: `ai-friendly-batch-YYYY-MM-DD` |
| batch_output_dir        | batch_output_dir        | optional                                |
| project_role_preference | project_role_preference | default `auto`                          |
| report_language         | report_language         | default `english`                       |
| max_parallel_subagents  | max_parallel_subagents  | default `3`, valid range `1-4`          |
| notes                   | notes                   | optional                                |
| (system-generated)      | confirmation_required   | always `true`                           |

## Standard Execution Flow

1. Save user answers to `<runtime_dir>/batch-intake-answers.json`.
2. Validate and map:
   - `node scripts/validate-batch-intake.js --input <runtime_dir>/batch-intake-answers.json > <runtime_dir>/batch-intake-context.json`
3. Show batch summary and ask whether to continue.
4. After approval, run per-target evaluations with subagents.
5. Generate batch `summary.md` and link each package `summary.md`.
