#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { action: '', targetPath: '', preferredRuntimeDir: '', runtimeDir: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--action') {
      out.action = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--target-path') {
      out.targetPath = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--preferred-runtime-dir') {
      out.preferredRuntimeDir = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--runtime-dir') {
      out.runtimeDir = args[i + 1] || '';
      i += 1;
    }
  }
  if (!['create', 'cleanup'].includes(out.action)) fail('Missing or invalid --action (create|cleanup)');
  return out;
}

function ensureInsideRepo(absPath, repoRoot) {
  if (!(absPath === repoRoot || absPath.startsWith(`${repoRoot}${path.sep}`))) {
    fail('target_path resolves outside repository root');
  }
}

function makeRuntimeName() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(
    2,
    '0',
  )}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(
    d.getSeconds(),
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(4).toString('hex');
  return `run-${stamp}-${rand}`;
}

function createWorkspace(targetPath, preferredRuntimeDir) {
  const repoRoot = process.cwd();
  const targetAbs = path.resolve(repoRoot, targetPath);
  ensureInsideRepo(targetAbs, repoRoot);

  let runtimeDir;
  if (preferredRuntimeDir) {
    runtimeDir = path.isAbsolute(preferredRuntimeDir)
      ? path.resolve(preferredRuntimeDir)
      : path.resolve(repoRoot, preferredRuntimeDir);
    fs.mkdirSync(runtimeDir, { recursive: true });
  } else {
    try {
      const osTempRoot = path.join(os.tmpdir(), 'ai-friendly-evaluate');
      fs.mkdirSync(osTempRoot, { recursive: true });
      runtimeDir = path.join(osTempRoot, makeRuntimeName());
      fs.mkdirSync(runtimeDir);
    } catch (_err) {
      const fallbackRoot = path.join(targetAbs, '.ai-friendly-evaluate-tmp');
      fs.mkdirSync(fallbackRoot, { recursive: true });
      runtimeDir = path.join(fallbackRoot, makeRuntimeName());
      fs.mkdirSync(runtimeDir);
    }
  }

  const result = {
    ok: true,
    runtime_dir: runtimeDir,
    intake_answers_file: path.join(runtimeDir, 'intake-answers.json'),
    intake_context_file: path.join(runtimeDir, 'intake-context.json'),
    output_context_file: path.join(runtimeDir, 'output-context.json'),
    score_input_file: path.join(runtimeDir, 'score-input.json'),
    score_output_file: path.join(runtimeDir, 'score-output.json'),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function cleanupWorkspace(runtimeDir) {
  const abs = path.resolve(runtimeDir);
  if (!fs.existsSync(abs)) {
    process.stdout.write(`${JSON.stringify({ ok: true, removed: false, runtime_dir: abs }, null, 2)}\n`);
    return;
  }
  fs.rmSync(abs, { recursive: true, force: true });
  process.stdout.write(`${JSON.stringify({ ok: true, removed: true, runtime_dir: abs }, null, 2)}\n`);
}

function main() {
  const args = parseArgs();
  if (args.action === 'create') {
    if (!args.targetPath) fail('target_path is required for create action');
    createWorkspace(args.targetPath, args.preferredRuntimeDir);
  } else {
    if (!args.runtimeDir) fail('runtime_dir is required for cleanup action');
    cleanupWorkspace(args.runtimeDir);
  }
}

main();
