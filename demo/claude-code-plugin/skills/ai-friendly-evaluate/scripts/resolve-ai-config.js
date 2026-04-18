#!/usr/bin/env node
/**
 * resolve-ai-config.js
 *
 * Automatically discovers and summarizes effective AI configuration files.
 * In monorepo environments, this traces from target path up to repo root
 * to find inherited configuration.
 *
 * Usage:
 *   node resolve-ai-config.js --target-path "subspaces/webapp_main/libs/webapp-fe-shared" [--repo-root "/path/to/repo"]
 */

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
  const out = { targetPath: '', repoRoot: '' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--target-path') {
      out.targetPath = args[i + 1] || '';
      i += 1;
    } else if (args[i] === '--repo-root') {
      out.repoRoot = args[i + 1] || '';
      i += 1;
    }
  }
  if (!out.targetPath) fail('Missing required --target-path');
  return out;
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
      const files = listDirFiles(rootDir);
      configs.inherited.push({ type: 'dir', path: dir, location: 'root', files });
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
        const files = listDirFiles(localDir);
        configs.local.push({ type: 'dir', path: dir, location: 'local', files });
      }
    }
  }

  // Effective = inherited + local
  configs.effective = [...configs.inherited, ...configs.local];

  return configs;
}

function listDirFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath).filter((f) => f.endsWith('.md') || f.endsWith('.txt'));
  } catch {
    return [];
  }
}

function main() {
  const { targetPath, repoRoot: providedRepoRoot } = parseArgs();

  // Resolve target path
  const absTarget = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(absTarget)) {
    fail(`target_path does not exist: ${targetPath}`);
  }

  // Find or use repo root
  const repoRoot = providedRepoRoot
    ? path.isAbsolute(providedRepoRoot)
      ? providedRepoRoot
      : path.resolve(process.cwd(), providedRepoRoot)
    : findRepoRoot(absTarget);

  const configs = resolveAIConfig(absTarget, repoRoot);

  const result = {
    target_path: targetPath.replace(/\\/g, '/'),
    target_abs: absTarget,
    repo_root: repoRoot,
    ai_config: configs,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
