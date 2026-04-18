#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { targetPath: '', outputPath: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--target-path') {
      out.targetPath = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--output-path') {
      out.outputPath = args[i + 1] || '';
      i += 1;
    }
  }
  if (!out.targetPath) fail('Missing required --target-path');
  return out;
}

function ensureInsideRepo(absPath, repoRoot) {
  if (!(absPath === repoRoot || absPath.startsWith(`${repoRoot}${path.sep}`))) {
    fail('path resolves outside repository root');
  }
}

function ensurePackageRoot(absPath) {
  // Allow repo root when it has package.json (single-repo); otherwise require a package root directory
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) fail('target_path must be a directory');
  const packageJson = path.join(absPath, 'package.json');
  if (!fs.existsSync(packageJson)) fail('target_path must be a package root directory with package.json');
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  } catch (err) {
    fail(`invalid package.json at target_path: ${err.message}`);
  }
  if (!payload || typeof payload.name !== 'string' || !payload.name) {
    fail('package.json at target_path must contain a non-empty name field');
  }
}

function rel(p, root) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function main() {
  const { targetPath, outputPath } = parseArgs();
  const repoRoot = process.cwd();

  if (path.isAbsolute(targetPath)) fail('target_path must be repository-relative, not absolute');
  const targetAbs = path.resolve(repoRoot, targetPath);
  ensureInsideRepo(targetAbs, repoRoot);
  ensurePackageRoot(targetAbs, repoRoot);

  let outputDirAbs;
  let usedDefault = false;
  if (outputPath && outputPath.trim()) {
    outputDirAbs = path.isAbsolute(outputPath) ? path.resolve(outputPath) : path.resolve(repoRoot, outputPath.trim());
  } else {
    outputDirAbs = path.resolve(targetAbs, 'docs', 'ai-friendly-evaluation-report');
    usedDefault = true;
  }
  ensureInsideRepo(outputDirAbs, repoRoot);
  if (fs.existsSync(outputDirAbs) && !fs.statSync(outputDirAbs).isDirectory()) {
    fail('output_path points to a file, directory path is required');
  }

  const summaryFile = path.join(outputDirAbs, 'summary.md');
  const appendixScoringDetails = path.join(outputDirAbs, 'appendix-scoring-details.md');
  const appendixCalculation = path.join(outputDirAbs, 'appendix-calculation.md');
  const appendixContext = path.join(outputDirAbs, 'appendix-context.md');
  const appendixRisks = path.join(outputDirAbs, 'appendix-risks.md');

  const result = {
    ok: true,
    target_path: rel(targetAbs, repoRoot),
    output_dir: rel(outputDirAbs, repoRoot),
    output_dir_abs: outputDirAbs,
    summary_file: rel(summaryFile, repoRoot),
    appendix_scoring_details_file: rel(appendixScoringDetails, repoRoot),
    appendix_calculation_file: rel(appendixCalculation, repoRoot),
    appendix_context_file: rel(appendixContext, repoRoot),
    appendix_risks_file: rel(appendixRisks, repoRoot),
    used_default_output_path: usedDefault,
    output_parent: rel(path.dirname(outputDirAbs), repoRoot),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
