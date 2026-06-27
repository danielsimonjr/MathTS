/**
 * Matrix heavy ops — AssemblyScript vs JS.
 *
 * Benchmarks the AssemblyScript-accelerated matrix paths against their pure-JS
 * equivalents:
 *
 *   - multiply   : `WASMBackend.multiply` (AS `matrix_multiply`) vs
 *                  `JSBackend.multiply`.
 *   - svd        : `svdWasm` (AS one-sided Jacobi `matrix_svd`) vs the
 *                  synchronous Golub-Reinsch `svd` (JS). maxdiff on singular
 *                  values.
 *   - eig        : `eigWasm` (AS) vs `eig` (JS), on a symmetric matrix. maxdiff
 *                  on the sorted real eigenvalues.
 *   - welch-psd  : the FFT-based power-spectral-density estimate
 *                  (`welchPSDDispatch`, AS `welch_psd_f64`) vs `welchPSDJS`.
 *                  This is the FFT round-trip coverage — Welch's method runs an
 *                  FFT over each (overlapping, windowed) frame.
 *
 * `multiply` / `svd` / `eig` size axis is the square-matrix dimension; the AS
 * backend is configured with `minElements: 0` so even small matrices take the
 * wasm path (we want the kernel timing, not the threshold gate). `welch-psd`
 * size axis is the sample count.
 *
 * Run: `npm run bench:matrix`
 */

import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { WASMBackend } from '../../../matrix/src/backends/WASMBackend.js';
import { svd } from '../../../matrix/src/operations/svd.js';
import { svdWasm } from '../../../matrix/src/operations/svd-wasm.js';
import { eig, type EigResult } from '../../../matrix/src/operations/eig.js';
import { eigWasm } from '../../../matrix/src/operations/eig-wasm.js';
import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import {
  welchPSDDispatch,
  welchPSDJS,
} from '../../../functions/src/wasm/signal/wasm-bridge.js';
import { maxdiffF64, runCases, isMainModule, type WasmCase } from './harness.js';

const wasmBackend = new WASMBackend({ minElements: 0 });

/** Random square matrix as a flat-backed DenseMatrix. */
function randomDense(dim: number): DenseMatrix {
  const data = new Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) data[i] = Math.random();
  return DenseMatrix.fromFlat(dim, dim, data);
}

/** Random square matrix as a 2D array. */
function randomMat(dim: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < dim; i++) {
    const row = new Array(dim);
    for (let j = 0; j < dim; j++) row[j] = Math.random();
    m.push(row);
  }
  return m;
}

/** Random SYMMETRIC matrix (real eigenvalues) as a 2D array. */
function randomSymmetric(dim: number): number[][] {
  const m = randomMat(dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < i; j++) {
      const v = (m[i][j] + m[j][i]) / 2;
      m[i][j] = v;
      m[j][i] = v;
    }
  }
  return m;
}

/** Sorted real eigenvalues (ascending) from an EigResult. */
function sortedRealEig(r: EigResult): Float64Array {
  const vals = r.values.map((v) => v.re).sort((a, b) => a - b);
  return Float64Array.from(vals);
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

const svdCase: WasmCase = {
  op: 'svd (singular values)',
  unit: 'matrix dim',
  sizes: [32, 64, 128],
  prepare: (dim) => randomMat(dim),
  js: (i) => Float64Array.from(svd(i as number[][]).S),
  as: async (i) => Float64Array.from((await svdWasm(i as number[][])).S),
  maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  iterations: (dim) => (dim <= 32 ? 8 : dim <= 64 ? 4 : 2),
  note: 'maxdiff over the singular-value spectrum (thin form on both paths).',
};

const eigCase: WasmCase = {
  op: 'eig (symmetric eigenvalues)',
  unit: 'matrix dim',
  sizes: [32, 64, 128],
  prepare: (dim) => randomSymmetric(dim),
  js: (i) => sortedRealEig(eig(i as number[][])),
  as: async (i) => sortedRealEig(await eigWasm(i as number[][])),
  maxdiff: (a, b) => maxdiffF64(a as Float64Array, b as Float64Array),
  iterations: (dim) => (dim <= 32 ? 8 : dim <= 64 ? 4 : 2),
  note: 'maxdiff over the sorted real eigenvalues of a symmetric matrix.',
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
  await runCases('MATRIX HEAVY OPS + FFT — AssemblyScript vs JS', [
    multiplyCase,
    svdCase,
    eigCase,
    welchCase,
  ]);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
