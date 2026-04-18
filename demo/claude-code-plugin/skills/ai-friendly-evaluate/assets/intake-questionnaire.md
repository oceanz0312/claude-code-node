# Intake Questionnaire

Collect answers before starting a single-package evaluation. This file defines user-facing questions and mapping into execution context via `scripts/validate-intake.js`.

## Required Question

1. Target package root path (string)
   - Repository-relative path to a directory that contains `package.json` (package root).
   - Single-repo: use `.` when the repo root has `package.json`.
   - Monorepo: use the path to the sub-project, e.g. `packages/apps/webapp-live`.

## Optional Questions

1. Evaluation goal (string)
   - One-sentence goal for this run.
   - If empty, default title is generated: `AI Friendly Evaluation Report - YYYY-MM-DD`.
2. Report output directory (string)
   - Custom output directory.
   - If empty, default is `<target_path>/docs/ai-friendly-evaluation-report/`.
3. Project role preference (string)
   - Allowed values: `auto`, `infrastructure`, `business`.
4. Report language (string)
   - Allowed values: `english`, `chinese`.
   - Default: `english`.
5. Notes (string)
   - Additional constraints or context.

## Answer Template (User Input)

```json
{
  "target_path": "packages/apps/webapp-live",
  "output_path": "docs/ai/reports/webapp-live-q2",
  "project_role_preference": "auto",
  "report_language": "english",
  "notes": "focus on docs quality and testability"
}
```

For a single-repo (package.json at repo root), use `"target_path": "."`.

## Mapping (Questionnaire -> Execution Context)

| Questionnaire Field     | Execution Field         | Notes                                                     |
| ----------------------- | ----------------------- | --------------------------------------------------------- |
| target_path             | target_path             | package root path                                         |
| evaluation_goal         | evaluation_goal         | optional                                                  |
| (system-generated)      | report_title            | default title with date when goal is empty                |
| output_path             | output_path             | optional                                                  |
| project_role_preference | project_role_preference | default `auto`                                            |
| report_language         | report_language         | default `english`; controls summary and appendix language |
| notes                   | notes                   | optional                                                  |
| (system-generated)      | confirmation_required   | always `true`                                             |

## Standard Execution Flow

1. Create runtime workspace (prefer system temp directory):
   - `node scripts/runtime-workspace.js --action create --target-path "<target_path>" > <runtime-context.json>`
2. Save user answers to `<runtime_dir>/intake-answers.json`.
3. Validate and map:
   - `node scripts/validate-intake.js --input <runtime_dir>/intake-answers.json > <runtime_dir>/intake-context.json`
4. Use `<runtime_dir>/intake-context.json` as the only execution context.
5. Show execution summary and ask user whether to continue.
6. Continue only with explicit user approval.
7. Cleanup runtime directory when finished:
   - `node scripts/runtime-workspace.js --action cleanup --runtime-dir "<runtime_dir>"`

## Execution Context Example

```json
{
  "ok": true,
  "target_path": "packages/apps/webapp-live",
  "evaluation_goal": null,
  "report_title": "AI Friendly Evaluation Report - 2026-03-11",
  "output_path": "docs/ai/reports/webapp-live-q2",
  "project_role_preference": "auto",
  "report_language": "english",
  "notes": "focus on docs quality and testability",
  "confirmation_required": true
}
```
