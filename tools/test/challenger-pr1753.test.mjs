/**
 * Challenger review of PR #1753 ("ci: conflict-free changelog fragments,
 * budget and known-gaps"). Each test pins a property the PR claims or must not
 * break, and fails against the PR head (9f76f9cd), so the finding is
 * reproducible locally instead of only in CI.
 *
 *  1. The docs-only CI guard is green.  [REGRESSION: breaks Compile & Lint]
 *  2. The compat split adds no runtime import cycle.  [REGRESSION: breaks
 *     Architecture docs, runtimeCircularDeps 2 -> 3]
 *  3. A bundle case removed from the budget fails.  [gate gap, also on main]
 *  4. A bundle case with no recorded ceiling fails.  [gate gap, also on main]
 *  5. A hand-inflated ceiling fails.  [REGRESSION: main pinned `tolerance` so a
 *     loosened budget failed; the ceiling rewrite deleted that check]
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uncoveredMdConsumers } from '../ci/discover-md-consumers.mjs';
import { compareBudget } from './check-bundle-budget.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('every test file that reads Markdown at runtime is in docs-only-manifest.json', () => {
  const uncovered = uncoveredMdConsumers();
  assert.deepEqual(
    uncovered,
    [],
    'Compile & Lint runs tools/test/docs-only-ci-guard.test.mjs; this PR adds ' +
      'tools/test/check-changelog-fragment.test.mjs (it names docs/api/... paths) ' +
      'but never registers it, so the required check is red.'
  );
});

test('the compat source tree has no runtime import cycle', async () => {
  const dir = join(repoRoot, 'compat', 'src');
  /** @type {Map<string, string[]>} */
  const graph = new Map();
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8')
      // `import type` / `export type` are erased at compile time and cannot cycle at runtime.
      .replace(/^\s*import\s+type\s+[\s\S]*?;?\s*$/gm, '')
      .replace(/^\s*export\s+type\s+[\s\S]*?;?\s*$/gm, '');
    const deps = [];
    for (const m of text.matchAll(
      /^\s*(?:import|export)\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/gm
    )) {
      deps.push(m[2].replace(/^\.\//, '').replace(/\.js$/, '.ts'));
    }
    graph.set(name, deps);
  }

  const cycles = new Set();
  const visit = (node, stack) => {
    const at = stack.indexOf(node);
    if (at >= 0) {
      cycles.add([...stack.slice(at), node].join(' -> '));
      return;
    }
    for (const dep of graph.get(node) ?? []) {
      if (graph.has(dep)) visit(dep, [...stack, node]);
    }
  };
  for (const name of graph.keys()) visit(name, []);

  assert.deepEqual(
    [...cycles],
    [],
    'the new `index.ts -> named-instance-exports.ts -> index.ts` runtime cycle ' +
      'raises runtimeCircularDeps from 2 to 3; ARCHITECTURE.md and OVERVIEW.md ' +
      'claim 2, so the Architecture docs job fails.'
  );
});

test('a bundle case that the budget does not list fails the check', () => {
  const live = {
    files: {},
    entries: {},
    bundles: [
      { label: 'functions barrel evaluate', bytes: 1_500_000, import: 'x', platform: 'node' },
    ],
  };
  const budget = { files: {}, entries: {}, bundles: [] };
  const failures = compareBudget(live, budget);
  assert.ok(
    failures.some((f) => /functions barrel evaluate/.test(f)),
    'a bundle case REMOVED from the budget must fail, as a removed file or ' +
      `tree-shake entry already does; got ${JSON.stringify(failures)}`
  );
});

test('a bundle case with no recorded ceiling fails instead of being unenforced', () => {
  const live = {
    files: {},
    entries: {},
    bundles: [{ label: 'compat create(all)', bytes: 9_000_000, import: 'x', platform: 'node' }],
  };
  const budget = {
    files: {},
    entries: {},
    bundles: [{ label: 'compat create(all)', import: 'x', platform: 'node' }],
  };
  const failures = compareBudget(live, budget);
  assert.ok(
    failures.length > 0,
    'a budget bundle entry without maxBytes must fail: `actual > undefined` is ' +
      'false, so the case passes no matter how large the bundle grows'
  );
});

test('a hand-inflated ceiling fails so a growth cannot be hidden by editing the budget', () => {
  // Verified by hand against origin/main: `compareBudget` there reports
  // "core/dist/index.js: 270000 bytes, budget 27000000" (outside the pinned
  // tolerance). On the PR head the same inflated budget returns []. `tolerance`
  // was pinned by compareBudget and a test named "a loosened tolerance in the
  // budget file fails"; the ceiling rewrite deleted both, so nothing now ties a
  // committed ceiling to the size it was written from.
  const live = { files: { 'core/dist/index.js': 270_000 }, entries: {}, bundles: [] };
  const budget = { files: { 'core/dist/index.js': 27_000_000 }, entries: {}, bundles: [] };
  const failures = compareBudget(live, budget);
  assert.ok(
    failures.some((f) => /core\/dist\/index\.js/.test(f)),
    'a ceiling 100x the measured size must fail, as it did on main'
  );
});
