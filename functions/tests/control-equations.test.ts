import { describe, it, expect } from 'vitest';
import { care, dlyap, dare } from '../src/index.js';

describe('control-theory matrix equations', () => {
  it('care double-integrator -> [[sqrt3,1],[1,sqrt3]]', () => {
    const X = care(
      [
        [0, 1],
        [0, 0],
      ],
      [[0], [1]],
      [
        [1, 0],
        [0, 1],
      ],
      [[1]]
    );
    expect(X[0][0]).toBeCloseTo(Math.sqrt(3), 5);
    expect(X[0][1]).toBeCloseTo(1, 5);
    expect(X[1][0]).toBeCloseTo(1, 5);
    expect(X[1][1]).toBeCloseTo(Math.sqrt(3), 5);
  });

  it('dlyap diag(0.5) with Q=I -> (4/3) I', () => {
    const X = dlyap(
      [
        [0.5, 0],
        [0, 0.5],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    );
    expect(X[0][0]).toBeCloseTo(4 / 3, 6);
    expect(X[1][1]).toBeCloseTo(4 / 3, 6);
    expect(X[0][1]).toBeCloseTo(0, 6);
  });

  it('dare (scipy-pinned) -> [[2.94712297,2.36920541],[2.36920541,4.61313426]]', () => {
    const X = dare(
      [
        [1, 1],
        [0, 1],
      ],
      [[0], [1]],
      [
        [1, 0],
        [0, 1],
      ],
      [[1]]
    );
    // Pinned against scipy.linalg.solve_discrete_are(A, B, Q, R) for this
    // exact (A, B, Q, R) — see functions/src/numeric/control-equations.ts docstring.
    expect(X[0][0]).toBeCloseTo(2.94712297, 6);
    expect(X[0][1]).toBeCloseTo(2.36920541, 6);
    expect(X[1][0]).toBeCloseTo(2.36920541, 6);
    expect(X[1][1]).toBeCloseTo(4.61313426, 6);

    // Self-verifying residual check on the actual DARE equation, independent
    // of the pinned values above:
    //   A^T X A - X - A^T X B (R + B^T X B)^-1 B^T X A + Q ~= 0
    const A = [
      [1, 1],
      [0, 1],
    ];
    const B = [[0], [1]];
    const Q = [
      [1, 0],
      [0, 1],
    ];
    const R = [[1]];
    const At = [
      [A[0][0], A[1][0]],
      [A[0][1], A[1][1]],
    ];
    const matmul = (M: number[][], N: number[][]): number[][] => {
      const rows = M.length;
      const inner = N.length;
      const cols = N[0].length;
      const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < inner; k++) {
          for (let j = 0; j < cols; j++) out[i][j] += M[i][k] * N[k][j];
        }
      }
      return out;
    };
    const AtXA = matmul(matmul(At, X), A);
    const BtXA = matmul([[B[0][0], B[1][0]]], matmul(X, A));
    const BtXB = matmul([[B[0][0], B[1][0]]], matmul(X, B));
    const RplusBtXB = R[0][0] + BtXB[0][0];
    const AtXB = matmul(matmul(At, X), B); // 2x1
    const middle = matmul(AtXB, [[1 / RplusBtXB]]); // 2x1
    const correction = matmul(middle, BtXA); // 2x2
    const residual: number[][] = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        residual[i][j] = AtXA[i][j] - X[i][j] - correction[i][j] + Q[i][j];
      }
    }
    for (const row of residual) {
      for (const v of row) {
        expect(Math.abs(v)).toBeLessThan(1e-6);
      }
    }

    expect(X[0][1]).toBeCloseTo(X[1][0], 6);
    expect(X.every((row) => row.every(Number.isFinite))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Complex-spectrum Riccati coverage — locks in the RETAINED solvers (care =
// matrix sign function, dare = structure-preserving doubling) on cases whose
// Hamiltonian / open-loop spectrum is COMPLEX. This is the case the routing
// TODO flagged (the eigenvector-basis path was prototyped + measured on
// 2026-07-18 and found strictly LESS accurate than the sign function — see the
// control-equations.ts docstring — so the sign-function / SDA path is kept).
// Each case is pinned to scipy.linalg.solve_{continuous,discrete}_are AND to
// the implementation-independent Riccati residual (which needs no oracle).
// ---------------------------------------------------------------------------
describe('control equations — complex-spectrum stabilizing solutions', () => {
  const T = (A: number[][]): number[][] => A[0].map((_, j) => A.map((r) => r[j]));
  const mm = (A: number[][], B: number[][]): number[][] => {
    const n = A.length;
    const k = B.length;
    const m = B[0].length;
    const C = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < n; i++)
      for (let p = 0; p < k; p++) for (let j = 0; j < m; j++) C[i][j] += A[i][p] * B[p][j];
    return C;
  };
  const inv = (A: number[][]): number[][] => {
    const n = A.length;
    const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const pv = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= pv;
      for (let r = 0; r < n; r++)
        if (r !== c) {
          const f = M[r][c];
          for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
        }
    }
    return M.map((r) => r.slice(n));
  };
  const maxAbs = (A: number[][]): number => A.reduce((m, r) => Math.max(m, ...r.map(Math.abs)), 0);
  const sub = (A: number[][], B: number[][]): number[][] =>
    A.map((r, i) => r.map((v, j) => v - B[i][j]));

  // Continuous Riccity residual: AᵀX + XA − X B R⁻¹ Bᵀ X + Q.
  const careResidual = (
    A: number[][],
    B: number[][],
    Q: number[][],
    R: number[][],
    X: number[][]
  ): number => {
    const G = mm(mm(B, inv(R)), T(B));
    const term = A.map((r, i) =>
      r.map((_, j) => mm(T(A), X)[i][j] + mm(X, A)[i][j] - mm(mm(X, G), X)[i][j] + Q[i][j])
    );
    return maxAbs(term);
  };
  // Discrete Riccati residual: AᵀXA − X − AᵀXB(R+BᵀXB)⁻¹BᵀXA + Q.
  const dareResidual = (
    A: number[][],
    B: number[][],
    Q: number[][],
    R: number[][],
    X: number[][]
  ): number => {
    const At = T(A);
    const Bt = T(B);
    const AtXA = mm(mm(At, X), A);
    const RB = R.map((r, i) => r.map((v, j) => v + mm(mm(Bt, X), B)[i][j]));
    const corr = mm(mm(mm(mm(At, X), B), inv(RB)), mm(mm(Bt, X), A));
    const term = A.map((r, i) => r.map((_, j) => AtXA[i][j] - X[i][j] - corr[i][j] + Q[i][j]));
    return maxAbs(term);
  };
  const symErr = (X: number[][]): number => maxAbs(sub(X, T(X)));

  it('care oscillator (Hamiltonian eigenvalues −0.678±0.977i) = scipy solve_continuous_are', () => {
    const A = [
      [0, 1],
      [-1, -0.1],
    ];
    const B = [[0], [1]];
    const Q = [
      [1, 0],
      [0, 1],
    ];
    const R = [[1]];
    const X = care(A, B, Q, R);
    // scipy.linalg.solve_continuous_are (2026-07-18):
    const O = [
      [1.81751251612405, 0.41421356237309603],
      [0.41421356237309603, 1.2558861031613937],
    ];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) expect(X[i][j]).toBeCloseTo(O[i][j], 8);
    expect(careResidual(A, B, Q, R, X)).toBeLessThan(1e-10);
    expect(symErr(X)).toBeLessThan(1e-12);
  });

  it('care 3×3 companion (complex Hamiltonian pair −0.48±0.58i) = scipy solve_continuous_are', () => {
    const A = [
      [0, 1, 0],
      [0, 0, 1],
      [-1, -2, -3],
    ];
    const B = [[0], [0], [1]];
    const Q = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const R = [[1]];
    const X = care(A, B, Q, R);
    const O = [
      [2.1870824521318526, 1.882914865237619, 0.41421356237309553],
      [1.882914865237619, 3.808370011372001, 0.9607143952896295],
      [0.41421356237309553, 0.9607143952896295, 0.45274221316611757],
    ];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(X[i][j]).toBeCloseTo(O[i][j], 7);
    expect(careResidual(A, B, Q, R, X)).toBeLessThan(1e-9);
    expect(symErr(X)).toBeLessThan(1e-11);
  });

  it('dare rotation (complex open-loop eigenvalues 0.9±0.3i) = scipy solve_discrete_are', () => {
    const A = [
      [0.9, 0.3],
      [-0.3, 0.9],
    ];
    const B = [[0], [1]];
    const Q = [
      [1, 0],
      [0, 1],
    ];
    const R = [[1]];
    const X = dare(A, B, Q, R);
    // scipy.linalg.solve_discrete_are (2026-07-18):
    const O = [
      [3.519879856873307, 0.9149078229079387],
      [0.9149078229079387, 1.996195281143966],
    ];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) expect(X[i][j]).toBeCloseTo(O[i][j], 7);
    expect(dareResidual(A, B, Q, R, X)).toBeLessThan(1e-10);
    expect(symErr(X)).toBeLessThan(1e-12);
  });
});
