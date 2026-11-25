import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ceilingFor,
  compareBudget,
  duplicateInstalls,
  exceedsCeiling,
  measureBudget,
  staticClosure,
} from './check-bundle-budget.mjs';

const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-bundle-budget.mjs');

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

test('ceilingFor leaves at least one byte and at most one step of headroom', () => {
  for (const bytes of [1, 255, 256, 257, 2048, 2200, 10_000, 100_000, 2_359_674]) {
    const ceiling = ceilingFor(bytes);
    assert.ok(ceiling > bytes, `${bytes}: ceiling ${ceiling} must exceed the size`);
    assert.ok(
      ceiling - bytes <= Math.max(256, bytes * 0.05),
      `${bytes}: headroom ${ceiling - bytes} must stay near one step`
    );
  }
});

test('ceilingFor is deterministic and monotonic in the measured size', () => {
  assert.equal(ceilingFor(100_000), ceilingFor(100_000));
  assert.ok(ceilingFor(100_000) <= ceilingFor(101_000));
  assert.ok(ceilingFor(101_000) <= ceilingFor(200_000));
});

test('exceedsCeiling is one-sided: any growth past the ceiling fails, a shrink never does', () => {
  assert.equal(exceedsCeiling(10_000, 10_000), false);
  assert.equal(exceedsCeiling(10_000, 10_001), true);
  assert.equal(exceedsCeiling(10_000, 5_000), false);
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

test('compareBudget fails on growth past the ceiling, a new file and a tree-shake flip', () => {
  const live = {
    files: { 'a.js': 10_000, 'new.js': 5 },
    entries: { 'a.js': { export: 'x', treeShake: false } },
  };
  const budget = {
    files: { 'a.js': 10_000 },
    entries: { 'a.js': { export: 'x', treeShake: true } },
  };
  const failures = compareBudget(live, budget);
  assert.ok(failures.some((f) => /new\.js: built but not in the budget/.test(f)));
  assert.ok(failures.some((f) => /treeShake flipped true -> false/.test(f)));

  // A size at or under the ceiling passes, and so does a shrink: ceilings that move
  // with every size wiggle are the exact-byte conflict this budget exists to end.
  assert.deepEqual(
    compareBudget(
      { files: { 'a.js': 10_000 }, entries: {} },
      { files: { 'a.js': 10_000 }, entries: {} }
    ),
    []
  );
  assert.deepEqual(
    compareBudget(
      { files: { 'a.js': 9_000 }, entries: {} },
      { files: { 'a.js': 10_000 }, entries: {} }
    ),
    []
  );
  assert.match(
    compareBudget(
      { files: { 'a.js': 11_000 }, entries: {} },
      { files: { 'a.js': 10_000 }, entries: {} }
    )[0],
    /11000 bytes, ceiling 10000/
  );
  assert.match(
    compareBudget(
      { files: {}, entries: { 'a.js': { export: 'x', treeShake: true } } },
      { files: {}, entries: { 'a.js': { export: 'x', treeShake: false } } }
    )[0],
    /improved false -> true/
  );
});

test('a sentinel that appears in a tree-shaking entry fails', () => {
  const budget = {
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

test('the CLI writes a budget, accepts it, accepts a shrink, then rejects a grown chunk', () => {
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
      `export const alpha = () => ${JSON.stringify('g'.repeat(100))};\nexport const beta = () => 2;\n`
    );
    assert.equal(run().status, 0, 'a shrink passes; the ceiling rarely changes');

    fx.write(
      'pkg/dist/chunk-abc123.js',
      `export const alpha = () => ${JSON.stringify('g'.repeat(9000))};\nexport const beta = () => 2;\n`
    );
    const grown = run();
    assert.equal(grown.status, 1);
    assert.match(grown.stderr, /pkg\/dist\/index\.js: \d+ bytes, ceiling \d+/);
    assert.match(grown.stderr, /--write/);
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

// A package inlined from two install folders at the same version is a stale, un-deduplicated copy
// (a nested node_modules that the lock no longer names). Such a copy made every inlined bundle about
// 45 KB larger on one machine than in CI, so that machine could not check or refresh the budget.
test('duplicateInstalls names a package inlined from two folders at one version', () => {
  const root = mkdtempSync(join(tmpdir(), 'bundle-dup-'));
  try {
    const pkg = (dir, name, version) => {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, 'package.json'), JSON.stringify({ name, version }));
    };
    pkg('node_modules/dep', 'dep', '1.0.0');
    pkg('a/node_modules/dep', 'dep', '1.0.0');
    pkg('b/node_modules/other', 'other', '1.0.0');
    pkg('c/node_modules/other', 'other', '2.0.0');
    const inputs = [
      'node_modules/dep/index.js',
      'a/node_modules/dep/lib/x.js',
      'b/node_modules/other/index.js',
      'c/node_modules/other/index.js',
      'core/dist/index.js',
    ];
    const dups = duplicateInstalls(root, inputs);
    assert.equal(dups.length, 1, JSON.stringify(dups));
    assert.equal(dups[0].name, 'dep');
    assert.equal(dups[0].version, '1.0.0');
    assert.deepEqual(dups[0].dirs, ['a/node_modules/dep', 'node_modules/dep']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('duplicateInstalls reads scoped names and ignores workspace sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'bundle-dup-'));
  try {
    for (const dir of ['node_modules/@s/p', 'x/node_modules/@s/p']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(
        join(root, dir, 'package.json'),
        JSON.stringify({ name: '@s/p', version: '3.0.0' })
      );
    }
    const dups = duplicateInstalls(root, [
      'node_modules/@s/p/a.js',
      'x/node_modules/@s/p/b.js',
      'packages/w/dist/i.js',
    ]);
    assert.deepEqual(
      dups.map((d) => d.name),
      ['@s/p']
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
