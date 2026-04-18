#!/usr/bin/env node
const fs = require('fs');

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

function requireNonEmptyString(payload, aliases, label) {
  const value = getByAlias(payload, aliases);
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
  return value.trim();
}

function optionalString(payload, aliases, label) {
  const value = getByAlias(payload, aliases);
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail(`${label} must be a string when provided`);
  return value.trim();
}

function buildDefaultReportTitle() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `AI Friendly Evaluation Report - ${yyyy}-${mm}-${dd}`;
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

function main() {
  const { input } = parseArgs();
  if (!fs.existsSync(input)) fail('input file does not exist');
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  } catch (err) {
    fail(`intake payload must be valid JSON: ${err.message}`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('intake payload must be a JSON object');
  }

  const targetPath = requireNonEmptyString(
    payload,
    ['target_path', '被评估包根目录', '评估目标包路径'],
    'package root path',
  );
  const evaluationGoal = optionalString(payload, ['evaluation_goal', '本次评估目标', '评估目标'], 'evaluation goal');
  const reportTitle = evaluationGoal || buildDefaultReportTitle();
  const outputPath = optionalString(payload, ['output_path', '报告保存位置', '报告输出位置'], 'output path');
  const rolePref =
    optionalString(payload, ['project_role_preference', '项目角色偏好'], 'project role preference') || 'auto';
  if (!['auto', 'infrastructure', 'business'].includes(rolePref)) {
    fail('project_role_preference must be one of: auto, infrastructure, business');
  }
  const reportLanguage = normalizeReportLanguage(
    optionalString(payload, ['report_language', 'language', '报告语言'], 'report language'),
  );
  const notes = optionalString(payload, ['notes', '补充说明'], 'notes');

  const result = {
    ok: true,
    target_path: targetPath,
    evaluation_goal: evaluationGoal || null,
    report_title: reportTitle,
    output_path: outputPath || null,
    project_role_preference: rolePref,
    report_language: reportLanguage,
    notes: notes || null,
    confirmation_required: true,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
