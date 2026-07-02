// B8 chain spike: JS-separate (autograd's style: 3 allocating passes) vs JS-fused
// (one native-math pass) vs WASM-chain (1 copy-in, 3 in-memory kernels, 1 copy-out).
import { readFileSync } from 'node:fs';
const { instance } = await WebAssembly.instantiate(readFileSync('assembly/build/mathts.wasm'), {
  env: { abort: () => { throw new Error('abort'); } },
});
const ex = instance.exports;
const { memory } = ex;
const kSin = ex.array_sin_ptr, kExp = ex.array_exp_ptr, kSinh = ex.array_sinh_ptr;

const SIZES = [1024, 16384, 262144];
const maxN = Math.max(...SIZES);
const base = memory.buffer.byteLength;
memory.grow(Math.ceil((base + 2 * maxN * 8) / 65536) + 1);

// chain: sqrt(exp(sin(x)))  (sin keeps values in [-1,1], exp in [.37,2.7], sqrt fine)
function jsSeparate(xs) {
  const a = new Float64Array(xs.length); for (let i = 0; i < xs.length; i++) a[i] = Math.sin(xs[i]);
  const b = new Float64Array(xs.length); for (let i = 0; i < xs.length; i++) b[i] = Math.exp(a[i]);
  const c = new Float64Array(xs.length); for (let i = 0; i < xs.length; i++) c[i] = Math.sinh(b[i]);
  return c;
}
function jsFused(xs, out) {
  for (let i = 0; i < xs.length; i++) out[i] = Math.sinh(Math.exp(Math.sin(xs[i])));
  return out;
}
function wasmChain(xs, out) {
  const n = xs.length, inO = base, outO = base + n * 8;
  new Float64Array(memory.buffer, inO, n).set(xs);
  kSin(inO, outO, n); kExp(outO, outO, n); kSinh(outO, outO, n); // in-memory, in-place after first
  out.set(new Float64Array(memory.buffer, outO, n));
  return out;
}
// correctness
{
  const xs = Float64Array.from({ length: 500 }, (_, i) => (i - 250) / 100);
  const a = jsSeparate(xs), b = wasmChain(xs, new Float64Array(500));
  let e = 0; for (let i = 0; i < 500; i++) e = Math.max(e, Math.abs(a[i] - b[i]));
  console.log(`chain correctness max|js-wasm| = ${e.toExponential(2)}\n`);
}
function time(fn, xs, out, iters) {
  for (let w = 0; w < 5; w++) fn(xs, out);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(xs, out);
  return Number(process.hrtime.bigint() - t0) / 1e6 / iters;
}
console.log('size'.padStart(9), 'JS-sep'.padStart(9), 'JS-fused'.padStart(9), 'WASM'.padStart(9), 'WASM vs best-JS'.padStart(16));
for (const n of SIZES) {
  const xs = Float64Array.from({ length: n }, (_, i) => ((i % 1000) - 500) / 200);
  const out = new Float64Array(n);
  const it = Math.max(20, Math.round(1e7 / n));
  const sep = time((x) => jsSeparate(x), xs, out, it);
  const fused = time(jsFused, xs, out, it);
  const wasm = time(wasmChain, xs, out, it);
  const bestJs = Math.min(sep, fused);
  const r = bestJs / wasm;
  console.log(String(n).padStart(9), sep.toFixed(4).padStart(9), fused.toFixed(4).padStart(9),
    wasm.toFixed(4).padStart(9), ((r >= 1 ? r.toFixed(2) : '(' + r.toFixed(2)) + 'x)').padStart(16),
    r >= 1.15 ? ' WASM wins' : r <= 0.87 ? ' JS wins' : ' ~tie');
}
