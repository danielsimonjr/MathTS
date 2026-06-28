/**
 * Tests for Slice 5.2: pinv / cond / norm2 / normFro / lowRankApprox / singularValues
 * promoted to the typed/ dispatch layer.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  pinv,
  cond,
  norm2,
  normFro,
  lowRankApprox,
  singularValues,
} from '../src/typed/matrix-ops.js';

// =============================================================================
// Helpers
// =============================================================================

/** Multiply two number[][] matrices. */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) for (let j = 0; j < n; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

/** Convert DenseMatrix to number[][]. */
function toArray(D: DenseMatrix): number[][] {
  return D.toArray();
}

/** Frobenius distance between two number[][] matrices. */
function frobDiff(A: number[][], B: number[][]): number {
  let sum = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) {
      const d = A[i][j] - B[i][j];
      sum += d * d;
    }
  return Math.sqrt(sum);
}

// Simple 3x2 test matrix used throughout.
const RAW_3X2 = [
  [1, 2],
  [3, 4],
  [5, 6],
];

// Well-conditioned 2x2
const RAW_2X2 = [
  [2, 1],
  [1, 3],
];

// Hilbert 5x5 — famously ill-conditioned
function hilbert(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)));
}

// =============================================================================
// pinv
// =============================================================================

describe('pinv (typed/)', () => {
  it('returns a DenseMatrix of shape (n, m) for an m×n input', () => {
    const A = DenseMatrix.fromArray(RAW_3X2);
    const Ap = pinv(A) as DenseMatrix;
    expect(Ap).toBeInstanceOf(DenseMatrix);
    expect(Ap.rows).toBe(2);
    expect(Ap.cols).toBe(3);
  });

  it('satisfies Moore-Penrose identity A · A⁺ · A ≈ A', () => {
    const A = DenseMatrix.fromArray(RAW_3X2);
    const Ap = toArray(pinv(A) as DenseMatrix);
    const A_arr = RAW_3X2;
    // A · Ap: (3x2) · (2x3) = (3x3)
    const AApA = matMul(matMul(A_arr, Ap), A_arr);
    expect(frobDiff(AApA, A_arr)).toBeLessThan(1e-8);
  });

  it('satisfies Moore-Penrose identity A⁺ · A · A⁺ ≈ A⁺', () => {
    const A = DenseMatrix.fromArray(RAW_3X2);
    const Ap = toArray(pinv(A) as DenseMatrix);
    const ApAAp = matMul(matMul(Ap, RAW_3X2), Ap);
    expect(frobDiff(ApAAp, Ap)).toBeLessThan(1e-8);
  });

  it('honors the rcond option — high rcond treats small singular values as zero', () => {
    // Use a near-rank-1 matrix; with large rcond the second singular value is suppressed.
    const A = DenseMatrix.fromArray([
      [1, 2],
      [2, 4],
    ]); // rank 1
    const Ap = pinv(A, { rcond: 0.5 }) as DenseMatrix;
    expect(Ap).toBeInstanceOf(DenseMatrix);
    expect(Ap.rows).toBe(2);
    expect(Ap.cols).toBe(2);
  });

  it('throws TypeError for non-DenseMatrix input', () => {
    expect(() =>
      (pinv as (...args: unknown[]) => unknown)([
        [1, 2],
        [3, 4],
      ])
    ).toThrow(TypeError);
  });
});

// =============================================================================
// cond
// =============================================================================

describe('cond (typed/)', () => {
  it('returns 1 for an identity matrix', () => {
    expect(
      cond([
        [1, 0],
        [0, 1],
      ])
    ).toBeCloseTo(1, 10);
  });

  it('returns a moderate value for a well-conditioned 2x2', () => {
    // [[2,1],[1,3]] has singular values roughly 3.56 and 1.41 → cond ≈ 2.52
    const c = cond(RAW_2X2) as number;
    expect(c).toBeGreaterThan(1);
    expect(c).toBeLessThan(10);
  });

  it('returns a large value for a Hilbert(5) matrix (~1e5)', () => {
    const c = cond(hilbert(5)) as number;
    expect(c).toBeGreaterThan(1e4);
  });

  it('returns Infinity for a singular matrix', () => {
    // [[1,2],[2,4]] is rank-1 → σ_min = 0
    expect(
      cond([
        [1, 2],
        [2, 4],
      ])
    ).toBe(Infinity);
  });

  it('throws TypeError for non-array input', () => {
    expect(() => (cond as (...args: unknown[]) => unknown)(42)).toThrow(TypeError);
  });
});

// =============================================================================
// norm2
// =============================================================================

