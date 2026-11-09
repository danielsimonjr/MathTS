/**
 * Benchmark the 14 Float64Array unary ops that dispatched through a NAMELESS
 * shouldParallelize(len) (the global 50k threshold) before they became
 * synchronous: an inline JS loop against computePool.applyKernel (the old
 * worker path), medians of 9 interleaved reps. Run from the repo root after a build:
 *
 *   node tools/benchmarks/sync-unary-kernels.mjs
 */
import { computePool } from '../../parallel/dist/index.js';

const REPS = 9;
const SIZES = [5e4, 5e5, 5e6];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const OPS = {
  sign: (x) => Math.sign(x),
  cube: (x) => x * x * x,
  cbrt: (x) => Math.cbrt(x),
  log10: (x) => Math.log10(x),
  log2: (x) => Math.log2(x),
  log1p: (x) => Math.log1p(x),
  expm1: (x) => Math.expm1(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  fix: (x) => Math.trunc(x),
  cosh: (x) => Math.cosh(x),
  sinh: (x) => Math.sinh(x),
  tanh: (x) => Math.tanh(x),
};

function loop(a, f) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]);
  return out;
}

const data = new Map(
  SIZES.map((n) => {
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 10;
    return [n, a];
  })
);

await computePool.initialize();
console.log('| op | size | sync (ms) | workers (ms) | workers speedup |');
console.log('|---|---|---|---|---|');
for (const [name, f] of Object.entries(OPS)) {
  const src = f.toString();
  for (const n of SIZES) {
    const a = data.get(n);
    const seqT = [],
      parT = [];
    for (let r = 0; r < REPS; r++) {
      let t = performance.now();
      loop(a, f);
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
