#!/usr/bin/env node
/**
 * Bun test runner for compat. `unary-fast-path.test.ts` must run in its own process:
 * `mock.module('@danielsimonjr/mathts-functions')` must install before shims load; other
 * suites import the real package at top level and share a worker with the default runner.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const testsDir = join(root, 'tests');
const unary = join(testsDir, 'unary-fast-path.test.ts');
const isolateFlag = ['--isolate', '--timeout', '240000'];
const extra = process.argv.slice(2);
const hasCoverage = extra.includes('--coverage');
const coverageRoot = join(root, 'coverage');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.test.ts') && p !== unary) acc.push(relative(root, p));
  }
  return acc;
}

function runBatch(paths, coverageDir) {
  const covArgs = coverageDir ? ['--coverage', '--coverage-dir', coverageDir] : [];
  const bunArgs = [
    'test',
    ...isolateFlag,
    ...extra.filter((a) => a !== '--' && a !== '--coverage'),
    ...covArgs,
    ...paths,
  ];
  return spawnSync('bun', bunArgs, { cwd: root, stdio: 'inherit' });
}

const others = walk(testsDir);

if (hasCoverage) {
  let r = runBatch(others, coverageRoot);
  if (r.status !== 0) process.exit(r.status ?? 1);
  // Unary #889 is isolated for mock.module; src coverage is measured by the main batch.
  r = runBatch([relative(root, unary)]);
  process.exit(r.status ?? 0);
}

let r = runBatch(others);
if (r.status !== 0) process.exit(r.status ?? 1);

r = runBatch([relative(root, unary)]);
process.exit(r.status ?? 0);