import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const generator = join(here, 'create-dependency-graph.ts');
const reversePreload = join(here, 'reverse-readdir-preload.cjs');
// The generator and the preload run under Bun. The file itself may run under `bun test` or under `node --test`.
const bunBinary = process.versions.bun ? process.execPath : 'bun';

// The smallest valid WebAssembly module that exports `__new`. The generator refuses to run without the bundle that the
// wasm-pairing probe reads (`functions/dist/wasm/mathts-as.wasm`), and it only checks the export names.
const WASM_WITH_NEW = Buffer.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02,
  0x01, 0x00, 0x07, 0x09, 0x01, 0x05, 0x5f, 0x5f, 0x6e, 0x65, 0x77, 0x00, 0x00, 0x0a, 0x04, 0x01,
  0x02, 0x00, 0x0b,
]);

/**
 * A three-package monorepo. Package, directory and file names are written in an order that is not their sort order, and
 * every package imports every file of its own, so each file is reachable and appears in the reports.
 */
function writeFixture(root) {
  const put = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  put(
    'package.json',
    JSON.stringify({ name: 'fixture', private: true, workspaces: ['packages/*', 'functions'] })
  );
  put('functions/dist/wasm/mathts-as.wasm', WASM_WITH_NEW);
  const layout = {
    zeta: {
      'src/index.ts': ['./util/b', './util/a', './core/y', './core/x'],
      'src/util/b.ts': [],
      'src/util/a.ts': [],
      'src/core/y.ts': [],
      'src/core/x.ts': [],
    },
    alpha: {
      'src/index.ts': ['./mid/n', './mid/m', './base/q'],
      'src/mid/n.ts': [],
      'src/mid/m.ts': [],
      'src/base/q.ts': [],
    },
    mid: { 'src/index.ts': ['./deep/z', './deep/c'], 'src/deep/z.ts': [], 'src/deep/c.ts': [] },
  };
  // `functions` is a workspace package, because the generator refuses a source file that no workspace covers. Its index
  // imports every file below, so each is reachable.
  put(
    'functions/package.json',
    JSON.stringify({ name: '@fixture/functions', version: '1.0.0', type: 'module' })
  );
  put(
    'functions/src/index.ts',
    ['zeta', 'alpha', 'mid']
      .flatMap((stem) => [`./typed/${stem}.js`, `./wasm/${stem}/bridge.js`, `./gpu/${stem}-gpu.js`])
      .map((path) => `import '${path}';\n`)
      .join('')
  );
  // The pairing reports read these directories by name. Each file holds one typed function of each routing kind, and the
  // files are written out of sort order.
  for (const stem of ['zeta', 'alpha', 'mid']) {
    put(
      `functions/src/typed/${stem}.ts`,
      [
        `export const ${stem}Wasm = mathTyped('f', { number: (x) => ${stem}Dispatch(x) });`,
        `export const ${stem}Pool = mathTyped('f', { number: (x) => computePool.${stem}Op(x) });`,
        `export const ${stem}Gpu = mathTyped('f', { number: (x) => ${stem}GpuDispatch(x) });`,
        `export const ${stem}Plain = mathTyped('f', { number: (x) => x });`,
        '',
      ].join('\n')
    );
    put(
      `functions/src/wasm/${stem}/bridge.ts`,
      `function ${stem}Dispatch(x) { return withAsF64(x); }\nfunction ${stem}PlainDispatch(x) { return x; }\n`
    );
    put(
      `functions/src/gpu/${stem}-gpu.ts`,
      `export function ${stem}GpuDispatch(x) { return getGpuDevice(x); }\n`
    );
  }
  for (const [pkg, files] of Object.entries(layout)) {
    put(
      `packages/${pkg}/package.json`,
      JSON.stringify({ name: `@fixture/${pkg}`, version: '1.0.0', type: 'module' })
    );
    for (const [file, imports] of Object.entries(files)) {
      const stem = file.split('/').pop().replace('.ts', '');
      const lines = imports.map((i) => `import './${i.replace('./', '')}.js';`);
      put(
        `packages/${pkg}/${file}`,
        `${lines.join('\n')}\nexport const ${pkg}_${stem} = '${pkg}/${file}';\n`
      );
    }
  }
}

/** Every file under `dir`, as relative path -> text with the date and time stamps made constant. */
function readReports(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const text = readFileSync(full, 'utf8').replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?/g, '<date>');
        out.set(relative(dir, full).replace(/\\/g, '/'), text);
      }
    }
  };
  walk(dir);
  return out;
}

/** Run the generator on `root`; `reversed` loads the preload that reverses every directory listing. */
function generate(root, reversed) {
  const args = [...(reversed ? ['--preload', reversePreload] : []), generator, `--root=${root}`];
  const r = spawnSync(bunBinary, args, { encoding: 'utf8', timeout: 120_000 });
  assert.equal(
    r.status,
    0,
    `the generator failed (reversed=${reversed}):\n${r.stdout}\n${r.stderr}`
  );
  return r;
}

test('the reports do not depend on the order in which the file system lists a directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'cdg-order-'));
  try {
    writeFixture(root);
    const reports = join(root, 'docs', 'Architecture');

    generate(root, false);
    const inNameOrder = readReports(reports);

    const reversedRun = generate(root, true);
    const inReverseOrder = readReports(reports);

    // Controls. Without them an empty result, or a preload that never loaded, would make the two runs equal.
    assert.match(
      reversedRun.stderr,
      /patched readdirSync calls: [1-9]/,
      'the preload must change at least one listing'
    );
    const graph = inNameOrder.get('DEPENDENCY_GRAPH.md');
    assert.ok(graph, 'DEPENDENCY_GRAPH.md must exist');
    assert.ok(
      (graph.match(/^## .+ Dependencies$/gm) ?? []).length >= 6,
      'the fixture must produce several module sections'
    );

    const differing = [...inNameOrder.keys(), ...inReverseOrder.keys()].filter(
      (name, i, all) =>
        all.indexOf(name) === i && inNameOrder.get(name) !== inReverseOrder.get(name)
    );
    assert.deepEqual(
      differing,
      [],
      `these reports changed when the directory listings were reversed: ${differing.join(', ')}`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
