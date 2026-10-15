/**
 * Unit tests for dist-node-imports.mjs. They run on fixture dist trees in a temp directory.
 *
 *   node --test tools/test/dist-node-imports.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import {
  dotEntryFile,
  isNodeBuiltin,
  staticImports,
  staticNodeImports,
} from './dist-node-imports.mjs';

const root = mkdtempSync(join(tmpdir(), 'dist-node-imports-'));
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

describe('isNodeBuiltin', () => {
  test('accepts the node: prefix, bare builtin names and builtin subpaths', () => {
    for (const spec of ['node:module', 'node:fs/promises', 'fs', 'path', 'fs/promises']) {
      assert.equal(isNodeBuiltin(spec), true, spec);
    }
  });

  test('rejects relative paths and packages', () => {
    for (const spec of ['./chunk.js', '../x.js', '@danielsimonjr/mathts-core', 'workerpool']) {
      assert.equal(isNodeBuiltin(spec), false, spec);
    }
  });
});

describe('staticImports', () => {
  test('reads every static form that a bundler emits', () => {
    const source = [
      'import { createRequire } from "node:module";',
      "import fs from 'fs';",
      'import * as path from "path";',
      'import "./side-effect.js";',
      'import {',
      '  a,',
      '  b',
      '} from "./multi-line.js";',
      'export { c } from "./re-export.js";',
      'export * from "./star.js";',
    ].join('\n');
    assert.deepEqual(staticImports(source), [
      'node:module',
      'fs',
      'path',
      './side-effect.js',
      './multi-line.js',
      './re-export.js',
      './star.js',
    ]);
  });

  test('reads minified statements on one line', () => {
    const source = 'import{a}from"node:os";import"./x.js";export{b}from"./y.js";';
    assert.deepEqual(staticImports(source), ['node:os', './x.js', './y.js']);
  });

  test('ignores dynamic import(), import.meta and string contents', () => {
    const source = [
      'const lazy = () => import("node:fs");',
      'const url = import.meta.url;',
      'import.meta.resolve("x");',
      'const text = "import x from \\"node:os\\"";',
      'export const value = "from";',
    ].join('\n');
    assert.deepEqual(staticImports(source), []);
  });
});

describe('staticNodeImports', () => {
  test('passes an entry that imports only relative files and packages', () => {
    const dir = fixture('clean', {
      'dist/index.js':
        'import { a } from "./chunk.js";\nimport "@danielsimonjr/mathts-core";\nexport { a };\n',
      'dist/chunk.js': 'export const a = 1;\n',
    });
    assert.deepEqual(staticNodeImports(join(dir, 'dist/index.js')), []);
  });

  test('reports a builtin that the entry file imports', () => {
    const dir = fixture('entry', {
      'dist/index.js': 'import { createRequire } from "node:module";\nexport const x = 1;\n',
    });
    assert.deepEqual(staticNodeImports(join(dir, 'dist/index.js')), [
      { file: join(dir, 'dist/index.js'), specifier: 'node:module' },
    ]);
  });

  test('reports a builtin that a statically imported chunk imports', () => {
    const dir = fixture('chunk', {
      'dist/index.js': 'export * from "./a.js";\n',
      'dist/a.js': 'export * from "./b.js";\n',
      'dist/b.js': 'import { tmpdir } from "os";\nexport const t = tmpdir;\n',
    });
    assert.deepEqual(staticNodeImports(join(dir, 'dist/index.js')), [
      { file: join(dir, 'dist/b.js'), specifier: 'os' },
    ]);
  });

  test('ignores a builtin that only a dynamic import or an unreachable file uses', () => {
    const dir = fixture('lazy', {
      'dist/index.js':
        'export const load = () => import("./lazy.js");\nexport const fs = () => import("node:fs");\n',
      'dist/lazy.js': 'import { readFile } from "node:fs/promises";\nexport { readFile };\n',
      'dist/render-file.js': 'import { spawn } from "node:child_process";\nexport { spawn };\n',
    });
    assert.deepEqual(staticNodeImports(join(dir, 'dist/index.js')), []);
  });

  test('terminates on an import cycle', () => {
    const dir = fixture('cycle', {
      'dist/index.js': 'import "./a.js";\n',
      'dist/a.js': 'import "./b.js";\nimport "node:path";\n',
      'dist/b.js': 'import "./a.js";\n',
    });
    assert.deepEqual(staticNodeImports(join(dir, 'dist/index.js')), [
      { file: join(dir, 'dist/a.js'), specifier: 'node:path' },
    ]);
  });

  test('fails closed when a relative import has no file', () => {
    const dir = fixture('missing', { 'dist/index.js': 'import "./gone.js";\n' });
    assert.throws(() => staticNodeImports(join(dir, 'dist/index.js')), /gone\.js/);
  });
});

describe('dotEntryFile', () => {
  test('follows exports["."].import', () => {
    const dir = fixture('exports-import', {
      'package.json': JSON.stringify({
        exports: { '.': { types: './dist/index.d.ts', import: './dist/main.js' } },
      }),
    });
    assert.equal(dotEntryFile(dir), join(dir, 'dist/main.js'));
  });

  test('prefers the browser condition, which is the file a browser bundler loads', () => {
    const dir = fixture('exports-browser', {
      'package.json': JSON.stringify({
        exports: { '.': { import: './dist/node.js', browser: './dist/browser.js' } },
      }),
    });
    assert.equal(dotEntryFile(dir), join(dir, 'dist/browser.js'));
  });

  test('falls back to module, then main', () => {
    const dir = fixture('fallback', {
      'package.json': JSON.stringify({ main: './dist/cjs.js', module: './dist/esm.js' }),
    });
    assert.equal(dotEntryFile(dir), join(dir, 'dist/esm.js'));
  });

  test('throws when the package names no entry', () => {
    const dir = fixture('no-entry', { 'package.json': JSON.stringify({ name: 'x' }) });
    assert.throws(() => dotEntryFile(dir), /no "\." entry/);
  });
});
