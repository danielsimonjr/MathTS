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

for (const entry of manifest.vitest) {
  if (typeof entry === 'string') {
    run(`vitest ${entry}`, [vitestBin, 'run', entry]);
    continue;
  }
  const args = [vitestBin, 'run', entry.file, '-t', entry.testNamePattern];
  run(`vitest ${entry.file} (${entry.testNamePattern})`, args);
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