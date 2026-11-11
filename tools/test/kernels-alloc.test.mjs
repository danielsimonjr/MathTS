// Zero-allocation check for the fixed-size kernels of @danielsimonjr/mathts-functions.
// Run: node --expose-gc --max-semi-space-size=1 tools/test/kernels-alloc.test.mjs
// (after the functions build). It counts GC entries during 1e6 calls per kernel: a kernel
// that allocates forces scavenges in a 1 MB semi-space, a kernel that does not causes none.
// The allocating twin quaternionMultiply is the positive control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceObserver } from 'node:perf_hooks';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const F = await import(pathToFileURL(join(ROOT, 'functions/dist/index.js')).href);
const { KERNEL_NAMES } = await import(
  pathToFileURL(join(ROOT, 'functions/scripts/gen-kernels.mjs')).href
);

if (typeof globalThis.gc !== 'function') {
  throw new Error('Run with node --expose-gc --max-semi-space-size=1');
}

const WARM = 1e6;
const CALLS = 1e6;

/** Argument lists for each kernel: Float64Array inputs, offsets 0. */
function argsFor(name) {
  const v = (n) => Float64Array.from({ length: n }, (_, i) => 0.25 + i * 0.125);
  const out = (n) => new Float64Array(n);
  const table = {
    Add: (n) => [out(n), v(n), v(n)],
    Sub: (n) => [out(n), v(n), v(n)],
    Scale: (n) => [out(n), v(n), 0.5],
    ScaleAndAdd: (n) => [out(n), v(n), v(n), 0.5],
    Dot: (n) => [v(n), v(n)],
    Length: (n) => [v(n)],
    Normalize: (n) => [out(n), v(n)],
  };
  const m = /^vec([23])(\w+)$/.exec(name);
  if (m && table[m[2]]) return table[m[2]](Number(m[1]));
  switch (name) {
    case 'vec3Cross':
      return [out(3), v(3), v(3)];
    case 'quatMultiply':
      return [out(4), v(4), v(4)];
    case 'quatConjugate':
    case 'quatNormalize':
      return [out(4), v(4)];
    case 'quatRotate':
      return [out(3), v(4), v(3)];
    case 'quatIntegrate':
      return [out(4), v(4), v(3), 0.01];
    case 'mat3Multiply':
      return [out(9), v(9), v(9)];
    case 'mat3MulVec':
      return [out(3), v(9), v(3)];
    case 'mat3Transpose':
      return [out(9), v(9)];
    case 'mat3Inverse':
      return [out(9), Float64Array.of(2, 1, 0, 1, 3, 1, 0, 1, 4)];
    default:
      throw new Error(`no arguments for ${name}`);
  }
}

/**
 * A loop of `calls` calls of `fn` with `args`, compiled as new code for each kernel.
 * Fresh code has its own feedback, so a call site that an earlier kernel made polymorphic
 * cannot stop the kernel from being inlined. A number result goes into a Float64Array cell:
 * a double that leaves a non-inlined call, or that a captured `let` holds, is boxed by the
 * engine at that boundary, which is the harness and not the kernel.
 */
function makeLoop(arity, returnsNumber) {
  const params = Array.from({ length: arity }, (_, k) => 'x' + k);
  const callExpr = 'fn(' + params.join(', ') + ')';
  const stmt = returnsNumber ? 'sink[0] += ' + callExpr + ';' : callExpr + ';';
  // eslint-disable-next-line no-new-func -- fresh code per kernel is the point (see above)
  return new Function(
    'fn',
    'sink',
    ...params,
    'calls',
    'for (let i = 0; i < calls; i++) { ' + stmt + ' }'
  );
}

/** GC entries seen while `run(CALLS)` runs, after a warm-up of `WARM` calls. */
async function gcCount(run) {
  // Many short runs, not one long one: one long run is optimized by on-stack replacement,
  // and that code is not used when the next run enters the loop from the top.
  for (let k = 0; k < 100; k++) run(WARM / 100);
  globalThis.gc();
  let count = 0;
  const obs = new PerformanceObserver((list) => {
    count += list.getEntries().length;
  });
  obs.observe({ entryTypes: ['gc'] });
  run(CALLS);
  // Entries are delivered asynchronously; let the queue drain before reading.
  await new Promise((r) => setTimeout(r, 50));
  obs.disconnect();
  return count;
}

const kept = [];

test('positive control: the allocating twin quaternionMultiply triggers GC', async () => {
  const a = [1, 0.1, 0.2, 0.3];
  const b = [0.9, 0.2, 0.1, 0.4];
  const n = await gcCount((calls) => {
    for (let i = 0; i < calls; i++) kept[i & 1023] = F.quaternionMultiply(a, b);
  });
  assert.ok(n > 0, `expected GC entries from the allocating twin, saw ${n}`);
});

for (const name of KERNEL_NAMES) {
  test(`${name} makes no allocation`, async () => {
    const fn = F[name];
    assert.equal(typeof fn, 'function', `${name} is not exported from functions/dist`);
    const args = argsFor(name);
    const returnsNumber = typeof fn(...args) === 'number';
    const loop = makeLoop(args.length, returnsNumber);
    const sink = new Float64Array(1);
    const n = await gcCount((calls) => loop(fn, sink, ...args, calls));
    kept[0] = sink;
    assert.equal(n, 0, `${name}: ${n} GC entries in ${CALLS} calls`);
  });
}
