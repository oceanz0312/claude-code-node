# Shared Scoring And Calculation

Use this reference in both single and batch per-package execution.

1. Assign each check item a score of `0`, `1`, or `2` with explicit evidence notes.
2. Convert each dimension to a percentage score using rubric formulas.
3. Build score input JSON and execute:
   - `node scripts/calc-score.js --input <path-to-json>`
4. Verify whether shortboard correction is triggered:
   - grade cap for key dimensions
   - minus 5 penalty when two or more non-key dimensions are below 40
5. Persist the final scoring artifacts for report rendering:
   - raw total and grade
   - corrected total and grade
   - grade cap reasons
   - non-key penalty status
