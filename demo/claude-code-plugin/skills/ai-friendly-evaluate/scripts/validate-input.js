#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const AI_CONFIG_FILES = ['CLAUDE.md', 'AGENTS.md', '.cursorrules', '.claudeignore', '.cursorignore'];

const AI_CONFIG_DIRS = ['.cursor/rules', '.claude/skills', '.agents/skills'];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { targetPath: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--target-path') {
      out.targetPath = args[i + 1] || '';
      i += 1;
    }
  }
  if (!out.targetPath) fail('Missing required --target-path');
  return out;
}

function validatePackageRoot(absPath) {
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    fail('target_path must be a directory');
  }
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

function findRepoRoot(startPath) {
  let current = startPath;
  while (current !== path.dirname(current)) {
    const gitDir = path.join(current, '.git');
    if (fs.existsSync(gitDir)) {
      return current;
    }
    current = path.dirname(current);
  }
  return startPath;
}

function resolveAIConfig(targetPath, repoRoot) {
  const configs = {
    inherited: [],
    local: [],
    effective: [],
  };

  // Check root directory for inherited configs
  for (const file of AI_CONFIG_FILES) {
    const rootFile = path.join(repoRoot, file);
    if (fs.existsSync(rootFile)) {
      configs.inherited.push({ type: 'file', path: file, location: 'root' });
    }
  }
  for (const dir of AI_CONFIG_DIRS) {
    const rootDir = path.join(repoRoot, dir);
    if (fs.existsSync(rootDir)) {
      configs.inherited.push({ type: 'dir', path: dir, location: 'root' });
    }
  }

  // Check target directory for local configs (only if different from root)
  if (targetPath !== repoRoot) {
    for (const file of AI_CONFIG_FILES) {
      const localFile = path.join(targetPath, file);
      if (fs.existsSync(localFile)) {
        configs.local.push({ type: 'file', path: file, location: 'local' });
      }
    }
    for (const dir of AI_CONFIG_DIRS) {
      const localDir = path.join(targetPath, dir);
      if (fs.existsSync(localDir)) {
        configs.local.push({ type: 'dir', path: dir, location: 'local' });
      }
    }
  }

  // Effective = inherited + local
  configs.effective = [...configs.inherited, ...configs.local];

  return configs;
}

function main() {
  const { targetPath } = parseArgs();
  const cwdRepoRoot = process.cwd();

  if (path.isAbsolute(targetPath)) fail('target_path must be repository-relative, not absolute');
  const resolved = path.resolve(cwdRepoRoot, targetPath.trim());
  if (!(resolved === cwdRepoRoot || resolved.startsWith(`${cwdRepoRoot}${path.sep}`))) {
    fail('target_path resolves outside repository root');
  }
  if (!fs.existsSync(resolved)) fail(`target_path does not exist: ${targetPath}`);

  validatePackageRoot(resolved);

  // Find actual git repo root (may be different from cwd in monorepo)
  const repoRoot = findRepoRoot(resolved);

  // Resolve AI config inheritance
  const aiConfig = resolveAIConfig(resolved, repoRoot);

  const result = {
    ok: true,
    target_path: targetPath.replace(/\\/g, '/'),
    target_abs: resolved,
    target_kind: 'package_root',
    repo_root: repoRoot,
    ai_config: aiConfig,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
