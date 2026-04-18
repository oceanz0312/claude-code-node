#!/usr/bin/env node
const fs = require('fs');

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { input: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--input') {
      result.input = args[i + 1] || '';
      i += 1;
    }
  }
  if (!result.input) fail('Missing required --input');
  return result;
}

function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function cappedGrade(baseGrade, capGrade) {
  const order = { A: 4, B: 3, C: 2, D: 1 };
  return order[baseGrade] <= order[capGrade] ? baseGrade : capGrade;
}

function getBaseWeights(role) {
  if (role === 'infrastructure') {
    return { D1: 0.2, D2: 0.15, D3: 0.15, D4: 0.15, D5: 0.1, D6: 0.15, D7: 0.05, D8: 0.05 };
  }
  return { D1: 0.2, D2: 0.15, D3: 0.17, D4: 0.15, D5: 0.12, D6: 0.08, D7: 0.08, D8: 0.05 };
}

function validateDimensions(scores, d9Activated) {
  const required = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
  if (d9Activated) required.push('D9');
  const missing = required.filter((k) => !(k in scores));
  if (missing.length > 0) fail(`Missing dimension scores: ${JSON.stringify(missing)}`);

  Object.entries(scores).forEach(([k, v]) => {
    if (typeof v !== 'number' || Number.isNaN(v)) fail(`Invalid score type for ${k}`);
    if (v < 0 || v > 100) fail(`Score for ${k} must be within [0, 100], got ${v}`);
  });
}

function applyShortboardCorrection(scores, role, rawTotal) {
  const keyDims = role === 'infrastructure' ? ['D1', 'D4', 'D6'] : ['D1', 'D4'];
  let finalGradeCap = gradeFromScore(rawTotal);
  const capReasons = [];

  keyDims.forEach((dim) => {
    if (scores[dim] < 40) {
      finalGradeCap = cappedGrade(finalGradeCap, 'C');
      capReasons.push(`${dim}<40 -> cap C`);
    } else if (scores[dim] < 60) {
      finalGradeCap = cappedGrade(finalGradeCap, 'B');
      capReasons.push(`${dim}<60 -> cap B`);
    }
  });

  const nonKeyDims = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'].filter((d) => !keyDims.includes(d));
  const lowNonKey = nonKeyDims.filter((d) => scores[d] < 40);
  const penaltyTriggered = lowNonKey.length >= 2;
  const correctedTotal = Math.max(0, penaltyTriggered ? rawTotal - 5 : rawTotal);

  let correctedGrade = gradeFromScore(correctedTotal);
  if (capReasons.length > 0) correctedGrade = cappedGrade(correctedGrade, finalGradeCap);

  return { correctedTotal, correctedGrade, capReasons, penaltyTriggered };
}

function main() {
  const { input } = parseArgs();
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  } catch (err) {
    fail(`Cannot read input JSON: ${err.message}`);
  }

  const role = payload.role;
  if (!['infrastructure', 'business'].includes(role)) {
    fail('role must be one of: infrastructure, business');
  }

  const d9Activated = Boolean(payload.d9_activated);
  const scores = payload.scores;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) fail('scores must be an object');
  validateDimensions(scores, d9Activated);

  const weights = getBaseWeights(role);
  const baseTotal = Object.entries(weights).reduce((acc, [k, w]) => acc + scores[k] * w, 0);
  const rawTotal = d9Activated ? baseTotal * 0.9 + scores.D9 * 0.1 : baseTotal;
  const corrected = applyShortboardCorrection(scores, role, rawTotal);

  const result = {
    role,
    d9_activated: d9Activated,
    base_total: Number(baseTotal.toFixed(2)),
    raw_total: Number(rawTotal.toFixed(2)),
    raw_grade: gradeFromScore(rawTotal),
    corrected_total: Number(corrected.correctedTotal.toFixed(2)),
    corrected_grade: corrected.correctedGrade,
    grade_cap_reasons: corrected.capReasons,
    non_key_penalty_triggered: corrected.penaltyTriggered,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
