import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { exportsSubpathEntries } from './create-dependency-graph.ts';

/** A temporary repo holding one package `p/` built from `files` (path -> content). */
function withPackage(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'cdg-seeding-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, 'p', path)), { recursive: true });
      writeFileSync(join(root, 'p', path), content);
    }
    const pkg = JSON.parse(files['package.json']);
    run(exportsSubpathEntries(root, 'p', pkg));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const sources = {
  'src/index.ts': 'export const a = 1;\n',
  'src/bindings/loader.ts': 'export const b = 1;\n',
  'src/extra.ts': 'export const c = 1;\n',
  'src/dormant.ts': 'export const d = 1;\n',
  'src/shim.d.ts': "declare module 'x' {}\n",
};

test('a secondary `tsc -p` build seeds its includes as build roots', () => {
  withPackage(
    {
      ...sources,
      'package.json': JSON.stringify({ scripts: { build: 'tsc -p tsconfig.bindings.json' } }),
      'tsconfig.bindings.json': JSON.stringify({
        include: ['src/bindings/**/*.ts', 'src/extra.ts', 'src/shim.d.ts'],
      }),
    },
    (entries) => {
      assert.ok(entries.includes('p/src/bindings/loader.ts'));
      assert.ok(entries.includes('p/src/extra.ts'));
      assert.ok(!entries.includes('p/src/shim.d.ts'), 'a .d.ts is never a build root');
    }
  );
});

test('a noEmit type-check config seeds nothing', () => {
  // `typecheck: tsc -p tsconfig.test.json` once marked every src file reachable,
  // hiding dormant ones, and pulled an ambient .d.ts into the graph as source.
  withPackage(
    {
      ...sources,
      'package.json': JSON.stringify({
        scripts: { typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json' },
      }),
      'tsconfig.test.json': JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { noEmit: true },
        include: ['src/**/*.ts', 'src/shim.d.ts', 'tests/**/*.ts'],
      }),
    },
    (entries) => assert.deepEqual(entries, [])
  );
});

// A bare bundler script takes its entries from `<bundler>.config.ts`; the tool must
// read the config of whichever bundler the package builds with.
for (const bundler of ['tsdown', 'tsup']) {
  test(`a bare \`${bundler}\` script seeds the entries of ${bundler}.config.ts`, () => {
    withPackage(
      {
        ...sources,
        'package.json': JSON.stringify({
          scripts: { build: `${bundler} && tsc -p tsconfig.dts.json` },
        }),
        [`${bundler}.config.ts`]: "export default { entry: ['src/index.ts', 'src/extra.ts'] };\n",
      },
      (entries) => {
        assert.ok(entries.includes('p/src/extra.ts'));
        assert.ok(!entries.includes('p/src/dormant.ts'), 'an unlisted file is not a build root');
      }
    );
  });
}

test('a `tsdown` script that names its entries on the command line ignores the config', () => {
  withPackage(
    {
      ...sources,
      'package.json': JSON.stringify({
        scripts: { build: 'tsdown src/index.ts --format esm && tsc -p tsconfig.dts.json' },
      }),
      'tsdown.config.ts': "export default { entry: ['src/dormant.ts'] };\n",
    },
    (entries) => {
      assert.ok(entries.includes('p/src/index.ts'));
      assert.ok(!entries.includes('p/src/dormant.ts'));
    }
  );
});
