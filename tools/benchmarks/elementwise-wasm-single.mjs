// B8 spike: does the WASM batch exp (with copy-in/out) beat a V8-JIT'd Math.exp loop?
import { readFileSync } from 'node:fs';

const bytes = readFileSync('assembly/build/mathts.wasm');
const { instance } = await WebAssembly.instantiate(bytes, {
  env: { abort: () => { throw new Error('wasm abort'); } },
});
const { memory, array_exp_ptr } = instance.exports;

const SIZES = [256, 1024, 4096, 16384, 65536, 262144, 1048576];
const maxN = Math.max(...SIZES);
const base = memory.buffer.byteLength; // scratch above static data + heap
// pre-grow once so the buffer stays stable during timing (no per-call grow/detach)
const need = base + 2 * maxN * 8;
if (need > memory.buffer.byteLength) memory.grow(Math.ceil((need - memory.buffer.byteLength) / 65536) + 1);

function jsExp(xs, out) {
  for (let i = 0; i < xs.length; i++) out[i] = Math.exp(xs[i]);
  return out;
}
function wasmExp(xs, out) {
  const n = xs.length;
  const inO = base, outO = base + n * 8;
  new Float64Array(memory.buffer, inO, n).set(xs);
  array_exp_ptr(inO, outO, n);
  out.set(new Float64Array(memory.buffer, outO, n));
  return out;
}

// correctness check
{
  const xs = Float64Array.from({ length: 1000 }, (_, i) => (i - 500) / 100);
  const a = jsExp(xs, new Float64Array(1000));
  const b = wasmExp(xs, new Float64Array(1000));
  let maxErr = 0;
  for (let i = 0; i < 1000; i++) maxErr = Math.max(maxErr, Math.abs(a[i] - b[i]));
  console.log(`correctness: max|js-wasm| = ${maxErr.toExponential(2)} (must be ~0)\n`);
  if (maxErr > 1e-9) { console.log('WASM exp DIVERGES — abort benchmark'); process.exit(1); }
}

function time(fn, xs, out, iters) {
  for (let w = 0; w < 5; w++) fn(xs, out); // warmup / JIT
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(xs, out);
  return Number(process.hrtime.bigint() - t0) / 1e6 / iters; // ms/call
}

console.log('size'.padStart(9), 'JS ms'.padStart(10), 'WASM ms'.padStart(10), 'speedup'.padStart(9));
for (const n of SIZES) {
  const xs = Float64Array.from({ length: n }, (_, i) => ((i % 1000) - 500) / 200);
  const out = new Float64Array(n);
  const iters = Math.max(20, Math.round(2e7 / n));
  const js = time(jsExp, xs, out, iters);
  const wasm = time(wasmExp, xs, out, iters);
  const ratio = js / wasm;
  console.log(
    String(n).padStart(9), js.toFixed(4).padStart(10), wasm.toFixed(4).padStart(10),
    (ratio >= 1 ? ratio.toFixed(2) + 'x' : '(' + ratio.toFixed(2) + 'x)').padStart(9),
    ratio >= 1.15 ? '  <- WASM wins' : ratio <= 0.87 ? '  <- JS wins' : '  ~tie'
  );
}
