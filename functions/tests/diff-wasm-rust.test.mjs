/**
 * Differential test of the RUST wasm special kernels (functions/dist/wasm/mathts.wasm)
 * vs mpmath goldens. Drives the raw pointer ABI directly (the Rust binary has no
 * allocator; we grow linear memory for scratch and write inputs in place).
 *
 * Confirms the Rust backend (the DEFAULT for the functions package) is numerically
 * correct after the special-function port — i.e. enabling wasm does not regress.
 * Reuses assembly/tests/golden/special.golden.json (wasm export names).
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const wasmBuf = readFileSync(path.join(here, '../dist/wasm/mathts.wasm'));
const golden = JSON.parse(
  readFileSync(path.join(here, '../../assembly/tests/golden/special.golden.json'), 'utf-8'),
);

const { instance } = await WebAssembly.instantiate(wasmBuf, {});
const ex = instance.exports;
const mem = ex.memory;
mem.grow(4); // 256 KiB scratch past static data
const base = (mem.buffer.byteLength - 4 * 65536) >>> 0;
const f64 = () => new Float64Array(mem.buffer); // re-acquire (buffer can detach)

function score(a, e) {
  if (!Number.isFinite(a) || !Number.isFinite(e)) return a === e ? 0 : Infinity;
  const d = Math.abs(e) > 1e-12 ? Math.abs(e) : 1;
  return Math.abs(a - e) / d;
}

// Single-array kernels: fn(xs_ptr, n, out_ptr). Covers the functions fixed in Rust.
const VEC1 = {
  bessel_j0_f64: 'bessel_j0_f64', bessel_j1_f64: 'bessel_j1_f64',
  bessel_y0_f64: 'bessel_y0_f64', bessel_y1_f64: 'bessel_y1_f64',
  airy_ai_f64: 'airy_ai_f64', airy_bi_f64: 'airy_bi_f64',
  lgamma_f64: 'lgamma_f64', elliptic_k_f64: 'elliptic_k_f64', elliptic_e_f64: 'elliptic_e_f64',
};

function callVec1(fnName, x) {
  const inPtr = base, outPtr = base + 16;
  f64()[inPtr / 8] = x;
  const r = ex[fnName](inPtr, 1, outPtr);
  if (r !== 1) return NaN;
  return f64()[outPtr / 8];
}

let pass = 0, weak = 0, fail = 0;
const fails = [];
for (const [fn, spec] of Object.entries(golden.functions)) {
  if (spec.kind !== 'vec1' || !VEC1[fn]) continue;
  if (typeof ex[fn] !== 'function') { fail++; fails.push(`${fn} [MISSING WASM EXPORT]`); continue; }
  for (const c of spec.cases) {
    const x = c[0], expected = c[1];
    const s = score(callVec1(fn, x), expected);
    if (s <= 1e-9) pass++;
    else if (s <= 1e-6) weak++;
    else { fail++; fails.push(`${fn}(${x}) score=${s.toExponential(2)} got=${callVec1(fn, x)} want=${expected}`); }
  }
}

console.log('Rust wasm special kernels vs mpmath (vec1)');
console.log('==========================================');
console.log(`${pass + weak + fail} checks: ${pass} PASS, ${weak} WEAK, ${fail} FAIL`);
if (fails.length) { console.log('\nFAIL:'); fails.forEach((f) => console.log('  X ' + f)); }
process.exit(fail === 0 ? 0 : 1);
