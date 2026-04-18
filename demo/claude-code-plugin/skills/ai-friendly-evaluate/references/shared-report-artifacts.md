# Shared Report Artifacts

Use this reference in both single and batch per-package execution.

1. Read `assets/evaluation-report-template.md` for `summary.md` structure.
2. Read appendix templates:
   - `assets/appendix-scoring-details-template.md`
   - `assets/appendix-calculation-template.md`
   - `assets/appendix-context-template.md`
   - `assets/appendix-risks-template.md`
3. Produce concise score summary with:
   - corrected total score
   - final grade
   - key shortboards
4. Produce evidence-backed analysis for low-score dimensions.
5. Produce prioritized recommendations:
   - P0: must-fix
   - P1: strong recommendation
   - P2: optional follow-up
6. Render `summary.md` and all appendices in selected `report_language`.
7. Use fixed appendix file names:
   - `appendix-scoring-details.md`
   - `appendix-calculation.md`
   - `appendix-context.md`
   - `appendix-risks.md`
8. Ensure appendix links in `summary.md` are valid relative links.
9. Apply writing quality bar for `summary.md`:
   - start with a natural-language executive summary, not a score table
   - explain why final grade is reasonable using concrete evidence
   - convert top issues into actionable recommendations with expected impact
   - avoid metric dumps, placeholders, or generic statements
