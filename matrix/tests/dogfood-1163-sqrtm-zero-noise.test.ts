/**
 * Dogfood #1163 — `matrixSqrtm` of a singular matrix with a real root.
 *
 * The Schur form of a singular matrix holds rounding noise in place of the zero eigenvalue, and
 * the noise can be a tiny negative number (-6.5e-17 for the matrix below). The Björck recurrence
 * read it as a negative eigenvalue, returned no root, and `matrixSqrtm` threw "complex
 * eigenvalues" for a matrix that has a real root. A negative 1x1 entry within 64·eps of
 * max|T| is now read as a zero eigenvalue, and the root built on it is kept only when it
 * squares back to T. The oracle is SciPy 1.16.3 `sqrtm` (real part, imaginary part 1.2e-8).
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixSqrtm } from '../src/index.js';

type Rows = number[][];

const B: Rows = [
  [-3.2079045430930446e-9, -0.005315507696638693, 0.0022437670322530863, 3.229520592843284e-7],
  [-4.556124581097712e-9, -0.001299860056951658, 1.5047060367372993, -3.0435859361001234e-9],
  [0.0011356415530062785, 0.00005051084407935678, 0.2095294400660007, -1.0491866048886327],
  [-3.2079045430930446e-9, -0.005315507696638693, 0.0022437670322530863, 3.229520592843284e-7],
];

const mul = (a: Rows, b: Rows): Rows =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const maxAbs = (a: Rows): number => Math.max(...a.flat().map(Math.abs));

function relativeResidual(X: Rows, A: Rows): number {
  const XX = mul(X, X);
  return Math.max(...XX.flat().map((v, i) => Math.abs(v - A.flat()[i]))) / maxAbs(A);
}

describe('#1163 matrixSqrtm reads Schur rounding noise of a zero eigenvalue as zero', () => {
  it('the singular matrix of the issue gives the SciPy root (main threw "complex eigenvalues")', () => {
    const X = matrixSqrtm(DenseMatrix.fromArray(B)).toArray() as Rows;
    expect(relativeResidual(X, B)).toBeLessThan(1e-12);
    const scipyRow0 = [
      -0.0002893078223355494, -0.009416119561868884, 0.02452471433678917, 0.2672783386800254,
    ];
    for (let j = 0; j < 4; j++)
      expect(Math.abs(X[0][j] - scipyRow0[j])).toBeLessThanOrEqual(1e-8 * Math.abs(scipyRow0[j]));
  });

  it('a nilpotent matrix has no root: the noise is not read as zero when the root fails', () => {
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

  it('a negative eigenvalue that is not noise still has no real root', () => {
    expect(() =>
      matrixSqrtm(
        DenseMatrix.fromArray([
          [-1, 2],
          [0, 3],
        ])
      )
    ).toThrow();
  });

  it('[[1,1],[0,0]] keeps its root', () => {
    const X = matrixSqrtm(
      DenseMatrix.fromArray([
        [1, 1],
        [0, 0],
      ])
    ).toArray() as Rows;
    expect(
      relativeResidual(X, [
        [1, 1],
        [0, 0],
      ])
    ).toBeLessThan(1e-14);
  });
});
