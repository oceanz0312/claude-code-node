#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { input: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--input') {
      out.input = args[i + 1] || '';
      i += 1;
    }
  }
  if (!out.input) fail('Missing required --input');
  return out;
}

function getByAlias(payload, aliases) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) return payload[key];
  }
  return undefined;
}

function optionalString(payload, aliases, label) {
  const value = getByAlias(payload, aliases);
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail(`${label} must be a string when provided`);
  return value.trim();
}

function optionalInt(payload, aliases, label, defaultValue) {
  const value = getByAlias(payload, aliases);
  if (value === undefined || value === null) return defaultValue;
  if (!Number.isInteger(value)) fail(`${label} must be an integer when provided`);
  return value;
}

function normalizeReportLanguage(raw) {
  if (!raw) return 'english';
  const value = raw.trim().toLowerCase();
  const map = {
    english: 'english',
    en: 'english',
    英文: 'english',
    chinese: 'chinese',
    zh: 'chinese',
    中文: 'chinese',
  };
  if (!map[value]) fail('report language must be one of: english, chinese');
  return map[value];
}

function buildDefaultBatchId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `ai-friendly-batch-${yyyy}-${mm}-${dd}`;
}

function slugify(text) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || buildDefaultBatchId();
}

function ensurePackageRoot(repoRoot, target) {
  if (typeof target !== 'string' || !target.trim()) fail('each target must be a non-empty string');
  const rel = target.trim();
  if (path.isAbsolute(rel)) fail(`target must be repository-relative: ${target}`);
  const abs = path.resolve(repoRoot, rel);
  if (!(abs === repoRoot || abs.startsWith(`${repoRoot}${path.sep}`))) {
    fail(`target resolves outside repository root: ${target}`);
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) fail(`target is not a directory: ${target}`);
  const pkg = path.join(abs, 'package.json');
  if (!fs.existsSync(pkg)) fail(`target is not a package root (missing package.json): ${target}`);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  } catch (err) {
    fail(`invalid package.json for target ${target}: ${err.message}`);
  }
  if (!payload || typeof payload.name !== 'string' || !payload.name) {
    fail(`package.json missing non-empty name for target: ${target}`);
  }
  return rel.replace(/\\/g, '/');
}

function main() {
  const { input } = parseArgs();
  const repoRoot = process.cwd();
  if (!fs.existsSync(input)) fail('input file does not exist');

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  } catch (err) {
    fail(`batch intake payload must be valid JSON: ${err.message}`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('batch intake payload must be a JSON object');
  }

  const targetsRaw = getByAlias(payload, ['targets', '批量评估目标包列表']);
  if (!Array.isArray(targetsRaw) || targetsRaw.length === 0) fail('targets must be a non-empty array');

  const seen = new Set();
  const targets = [];
  for (const t of targetsRaw) {
    const normalized = ensurePackageRoot(repoRoot, t);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      targets.push(normalized);
    }
  }

  const batchName = optionalString(payload, ['batch_name', '批次名称'], 'batch name');
  const batchId = batchName ? slugify(batchName) : buildDefaultBatchId();
  const batchOutputDir =
    optionalString(payload, ['batch_output_dir', '批次报告输出目录'], 'batch output directory') ||
    `docs/ai-friendly-evaluation-batch/${batchId}`;
  const rolePref =
    optionalString(payload, ['project_role_preference', '项目角色偏好'], 'project role preference') || 'auto';
  if (!['auto', 'infrastructure', 'business'].includes(rolePref)) {
    fail('project_role_preference must be one of: auto, infrastructure, business');
  }
  const reportLanguage = normalizeReportLanguage(
    optionalString(payload, ['report_language', 'language', '报告语言'], 'report language'),
  );
  const maxParallel = optionalInt(payload, ['max_parallel_subagents', '并发子代理数量'], 'max parallel subagents', 3);
  if (maxParallel < 1 || maxParallel > 4) fail('max_parallel_subagents must be between 1 and 4');
  const notes = optionalString(payload, ['notes', '补充说明'], 'notes');

  const result = {
    ok: true,
    mode: 'batch',
    use_subagents: true,
    max_parallel_subagents: maxParallel,
    targets,
    batch_name: batchName || null,
    batch_id: batchId,
    batch_output_dir: batchOutputDir,
    project_role_preference: rolePref,
    report_language: reportLanguage,
    notes: notes || null,
    confirmation_required: true,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
