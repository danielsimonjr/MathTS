/**
 * Dogfood #1158, #1163, #1170 - `sqrtm` of a matrix that Denman-Beavers does not solve.
 *
 * `sqrtm` stopped at an absolute step size of 1e-6 and returned the last iterate without a
 * check, and it inverted each iterate. So a root with entries above about 2^33 never converged
 * (#1158), a matrix with entries near 2^-19 stopped early with a residual of 4.5e-8 (#1158), a
 * singular matrix with no real root returned a value that is not a root (#1163), and a singular
 * matrix with a real root threw "Cannot calculate inverse" (#1170). The result is now kept only
 * when X*X reproduces A. The oracle is SciPy 1.16.3 `sqrtm` (values below) and the exact
 * identity sqrtm(2^e A) = 2^(e/2) sqrtm(A).
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixSqrtm } from '@danielsimonjr/mathts-matrix';
import { matrix, sqrtm } from '../src/index.js';

type Rows = number[][];

const root = (A: Rows): Rows => sqrtm(A) as Rows;
const mul = (a: Rows, b: Rows): Rows =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const maxAbs = (a: Rows): number => Math.max(...a.flat().map(Math.abs));
const scale = (a: Rows, f: number): Rows => a.map((r) => r.map((x) => x * f));

/** `max|X·X - A| / max|A|`. */
function relativeResidual(X: Rows, A: Rows): number {
  const XX = mul(X, X);
  return Math.max(...XX.flat().map((v, i) => Math.abs(v - A.flat()[i]))) / maxAbs(A);
}

/** The residual normalised by the size of the root: `max|X·X - A| / (n · max|X|²)`. */
function normalisedResidual(X: Rows, A: Rows): number {
  const n = A.length;
  const m = maxAbs(X);
  const XX = mul(scale(X, 1 / m), scale(X, 1 / m));
  return Math.max(...XX.flat().map((v, i) => Math.abs(v - A.flat()[i] / (m * m)))) / n;
}

describe('#1158 sqrtm of a matrix with large or small entries', () => {
  it('30 random SPD matrices times 2^k, k in 70..300: no throw, residual below 1e-9', () => {
    // A run that does not converge costs 1000 iterations, so the sample is 6 matrices for each
    // k. Main throws for 5 of these 30 (the LCG, the order and the shape of the matrices are fixed).
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647 - 0.5;
    };
    for (const k of [70, 80, 100, 200, 300]) {
      for (let q = 0; q < 6; q++) {
        const n = 2 + (q % 4);
        const G = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
        const GGt = mul(
          G,
          G[0].map((_, j) => G.map((r) => r[j]))
        );
        const A = scale(
          GGt.map((r, i) => r.map((v, j) => v + (i === j ? 1e-3 : 0))),
          2 ** k
        );
        const X = root(A);
        expect(normalisedResidual(X, A)).toBeLessThan(1e-9);
      }
    }
  });

  it('already fixed on main: sqrtm([[1e200,0],[0,1e-200]]) is [[1e100,0],[0,1e-100]]', () => {
    expect(
      root([
        [1e200, 0],
        [0, 1e-200],
      ])
    ).toEqual([
      [1e100, 0],
      [0, 1e-100],
    ]);
  });

  it('[[4,1],[1,3]] * 2^-19 reproduces its matrix (main stopped with a residual of 4.5e-8)', () => {
    const A = scale(
      [
        [4, 1],
        [1, 3],
      ],
      2 ** -19
    );
    const X = root(A);
    expect(relativeResidual(X, A)).toBeLessThan(1e-13);
    // sqrtm(2^-20 * [[8,2],[2,6]]) = 2^-10 * sqrtm([[8,2],[2,6]])
    const want = scale(
      root([
        [2, 0.5],
        [0.5, 1.5],
      ]),
      2 ** -9
    );
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++)
        expect(Math.abs(X[i][j] - want[i][j])).toBeLessThanOrEqual(1e-12 * Math.abs(want[i][j]));
    expect(X[0][0]).toBeCloseTo(0.0027366933239015047, 15);
    expect(X[1][1]).toBeCloseTo(0.002362655649110671, 15);
  });

  it('the matrix of the issue comment, times 2^-19, reproduces its matrix', () => {
    const A = scale(
      [
        [1, 1, 1],
        [1, 1.01, 1],
        [1, 1, 1.01],
      ],
      2 ** -19
    );
    expect(relativeResidual(root(A), A)).toBeLessThan(1e-13);
  });

  it('an ordinary matrix keeps its value bit for bit', () => {
    expect(
      root([
        [33, 24],
        [48, 57],
      ])
    ).toEqual([
      [5.000000000000001, 2.000000000000001],
      [4.000000000000002, 7.000000000000002],
    ]);
    expect(
      root([
        [4, 1],
        [1, 3],
      ])
    ).toEqual([
      [1.981577633135346, 0.27083220609419806],
      [0.27083220609419806, 1.7107454270411477],
    ]);
  });
});

