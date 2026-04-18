#!/usr/bin/env node
/**
 * generate-subagent-prompt.js
 *
 * Generates a standardized subagent prompt for per-package evaluation.
 * This ensures all prompts are consistent with the dispatch template.
 *
 * Usage:
 *   node scripts/generate-subagent-prompt.js \
 *     --target-path "subspaces/webapp_main/libs/webapp-fe-shared" \
 *     --output-dir "tmp/ai-friendly-evaluate/report/packages/webapp-fe-shared" \
 *     --report-language "chinese" \
 *     --project-role-preference "auto"
 */

const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    targetPath: '',
    outputDir: '',
    reportLanguage: 'english',
    projectRolePreference: 'auto',
    skillDir: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--target-path') {
      out.targetPath = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--output-dir') {
      out.outputDir = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--report-language') {
      out.reportLanguage = args[i + 1] || 'english';
      i += 1;
    } else if (args[i] === '--project-role-preference') {
      out.projectRolePreference = args[i + 1] || 'auto';
      i += 1;
    } else if (args[i] === '--skill-dir') {
      out.skillDir = args[i + 1] || '';
      i += 1;
    }
  }
  if (!out.targetPath) fail('Missing required --target-path');
  if (!out.outputDir) fail('Missing required --output-dir');
  return out;
}

function generatePrompt(options) {
  const { targetPath, outputDir, reportLanguage, projectRolePreference, skillDir } = options;

  // skillDir should be passed via --skill-dir, or auto-detected from script location
  const refBase = skillDir;

  const prompt = `Task: Evaluate AI friendliness for one package and produce full report files.

Package target:
- target_path: ${targetPath}
- output_dir: ${outputDir}

Global context:
- report_language: ${reportLanguage}
- project_role_preference: ${projectRolePreference}
- rubric_source: ${refBase}/references/lark-ai-friendly-scoring-v0.2.md
- quick_map: ${refBase}/references/rubric-quick-map.md
- contract_references:
  - ${refBase}/references/shared-validation.md
  - ${refBase}/references/shared-evidence-collection.md
  - ${refBase}/references/shared-scoring-and-calculation.md
  - ${refBase}/references/shared-report-artifacts.md
  - ${refBase}/references/shared-runtime-cleanup.md

Mandatory execution order (must follow):
1) shared-validation
2) shared-evidence-collection
3) shared-scoring-and-calculation
4) shared-report-artifacts
5) shared-runtime-cleanup

Required outputs:
1) summary.md
2) appendix-scoring-details.md
3) appendix-calculation.md
4) appendix-context.md
5) appendix-risks.md

Quality requirements:
- Start summary with natural-language executive conclusion (2-4 sentences).
- Explain why final grade is reasonable with concrete evidence.
- Provide actionable roadmap with expected impact and effort.
- Keep appendix and summary consistent on scores and conclusions.

Output a JSON contract at the end with:
{
  "target_path": "${targetPath}",
  "status": "success|failed",
  "corrected_score": 0,
  "grade": "A|B|C|D",
  "key_shortboards": ["D1", "D4"],
  "summary_file": "${outputDir}/summary.md",
  "appendix_files": {
    "scoring_details": "${outputDir}/appendix-scoring-details.md",
    "calculation": "${outputDir}/appendix-calculation.md",
    "context": "${outputDir}/appendix-context.md",
    "risks": "${outputDir}/appendix-risks.md"
  },
  "error": null
}`;

  return prompt;
}

function main() {
  const options = parseArgs();

  // Auto-detect skill directory from script location if not provided
  if (!options.skillDir) {
    options.skillDir = path.resolve(__dirname, '..');
  }

  const prompt = generatePrompt(options);

  // Output as JSON for easy parsing
  const result = {
    target_path: options.targetPath,
    output_dir: options.outputDir,
    report_language: options.reportLanguage,
    project_role_preference: options.projectRolePreference,
    prompt: prompt,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
