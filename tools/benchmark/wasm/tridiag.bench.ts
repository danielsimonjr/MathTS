/**
 * Tridiagonal-solve WASM kernel benchmark — Slice 3.10b.
 *
 * Compares the pure-JS Thomas algorithm against the WASM-dispatched path for
 * the tridiagonal solver used by `cubicSpline`.
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/tridiag.bench.ts
 *   (requires the Rust WASM artifact at /home/user/MathTS/lib/wasm/mathts.wasm)
 *
 * Expected result: WASM wins above WASM_TRIDIAG_THRESHOLD (1024 unknowns),
 * JS wins (or is comparable) below due to marshal overhead.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  tridiagSolveDispatch,
  tridiagSolveJS,
  WASM_TRIDIAG_THRESHOLD,
} from '../../../functions/src/wasm/interpolation/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 30;

/**
 * Build a symmetric diagonally-dominant tridiagonal system of size n.
 * The exact solution is all-ones.
 */
function buildSystem(n: number): {
  diag: Float64Array;
  lower: Float64Array;
  upper: Float64Array;
  rhs: Float64Array;
} {
  const diag = new Float64Array(n).fill(4.0);
  const lower = new Float64Array(n - 1).fill(-1.0);
  const upper = new Float64Array(n - 1).fill(-1.0);
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    rhs[i] = 4.0;
    if (i > 0) rhs[i] -= 1.0;
    if (i < n - 1) rhs[i] -= 1.0;
  }
  return { diag, lower, upper, rhs };
}

function bench(label: string, fn: () => unknown, runs: number): number {
  // Warm-up.
  fn();
  fn();
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  console.log(`  ${label.padEnd(40)} ${elapsed.toFixed(4)} ms/run`);
  return elapsed;
}

async function run(): Promise<void> {
  console.log('=== Tridiagonal-Solve WASM Kernel Benchmark ===');
  console.log(`  WASM_TRIDIAG_THRESHOLD = ${WASM_TRIDIAG_THRESHOLD}`);

  if (!WASM_PATH) {
    console.log('  WASM artifact not found — JS-only benchmark');
  } else {
    await wasmLoader.load(WASM_PATH);
    console.log('  Rust WASM artifact loaded');
  }

  const sizes = [128, 256, 512, WASM_TRIDIAG_THRESHOLD, 2048, 4096];

  for (const n of sizes) {
    const { diag, lower, upper, rhs } = buildSystem(n);

    console.log(
      `\n--- n = ${n} (${n >= WASM_TRIDIAG_THRESHOLD ? 'above' : 'below'} threshold) ---`
    );

    const jsT = bench('tridiag JS baseline', () => tridiagSolveJS(diag, lower, upper, rhs), RUNS);
    const dispatchT = bench(
      'tridiag WASM dispatch',
      () => tridiagSolveDispatch(diag, lower, upper, rhs),
      RUNS
    );

    if (dispatchT < jsT) {
      console.log(`  → WASM wins by ${(jsT / dispatchT).toFixed(2)}×`);
    } else {
      console.log(
        `  → JS wins by ${(dispatchT / jsT).toFixed(2)}× (expected below threshold or marshal overhead)`
      );
    }
  }
}

run().catch(console.error);
