/**
 * Entry points of `@danielsimonjr/mathts-wasm` (#1019).
 *
 * The package resolves its own name through the `exports` map, the way a consumer does:
 * - `.` and `./debug.js` are modules (the generated glue of the release and the debug build).
 * - `./wasm` and `./debug` are the binaries. They have no import, so Node loads them as
 *   WebAssembly ES modules. Bun has no such loader: it returns the file path as `default`.
 * - A binary that has no import needs no host function for `abort`. An AssemblyScript abort
 *   (a failed assert, an index out of range) traps as a `WebAssembly.RuntimeError`
 *   (message `unreachable` in V8, `Unreachable code should not be executed` in JavaScriptCore).
 *
 * Plain asserts, no framework: the test runs with `node` and with `bun`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = '@danielsimonjr/mathts-wasm';
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, '../build/wasm-manifest.json'), 'utf8'));
const isBun = typeof Bun !== 'undefined';
const BINARIES = [
  { subpath: 'wasm', file: 'mathts.wasm' },
  { subpath: 'debug', file: 'mathts-debug.wasm' },
];

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(
      `FAIL ${name}\n     ${String(error?.message ?? error)
        .split('\n')
        .join('\n     ')}`
    );
  }
}

/** The path of a subpath of the package, from the `exports` map. */
function resolvePath(subpath) {
  const resolved = import.meta.resolve(`${PACKAGE}/${subpath}`);
  return resolved.startsWith('file:') ? fileURLToPath(resolved) : resolved;
}

await test('./debug.js is a module with the write-back glue', async () => {
  const debug = await import(`${PACKAGE}/debug.js`);
  assert.equal(typeof debug.matrix_multiply, 'function');
  const result = new Float64Array(4);
  debug.matrix_multiply(Float64Array.of(1, 2, 3, 4), 2, 2, Float64Array.of(5, 6, 7, 8), 2, result);
  assert.deepEqual(Array.from(result), [19, 22, 43, 50]);
});

for (const { subpath, file } of BINARIES) {
  await test(`./${subpath} resolves to ${file}, and the SHA-384 of the bytes matches the manifest`, () => {
    const path = resolvePath(subpath);
    assert.ok(path.endsWith(file), path);
    const digest = `sha384-${createHash('sha384').update(readFileSync(path)).digest('base64')}`;
    assert.equal(digest, manifest[file]);
  });

  await test(`./${subpath} has no import and instantiates with an empty import object`, async () => {
    const bytes = readFileSync(resolvePath(subpath));
    const module = await WebAssembly.compile(bytes);
    assert.deepEqual(WebAssembly.Module.imports(module), []);
    const { exports } = await WebAssembly.instantiate(module, {});
    assert.equal(exports.add_f64(2, 3), 5);
  });

  await test(`require.resolve('./${subpath}') finds ${file}`, () => {
    const require = createRequire(import.meta.url);
    assert.ok(require.resolve(`${PACKAGE}/${subpath}`).endsWith(file));
  });

  await test(`import('./${subpath}') ${isBun ? 'returns the file path (Bun)' : 'loads the binary as a module (Node)'}`, async () => {
    const specifier = `${PACKAGE}/${subpath}`;
    if (isBun) {
      const { default: path } = await import(specifier);
      assert.equal(typeof path, 'string');
      assert.ok(path.endsWith(file), path);
      return;
    }
    try {
      const wasm = await import(specifier);
      assert.equal(wasm.add_f64(2, 3), 5);
      assert.ok(wasm.memory instanceof WebAssembly.Memory);
    } catch (error) {
      // Node 22.12 to 22.18 load a WebAssembly module only with a flag.
      if (error?.code !== 'ERR_UNKNOWN_FILE_EXTENSION') throw error;
      const code = `const m = await import(${JSON.stringify(specifier)}); process.stdout.write(String(m.add_f64(2, 3)));`;
      const run = spawnSync(
        process.execPath,
        ['--experimental-wasm-modules', '--input-type=module', '-e', code],
        { cwd: here, encoding: 'utf8' }
      );
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout, '5');
    }
  });
}

await test('an abort traps as WebAssembly.RuntimeError and leaves the glue usable', async () => {
  const release = await import(PACKAGE);
  // chebyshevT throws a RangeError above the order that an i32 holds; the throw is an abort.
  assert.throws(
    () => release.chebyshevT(3e9, 0.5),
    (error) => error instanceof WebAssembly.RuntimeError && /unreachable/i.test(error.message)
  );
  assert.equal(release.add_f64(2, 3), 5);
  assert.equal(release.chebyshevT(3, 0.5), -1);
});

console.log(`\nsubpath-imports: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
