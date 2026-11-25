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
import { missingSurfaceFileMessage, runtimeExportNames } from '../generate-functions-reference.mjs';
import { IMPORT_EXPORT_KEYS, packageDotEntry } from '../package-dot-entry.mjs';

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
    assert.match(r.stderr, /dist[\\/]index\.js/);
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
    const index = join(dir, 'src/index.ts');
    const base = Date.now() / 1000;
    utimesSync(dist, base - 10, base - 10);
    // index.ts must not be the reason: only the star-target leaf is newer.
    utimesSync(index, base - 10, base - 10);
    utimesSync(leaf, base + 5, base + 5);
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /src[\\/]leaf\.ts/);
    assert.doesNotMatch(r.stderr, /src[\\/]index\.ts/);
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
        "export * as ns from './star.js';",
        'export { kept, loadWasm as lw };',
        'export type { T };',
        'export { type U, freshName };',
        'export { foo as default };',
        'export function fn() {}',
        'export class Cls {}',
        'export enum E { A }',
        '',
      ].join('\n'),
      'src/star.ts': 'export const starOnly = 1;\n',
      'dist/index.js': [
        'export const kept = 1;',
        'export const lw = () => {};',
        'export const freshName = 2;',
        'export const ns = {};',
        'export function fn() {}',
        'export class Cls {}',
        'export const E = { A: 0 };',
        '',
      ].join('\n'),
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

  test('GITHUB_ACTIONS does not skip the mtime refusal', () => {
    const dir = fixture('ci-mtime', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': "export * from './leaf.js';\nexport const kept = 1;\n",
      'src/leaf.ts': 'export const fromLeaf = 2;\n',
      'dist/index.js': 'export const kept = 1;\nexport const fromLeaf = 2;\n',
    });
    const dist = join(dir, 'dist/index.js');
    const leaf = join(dir, 'src/leaf.ts');
    const index = join(dir, 'src/index.ts');
    const base = Date.now() / 1000;
    utimesSync(dist, base - 10, base - 10);
    utimesSync(index, base - 10, base - 10);
    utimesSync(leaf, base + 5, base + 5);
    const r = spawnSync(process.execPath, [GENERATOR, '--preflight-only', dir], {
      encoding: 'utf8',
      cwd: REPO,
      env: { ...process.env, GITHUB_ACTIONS: 'true', CI: 'true' },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /src[\\/]leaf\.ts/);
  });

  test('namespace re-export missing from dist exits 1 and names it', () => {
    const dir = fixture('star-as', {
      'package.json': JSON.stringify(PKG_JSON, null, 2),
      'src/index.ts': "export * as ns from './star.js';\nexport const kept = 1;\n",
      'src/star.ts': 'export const starOnly = 1;\n',
      'dist/index.js': 'export const kept = 1;\n',
    });
    const now = Date.now() / 1000;
    utimesSync(join(dir, 'dist/index.js'), now, now);
    utimesSync(join(dir, 'src/index.ts'), now - 5, now - 5);
    utimesSync(join(dir, 'src/star.ts'), now - 5, now - 5);
    const r = runPreflight(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ns/);
  });

  test('docs generator resolves the import condition, not browser', () => {
    const dir = fixture('import-first', {
      'package.json': JSON.stringify({
        name: '@test/import-first',
        exports: { '.': { browser: './dist/browser.js', import: './dist/index.js' } },
      }),
    });
    assert.equal(packageDotEntry(dir, IMPORT_EXPORT_KEYS).distPath, join(dir, 'dist/index.js'));
  });
});

describe('runtimeExportNames', () => {
  test('reads aliases, namespace re-exports, declarations; ignores types and default', () => {
    const names = runtimeExportNames(
      [
        "export * as ns from './mod.js';",
        'export { kept, loadWasm as lw, foo as default };',
        'export type { T };',
        'export { type U, freshName };',
        'export { bar as type OnlyType };',
        'export function fn() {}',
        'export class Cls {}',
        'export enum E { A }',
        'export const kept2 = 1;',
        'export interface I {}',
        'export default function def() {}',
      ].join('\n')
    );
    assert.deepEqual(
      [...names].sort(),
      ['Cls', 'E', 'fn', 'freshName', 'kept', 'kept2', 'lw', 'ns'].sort()
    );
  });

  test('strips comments and reads multi-line export lists', () => {
    const names = runtimeExportNames(
      [
        'export {',
        '  /* skip */',
        '  kept, // c',
        '  loadWasm as lw,',
        '};',
        'export { config } from "./x.js"; // trailing',
      ].join('\n')
    );
    assert.deepEqual([...names].sort(), ['config', 'kept', 'lw']);
  });
});

describe('generate-functions-reference surfaces file', () => {
  // package-export-surfaces.json is written by `bun run docs:deps`, and no commit holds it.
  const absent = join(root, 'no-surfaces', 'package-export-surfaces.json');

  test('--check fails on a missing surfaces file and names the command that writes it', () => {
    const message = missingSurfaceFileMessage(absent, true);
    assert.equal(typeof message, 'string');
    assert.match(message, /bun run docs:deps/);
    assert.match(message, /package-export-surfaces\.json/);
  });

  test('a rewrite skips the reconciliation when the surfaces file is missing', () => {
    // The Site workflow runs the generator after a build and without docs:deps.
    assert.equal(missingSurfaceFileMessage(absent, false), null);
  });

  test('--check passes the file test when the surfaces file exists', () => {
    const dir = fixture('with-surfaces', { 'package-export-surfaces.json': '{"surfaces":{}}' });
    assert.equal(missingSurfaceFileMessage(join(dir, 'package-export-surfaces.json'), true), null);
  });
});

describe('__PKG_VERSION__ for docs:functions (Bun source execution)', () => {
  test('tsdown define does not emit globalThis."<version>" in core dist', () => {
    const dist = readFileSync(join(REPO, 'core/dist/index.js'), 'utf8');
    assert.doesNotMatch(dist, /globalThis\."/);
    assert.match(dist, /__PKG['"]\s*,\s*['"]VERSION__/);
  });

  test('core/src VERSION reads globalThis when the tsdown define is missing', () => {
    const script = [
      'globalThis.__PKG_VERSION__ = "from-global";',
      'const m = await import("./core/src/index.ts");',
      'if (m.VERSION !== "from-global") {',
      '  console.error(m.VERSION);',
      '  process.exit(1);',
      '}',
    ].join('');
    const bun = spawnSync('bun', ['-e', script], { cwd: REPO, encoding: 'utf8' });
    assert.equal(bun.status, 0, bun.stderr + bun.stdout);
  });

  test('docs:functions always injects __PKG_VERSION__ through run-docs-functions.mjs', () => {
    const runner = readFileSync(join(REPO, 'tools/run-docs-functions.mjs'), 'utf8');
    assert.match(runner, /--define/);
    assert.match(runner, /__PKG_VERSION__/);
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['docs:functions'], 'bun tools/run-docs-functions.mjs');
    assert.equal(pkg.scripts['docs:functions:check'], 'bun tools/run-docs-functions.mjs --check');
  });
});
