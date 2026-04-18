# Shared Runtime Cleanup

Use this reference in both single and batch execution.

1. Always cleanup runtime artifacts after success or abort:
   - `node scripts/runtime-workspace.js --action cleanup --runtime-dir "<runtime_dir>"`
2. If cleanup fails, report the remaining path and ask user for manual cleanup only when required.
3. Do not skip cleanup on validation failures, user cancellation, or partial batch completion.
