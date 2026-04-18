# Batch Subagent Dispatch Template

Use this template to dispatch per-package evaluation tasks in batch mode while preserving narrative quality.

## Dispatcher Rules

1. Launch one subagent per target package.
2. Respect `max_parallel_subagents` from batch context.
3. Pass the same global context to every subagent:
   - rubric references
   - report language
   - role preference
   - writing quality bar
4. **Generate prompts using the script** - do NOT manually assemble prompts:
   ```
   node scripts/generate-subagent-prompt.js \
     --target-path "<target_path>" \
     --output-dir "<package_output_dir>" \
     --report-language "<report_language>" \
     --project-role-preference "<project_role_preference>"
   ```
   Use the generated prompt EXACTLY - do not modify or omit any sections.
5. Require each subagent to output both:
   - structured scoring data (JSON contract)
   - natural-language conclusions
6. Do not accept outputs that are only metric dumps.

## Batch Aggregation Rules

1. Merge subagent output contracts into a batch result list.
2. Mark target `failed` if contract order is violated or required outputs are missing.
3. Build batch `summary.md` from:
   - score distribution
   - top and bottom packages
   - repeated shortboards
   - 1-2 shared priorities
4. List failed targets with error reasons.
5. Verify every summary link resolves to an existing package `summary.md`.
