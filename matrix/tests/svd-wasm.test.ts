import { describe, it, expect } from 'vitest';
import { svdWasm } from '../src/operations/svd-wasm.js';
import { svd } from '../src/operations/svd.js';
import { RustWasmLoader } from '../src/backends/RustWasmLoader.js';

/**
 * Tests `svdWasm` — the WASM-accelerated thin SVD wired to the Rust crate's
 * `svd` export (EXPANSION/GAP slice 2). Reconstruction checks pass on either
 * path (Rust WASM or the JS fallback), so the suite is environment-robust.
 */
function reconstruct(
  U: number[][],
  S: number[],
  V: number[][],
  m: number,
  n: number,
  k: number
): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < k; t++) acc += U[i][t] * S[t] * V[j][t];
      row.push(acc);
    }
    out.push(row);
  }
  return out;
}

function maxDiff(A: number[][], B: number[][]): number {
  let d = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      d = Math.max(d, Math.abs(A[i][j] - B[i][j]));
    }
  }
  return d;
}

const cases: Array<[string, number[][]]> = [
  ['3x3 diagonal', [[3, 0, 0], [0, 1, 0], [0, 0, 2]]],
  ['4x2 tall', [[1, 2], [3, 4], [5, 6], [7, 8]]],
  ['2x4 wide', [[1, 2, 3, 4], [5, 6, 7, 8]]],
  ['5x3 general', [[2, -1, 0], [4, 3, -2], [1, 1, 5], [0, 6, -3], [-1, 2, 1]]],
];

describe('svdWasm', () => {
  for (const [name, A] of cases) {
    it(`returns a thin SVD that reconstructs ${name}`, async () => {
      const m = A.length;
      const n = A[0].length;
      const k = Math.min(m, n);
      const r = await svdWasm(A);

      expect(r.U.length).toBe(m);
      expect(r.U[0].length).toBe(k);
      expect(r.S.length).toBe(k);
      expect(r.V.length).toBe(n);
      expect(r.V[0].length).toBe(k);

      expect(maxDiff(A, reconstruct(r.U, r.S, r.V, m, n, k))).toBeLessThan(1e-8);
      for (let i = 1; i < k; i++) {
        expect(r.S[i - 1]).toBeGreaterThanOrEqual(r.S[i] - 1e-12);
      }
    });
  }

  it('agrees with the synchronous JS svd on singular values', async () => {
    const A = [[4, 0], [3, -5]];
    const w = await svdWasm(A);
    const j = svd(A);
    expect(w.S[0]).toBeCloseTo(j.S[0], 9);
    expect(w.S[1]).toBeCloseTo(j.S[1], 9);
  });

  it('handles an empty matrix', async () => {
    const r = await svdWasm([]);
    expect(r).toEqual({ U: [], S: [], V: [], rank: 0 });
  });

  it('reports which backend served the decomposition', async () => {
    await svdWasm([[1, 0], [0, 1]]);
    // Informational: true when the Rust WASM build is present.
    console.log(
      `svdWasm backend: ${
        RustWasmLoader.getInstance().isLoaded ? 'Rust WASM' : 'JS fallback'
      }`
    );
  });
});