describe('#1163 sqrtm of a singular matrix with a real root', () => {
  const B = [
    [-3.2079045430930446e-9, -0.005315507696638693, 0.0022437670322530863, 3.229520592843284e-7],
    [-4.556124581097712e-9, -0.001299860056951658, 1.5047060367372993, -3.0435859361001234e-9],
    [0.0011356415530062785, 0.00005051084407935678, 0.2095294400660007, -1.0491866048886327],
    [-3.2079045430930446e-9, -0.005315507696638693, 0.0022437670322530863, 3.229520592843284e-7],
  ];
  // SciPy 1.16.3 real part of sqrtm(B), first row (the imaginary part is 1.2e-8).
  const scipyRow0 = [
    -0.0002893078223355494, -0.009416119561868884, 0.02452471433678917, 0.2672783386800254,
  ];

  it('sqrtm(B) returns the SciPy root and squares back to B (main returned a residual of 0.458)', () => {
    const X = root(B);
    expect(relativeResidual(X, B)).toBeLessThan(1e-12);
    for (let j = 0; j < 4; j++)
      expect(Math.abs(X[0][j] - scipyRow0[j])).toBeLessThanOrEqual(1e-8 * Math.abs(scipyRow0[j]));
  });

  it('matrixSqrtm(B) returns the same root (it threw "complex eigenvalues")', () => {
    const X = matrixSqrtm(DenseMatrix.fromArray(B)).toArray() as Rows;
    expect(relativeResidual(X, B)).toBeLessThan(1e-12);
    for (let j = 0; j < 4; j++)
      expect(Math.abs(X[0][j] - scipyRow0[j])).toBeLessThanOrEqual(1e-8 * Math.abs(scipyRow0[j]));
  });

  it('a nilpotent matrix has no root: both sqrtm and matrixSqrtm throw', () => {
    expect(() =>
      root([
        [0, 1],
        [0, 0],
      ])
    ).toThrow(/could not converge/);
    expect(() =>
      matrixSqrtm(
        DenseMatrix.fromArray([
          [0, 1],
          [0, 0],
        ])
      )
    ).toThrow();
    expect(() =>
      matrixSqrtm(
        DenseMatrix.fromArray([
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 0],
        ])
      )
    ).toThrow();
  });
});

describe('#1170 sqrtm of a singular matrix', () => {
  it('the zero matrix has the root zero', () => {
    expect(
      root([
        [0, 0],
        [0, 0],
      ])
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('[[1,2],[2,4]] gives the SciPy root', () => {
    const X = root([
      [1, 2],
      [2, 4],
    ]);
    const want = [
      [0.4472135954999581, 0.8944271909999162],
      [0.8944271909999162, 1.7888543819998324],
    ];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) expect(Math.abs(X[i][j] - want[i][j])).toBeLessThan(1e-12);
  });

  it('[[2,1],[2,1]] gives the SciPy root', () => {
    const X = root([
      [2, 1],
      [2, 1],
    ]);
    const want = [
      [1.1547005383792512, 0.5773502691896255],
      [1.1547005383792512, 0.5773502691896255],
    ];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) expect(Math.abs(X[i][j] - want[i][j])).toBeLessThan(1e-12);
  });

  it('a Matrix input gives a Matrix with the same values', () => {
    const X = sqrtm(
      matrix([
        [1, 2],
        [2, 4],
      ])
    ) as { valueOf(): Rows; size(): number[] };
    expect(typeof X.size).toBe('function');
    const v = X.valueOf();
    expect(Math.abs(v[0][0] - 0.4472135954999581)).toBeLessThan(1e-12);
    expect(Math.abs(v[1][1] - 1.7888543819998324)).toBeLessThan(1e-12);
  });
});
