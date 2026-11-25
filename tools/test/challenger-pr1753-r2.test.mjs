/**
 * Challenger round 2 for PR #1753, after the fix commits 78f275e0 and 8baa9ddc.
 *
 * Round 1 raised five findings. The fix commits resolve four of them properly:
 * the docs-only manifest entry, the compat runtime cycle (verified with
 * repo-tools: runtimeCircularDeps is 2 again), the removed-bundle-case check and
 * the missing-maxBytes check. This file pins the one that is only partly fixed.
 *
 *  `loosenedCeilingFailure` accepts ANY ceiling that equals `ceilingFor(size)`
 *  for some size, however large, because the 10x guard only applies when the
 *  ceiling is NOT canonical (`ceilingFor(recorded) !== maxBytes`). So setting
 *  `core/dist/index.js` to `ceilingFor(100 * 270000)` passes the gate and hides
 *  a 100x growth, which is exactly what finding 5 asked to prevent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareBudget, ceilingFor, loosenedCeilingFailure } from './check-bundle-budget.mjs';

test('a canonical ceiling far above the measured size still fails', () => {
  const actual = 270_000;
  const inflated = ceilingFor(actual * 100); // canonical: ceilingFor is the source of this value
  const failures = compareBudget(
    { files: { 'core/dist/index.js': actual }, entries: {}, bundles: [] },
    { files: { 'core/dist/index.js': inflated }, entries: {}, bundles: [] }
  );
  assert.ok(
    failures.length > 0,
    `a ceiling of ceilingFor(100x actual) (${inflated}) must fail; it was accepted, so ` +
      'any growth up to that ceiling is now invisible in the budget file'
  );
});

test('loosenedCeilingFailure rejects a canonical ceiling above the 10x window', () => {
  // The guard's own contract: a ceiling may sit at most one ceilingFor step above
  // the measured size, plus whatever implied shrink the 10x window tolerates.
  for (const actual of [10_000, 270_000, 2_400_000]) {
    for (const mult of [10, 100, 1000]) {
      const inflated = ceilingFor(actual * mult);
      assert.notEqual(
        loosenedCeilingFailure('entry', inflated, actual),
        null,
        `ceilingFor(${mult}x ${actual}) = ${inflated} must be reported as loosened`
      );
    }
  }
});

test('a deliberate one-step ceiling is still accepted (no false positive)', () => {
  const actual = 270_000;
  const tight = ceilingFor(actual);
  assert.equal(
    loosenedCeilingFailure('entry', tight, actual),
    null,
    'the exact ceilingFor(actual) is what --write produces and must pass'
  );
});
