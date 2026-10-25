/**
 * Unit tests for dist-freshness preflight in generate-functions-reference.mjs.
 *
 *   node --test tools/test/dist-freshness.test.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const GENERATOR = join(REPO, 'tools/generate-functions-reference.mjs');

const root = mkdtempSync(join(tmpdir(), 'dist-freshness-'));
after(() => rmSync(root, { recursive: true, force: true }));

/** Write `files` (relative path -> text) under a new directory and return its path. */
function fixture(name, files) {
  const dir = join(root, name);
  for (const [rel, text] of Object.entries(files)) {
    const file = join(dir, rel);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

function runPreflight(pkgDir) {
  return spawnSync(process.execPath, [GENERATOR, '--preflight-only', pkgDir], {
    encoding: 'utf8',
    cwd: REPO,
  });
}

const PKG_JSON = {
  name: '@test/dist-freshness-fixture',
  type: 'module',
  exports: { '.': { import: './dist/index.js' } },
};

describe('generate-functions-reference preflight', () => {
  test('missing dist entry exits 1 with build hint', () => {
    const dir = fixture('no-dist', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': 'export const kept = 1;\n',
    });
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /dist\/index\.js/);
    assert.match(r.stderr, /bun run build/);
  });

  test('src file newer than dist exits 1 and names the file', () => {
    const dir = fixture('mtime', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': "export * from './leaf.js';\nexport const kept = 1;\n",
      'src/leaf.ts': 'export const fromLeaf = 2;\n',
      'dist/index.js': 'export const kept = 1;\nexport const fromLeaf = 2;\n',
    });
    const dist = join(dir, 'dist/index.js');
    const leaf = join(dir, 'src/leaf.ts');
    const base = Date.now() / 1000;
    utimesSync(dist, base - 10, base - 10);
    utimesSync(leaf, base + 5, base + 5);
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /src\/leaf\.ts/);
  });

  test('barrel value export missing from dist exits 1 and names the export', () => {
    const dir = fixture('missing-export', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': 'export const kept = 1;\nexport const freshName = 2;\n',
      'dist/index.js': 'export const kept = 1;\n',
    });
    const now = Date.now() / 1000;
    utimesSync(join(dir, 'dist/index.js'), now, now);
    utimesSync(join(dir, 'src/index.ts'), now - 5, now - 5);
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /freshName/);
  });

  test('fresh dist and barrel passes preflight', () => {
    const dir = fixture('fresh', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': [
        "export * from './star.js';",
        'export { kept, loadWasm as lw };',
        'export type { T };',
        'export { type U, freshName };',
        '',
      ].join('\n'),
      'src/star.ts': 'export const starOnly = 1;\n',
      'dist/index.js': 'export const kept = 1;\nexport const lw = () => {};\nexport const freshName = 2;\n',
    });
    const now = Date.now() / 1000;
    utimesSync(join(dir, 'dist/index.js'), now, now);
    for (const rel of ['src/index.ts', 'src/star.ts']) {
      utimesSync(join(dir, rel), now - 5, now - 5);
    }
    const r = runPreflight(dir);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  test('preflight failure does not write into the fixture tree', () => {
    const marker = 'MARKER-UNCHANGED';
    const dir = fixture('no-write', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': 'export const kept = 1;\nexport const freshName = 2;\n',
      'dist/index.js': 'export const kept = 1;\n',
      'MARKER.md': marker,
    });
    const markerPath = join(dir, 'MARKER.md');
    const before = readFileSync(markerPath, 'utf8');
    const mtimeBefore = statSync(markerPath).mtimeMs;
    const now = Date.now() / 1000;
    utimesSync(join(dir, 'dist/index.js'), now, now);
    utimesSync(join(dir, 'src/index.ts'), now - 5, now - 5);
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.equal(readFileSync(markerPath, 'utf8'), before);
    assert.equal(statSync(markerPath).mtimeMs, mtimeBefore);
  });
});
