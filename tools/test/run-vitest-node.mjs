#!/usr/bin/env node
/**
 * Run the WHOLE MathTS test suite under vitest on real Node.
 *
 * `bun run test` executes every package script on the Bun runtime (`[run] bun = true`), so it
 * never proves that the tests pass on the Node versions that consumers use. This script runs on
 * the Node that starts it and spawns every child with `process.execPath`, so each test process
 * is that same Node:
 *
 * 1. `vitest run` in every workspace package that has a `vitest.config.ts`. The package config
 *    supplies the vitest equivalent of its Bun-only setup (`define` for `__PKG_VERSION__`, and
 *    a separate snapshot path in `plot`).
 * 2. `vitest run` with the root `vitest.config.ts` (`tests/integration`, `tests/wasm`).
 * 3. The standalone Node test scripts of packages without a vitest config (`assembly`): every
 *    `node <file>` command in its `test` and `test:diff` scripts.
 *
 * The script refuses to run under Bun. It exits 1 when any step fails, and it prints one summary
 * line per step. Prerequisite: `bun run build:wasm && bun run build`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

if (typeof globalThis.Bun !== 'undefined') {
  console.error('run-vitest-node: this script must run on Node, not Bun.');
  process.exit(1);
}

const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const results = [];

/**
 * Run one command with the current Node binary and record its exit status.
 * @param {string} label - name printed in the summary.
 * @param {string} cwd - working directory.
 * @param {string[]} args - arguments after the Node binary.
 */
function run(label, cwd, args) {
  console.log(`\n::group::${label} (node ${process.version})`);
  const child = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  console.log('::endgroup::');
  const status = child.error ? `spawn error: ${child.error.message}` : child.status;
  results.push({ label, ok: child.status === 0, status });
}

console.log(
  `[runtime-probe] runner process.version=${process.version} typeof Bun=${typeof globalThis.Bun}`
);

for (const dir of workspaceDirs()) {
  const cwd = join(repoRoot, dir);
  if (existsSync(join(cwd, 'vitest.config.ts'))) {
    run(`vitest ${dir}`, cwd, [vitestBin, 'run']);
    continue;
  }
  const scripts = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).scripts ?? {};
  const nodeFiles = [scripts.test, scripts['test:diff']]
    .filter(Boolean)
    .flatMap((script) => script.split('&&').map((part) => part.trim()))
    .filter((part) => /^node \S+$/.test(part))
    .map((part) => part.slice('node '.length));
  if (nodeFiles.length === 0) {
    results.push({
      label: `${dir}: no vitest config and no node test scripts`,
      ok: false,
      status: 'none',
    });
    continue;
  }
  for (const file of nodeFiles) run(`node ${dir}/${file}`, cwd, [file]);
}

run('vitest root (tests/integration, tests/wasm)', repoRoot, [vitestBin, 'run']);

console.log(`\nrun-vitest-node summary (node ${process.version}):`);
for (const r of results)
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.label}${r.ok ? '' : ` (exit ${r.status})`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`run-vitest-node: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
