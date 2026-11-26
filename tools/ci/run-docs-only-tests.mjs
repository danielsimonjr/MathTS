#!/usr/bin/env node
/**
 * Subset of documentation-consuming tests for docs-only pull requests (CI Test 22.x leg).
 * Expects `bun run build` to have run; exits 1 on any failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../test/workspaces.mjs';

if (typeof globalThis.Bun !== 'undefined') {
  console.error('run-docs-only-tests: use Node, not Bun.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/ci/docs-only-manifest.json'), 'utf8'));
const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');

/** Run a subprocess and exit the runner on non-zero status. */
function run(label, args, cwd = repoRoot) {
  console.log(`\n::group::${label}`);
  const child = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  console.log('::endgroup::');
  if (child.status !== 0) {
    console.error(`run-docs-only-tests: ${label} failed (exit ${child.status ?? 'error'})`);
    process.exit(child.status ?? 1);
  }
}

if (!existsSync(vitestBin)) {
  console.error('run-docs-only-tests: vitest missing — run bun install');
  process.exit(1);
}

/**
 * Root vitest.config.ts includes only `tests/{docs,integration,wasm}`.
 * Package tests need that package's config, whose include is `tests/**`.
 * @param {string} file repo-relative test path
 */
function vitestTarget(file) {
  const testsAt = file.indexOf('/tests/');
  if (testsAt === -1) {
    return { cwd: repoRoot, args: [vitestBin, 'run', file] };
  }
  const pkg = file.slice(0, testsAt);
  const config = join(repoRoot, pkg, 'vitest.config.ts');
  if (!existsSync(config)) {
    return { cwd: repoRoot, args: [vitestBin, 'run', file] };
  }
  return {
    cwd: join(repoRoot, pkg),
    args: [vitestBin, 'run', '--config', config, file.slice(testsAt + 1)],
  };
}

for (const entry of manifest.vitest) {
  if (typeof entry === 'string') {
    const target = vitestTarget(entry);
    run(`vitest ${entry}`, target.args, target.cwd);
    continue;
  }
  const target = vitestTarget(entry.file);
  target.args.push('-t', entry.testNamePattern);
  run(`vitest ${entry.file} (${entry.testNamePattern})`, target.args, target.cwd);
}

for (const rel of manifest.nodeTest ?? []) {
  run(`node --test ${rel}`, ['--test', rel]);
}

for (const cmd of manifest.commands ?? []) {
  console.log(`\n::group::${cmd}`);
  const child = spawnSync(cmd, { cwd: repoRoot, stdio: 'inherit', shell: true });
  console.log('::endgroup::');
  if (child.status !== 0) {
    console.error(`run-docs-only-tests: ${cmd} failed`);
    process.exit(child.status ?? 1);
  }
}

console.log('run-docs-only-tests: all documentation gates passed');