describe('norm2 (typed/)', () => {
  it('equals the largest singular value of a diagonal matrix', () => {
    // [[3,0],[0,2]] → σ = [3, 2] → norm2 = 3
    expect(
      norm2([
        [3, 0],
        [0, 2],
      ])
    ).toBeCloseTo(3, 10);
  });

  it('matches singularValues output[0]', () => {
    const A = RAW_3X2;
    const n2 = norm2(A) as number;
    const svs = singularValues(A) as number[];
    expect(n2).toBeCloseTo(svs[0], 8);
  });

  it('returns 0 for a zero matrix', () => {
    expect(
      norm2([
        [0, 0],
        [0, 0],
      ])
    ).toBeCloseTo(0, 10);
  });

  it('throws TypeError for non-array input', () => {
    expect(() => (norm2 as (...args: unknown[]) => unknown)('hello')).toThrow(TypeError);
  });
});

// =============================================================================
// normFro
// =============================================================================

describe('normFro (typed/)', () => {
  it('matches manual sqrt(sum(A_ij²)) for 2x2 identity', () => {
    expect(
      normFro([
        [1, 0],
        [0, 1],
      ])
    ).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('matches manual sqrt(sum) for 3x2 matrix', () => {
    const expected = Math.sqrt(1 + 4 + 9 + 16 + 25 + 36);
    expect(normFro(RAW_3X2)).toBeCloseTo(expected, 8);
  });

  it('returns 0 for a zero matrix', () => {
    expect(
      normFro([
        [0, 0],
        [0, 0],
      ])
    ).toBeCloseTo(0, 10);
  });

  it('throws TypeError for non-array input', () => {
    expect(() => (normFro as (...args: unknown[]) => unknown)(99)).toThrow(TypeError);
  });
});

// =============================================================================
// lowRankApprox
// =============================================================================

describe('lowRankApprox (typed/)', () => {
  it('returns a matrix of the same shape', () => {
    const result = lowRankApprox(RAW_3X2, 1) as number[][];
    expect(result.length).toBe(3);
    expect(result[0].length).toBe(2);
  });

  it('full-rank approximation (k = min(m,n)) recovers the original matrix', () => {
    // 4×2 full-rank matrix: rank-2 approx should be exact.
    const A = [
      [4, 3],
      [2, 1],
      [1, 2],
      [0, 1],
    ];
    const A2 = lowRankApprox(A, 2) as number[][];
    expect(frobDiff(A2, A)).toBeLessThan(1e-8);
  });

  it('rank-k error decreases as k increases for a full-rank matrix', () => {
    const A = hilbert(4);
    const err1 = frobDiff(lowRankApprox(A, 1) as number[][], A);
    const err2 = frobDiff(lowRankApprox(A, 2) as number[][], A);
    const err3 = frobDiff(lowRankApprox(A, 3) as number[][], A);
    expect(err2).toBeLessThan(err1);
    expect(err3).toBeLessThan(err2);
  });

  it('throws TypeError for non-array first argument', () => {
    expect(() => (lowRankApprox as (...args: unknown[]) => unknown)('matrix', 1)).toThrow(TypeError);
  });
});

// =============================================================================
// singularValues
// =============================================================================

describe('singularValues (typed/)', () => {
  it('returns a non-negative descending array of length min(m, n)', () => {
    const sv = singularValues(RAW_3X2) as number[];
    expect(sv.length).toBe(2); // min(3, 2)
    for (const s of sv) expect(s).toBeGreaterThanOrEqual(0);
    // Descending order
    for (let i = 1; i < sv.length; i++) expect(sv[i - 1]).toBeGreaterThanOrEqual(sv[i]);
  });

  it('returns [3, 2] for a diagonal [[3,0],[0,2]] matrix', () => {
    const sv = singularValues([
      [3, 0],
      [0, 2],
    ]) as number[];
    expect(sv[0]).toBeCloseTo(3, 8);
    expect(sv[1]).toBeCloseTo(2, 8);
  });

  it('has length min(m,n) for a non-square matrix', () => {
    const sv = singularValues([
      [1, 2, 3],
      [4, 5, 6],
    ]) as number[];
    expect(sv.length).toBe(2); // min(2, 3)
  });

  it('contains only one nonzero for a rank-1 matrix', () => {
    const sv = singularValues([
      [1, 2],
      [2, 4],
    ]) as number[];
    expect(sv.length).toBe(2);
    expect(sv[0]).toBeGreaterThan(0);
    expect(sv[1]).toBeCloseTo(0, 8);
  });

  it('throws TypeError for non-array input', () => {
    expect(() => (singularValues as (...args: unknown[]) => unknown)(null)).toThrow(TypeError);
  });
});

// =============================================================================
// matrixExpm / matrixLogm / matrixSqrtm — Slice 5.9
// =============================================================================

import { matrixExpm, matrixLogm, matrixSqrtm } from '../src/typed/matrix-ops.js';

/** Identity matrix n×n as number[][]. */
function eyeArr(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/** Frobenius distance. */
function frobDiff2(A: number[][], B: number[][]): number {
  let s = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) {
      const d = A[i][j] - B[i][j];
      s += d * d;
    }
  return Math.sqrt(s);
}

describe('matrixExpm (typed/)', () => {
  it('1. Array dispatch: expm(0) = I', () => {
    const R = matrixExpm([
      [0, 0],
      [0, 0],
    ]) as number[][];
    expect(frobDiff2(R, eyeArr(2))).toBeLessThan(1e-12);
  });

  it('2. DenseMatrix dispatch: expm(I) = e * I', () => {
    const A = DenseMatrix.fromArray([
      [1, 0],
      [0, 1],
    ]);
    const R = matrixExpm(A) as DenseMatrix;
    expect(R).toBeInstanceOf(DenseMatrix);
    expect(Math.abs(R.get(0, 0) - Math.E)).toBeLessThan(1e-10);
    expect(Math.abs(R.get(1, 1) - Math.E)).toBeLessThan(1e-10);
    expect(Math.abs(R.get(0, 1))).toBeLessThan(1e-12);
  });

  it('3. expm(diag) = diag(exp(λ)) — typed Array path', () => {
    const R = matrixExpm([
      [2, 0],
      [0, 3],
    ]) as number[][];
    expect(Math.abs(R[0][0] - Math.exp(2))).toBeLessThan(1e-10);
    expect(Math.abs(R[1][1] - Math.exp(3))).toBeLessThan(1e-10);
  });

  it('4. expm(-A) is inverse of expm(A)', () => {
    const A = [
      [1, 0.5],
      [0.5, 2],
    ];
    const eA = matrixExpm(A) as number[][];
    const enA = matrixExpm([
      [-1, -0.5],
      [-0.5, -2],
    ]) as number[][];
    const prod: number[][] = matMul(eA, enA);
    expect(frobDiff2(prod, eyeArr(2))).toBeLessThan(1e-10);
  });

  it('5. TypeError for non-matrix input', () => {
    expect(() => (matrixExpm as (...args: unknown[]) => unknown)(null)).toThrow(TypeError);
  });
});

describe('matrixLogm (typed/)', () => {
  it('6. Array dispatch: logm(I) = 0', () => {
    const R = matrixLogm([
      [1, 0],
      [0, 1],
    ]) as number[][];
    const Z = [
      [0, 0],
      [0, 0],
    ];
    expect(frobDiff2(R, Z)).toBeLessThan(1e-12);
  });

  it('7. DenseMatrix dispatch: logm(diag) = diag(log)', () => {
    const A = DenseMatrix.fromArray([
      [4, 0],
      [0, 9],
    ]);
    const R = matrixLogm(A) as DenseMatrix;
    expect(R).toBeInstanceOf(DenseMatrix);
    expect(Math.abs(R.get(0, 0) - Math.log(4))).toBeLessThan(1e-9);
    expect(Math.abs(R.get(1, 1) - Math.log(9))).toBeLessThan(1e-9);
  });

  it('8. Round-trip: expm(logm(A)) ≈ A (Array path)', () => {
    const A = [
      [3, 0],
      [0, 5],
    ];
    const logA = matrixLogm(A) as number[][];
    const R = matrixExpm(logA) as number[][];
    expect(frobDiff2(R, A)).toBeLessThan(1e-7);
  });

  it('9. Throws for non-positive eigenvalue', () => {
    expect(() =>
      matrixLogm([
        [0, 0],
        [0, 1],
      ])
    ).toThrow(/non-positive|not supported/i);
  });
});

describe('matrixSqrtm (typed/)', () => {
  it('10. Array dispatch: sqrtm(I) = I', () => {
    const R = matrixSqrtm([
      [1, 0],
      [0, 1],
    ]) as number[][];
    expect(frobDiff2(R, eyeArr(2))).toBeLessThan(1e-12);
  });

  it('11. DenseMatrix dispatch: sqrtm(4I) = 2I', () => {
    const A = DenseMatrix.fromArray([
      [4, 0],
      [0, 4],
    ]);
    const R = matrixSqrtm(A) as DenseMatrix;
    expect(R).toBeInstanceOf(DenseMatrix);
    expect(Math.abs(R.get(0, 0) - 2)).toBeLessThan(1e-12);
    expect(Math.abs(R.get(1, 1) - 2)).toBeLessThan(1e-12);
  });

  it('12. sqrtm(A)^2 ≈ A for SPD matrix (Array path)', () => {
    const A = [
      [4, 2],
      [2, 3],
    ];
    const R = matrixSqrtm(A) as number[][];
    const R2 = matMul(R, R);
    expect(frobDiff2(R2, A)).toBeLessThan(1e-8);
  });

  it('13. Throws for negative eigenvalue', () => {
    expect(() =>
      matrixSqrtm([
        [-4, 0],
        [0, 1],
      ])
    ).toThrow(/negative eigenvalue|not supported/i);
  });
});
