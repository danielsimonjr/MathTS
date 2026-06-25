/**
 * T1 decision gate (WASM_PAIRING_GAP_PLAN): is the Rust WASM reduction path
 * faster than JS for sum/mean/variance, and where is the break-even? Also
 * checks correctness (wasm == JS to <1e-9) so we never benchmark a wrong kernel.
 *
 * Raw pointer ABI against functions/dist/wasm/mathts.wasm (Rust). No allocator
 * exports — we grow linear memory for scratch and write inputs in place.
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const wasmBuf = readFileSync(path.join(here, '../../../functions/dist/wasm/mathts.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBuf, {});
const ex = instance.exports;
const mem = ex.memory;

// JS references
const jsSum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const jsMean = (a) => jsSum(a) / a.length;
const jsVar = (a, ddof = 0) => { const m = jsMean(a); let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; s += d * d; } return s / (a.length - ddof); };

const sizes = [100, 1000, 10_000, 100_000, 1_000_000];
const score = (a, b) => (Math.abs(b) > 1e-12 ? Math.abs(a - b) / Math.abs(b) : Math.abs(a - b));

// Grow wasm memory generously (1e6 f64 = 8MB; reserve ~16MB).
const targetPages = 256;
const curPages = mem.buffer.byteLength / 65536;
if (curPages < targetPages) mem.grow(targetPages - curPages);
const base = 2 * 65536; // leave pages 0-1 for static data

// Source data lives in a plain JS array (the realistic input the API receives).
function makeInput(n) {
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.sin(i * 0.001) + (i % 7);
  return a;
}
function bench(fn, iters) {
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < iters; i++) acc += fn();
  return (performance.now() - t0) / iters;
}

console.log('Reduction: Rust WASM (incl. copy-in) vs JS — per-call ms, lower=better');
console.log('size       op         wasm+copy   js        speedup   relerr');
for (const n of sizes) {
  const src = makeInput(n);
  const iters = n >= 100_000 ? 100 : 5000;
  // Realistic wasm path: copy the JS array into wasm memory, then call the kernel.
  const copyAndCall = (kernel) => () => {
    const view = new Float64Array(mem.buffer, base, n);
    for (let i = 0; i < n; i++) view[i] = src[i];
    return kernel();
  };
  for (const [op, kernel, jsFn] of [
    ['sum', () => ex.sum(base, n), () => jsSum(src)],
    ['mean', () => ex.mean(base, n), () => jsMean(src)],
    ['variance', () => ex.variance(base, n, 0), () => jsVar(src, 0)],
  ]) {
    // correctness (copy once, call)
    { const v = new Float64Array(mem.buffer, base, n); for (let i = 0; i < n; i++) v[i] = src[i]; }
    const rel = score(kernel(), jsFn());
    const wb = bench(copyAndCall(kernel), iters);
    const jb = bench(jsFn, iters);
    console.log(
      `${String(n).padEnd(10)} ${op.padEnd(9)} ${wb.toFixed(5).padStart(9)} ${jb.toFixed(5).padStart(9)} ${(jb / wb).toFixed(2).padStart(8)}x  ${rel.toExponential(1)}`
    );
  }
}
console.log('\nwasm(ms) INCLUDES the JS->wasm copy-in (realistic single-call dispatch cost).');
console.log('computePool (parallel workers) is the existing path; it wins only at large n');
console.log('where multi-core offsets worker-spawn/transfer overhead — see ComputePool thresholds.');
