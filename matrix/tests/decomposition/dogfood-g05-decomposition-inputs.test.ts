/**
 * Dogfood relay G05 — decomposition input types (#704, #705).
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import {
  cholesky,
  decompositionInputToDenseMatrix,
  decompositionInputToNestedArray,
  eig,
  lu,
  luSolve,
  matrixSchur,
  normFro,
  qr,
  svd,
  svdWasm,
} from '../../src/operations/index.js';

/** NumPy reference: np.linalg.svd([[1,2],[3,4]], compute_uv=False) */
const NUMPY_S_2X2 = [5.464985704077139, 0.3659661906282276];

describe('G05 #704 — svd accepts DenseMatrix', () => {
  it('matches nested-array singular values (NumPy oracle)', () => {
    const nested = svd([
      [1, 2],
      [3, 4],
    ]);
    const packed = svd(new DenseMatrix(2, 2, [1, 2, 3, 4]));
    expect(packed.S[0]).toBeCloseTo(nested.S[0], 12);
    expect(packed.S[1]).toBeCloseTo(nested.S[1], 12);
    expect(packed.S[0]).toBeCloseTo(NUMPY_S_2X2[0], 9);
    expect(packed.S[1]).toBeCloseTo(NUMPY_S_2X2[1], 9);
    expect(packed.S[0]).toBeCloseTo(5.4649857, 8);
    expect(packed.rank).toBe(2);
    expect(packed.U.length).toBe(2);
    expect(packed.V.length).toBe(2);
  });

  it('rejects unknown objects instead of returning rank 0', () => {
    expect(() => svd({ rows: 2, cols: 2 } as unknown as number[][])).toThrow(TypeError);
  });
});

describe('G05 #705 — lu accepts nested arrays', () => {
  it('exact repro: lu([[4,1],[1,3]]) does not throw', () => {
    expect(() =>
      lu([
        [4, 1],
        [1, 3],
      ])
    ).not.toThrow();
  });

  it('matches DenseMatrix lu path', () => {
    const nested = lu([
      [4, 1],
      [1, 3],
    ]);
    const dense = lu(new DenseMatrix(2, 2, [4, 1, 1, 3]));
    expect(luSolve(nested, [1, 2])).toEqual(luSolve(dense, [1, 2]));
  });
});

function reconstruct(U: number[][], S: number[], V: number[][]): number[][] {
  const m = U.length;
  const n = V.length;
  const k = S.length;
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(n).fill(0);
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let t = 0; t < k; t++) {
        sum += U[i][t] * S[t] * V[j][t];
      }
      row[j] = sum;
    }
    out.push(row);
  }
  return out;
}

describe('G05 probes — shared normalizer', () => {
  const nested = [
    [1, 2],
    [3, 4],
  ];
  const dense = new DenseMatrix(2, 2, [1, 2, 3, 4]);
  const flat = new Float64Array([1, 2, 3, 4]);
  const packed = { data: new Float64Array([1, 2, 3, 4]), rows: 2, cols: 2 };

  it('reconstructs A = U Σ Vᵀ for every accepted shape (NumPy σ)', () => {
    for (const input of [nested, dense, flat, packed]) {
      const r = svd(input);
      expect(r.S[0]).toBeCloseTo(NUMPY_S_2X2[0], 8);
      expect(r.S[1]).toBeCloseTo(NUMPY_S_2X2[1], 8);
      const back = reconstruct(r.U, r.S, r.V);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          expect(back[i][j]).toBeCloseTo(nested[i][j], 8);
        }
      }
    }
  });

  it('svdWasm(DenseMatrix) is the same singular values, not a silent empty factor', async () => {
    const r = await svdWasm(dense);
    expect(r.S[0]).toBeCloseTo(NUMPY_S_2X2[0], 8);
    expect(r.rank).toBe(2);
  });

  it('rejects ragged rows and unknown values with TypeError', () => {
    expect(() => svd([[1, 2], [3]])).toThrow(TypeError);
    expect(() => lu([[1, 2], [3]])).toThrow(TypeError);
    expect(() => svd(null as unknown as number[][])).toThrow(TypeError);
    expect(() => qr({ data: [1, 2, 3, 4], rows: 2, cols: 2 } as unknown as number[][])).toThrow(
      TypeError
    );
  });

  it('treats a length-0 Float64Array as 0×0, and a non-square buffer as TypeError', () => {
    expect(svd(new Float64Array(0))).toEqual({ U: [], S: [], V: [], rank: 0 });
    expect(() => svd(new Float64Array([1, 2, 3, 4, 5]))).toThrow(TypeError);
  });

  it('does not copy a nested array or a DenseMatrix on the hot path', () => {
    expect(decompositionInputToNestedArray(nested)).toBe(nested);
    expect(decompositionInputToDenseMatrix(dense)).toBe(dense);
    const buf = new Float64Array([4, 1, 1, 3]);
    const converted = decompositionInputToDenseMatrix(buf);
    buf[0] = 99;
    expect(converted.get(0, 0)).toBe(4);
  });

  it('qr, cholesky, eig, and schur agree on nested arrays and DenseMatrix', () => {
    const A = [
      [4, 1],
      [1, 3],
    ];
    const D = new DenseMatrix(2, 2, [4, 1, 1, 3]);
    const qN = qr(A);
    const qD = qr(D);
    expect(qN.R.get(0, 0)).toBeCloseTo(qD.R.get(0, 0), 12);
    expect(cholesky(A).L.get(1, 0)).toBeCloseTo(cholesky(D).L.get(1, 0), 12);
    expect(eig(A).values[0].re).toBeCloseTo(eig(D).values[0].re, 10);
    expect(matrixSchur(A).T.get(0, 0)).toBeCloseTo(matrixSchur(D).T.get(0, 0), 8);
    expect(normFro(D)).toBeCloseTo(Math.sqrt(4 * 4 + 1 + 1 + 9), 12);
  });

  it('does not read an LU result object as packed storage', () => {
    const fac = lu(nested);
    expect(() => svd(fac as unknown as number[][])).toThrow(TypeError);
  });
});
