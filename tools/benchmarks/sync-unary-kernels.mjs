/**
 * Benchmark the 14 Float64Array unary ops that dispatched through a NAMELESS
 * shouldParallelize(len) (the global 50k threshold) before they became
 * synchronous. Arm 1 is the shipped synchronous typed function from the built
 * functions package, with the WASM tier loaded (`loadWasm()`), so ops that have a
 * WASM kernel in their policy band take it. Arm 2 is computePool.applyKernel (the
 * old worker path). Medians of 9 interleaved reps. Run from the repo root after a build:
 *
 *   node tools/benchmarks/sync-unary-kernels.mjs
 */
import { computePool } from '../../parallel/dist/index.js';
import * as fns from '../../functions/dist/index.js';

const REPS = 9;
const SIZES = [5e4, 5e5, 5e6];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// op name -> worker kernel source (the source the old typed signature sent)
const OPS = {
  sign: '(x) => Math.sign(x)',
  cube: '(x) => x * x * x',
  cbrt: '(x) => Math.cbrt(x)',
  log10: '(x) => Math.log10(x)',
  log2: '(x) => Math.log2(x)',
  log1p: '(x) => Math.log1p(x)',
  expm1: '(x) => Math.expm1(x)',
  round: '(x) => Math.round(x)',
  floor: '(x) => Math.floor(x)',
  ceil: '(x) => Math.ceil(x)',
  fix: '(x) => Math.trunc(x)',
  cosh: '(x) => Math.cosh(x)',
  sinh: '(x) => Math.sinh(x)',
  tanh: '(x) => Math.tanh(x)',
};

const data = new Map(
  SIZES.map((n) => {
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 10;
    return [n, a];
  })
);

const wasm = await fns.loadWasm();
await computePool.initialize();
console.log(`WASM tier loaded: ${wasm}`);
console.log('| op | size | sync typed fn (ms) | workers (ms) | workers speedup |');
console.log('|---|---|---|---|---|');
for (const [name, src] of Object.entries(OPS)) {
  const f = fns[name];
  for (const n of SIZES) {
    const a = data.get(n);
    const seqT = [],
      parT = [];
    for (let r = 0; r < REPS; r++) {
      let t = performance.now();
      f(a);
      seqT.push(performance.now() - t);
      t = performance.now();
      await computePool.applyKernel(a, src);
      parT.push(performance.now() - t);
    }
    const s = median(seqT),
      p = median(parT);
    console.log(`| ${name} | ${n} | ${s.toFixed(2)} | ${p.toFixed(2)} | ${(s / p).toFixed(2)}x |`);
  }
}
await computePool.terminate();
process.exit(0);
