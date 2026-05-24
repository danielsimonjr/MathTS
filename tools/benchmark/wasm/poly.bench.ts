/**
 * Polynomial WASM kernel benchmark — Slice 3.7.
 *
 * Compares the pure-JS path against the WASM path for:
 *   • poly_mul_f64  — O(n·m) convolution
 *   • poly_div_mod_f64 — polynomial long division
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/poly.bench.ts
 *   (requires the Rust WASM artifact at /home/user/lib/wasm/mathts.wasm)
 *
 * Expected result: WASM wins above WASM_POLY_THRESHOLD (256 coefficients),
 * JS wins below.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Direct imports from source (pre-build).
import {
  polyMulDispatch,
  polyDivModDispatch,
  WASM_POLY_THRESHOLD,
} from '../../../functions/src/wasm/poly/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 20;

function randF64Array(n: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 20 - 10;
  a[n - 1] = a[n - 1] === 0 ? 1 : a[n - 1]; // non-zero leading coeff
  return a;
}

/** Pure-JS poly multiply (baseline). */
function jsMul(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length === 0 || b.length === 0) return new Float64Array([0]);
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

/** Pure-JS long division (baseline). */
function jsDivMod(num: Float64Array, den: Float64Array): void {
  const qLen = num.length >= den.length ? num.length - den.length + 1 : 0;
  const work = new Float64Array(num);
  const quot = new Float64Array(qLen);
  const bn = den[den.length - 1];
  for (let ii = 0; ii < qLen; ii++) {
    const i = num.length - 1 - ii;
    quot[i - den.length + 1] = work[i] / bn;
    for (let j = 0; j < den.length; j++)
      work[i - den.length + 1 + j] -= quot[i - den.length + 1] * den[j];
  }
}

function bench(label: string, fn: () => unknown, runs: number): number {
  // Warm-up.
  fn();
  fn();
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  console.log(`  ${label.padEnd(40)} ${elapsed.toFixed(3)} ms/run`);
  return elapsed;
}

async function run(): Promise<void> {
  console.log('=== Polynomial WASM Kernel Benchmark ===');
  console.log(`  WASM_POLY_THRESHOLD = ${WASM_POLY_THRESHOLD}`);

  if (!WASM_PATH) {
    console.log('  WASM artifact not found — JS-only benchmark');
  } else {
    await wasmLoader.load(WASM_PATH);
    console.log('  Rust WASM artifact loaded');
  }

  const sizes = [64, 128, WASM_POLY_THRESHOLD, 512, 1024, 2048];

  for (const n of sizes) {
    const a = randF64Array(n);
    const b = randF64Array(n);
    const num = randF64Array(n * 2);
    const den = randF64Array(n);

    console.log(`\n--- n = ${n} (${n >= WASM_POLY_THRESHOLD ? 'above' : 'below'} threshold) ---`);

    const jsT = bench('poly_mul JS baseline', () => jsMul(a, b), RUNS);
    const wasmT = bench('poly_mul WASM dispatch', () => polyMulDispatch(a, b), RUNS);

    if (wasmT < jsT) {
      console.log(`  → WASM wins by ${(jsT / wasmT).toFixed(2)}×`);
    } else {
      console.log(`  → JS wins by ${(wasmT / jsT).toFixed(2)}× (expected below threshold)`);
    }

    const jsDivT = bench('poly_div_mod JS baseline', () => jsDivMod(num, den), RUNS);
    const wasmDivT = bench('poly_div_mod WASM dispatch', () => polyDivModDispatch(num, den), RUNS);

    if (wasmDivT < jsDivT) {
      console.log(`  → WASM div wins by ${(jsDivT / wasmDivT).toFixed(2)}×`);
    } else {
      console.log(
        `  → JS div wins by ${(wasmDivT / jsDivT).toFixed(2)}× (expected below threshold)`
      );
    }
  }
}

run().catch(console.error);
