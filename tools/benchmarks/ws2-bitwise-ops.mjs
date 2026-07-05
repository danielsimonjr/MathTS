/**
 * WS-2 addendum: benchmark the bitwise family (Int32Array element-wise), which
 * gates via a NAMELESS shouldParallelize(len) → the untested global 50k
 * threshold. Inline JS vs the worker path (forced via thresholdElements: 1),
 * medians of 9 interleaved reps. Run from repo root after a build:
 *
 *   node tools/benchmarks/ws2-bitwise-ops.mjs
 */
import { computePool } from '../../parallel/dist/index.js';

const REPS = 9;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function randI32(n) {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 0x7fffffff) | 0;
  return a;
}

async function bench(label, sizes, seqFn, parFn) {
  console.log(`\n=== ${label} ===`);
  console.log('size'.padEnd(10), 'seq(ms)'.padEnd(10), 'par(ms)'.padEnd(10), 'speedup');
  for (const s of sizes) {
    const seqTimes = [], parTimes = [];
    for (let r = 0; r < REPS; r++) {
      let t = performance.now();
      await seqFn(s);
      seqTimes.push(performance.now() - t);
      t = performance.now();
      await parFn(s);
      parTimes.push(performance.now() - t);
    }
    const seq = median(seqTimes), par = median(parTimes);
    console.log(String(s).padEnd(10), seq.toFixed(3).padEnd(10), par.toFixed(3).padEnd(10), (seq / par).toFixed(2) + 'x');
  }
}

await computePool.initialize();

const SIZES = [1e4, 1e5, 1e6, 4e6].map(Math.round);
const as = new Map(SIZES.map((n) => [n, randI32(n)]));
const bs = new Map(SIZES.map((n) => [n, randI32(n)]));

function jsBitAnd(a, b) {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}
function jsBitNot(a) {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = ~a[i];
  return out;
}
function jsLeftShift(a, k) {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] << k;
  return out;
}

// force the pool's worker path for the par arm (bitwise gates are nameless → global)
computePool.updateConfig({ thresholdElements: 1 });
await bench('bitAnd (binary, representative of and/or/xor)', SIZES,
  async (n) => jsBitAnd(as.get(n), bs.get(n)),
  async (n) => computePool.bitAnd(as.get(n), bs.get(n)));
await bench('bitNot (unary)', SIZES,
  async (n) => jsBitNot(as.get(n)),
  async (n) => computePool.bitNot(as.get(n)));
await bench('leftShift (scalar shift, representative of shifts)', SIZES,
  async (n) => jsLeftShift(as.get(n), 3),
  async (n) => computePool.leftShift(as.get(n), 3));

await computePool.terminate();
process.exit(0);
