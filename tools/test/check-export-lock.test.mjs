import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectLockTree, diffTrees } from './check-export-lock.mjs';

const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-export-lock.mjs');

/**
 * A one-package workspace whose barrel re-exports from `impl` the way the published `index.d.ts`
 * files do, plus a private package that must be ignored.
 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'export-lock-'));
  const write = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  write('package.json', JSON.stringify({ name: 'fixture-root', workspaces: ['pkg', 'hidden'] }));
  write(
    'pkg/package.json',
    JSON.stringify({
      name: '@fixture/pkg',
      exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
    })
  );
  write('hidden/package.json', JSON.stringify({ name: '@fixture/hidden', private: true }));
  write('pkg/dist/index.js', "export * from './impl.js';\nexport const direct = 1;\n");
  write(
    'pkg/dist/index.d.ts',
    "export * from './impl.js';\nexport declare const direct: number;\n"
  );
  write('pkg/dist/impl.js', 'export function twice(x) {\n  return x * 2;\n}\n');
  write(
    'pkg/dist/impl.d.ts',
    '/** export function notReal(): void; */\nexport declare function twice(x: number): number;\nexport interface Shape {\n  n: number;\n}\n'
  );
  return { root, write, lock: join(root, 'lock.json') };
}

function run(fixture, ...flags) {
  return spawnSync(
    process.execPath,
    [checker, '--root', fixture.root, '--lock', fixture.lock, ...flags],
    { encoding: 'utf8' }
  );
}

test('names behind `export *` are locked, comments and private packages are not', () => {
  const fx = makeFixture();
  try {
    const tree = collectLockTree(fx.root);
    assert.deepEqual(Object.keys(tree), ['@fixture/pkg']);
    assert.deepEqual(tree['@fixture/pkg']['.'], {
      Shape: { kind: 'type' },
      direct: { kind: 'number' },
      twice: { kind: 'function' },
    });
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a matching tree passes and an added name fails until the lock is rewritten', () => {
  const fx = makeFixture();
  try {
    assert.equal(run(fx, '--write').status, 0);
    assert.equal(run(fx).status, 0, 'unchanged tree must match its own lock');

    fx.write(
      'pkg/dist/impl.js',
      'export function twice(x) {\n  return x * 2;\n}\nexport const extra = 3;\n'
    );
    fx.write(
      'pkg/dist/impl.d.ts',
      readFileSync(join(fx.root, 'pkg/dist/impl.d.ts'), 'utf8') +
        'export declare const extra: number;\n'
    );
    const added = run(fx);
    assert.equal(added.status, 1);
    assert.match(added.stderr, /added extra \(number\)/);

    assert.equal(run(fx, '--write').status, 0);
    assert.equal(run(fx).status, 0, 'a rewritten lock accepts the new name');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a removed name and a changed kind both fail', () => {
  const fx = makeFixture();
  try {
    assert.equal(run(fx, '--write').status, 0);

    fx.write('pkg/dist/index.js', "export * from './impl.js';\nexport const direct = () => 1;\n");
    const changed = run(fx);
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /direct changed number -> function/);

    fx.write('pkg/dist/index.js', "export * from './impl.js';\n");
    fx.write('pkg/dist/index.d.ts', "export * from './impl.js';\n");
    const removed = run(fx);
    assert.equal(removed.status, 1);
    assert.match(removed.stderr, /removed direct/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a declared value that the built entry does not export is locked as missing', () => {
  const fx = makeFixture();
  try {
    fx.write('pkg/dist/index.js', "export * from './impl.js';\n");
    const tree = collectLockTree(fx.root);
    assert.deepEqual(tree['@fixture/pkg']['.'].direct, { kind: 'missing' });
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a missing lock file fails instead of passing', () => {
  const fx = makeFixture();
  try {
    const result = run(fx);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing .*lock\.json/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('diffTrees reports a removed entry point', () => {
  const lines = diffTrees({ pkg: {} }, { pkg: { './x': { a: { kind: 'type' } } } });
  assert.deepEqual(lines, ['pkg ./x: entry point removed']);
});
