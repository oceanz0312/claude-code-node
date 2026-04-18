# Shared Validation

Use this reference in both single and batch per-package execution.

1. Treat validated intake context as the only source of truth for `target_path`, `output_path`, `report_title`, `project_role_preference`, and `report_language`.
2. Execute `node scripts/validate-input.js --target-path "<target_path>"` before any scoring step.
3. The validation output includes `repo_root` and `ai_config` fields:
   - `ai_config.inherited`: Root-level AI config files inherited by this package
   - `ai_config.local`: Package-local AI config files
   - `ai_config.effective`: Combined effective config (inherited + local)
   - Use this information for D2 evidence collection to properly credit inherited config.
4. Use validated `target_path` as the only evidence collection scope.
5. Execute `node scripts/resolve-output-path.js --target-path "<target_path>" --output-path "<output_path>"` to resolve report output directory and fixed artifact paths.
6. If `output_path` is empty, use default package-local output: `<target_path>/docs/ai-friendly-evaluation-report/`.
7. Record baseline revision with `git rev-parse HEAD`.
8. Determine project role (`infrastructure` or `business`) using rubric rules and available evidence.
9. Determine whether D9 is activated based on workspace dependency complexity evidence.
