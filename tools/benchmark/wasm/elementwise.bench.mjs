/**
 * T3 decision gate (WASM_PAIRING_GAP_PLAN): is the Rust WASM elementwise path
 * (simd_*_array) faster than JS for unary array ops (sin/cos), with the
 * realistic JS->wasm copy-IN and wasm->JS copy-OUT included? Also checks
 * correctness (<1e-12) so we never benchmark a wrong kernel.
 *
 * NOTE: despite the `simd_` name, these kernels are scalar libm loops
 * (wasm-rust/.../compat/simd_array.rs) — this measures whether that + 2 copies
 * can beat V8's Math.sin. Raw pointer ABI against functions/dist/wasm/mathts.wasm.
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const wasmBuf = readFileSync(path.join(here, '../../../functions/dist/wasm/mathts.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBuf, {});
const ex = instance.exports;
const mem = ex.memory;
const sizes = [100, 1000, 10_000, 100_000, 1_000_000];
const maxN = sizes[sizes.length - 1];
// Place in/out buffers in a freshly-grown region PAST the wasm's static data +
// heap (avoids stomping wasm internals, which corrupted large-n results).
const needBytes = 2 * maxN * 8 + 65536;
const oldBytes = mem.buffer.byteLength;
mem.grow(Math.ceil(needBytes / 65536));
const inBase = oldBytes;
const outBase = inBase + maxN * 8;

function makeInput(n) {
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = 0.5 + (i % 997) * 0.001; // strictly > 0 so log/sqrt are valid
  return a;
}
function bench(fn, iters) {
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  return (performance.now() - t0) / iters;
}

console.log('Elementwise unary: Rust WASM (incl. copy in+out) vs JS — per-call ms, lower=better');
console.log('size       op     wasm+copy   js        speedup   maxabsdiff');
for (const n of sizes) {
  const src = makeInput(n);
  const iters = n >= 100_000 ? 100 : 3000;

  const cand = [
    ['sin', ex.simd_sin_array, Math.sin],
    ['cos', ex.simd_cos_array, Math.cos],
    ['tan', ex.simd_tan_array, Math.tan],
    ['exp', ex.simd_exp_array, Math.exp],
    ['log', ex.simd_log_array, Math.log],
    ['sqrt', ex.simd_sqrt_array, Math.sqrt],
    ['abs', ex.simd_abs_array, Math.abs],
  ].filter(([, k]) => typeof k === 'function');
  for (const [op, kernel, jsScalar] of cand) {
    // realistic wasm path: copy src -> wasm, call, copy out -> fresh JS array
    const wasmCall = () => {
      const inView = new Float64Array(mem.buffer, inBase, n);
      for (let i = 0; i < n; i++) inView[i] = src[i];
      kernel(inBase, outBase, n);
      const outView = new Float64Array(mem.buffer, outBase, n);
      const result = new Float64Array(n);
      result.set(outView);
      return result;
    };
    const jsCall = () => {
      const r = new Float64Array(n);
      for (let i = 0; i < n; i++) r[i] = jsScalar(src[i]);
      return r;
    };
    // correctness
    const w = wasmCall(), j = jsCall();
    let maxd = 0;
    for (let i = 0; i < n; i++) maxd = Math.max(maxd, Math.abs(w[i] - j[i]));
    const wb = bench(wasmCall, iters), jb = bench(jsCall, iters);
    console.log(
      `${String(n).padEnd(10)} ${op.padEnd(6)} ${wb.toFixed(5).padStart(9)} ${jb.toFixed(5).padStart(9)} ${(jb / wb).toFixed(2).padStart(8)}x  ${maxd.toExponential(1)}`
    );
  }
}
console.log('\nINCLUDES copy-in + copy-out (realistic dispatch). simd_*_array are scalar libm');
console.log('loops (not vectorized), so this is the upper bound for the current kernels.');
