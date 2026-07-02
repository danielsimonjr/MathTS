/**
 * Phase 7b proof: the heavy matrix ops (SVD, symmetric eigendecomposition,
 * spectral radius) actually execute on the AssemblyScript binary — not a
 * silent JS fallback.
 *
 * Each test loads the real AS artifact through the shared (AS-default)
 * WasmLoader, asserts the allocator kind is 'as' (i.e. the AS managed runtime
 * is what got loaded), spies the AS export to confirm it was invoked, and
 * checks the marshalled result against the pure-JS reference.
 *
 * Guarded on the artifact existing so the suite degrades to a no-op in an
 * environment without the AS build.
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wasmLoader } from '../../src/backends/WasmLoader.js';
import { svdWasm } from '../../src/operations/svd-wasm.js';
import { eigWasm, spectralRadiusWasm } from '../../src/operations/eig-wasm.js';
import { svd } from '../../src/operations/svd.js';
import { eig } from '../../src/operations/eig.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');
const asAvailable = fs.existsSync(asWasmPath);

/** Symmetric n×n test matrix. */
function symmetric(n: number): number[][] {
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    A[i][i] = i + 1;
    if (i + 1 < n) {
      A[i][i + 1] = 0.5;
      A[i + 1][i] = 0.5;
    }
  }
  return A;
}

describe('heavy ops execute on the AssemblyScript binary (Phase 7b)', () => {
  beforeAll(async () => {
    if (!asAvailable) return;
    wasmLoader.reset();
    await wasmLoader.load(); // no arg → AS default
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.runIf(asAvailable)('loads the AS managed runtime', () => {
    const mod = wasmLoader.getModule();
    expect(mod).not.toBeNull();
    expect(typeof mod!.matrix_svd).toBe('function');
    expect(typeof mod!.matrix_eig_symmetric).toBe('function');
  });

  // RETIRED (2026-07-01): WASM svd disabled (WASM_SVD_ENABLED=false in svd-wasm.ts) — scalar
  // AS kernel measured 0.4–0.7× of JS (tools/benchmarks/decomp-audit). svdWasm now uses JS, so
  // the on-wasm dispatch this asserts no longer fires. Unskip if the kernel is SIMD-optimized.
  it.skip('svdWasm invokes matrix_svd and matches the JS SVD', async () => {
    // `readReturnedFloat64Array` is invoked only on the WASM dispatch path
    // (to decode the packed header the AS export returns); spying it proves
    // svdWasm ran on-wasm rather than via the JS fallback.
    const spy = vi.spyOn(wasmLoader, 'readReturnedFloat64Array');

    const A = [
      [2, -1, 0],
      [4, 3, -2],
      [1, 1, 5],
      [0, 6, -3],
      [-1, 2, 1],
    ];
    const r = await svdWasm(A);
    expect(spy).toHaveBeenCalled();

    // Singular values are bit-identical to the JS reference (7a parity).
    const ref = svd(A);
    const k = Math.min(A.length, A[0].length);
    for (let i = 0; i < k; i++) expect(r.S[i]).toBeCloseTo(ref.S[i], 9);

    // Reconstruct A = U·diag(S)·Vᵀ.
    const m = A.length;
    const n = A[0].length;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let acc = 0;
        for (let t = 0; t < k; t++) acc += r.U[i][t] * r.S[t] * r.V[j][t];
        expect(acc).toBeCloseTo(A[i][j], 8);
      }
    }
  });

  // RETIRED (2026-07-01): WASM eig disabled (WASM_EIG_ENABLED=false in eig-wasm.ts) — scalar
  // AS Jacobi/Francis kernels measured 0.2–0.7× of JS, worse at scale (decomp-audit). eigWasm
  // now uses JS, so the on-wasm dispatch this asserts no longer fires. Unskip if SIMD-optimized.
  it.skip('eigWasm invokes matrix_eig_symmetric and matches the JS eig (A·v ≈ λ·v)', async () => {
    // On-wasm proof: the decode hook only fires on the WASM dispatch path.
    const spy = vi.spyOn(wasmLoader, 'readReturnedFloat64Array');

    const A = symmetric(8);
    const n = A.length;
    const { values, vectors } = await eigWasm(A);
    expect(spy).toHaveBeenCalled();
    expect(values).toHaveLength(n);

    // Sum of eigenvalues == trace.
    const trace = A.reduce((s, row, i) => s + row[i], 0);
    const sum = values.reduce((s, v) => s + v.re, 0);
    expect(sum).toBeCloseTo(trace, 6);

    // Eigenvalue sets agree with the JS reference (sorted ascending).
    const jsVals = eig(A)
      .values.map((v) => v.re)
      .sort((a, b) => a - b);
    const wasmVals = values.map((v) => v.re).sort((a, b) => a - b);
    for (let i = 0; i < n; i++) expect(wasmVals[i]).toBeCloseTo(jsVals[i], 6);

    // Each (value, vector) pair satisfies A·v ≈ λ·v.
    for (let k = 0; k < n; k++) {
      const v = vectors[k];
      const lambda = values[k].re;
      for (let i = 0; i < n; i++) {
        let av = 0;
        for (let j = 0; j < n; j++) av += A[i][j] * v[j];
        const scale = Math.max(1, Math.abs(av), Math.abs(lambda * v[i]));
        expect(Math.abs(av - lambda * v[i]) / scale).toBeLessThan(1e-6);
      }
    }
  });

  // RETIRED (2026-07-01): WASM power-iteration disabled alongside eig/svd (decomp-audit).
  // spectralRadiusWasm now uses JS; the on-wasm dispatch this asserts no longer fires.
  it.skip('spectralRadiusWasm invokes matrix_spectral_radius and matches the JS eig', async () => {
    // On-wasm proof: allocateFloat64Array runs only on the WASM dispatch
    // path (the JS power-iteration fallback never allocates WASM memory).
    const spy = vi.spyOn(wasmLoader, 'allocateFloat64Array');

    const A = symmetric(8);
    const radius = await spectralRadiusWasm(A);
    expect(spy).toHaveBeenCalled();

    const expected = Math.max(...eig(A).values.map((v) => Math.abs(v.re)));
    expect(radius).toBeCloseTo(expected, 6);
  });
});
