/**
 * Correctness of the NON-SYMMETRIC eig path via `eigWasm`.
 *
 * `eigWasm` delegates to the JS `eig` (the WASM `matrix_eig_general` kernel was removed
 * 2026-07-01 as a scalar pessimization — see CHANGELOG / tools/benchmarks/decomp-audit). The
 * JS non-symmetric path is the canonical EISPACK `orthes`/`hqr2` algorithm, so these cross-checks
 * against the JS `eig` on random non-symmetric matrices verify the shared implementation.
 *
 * Historical note: the degree-8 companion of x^8 - 1 (the 8th roots of unity) used to be a JS/AS
 * discriminator because the old JS reference QR returned all-zero eigenvalues on it. That JS bug
 * is long fixed, so JS and `eigWasm` agree; the parity check below guards against regressing it.
 */

import { describe, it, expect } from 'vitest';
import { eigWasm } from '../../src/operations/eig-wasm.js';
import { eig } from '../../src/operations/eig.js';

// ---- helpers ---------------------------------------------------------------

function trace(A: number[][]): number {
  return A.reduce((s, row, i) => s + row[i], 0);
}

function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  const r = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[i] += A[i][j] * v[j];
  return r;
}

/** Greedy max-of-min complex set distance between two eigenvalue multisets. */
function eigSetMaxDiff(
  a: Array<{ re: number; im: number }>,
  b: Array<{ re: number; im: number }>
): number {
  const used = new Array(b.length).fill(false);
  let maxMin = 0;
  for (const ea of a) {
    let best = Infinity;
    let bestIdx = -1;
    for (let k = 0; k < b.length; k++) {
      if (used[k]) continue;
      const d = Math.hypot(ea.re - b[k].re, ea.im - b[k].im);
      if (d < best) {
        best = d;
        bestIdx = k;
      }
    }
    if (bestIdx >= 0) used[bestIdx] = true;
    maxMin = Math.max(maxMin, best);
  }
  return maxMin;
}

function seededRandom(seed: number): () => number {
  let st = seed >>> 0;
  return () => {
    st = (1103515245 * st + 12345) & 0x7fffffff;
    return st / 0x7fffffff - 0.5;
  };
}

function randomNonSymmetric(n: number, seed: number): number[][] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() * 10));
}

/** Companion matrix of monic x^n + c[n-1] x^{n-1} + ... + c0; coeffs = [c0..c_{n-1}]. */
function companion(coeffs: number[]): number[][] {
  const n = coeffs.length;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 1; i < n; i++) A[i][i - 1] = 1;
  for (let i = 0; i < n; i++) A[i][n - 1] = -coeffs[i];
  return A;
}

// ---- correctness -----------------------------------------------------------

describe('eigWasm — non-symmetric path correctness', () => {
  for (const [name, seed] of [
    ['random 8x8', 5],
    ['random 16x16', 9],
  ] as Array<[string, number]>) {
    it(`matches JS eig (as a set) on a ${name} non-symmetric matrix`, async () => {
      const A = randomNonSymmetric(name.includes('16') ? 16 : 8, seed);
      const wasmRes = await eigWasm(A);
      const jsRes = eig(A);

      expect(wasmRes.isSymmetric).toBe(false);
      expect(wasmRes.values).toHaveLength(A.length);

      // Eigenvalues agree with JS as an order-independent complex set.
      const diff = eigSetMaxDiff(wasmRes.values, jsRes.values as Array<{ re: number; im: number }>);
      expect(diff).toBeLessThan(1e-8);

      // Trace invariant: sum of eigenvalues == trace(A).
      const sumRe = wasmRes.values.reduce((s, v) => s + v.re, 0);
      expect(Math.abs(sumRe - trace(A))).toBeLessThan(1e-8);

      // Real eigenvectors satisfy A v = λ v (residual, complex pairs skipped).
      for (let k = 0; k < wasmRes.values.length; k++) {
        const { re, im } = wasmRes.values[k];
        if (Math.abs(im) > 1e-10) continue;
        const v = wasmRes.vectors[k];
        const vn = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (vn < 1e-9) continue;
        const Av = matvec(A, v);
        let res = 0;
        for (let i = 0; i < v.length; i++) res += (Av[i] - re * v[i]) ** 2;
        expect(Math.sqrt(res)).toBeLessThan(1e-7);
      }
    });
  }

  it('degree-8 companion (8th roots of unity): eigWasm and JS agree on the true spectrum', async () => {
    const A = companion([-1, 0, 0, 0, 0, 0, 0, 0]); // x^8 - 1 = 0, n = 8
    const trueRoots = Array.from({ length: 8 }, (_, k) => {
      const th = (2 * Math.PI * k) / 8;
      return { re: Math.cos(th), im: Math.sin(th) };
    });

    const wasmRes = await eigWasm(A);
    expect(wasmRes.isSymmetric).toBe(false);
    expect(eigSetMaxDiff(wasmRes.values, trueRoots)).toBeLessThan(1e-8);

    const jsRes = eig(A);
    expect(eigSetMaxDiff(jsRes.values, trueRoots)).toBeLessThan(1e-8);
    expect(eigSetMaxDiff(jsRes.values, wasmRes.values)).toBeLessThan(1e-8);
  });
});
