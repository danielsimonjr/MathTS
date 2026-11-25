#!/usr/bin/env node
/**
 * Local pre-push gate: the cheap CI checks, run before `git push` so a push does not
 * discover them in CI minutes later.
 *
 *   bun run prepush
 *
 * Runs, in order (every step runs; the script exits 1 when any step failed):
 *   1. bun run lint                            oxlint --deny-warnings (repo-wide zero, warnings included)
 *   2. bun run format:check                    prettier
 *   3. node tools/test/check-code-docs.mjs     MUST doc-comment gate (build-free)
 *   4. node tools/test/check-bundle-budget.mjs bundle sizes + tree-shake record
 *
 * The heavy gates (typecheck, tests, coverage) still run only in CI. check-bundle-budget
 * reads the built dist of `bun run build`, so run that first after a checkout or a
 * dependency change; without a dist this gate fails with that reminder, not with a
 * confusing "in the budget but not built" list.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');

/**
 * One gate step: an argv to spawn in the repository root.
 * @typedef {{ name: string, args: string[] }} Step
 */

/** @type {Step[]} */
const steps = [
  { name: 'lint (oxlint --deny-warnings)', args: ['bun', 'run', 'lint'] },
  { name: 'format:check (prettier)', args: ['bun', 'run', 'format:check'] },
  { name: 'code-docs check', args: ['node', 'tools/test/check-code-docs.mjs'] },
];

const distMarker = join(repoRoot, 'core', 'dist', 'index.js');
if (!existsSync(distMarker)) {
  console.error(
    'prepush: no built dist found (core/dist/index.js is missing).\n' +
      '  Run `bun run build` first — check-bundle-budget reads the built dist.'
  );
  process.exit(1);
}
steps.push({ name: 'bundle budget', args: ['node', 'tools/test/check-bundle-budget.mjs'] });

let failed = false;
for (const step of steps) {
  console.log(`\nprepush: ${step.name}`);
  const child = spawnSync(step.args[0], step.args.slice(1), { cwd: repoRoot, stdio: 'inherit' });
  if (child.status !== 0) {
    failed = true;
    console.error(
      `prepush: FAIL ${step.name}${child.status === null ? ` (${child.error?.message})` : ` (exit ${child.status})`}`
    );
  }
}

if (failed) {
  console.error('\nprepush: FAIL — fix the steps above before pushing.');
  process.exit(1);
}
console.log('\nprepush: OK — all pre-push gates pass.');
