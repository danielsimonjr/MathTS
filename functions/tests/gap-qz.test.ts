import { describe, it, expect } from 'vitest';
import { qz, generalizedEig } from '@danielsimonjr/mathts-functions';

/**
 * Generalized (QZ) Schur decomposition of a pencil (A, B), B nonsingular. Verifies
 * the same contract as scipy.linalg.qz (the factors are not unique, so we check the
 * decomposition itself rather than exact factor values): A = Q·AA·Zᵀ, B = Q·BB·Zᵀ
 * with Q, Z orthogonal, AA quasi-upper-triangular, BB upper-triangular.
 */
const T = (M: number[][]) => M[0].map((_, j) => M.map((r) => r[j]));
const mm = (X: number[][], Y: number[][]) =>
  X.map((row) => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)));
const maxAbsDiff = (X: number[][], Y: number[][]) =>
  Math.max(...X.flatMap((r, i) => r.map((v, j) => Math.abs(v - Y[i][j]))));
const eye = (n: number) =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

const CASES: Array<[string, number[][], number[][]]> = [
  [
    'symmetric A, lower-triangular B',
    [
      [2, 1, 1],
      [1, 3, 1],
      [1, 1, 4],
    ],
    [
      [2, 0, 0],
      [0, 3, 0],
      [0, 1, 2],
    ],
  ],
  [
    'general 4×4',
    [
      [4, 1, 2, 0],
      [1, 3, 0, 1],
      [2, 0, 5, 1],
      [0, 1, 1, 6],
    ],
    [
      [2, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 3, 0],
      [0, 0, 0, 1],
    ],
  ],
];

describe('qz — generalized Schur decomposition', () => {
  for (const [name, A, B] of CASES) {
    it(`${name}: A=Q·AA·Zᵀ, B=Q·BB·Zᵀ, orthogonal factors, (quasi-)triangular`, () => {
      const { AA, BB, Q, Z } = qz(A, B);
      const n = A.length;
      // reconstruction
      expect(maxAbsDiff(mm(mm(Q, AA), T(Z)), A)).toBeLessThan(1e-10);
      expect(maxAbsDiff(mm(mm(Q, BB), T(Z)), B)).toBeLessThan(1e-10);
      // orthogonality
      expect(maxAbsDiff(mm(T(Q), Q), eye(n))).toBeLessThan(1e-10);
      expect(maxAbsDiff(mm(T(Z), Z), eye(n))).toBeLessThan(1e-10);
      // AA quasi-upper-triangular (zero below the first subdiagonal), BB upper-triangular
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < i - 1; j++) expect(Math.abs(AA[i][j])).toBeLessThan(1e-9);
        for (let j = 0; j < i; j++) expect(Math.abs(BB[i][j])).toBeLessThan(1e-9);
      }
    });
  }

  it('B = I: AA is (quasi-)triangular and Q·AA·Zᵀ reconstructs A', () => {
    const A = [
      [6, -11, 6],
      [1, 0, 0],
      [0, 1, 0],
    ];
    const I = eye(3);
    const { AA, BB, Q, Z } = qz(A, I);
    expect(maxAbsDiff(mm(mm(Q, AA), T(Z)), A)).toBeLessThan(1e-9); // valid decomposition
    expect(maxAbsDiff(BB, I)).toBeLessThan(1e-9); // BB = I when B = I
    // generalized eigenvalues come from generalizedEig (correct for any spectrum)
    const ev = generalizedEig(A, I)
      .values.map((v) => (typeof v === 'object' ? v.re : v))
      .sort((a, b) => a - b);
    [1, 2, 3].forEach((r, i) => expect(ev[i]).toBeCloseTo(r, 6));
  });
});
