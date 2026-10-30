import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  compareBudget,
  exceedsTolerance,
  measureBudget,
  staticClosure,
} from './check-bundle-budget.mjs';

const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-bundle-budget.mjs');
const TOLERANCE = { bytes: 512, ratio: 0.01 };

/**
 * One package whose entry imports a hash-named chunk, as tsdown emits for `core`. `alpha` is small;
 * `beta` is a pure function that returns a large string, so a one-name import of `alpha` can drop
 * it. With `keepBeta`, load-time code calls `beta`, so nothing can be dropped.
 */
function makeFixture({ keepBeta = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
  const write = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  write('package.json', JSON.stringify({ name: 'fixture-root', workspaces: ['pkg'] }));
  write(
    'pkg/package.json',
    JSON.stringify({
      name: '@fixture/pkg',
      exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
    })
  );
  write('pkg/dist/index.js', "export { alpha, beta } from './chunk-abc123.js';\n");
  write(
    'pkg/dist/chunk-abc123.js',
    `export function alpha() {\n  return 1;\n}\nexport function beta() {\n  return ${JSON.stringify(`SENTINEL_BETA${'x'.repeat(4000)}`)};\n}\n${keepBeta ? 'globalThis.kept = beta();\n' : ''}`
  );
  const lock = {
    '@fixture/pkg': { '.': { alpha: { kind: 'function' }, beta: { kind: 'function' } } },
  };
  return { root, write, lock, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('exceedsTolerance uses the larger of bytes and ratio, in both directions', () => {
  assert.equal(exceedsTolerance(10_000, 10_400, TOLERANCE), false);
  assert.equal(exceedsTolerance(10_000, 9_400, TOLERANCE), true);
  assert.equal(exceedsTolerance(10_000, 10_600, TOLERANCE), true);
  assert.equal(exceedsTolerance(1_000_000, 1_009_000, TOLERANCE), false);
  assert.equal(exceedsTolerance(1_000_000, 1_011_000, TOLERANCE), true);
});

test('an entry is sized together with the chunk it imports', () => {
  const fx = makeFixture();
  try {
    const entry = join(fx.root, 'pkg/dist/index.js');
    const closure = staticClosure(entry).map((file) => basename(file));
    assert.deepEqual(closure.sort(), ['chunk-abc123.js', 'index.js']);
    const { files } = measureBudget(fx.root, fx.lock);
    assert.ok(files['pkg/dist/index.js'] > statSync(entry).size + 4000, 'chunk bytes are counted');
  } finally {
    fx.cleanup();
  }
});

test('a one-name import drops the unused export, and the sentinel with it', () => {
  const fx = makeFixture();
  try {
    const { entries } = measureBudget(fx.root, fx.lock);
    assert.deepEqual(entries['pkg/dist/index.js'], { export: 'alpha', treeShake: true });
  } finally {
    fx.cleanup();
  }
});

test('load-time use of the other export defeats tree-shaking', () => {
  const fx = makeFixture({ keepBeta: true });
  try {
    const { entries } = measureBudget(fx.root, fx.lock);
    assert.equal(entries['pkg/dist/index.js'].treeShake, false);
  } finally {
    fx.cleanup();
  }
});

test('compareBudget fails on growth, shrinkage, a new file and a tree-shake flip', () => {
  const live = {
    files: { 'a.js': 10_000, 'new.js': 5 },
    entries: { 'a.js': { export: 'x', treeShake: false } },
  };
  const budget = {
    tolerance: TOLERANCE,
    files: { 'a.js': 10_000 },
    entries: { 'a.js': { export: 'x', treeShake: true } },
  };
  const failures = compareBudget(live, budget);
  assert.ok(failures.some((f) => /new\.js: built but not in the budget/.test(f)));
  assert.ok(failures.some((f) => /treeShake flipped true -> false/.test(f)));

  assert.deepEqual(
    compareBudget(
      { files: { 'a.js': 10_300 }, entries: {} },
      { tolerance: TOLERANCE, files: { 'a.js': 10_000 }, entries: {} }
    ),
    []
  );
  assert.match(
    compareBudget(
      { files: { 'a.js': 11_000 }, entries: {} },
      { tolerance: TOLERANCE, files: { 'a.js': 10_000 }, entries: {} }
    )[0],
    /11000 bytes, budget 10000/
  );
  assert.match(
    compareBudget(
      { files: { 'a.js': 9_000 }, entries: {} },
      { tolerance: TOLERANCE, files: { 'a.js': 10_000 }, entries: {} }
    )[0],
    /9000 bytes, budget 10000/
  );
  assert.match(
    compareBudget(
      { files: {}, entries: { 'a.js': { export: 'x', treeShake: true } } },
      { tolerance: TOLERANCE, files: {}, entries: { 'a.js': { export: 'x', treeShake: false } } }
    )[0],
    /improved false -> true/
  );
});

test('a sentinel that appears in a tree-shaking entry fails', () => {
  const budget = {
    tolerance: TOLERANCE,
    files: {},
    entries: {
      'a.js': { export: 'x', treeShake: true, sentinel: 'kilogram', sentinelPresent: false },
    },
  };
  const live = {
    files: {},
    entries: {
      'a.js': { export: 'x', treeShake: true, sentinel: 'kilogram', sentinelPresent: true },
    },
  };
  assert.match(compareBudget(live, budget)[0], /sentinel kilogram appeared/);
});

test('a loosened tolerance in the budget file fails', () => {
  const live = { files: {}, entries: {} };
  const failures = compareBudget(live, {
    tolerance: { bytes: 1e9, ratio: 1 },
    files: {},
    entries: {},
  });
  assert.match(failures[0], /tolerance must stay/);
});

test('the CLI writes a budget, accepts it, then rejects a grown chunk', () => {
  const fx = makeFixture();
  try {
    const lockPath = join(fx.root, 'lock.json');
    const budgetPath = join(fx.root, 'budget.json');
    writeFileSync(lockPath, JSON.stringify(fx.lock));
    const run = (...flags) =>
      spawnSync(
        process.execPath,
        [checker, '--root', fx.root, '--lock', lockPath, '--budget', budgetPath, ...flags],
        {
          encoding: 'utf8',
        }
      );
    assert.equal(run('--write').status, 0);
    assert.equal(run().status, 0);

    fx.write(
      'pkg/dist/chunk-abc123.js',
      `export const alpha = () => ${JSON.stringify('g'.repeat(9000))};\nexport const beta = () => 2;\n`
    );
    const grown = run();
    assert.equal(grown.status, 1);
    assert.match(grown.stderr, /pkg\/dist\/index\.js: \d+ bytes, budget \d+/);
  } finally {
    fx.cleanup();
  }
});

test('a missing budget file fails instead of passing', () => {
  const fx = makeFixture();
  try {
    const lockPath = join(fx.root, 'lock.json');
    writeFileSync(lockPath, JSON.stringify(fx.lock));
    const result = spawnSync(
      process.execPath,
      [checker, '--root', fx.root, '--lock', lockPath, '--budget', join(fx.root, 'none.json')],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing/);
  } finally {
    fx.cleanup();
  }
});
