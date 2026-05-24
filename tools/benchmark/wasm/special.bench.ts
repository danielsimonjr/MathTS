/**
 * Bessel J/Y WASM kernel benchmark — Slice 3.10c-1.
 *
 * Compares the pure-JS scalar loop against the WASM-dispatched path for
 * Bessel J0, J1, Jn (n=5), Y0, Y1 over Float64Array inputs.
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/special.bench.ts
 *   (requires the Rust WASM artifact at /home/user/MathTS/lib/wasm/mathts.wasm)
 *
 * Expected result: WASM wins above WASM_SPECIAL_THRESHOLD (1024 elements)
 * due to the tight inner-loop; JS may be faster for small inputs due to
 * pointer-marshal overhead.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  WASM_SPECIAL_THRESHOLD,
  besselJ0Dispatch,
  besselJ0JS,
  besselJ1Dispatch,
  besselJ1JS,
  besselJDispatch,
  besselJnJS,
  besselY0Dispatch,
  besselY0JS,
} from '../../../functions/src/wasm/special/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 30;

function linspace(lo: number, hi: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const step = (hi - lo) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = lo + i * step;
  return out;
}

function bench(label: string, fn: () => void, runs = RUNS): number {
  // Warm-up
  for (let i = 0; i < 3; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  console.log(`  ${label.padEnd(40)} ${elapsed.toFixed(3)} ms/call`);
  return elapsed;
}

async function main(): Promise<void> {
  console.log('Bessel WASM kernel benchmark (Slice 3.10c-1)\n');
  console.log(`Threshold: ${WASM_SPECIAL_THRESHOLD} elements\n`);

  if (WASM_PATH) {
    console.log(`Loading WASM from: ${WASM_PATH}`);
    await wasmLoader.load(WASM_PATH);
    const mod = wasmLoader.getModule();
    const hasRust =
      mod && typeof (mod as unknown as Record<string, unknown>)['bessel_j0_f64'] === 'function';
    console.log(`WASM loaded; Rust bessel_j0_f64 available: ${hasRust}\n`);
  } else {
    console.log('WASM artifact not found — JS-only benchmark\n');
  }

  for (const n of [256, 512, 1024, 4096, 16384]) {
    console.log(`--- n = ${n} ---`);
    const xs = linspace(0.1, 20.0, n);
    const xsPos = linspace(0.5, 20.0, n); // Y-functions need x > 0

    const j0Js = bench(`J0  JS  n=${n}`, () => besselJ0JS(xs));
    const j0Wa = bench(`J0  WASM n=${n}`, () => besselJ0Dispatch(xs));

    const j1Js = bench(`J1  JS  n=${n}`, () => besselJ1JS(xs));
    const j1Wa = bench(`J1  WASM n=${n}`, () => besselJ1Dispatch(xs));

    const jnJs = bench(`J5  JS  n=${n}`, () => besselJnJS(5, xs));
    const jnWa = bench(`J5  WASM n=${n}`, () => besselJDispatch(5, xs));

    const y0Js = bench(`Y0  JS  n=${n}`, () => besselY0JS(xsPos));
    const y0Wa = bench(`Y0  WASM n=${n}`, () => besselY0Dispatch(xsPos));

    const speedupJ0 = j0Js / j0Wa;
    const speedupY0 = y0Js / y0Wa;
    console.log(
      `  J0 WASM speedup: ${speedupJ0.toFixed(2)}x (${n < WASM_SPECIAL_THRESHOLD ? 'below threshold — JS fallback expected' : 'above threshold'})`
    );
    console.log(`  Y0 WASM speedup: ${speedupY0.toFixed(2)}x`);
    console.log('');

    (void j1Js, void j1Wa, void jnJs, void jnWa); // referenced to avoid unused warnings
  }
}

main().catch(console.error);
