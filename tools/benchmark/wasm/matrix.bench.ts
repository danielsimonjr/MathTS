/**
 * Matrix heavy ops — AssemblyScript vs JS.
 *
 * Benchmarks the AssemblyScript-accelerated matrix paths against their pure-JS
 * equivalents:
 *
 *   - multiply   : `WASMBackend.multiply` (AS SIMD `matrix_multiply_simd_ptr`) vs
 *                  `JSBackend.multiply`.
 *   - welch-psd  : the FFT-based power-spectral-density estimate
 *                  (`welchPSDDispatch`, AS `welch_psd_f64`) vs `welchPSDJS`.
 *                  This is the FFT round-trip coverage — Welch's method runs an
 *                  FFT over each (overlapping, windowed) frame.
 *
 * `multiply` size axis is the square-matrix dimension; the AS backend is configured
 * with `minElements: 0` so even small matrices take the wasm path (we want the kernel
 * timing, not the threshold gate). `welch-psd` size axis is the sample count.
 *
 * (The svd/eig cases were removed 2026-07-01 — the WASM `matrix_svd`/`matrix_eig`
 * kernels were retired as scalar pessimizations; matrix's svd/eig run in JS. See CHANGELOG.)
 *
 * Run: `npm run bench:matrix`
 */

import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { WASMBackend } from '../../../matrix/src/backends/WASMBackend.js';
import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import { welchPSDDispatch, welchPSDJS } from '../../../functions/src/wasm/signal/wasm-bridge.js';
import { maxdiffF64, runCases, isMainModule, type WasmCase } from './harness.js';

const wasmBackend = new WASMBackend({ minElements: 0 });

/** Random square matrix as a flat-backed DenseMatrix. */
function randomDense(dim: number): DenseMatrix {
  const data = new Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) data[i] = Math.random();
  return DenseMatrix.fromFlat(dim, dim, data);
}

const multiplyCase: WasmCase = {
  op: 'multiply',
  unit: 'matrix dim',
  sizes: [64, 128, 256, 512],
  prepare: (dim) => ({ a: randomDense(dim), b: randomDense(dim) }),
  js: (i) => {
    const { a, b } = i as { a: DenseMatrix; b: DenseMatrix };
    return jsBackend.multiply(a, b).toFloat64Array();
  },
  as: (i) => {
    const { a, b } = i as { a: DenseMatrix; b: DenseMatrix };
    return wasmBackend.multiply(a, b).toFloat64Array();
  },
  maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  iterations: (dim) => (dim <= 128 ? 15 : dim <= 256 ? 8 : 4),
};

// Welch PSD = FFT-based spectral estimate (FFT over each windowed frame).
const FRAME = 1024;
const OVERLAP = 512;
const welchCase: WasmCase = {
  op: 'welch-psd [FFT]',
  unit: 'samples',
  sizes: [16384, 131072, 1_000_000],
  prepare: (n) => {
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) s[i] = Math.sin(i * 0.05) + 0.3 * Math.random();
    return s;
  },
  js: (i) => welchPSDJS(i as Float64Array, FRAME, OVERLAP, 0 /* hann */),
  as: (i) => welchPSDDispatch(i as Float64Array, FRAME, OVERLAP, 'hann'),
  maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  note: `Welch PSD, frame=${FRAME}, overlap=${OVERLAP}, Hann window (FFT per frame).`,
};

export async function main(): Promise<void> {
  await initWasm();
  await wasmBackend.initialize();
  await runCases('MATRIX HEAVY OPS + FFT — AssemblyScript vs JS', [multiplyCase, welchCase]);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
