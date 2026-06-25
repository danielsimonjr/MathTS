/**
 * Tier-1 decision gate (WASM_PAIRING_GAP_PLAN): the extended unary
 * transcendental kernels (asin/acos/atan/sinh/cosh/tanh/asinh/acosh/atanh/
 * expm1/log1p/log2/log10/cbrt/sec/csc/cot) — does the Rust `simd_*_array`
 * kernel beat JS `Math.*` including the realistic JS->wasm copy-in + copy-out?
 * Also checks correctness (<1e-12). Run: npm run bench:transcendental
 *
 * Wire only the ops that win here, exactly as abs/sin/cos/tan/exp/log were.
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const wasmBuf = readFileSync(path.join(here, '../../../functions/dist/wasm/mathts.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBuf, {});
const ex = instance.exports;
const mem = ex.memory;

const sizes = [1000, 10_000, 100_000];
const maxN = 100_000;
const oldBytes = mem.buffer.byteLength;
mem.grow(Math.ceil((2 * maxN * 8 + 65536) / 65536));
const inBase = oldBytes;
const outBase = inBase + maxN * 8;

// [op, kernel, jsFn, inputGen(i)] — inputGen keeps each op in its valid domain.
const OPS = [
  ['asin', 'simd_asin_array', Math.asin, (i) => -0.99 + (i % 199) * 0.01],
  ['acos', 'simd_acos_array', Math.acos, (i) => -0.99 + (i % 199) * 0.01],
  ['atan', 'simd_atan_array', Math.atan, (i) => -50 + (i % 100)],
  ['sinh', 'simd_sinh_array', Math.sinh, (i) => -3 + (i % 60) * 0.1],
  ['cosh', 'simd_cosh_array', Math.cosh, (i) => -3 + (i % 60) * 0.1],
  ['tanh', 'simd_tanh_array', Math.tanh, (i) => -5 + (i % 100) * 0.1],
  ['asinh', 'simd_asinh_array', Math.asinh, (i) => -10 + (i % 200) * 0.1],
  ['acosh', 'simd_acosh_array', Math.acosh, (i) => 1 + (i % 50) * 0.1],
  ['atanh', 'simd_atanh_array', Math.atanh, (i) => -0.99 + (i % 199) * 0.01],
  ['expm1', 'simd_expm1_array', Math.expm1, (i) => -2 + (i % 40) * 0.1],
  ['log1p', 'simd_log1p_array', Math.log1p, (i) => (i % 100) * 0.05],
  ['log2', 'simd_log2_array', Math.log2, (i) => 0.1 + (i % 100) * 0.1],
  ['log10', 'simd_log10_array', Math.log10, (i) => 0.1 + (i % 100) * 0.1],
  ['cbrt', 'simd_cbrt_array', Math.cbrt, (i) => -50 + (i % 100)],
  ['sec', 'simd_sec_array', (x) => 1 / Math.cos(x), (i) => -1.4 + (i % 280) * 0.01],
  ['csc', 'simd_csc_array', (x) => 1 / Math.sin(x), (i) => 0.1 + (i % 280) * 0.01],
  ['cot', 'simd_cot_array', (x) => Math.cos(x) / Math.sin(x), (i) => 0.1 + (i % 280) * 0.01],
];

const bench = (fn, it) => {
  const t0 = performance.now();
  for (let i = 0; i < it; i++) fn();
  return (performance.now() - t0) / it;
};
const rel = (a, b) => (Math.abs(b) > 1e-12 ? Math.abs(a - b) / Math.abs(b) : Math.abs(a - b));

console.log('Tier-1 transcendentals: Rust WASM (incl. copy in+out) vs JS Math.* — per-call ms');
console.log('size      op     wasm+copy   js        speedup  maxrel   verdict');
const winners = new Set();
for (const n of sizes) {
  for (const [op, kname, jsFn, gen] of OPS) {
    const kernel = ex[kname];
    if (typeof kernel !== 'function') {
      console.log(`${String(n).padEnd(9)} ${op.padEnd(6)} KERNEL MISSING (${kname})`);
      continue;
    }
    const src = new Float64Array(n);
    for (let i = 0; i < n; i++) src[i] = gen(i);
    const wasmCall = () => {
      const iv = new Float64Array(mem.buffer, inBase, n);
      iv.set(src);
      kernel(inBase, outBase, n);
      const r = new Float64Array(n);
      r.set(new Float64Array(mem.buffer, outBase, n));
      return r;
    };
    const w = wasmCall();
    let maxrel = 0;
    for (let i = 0; i < n; i++) maxrel = Math.max(maxrel, rel(w[i], jsFn(src[i])));
    const it = n >= 100_000 ? 100 : 2000;
    const wb = bench(wasmCall, it);
    const jb = bench(() => { const r = new Float64Array(n); for (let i = 0; i < n; i++) r[i] = jsFn(src[i]); return r; }, it);
    const speed = jb / wb;
    if (n === 10_000 && speed >= 1.15 && maxrel < 1e-12) winners.add(op);
    console.log(
      `${String(n).padEnd(9)} ${op.padEnd(6)} ${wb.toFixed(4).padStart(9)} ${jb.toFixed(4).padStart(9)} ${speed.toFixed(2).padStart(7)}x ${maxrel.toExponential(1)} ${speed >= 1.15 ? 'WIN' : 'lose'}`
    );
  }
}
console.log('\nWINNERS (>=1.15x at n=10k, correct):', [...winners].sort().join(', ') || '(none)');
