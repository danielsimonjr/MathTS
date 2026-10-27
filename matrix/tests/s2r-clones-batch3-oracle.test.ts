/**
 * Sprint 2R clone-merge batch 3 (G42, G51–G53, G57, G58) — independent oracles.
 * Pins behavior before deduplicating matrix backends / common helpers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { transpose } from '../src/operations/common.js';
import { matrixSqrtNewtonInternal } from '../src/operations/sqrtm.js';
import { jsBackend } from '../src/backends/JSBackend.js';
import { ParallelBackend } from '../src/backends/ParallelBackend.js';
import { DenseMatrix } from '../src/types/DenseMatrix.js';

describe('S2R batch3 — transpose (G42 oracle)', () => {
  it('[[1,2],[3,4]] → [[1,3],[2,4]]', () => {
    expect(
      transpose([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('1×3 row → 3×1 column', () => {
    expect(transpose([[7, 8, 9]])).toEqual([[7], [8], [9]]);
  });
});

describe('S2R batch3 — sumAxis (G51 oracle)', () => {
  // Hand sum on 2×3 with a zero column and zero row:
  // [[1, 0, 3], [0, 5, 6]]
  const a = DenseMatrix.fromArray([
    [1, 0, 3],
    [0, 5, 6],
  ]);

  it('axis 0: column sums [1, 5, 9]', () => {
    expect(jsBackend.sumAxis(a, 0).toFlatArray()).toEqual([1, 5, 9]);
  });

  it('axis 1: row sums [4, 11]', () => {
    expect(jsBackend.sumAxis(a, 1).toFlatArray()).toEqual([4, 11]);
  });

  it('ParallelBackend.sumAxis matches JSBackend on axis 0 and 1', () => {
    const pb = new ParallelBackend();
    expect(pb.sumAxis(a, 0).toFlatArray()).toEqual(jsBackend.sumAxis(a, 0).toFlatArray());
    expect(pb.sumAxis(a, 1).toFlatArray()).toEqual(jsBackend.sumAxis(a, 1).toFlatArray());
  });
});

describe('S2R batch3 — Frobenius norm (G52 oracle)', () => {
  it('[[3,4]] has norm 5', () => {
    const a = DenseMatrix.fromArray([[3, 4]]);
    expect(jsBackend.norm(a)).toBe(5);
  });

  it('empty 0×0 matrix has norm 0', () => {
    const empty = new DenseMatrix(0, 0);
    expect(jsBackend.norm(empty)).toBe(0);
  });
});

describe('S2R batch3 — ParallelBackend binary ops (G53 oracle)', () => {
  const a2 = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
  ]);
  const b2 = DenseMatrix.fromArray([
    [10, 20],
    [30, 40],
  ]);
  const addOracle = [
    [11, 22],
    [33, 44],
  ];
  const subOracle = [
    [-9, -18],
    [-27, -36],
  ];
  const hadamardOracle = [
    [10, 40],
    [90, 160],
  ];

  let parallelLow: ParallelBackend;
  let parallelHigh: ParallelBackend;

  beforeAll(async () => {
    parallelLow = new ParallelBackend({ parallelThreshold: 0 });
    parallelHigh = new ParallelBackend({ parallelThreshold: 100_000 });
    await parallelLow.initialize();
    await parallelHigh.initialize();
  });

  afterAll(async () => {
    await parallelLow.terminate();
    await parallelHigh.terminate();
  });

  it('2×2 add/sub/hadamard below threshold (sequential path)', async () => {
    expect((await parallelHigh.add(a2, b2)).toArray()).toEqual(addOracle);
    expect((await parallelHigh.subtract(a2, b2)).toArray()).toEqual(subOracle);
    expect((await parallelHigh.multiplyElementwise(a2, b2)).toArray()).toEqual(hadamardOracle);
  });

  it('2×2 add/sub/hadamard above threshold (worker path when ready)', async () => {
    expect((await parallelLow.add(a2, b2)).toArray()).toEqual(addOracle);
    expect((await parallelLow.subtract(a2, b2)).toArray()).toEqual(subOracle);
    expect((await parallelLow.multiplyElementwise(a2, b2)).toArray()).toEqual(hadamardOracle);
  });
});

/** Gauss–Jordan oracle (same pivot rule as logm/sqrtm matInv: singular if |pivot| < 1e-15). */
function oracleMatInv(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => {
    const r = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j];
    r[n + i] = 1;
    return r;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-15) return null;

    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[row][j] -= f * M[col][j];
    }
  }

  return M.map((row) => row.slice(n));
}

describe('S2R batch3 — matInv (G57 oracle)', () => {
  it('inverts [[1,2],[3,4]]', () => {
    const inv = oracleMatInv([
      [1, 2],
      [3, 4],
    ]);
    expect(inv).not.toBeNull();
    // Hand: det = -2, adjoint → [[-2,1],[1.5,-0.5]] scaled
    expect(inv![0][0]).toBeCloseTo(-2, 10);
    expect(inv![0][1]).toBeCloseTo(1, 10);
    expect(inv![1][0]).toBeCloseTo(1.5, 10);
    expect(inv![1][1]).toBeCloseTo(-0.5, 10);
  });

  it('singular matrix returns null', () => {
    expect(
      oracleMatInv([
        [1, 2],
        [2, 4],
      ])
    ).toBeNull();
  });
});

describe('S2R batch3 — matrixSqrtNewtonInternal (G58 oracle)', () => {
  it('sqrt([[4,0],[0,9]]) = [[2,0],[0,3]] within 1e-10', () => {
    const Y = matrixSqrtNewtonInternal([
      [4, 0],
      [0, 9],
    ]);
    expect(Y[0][0]).toBeCloseTo(2, 10);
    expect(Y[0][1]).toBeCloseTo(0, 10);
    expect(Y[1][0]).toBeCloseTo(0, 10);
    expect(Y[1][1]).toBeCloseTo(3, 10);
  });
});
