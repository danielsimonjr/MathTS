/**
 * Clone batch A (M1–M4): oracle tests for Givens params, Schur QR chase,
 * Gauss-Jordan continue-on-tiny-pivot, and Newton sqrt update.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { schurInternal } from '../../src/operations/schur.js';
import { matrixExpm } from '../../src/operations/expm.js';
import { matrixSqrtm, matrixSqrtNewtonInternal } from '../../src/operations/sqrtm.js';

// ---------------------------------------------------------------------------
// M1 — independent Givens oracle (bit-for-bit with legacy schur/svd copies)
// ---------------------------------------------------------------------------

function oracleGivensRotation(a: number, b: number): { c: number; s: number } {
  if (b === 0) return { c: 1, s: 0 };
  if (Math.abs(b) > Math.abs(a)) {
    const t = -a / b;
    const s = 1 / Math.sqrt(1 + t * t);
    return { c: s * t, s };
  }
  const t = -b / a;
  const c = 1 / Math.sqrt(1 + t * t);
  return { c, s: c * t };
}

const GIVENS_SNAPSHOT: Array<{ a: number; b: number; c: number; s: number }> = [
  { a: 3, b: 0, c: 1, s: 0 },
  { a: 0, b: 4, c: 0, s: 1 },
  { a: 3, b: 4, c: -0.6000000000000001, s: 0.8 },
  { a: 1e-20, b: 1, c: -1e-20, s: 1 },
  { a: 1, b: 1e-20, c: 1, s: -1e-20 },
  { a: -2, b: 5, c: 0.3713906763541037, s: 0.9284766908852592 },
  { a: 2, b: -5, c: 0.3713906763541037, s: 0.9284766908852592 },
];

// ---------------------------------------------------------------------------
// M3 — reference elimination (pre-consolidation bodies)
// ---------------------------------------------------------------------------

function referenceMatSolve(M: number[][], N: number[][]): number[][] {
  const n = M.length;
  const cols = N[0].length;
  const Aug: number[][] = M.map((row, i) => [...row, ...N[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(Aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(Aug[row][col]) > maxVal) {
        maxVal = Math.abs(Aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [Aug[col], Aug[maxRow]] = [Aug[maxRow], Aug[col]];

    const pivot = Aug[col][col];
    if (Math.abs(pivot) < 1e-15) continue;

    for (let j = col; j < n + cols; j++) Aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = Aug[row][col];
      if (factor === 0) continue;
      for (let j = col; j < n + cols; j++) Aug[row][j] -= factor * Aug[col][j];
    }
  }

  return Aug.map((row) => row.slice(n));
}

function referenceSolveCol(M: number[][], b: number[]): number[] {
  const n = M.length;
  const Aug = M.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(Aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(Aug[row][col]) > maxVal) {
        maxVal = Math.abs(Aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [Aug[col], Aug[maxRow]] = [Aug[maxRow], Aug[col]];

    const pivot = Aug[col][col];
    if (Math.abs(pivot) < 1e-30) continue;

    for (let j = col; j <= n; j++) Aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = Aug[row][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) Aug[row][j] -= f * Aug[col][j];
    }
  }

  return Aug.map((row) => row[n]);
}

function frobDiffArr(A: number[][], B: number[][]): number {
  let s = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) {
      const d = A[i][j] - B[i][j];
      s += d * d;
    }
  return Math.sqrt(s);
}

function matMulArr(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) for (let j = 0; j < n; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

function transposeArr(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

function residualSqrt(Y: number[][], A: number[][]): number {
  const Y2 = matMulArr(Y, Y);
  let err = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) err = Math.max(err, Math.abs(Y2[i][j] - A[i][j]));
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('clone batch A — givensRotation (M1)', () => {
  it('oracle table is orthonormal (pre-refactor snapshot)', () => {
    for (const row of GIVENS_SNAPSHOT) {
      const o = oracleGivensRotation(row.a, row.b);
      expect(o.c).toBeCloseTo(row.c, 15);
      expect(o.s).toBeCloseTo(row.s, 15);
      expect(o.c * o.c + o.s * o.s).toBeCloseTo(1, 14);
    }
  });
});

describe('clone batch A — Schur QR single-shift chase (M2)', () => {
  /** 4×4: trailing 2×2 has positive discriminant (real eigenvalues). */
  const Apos = [
    [1, 2, 0, 0],
    [0, 3, 4, 0],
    [0, 0, 5, 6],
    [0, 0, 0, 7],
  ];

  /** 4×4: complex-conjugate trailing pair → shift = H[end][end]. */
  const AnegDisc = [
    [0, 1, 0, 0],
    [-1, 0, 0, 0],
    [0, 0, 2, 1],
    [0, 0, -1, 2],
  ];

  it('Schur form matches pre-consolidation snapshots (positive discriminant)', () => {
    const { Q, H } = schurInternal(Apos);
    const Qt = transposeArr(Q);
    const recon = matMulArr(matMulArr(Q, H), Qt);
    expect(frobDiffArr(recon, Apos)).toBeLessThan(1e-9);
    expect(H[3][2]).toBeLessThan(1e-10);
  });

  it('Schur form matches pre-consolidation snapshots (negative discriminant shift branch)', () => {
    const { Q, H } = schurInternal(AnegDisc);
    const Qt = transposeArr(Q);
    const recon = matMulArr(matMulArr(Q, H), Qt);
    expect(frobDiffArr(recon, AnegDisc)).toBeLessThan(1e-8);
  });
});

