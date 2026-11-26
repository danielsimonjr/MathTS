import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * The Coverage job runs the Bun-runtime suite ONCE, as `bun run test:coverage`.
 *
 * Before this change the job ran `bun run test` (which is `turbo run test && vitest run`)
 * and then `bun run test:coverage`. Every package with a `test` script therefore ran its
 * suite on Bun. Now only `test:coverage` runs, so any package that has a `test` script but
 * no `test:coverage` script lost its Bun-runtime run in CI entirely: `assembly`
 * (`@danielsimonjr/mathts-wasm`, whose `test` script is the AssemblyScript suite) is such a
 * package, and no other workflow runs it under Bun (`bun run test:wasm` is a script no
 * workflow calls).
 *
 * This pins the invariant the single run must keep: the coverage suite covers every package
 * that the plain suite covers. Adding a package whose `test:coverage` script is missing is
 * then a failing check rather than a silent drop.
 */

/** Workspace directories that declare a `test` script, keyed by package name. */
function packagesWith(script) {
  const withScript = new Map();
  for (const dir of workspaceDirs()) {
    const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    if (typeof pkg.scripts?.[script] === 'string') withScript.set(pkg.name, dir);
  }
  return withScript;
}

test('the coverage suite runs every package that the plain suite runs', () => {
  const plain = packagesWith('test');
  const coverage = packagesWith('test:coverage');
  const dropped = [...plain.keys()].filter((name) => !coverage.has(name)).sort();
  assert.deepEqual(
    dropped,
    [],
    'these packages have a `test` script but no `test:coverage` script, so the Coverage ' +
      'job (which now runs `test:coverage` alone) never runs their suite on Bun: ' +
      dropped.join(', ')
  );
});