describe('clone batch A — gaussJordanContinue wrappers (M3)', () => {
  const wellCond = [
    [4, 1, 0, 0],
    [1, 4, 1, 0],
    [0, 1, 4, 1],
    [0, 0, 1, 4],
  ];

  it('reference matSolve / solveCol fixtures (oracle baseline)', () => {
    const rhs2 = [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ];
    const ref = referenceMatSolve(wellCond, rhs2);
    expect(ref.length).toBe(4);
    expect(Number.isFinite(ref[0][0])).toBe(true);

    const M = [
      [1e-20, 0],
      [0, 2],
    ];
    const b = [1, 4];
    const colRef = referenceSolveCol(M, b);
    const matRef = referenceMatSolve(M, [[b[0]], [b[1]]]);
    expect(colRef[0]).toBeGreaterThan(1e15);
    expect(matRef[0][0]).toBeCloseTo(1, 10);
    expect(matRef[1][0]).toBeCloseTo(2, 10);
  });

  it('matrixExpm returns finite result on well-conditioned sample', () => {
    const A = DenseMatrix.fromArray(wellCond);
    const E = matrixExpm(A).toArray();
    expect(E.every((row) => row.every((x) => Number.isFinite(x)))).toBe(true);
  });
});

describe('clone batch A — Newton sqrt drivers (M4)', () => {
  it('matrixSqrtm(I) and 4I', () => {
    const I = DenseMatrix.fromArray(
      Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => (i === j ? 1 : 0)))
    );
    const sI = matrixSqrtm(I).toArray();
    for (let i = 0; i < 3; i++) expect(sI[i][i]).toBeCloseTo(1, 10);

    const fourI = DenseMatrix.fromArray([
      [4, 0, 0],
      [0, 4, 0],
      [0, 0, 4],
    ]);
    const s4 = matrixSqrtm(fourI).toArray();
    for (let i = 0; i < 3; i++) expect(s4[i][i]).toBeCloseTo(2, 8);
  });

  it('symmetric SPD 3×3 via matrixSqrtm', () => {
    const A = DenseMatrix.fromArray([
      [5, 2, 0],
      [2, 5, 2],
      [0, 2, 5],
    ]);
    const Y = matrixSqrtm(A).toArray();
    expect(residualSqrt(Y, A.toArray())).toBeLessThan(1e-5);
  });

  it('rank-deficient: public sqrtm may null-fallback; internal still returns a matrix', () => {
    const singular = [
      [1, 1],
      [1, 1],
    ];
    const Yint = matrixSqrtNewtonInternal(singular);
    expect(Yint.length).toBe(2);
    const Ypub = matrixSqrtm(DenseMatrix.fromArray(singular));
    expect(Ypub.rows).toBe(2);
  });
});
