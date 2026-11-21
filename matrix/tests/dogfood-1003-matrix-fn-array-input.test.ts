import { describe, it, expect } from 'vitest';
// Issue #1003: matrixExpm([[0,1],[0,0]]) threw `A.toArray is not a function`. matrixExpm,
// matrixLogm and matrixSqrtm now accept the same inputs as the decompositions (a nested array,
// a SparseMatrix, a DenseMatrix), and an object with `toArray` (the MathJS matrix; this package
// cannot import it, so the test builds one by hand).
import { DenseMatrix, SparseMatrix, matrixExpm, matrixLogm, matrixSqrtm } from '../src/index.js';

type Nested = number[][];

function expectClose(actual: Nested, expected: Nested, relTol = 1e-12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i].length).toBe(expected[i].length);
    for (let j = 0; j < expected[i].length; j++) {
      const scale = Math.max(1, Math.abs(expected[i][j]));
      expect(Math.abs(actual[i][j] - expected[i][j])).toBeLessThanOrEqual(relTol * scale);
    }
  }
}

// Upper triangular [[4,1],[0,9]]: eigenvalues 4 and 9 (distinct), so for a function f the
// off-diagonal entry is (f(9) - f(4)) / (9 - 4) times the entry 1.
const U: Nested = [
  [4, 1],
  [0, 9],
];
const EXPM_U: Nested = [
  [Math.exp(4), (Math.exp(9) - Math.exp(4)) / 5],
  [0, Math.exp(9)],
];
const LOGM_U: Nested = [
  [Math.log(4), (Math.log(9) - Math.log(4)) / 5],
  [0, Math.log(9)],
];
// sqrt(9) - sqrt(4) = 1 and 9 - 4 = 5, so the off-diagonal entry is 1/5
const SQRTM_U: Nested = [
  [2, 1 / 5],
  [0, 3],
];

describe('issue #1003: matrixExpm, matrixLogm and matrixSqrtm accept a nested array', () => {
  it('matrixExpm([[0,1],[0,0]]) is I + N for the nilpotent N', () => {
    const r = matrixExpm([
      [0, 1],
      [0, 0],
    ]);
    expect(r).toBeInstanceOf(DenseMatrix);
    expectClose(r.toArray(), [
      [1, 1],
      [0, 1],
    ]);
  });

  it('matrixExpm of a nested array', () => {
    expectClose(matrixExpm(U).toArray(), EXPM_U);
  });

  it('matrixLogm of a nested array', () => {
    expectClose(matrixLogm(U).toArray(), LOGM_U);
  });

  it('matrixSqrtm of a nested array', () => {
    expectClose(matrixSqrtm(U).toArray(), SQRTM_U);
  });

  it('a DenseMatrix gives the same values (no regression)', () => {
    expectClose(matrixExpm(new DenseMatrix(U)).toArray(), EXPM_U);
    expectClose(matrixLogm(new DenseMatrix(U)).toArray(), LOGM_U);
    expectClose(matrixSqrtm(new DenseMatrix(U)).toArray(), SQRTM_U);
  });

  it('a SparseMatrix gives the same values (matrixExpm of a SparseMatrix worked before)', () => {
    const S = SparseMatrix.fromDense(new DenseMatrix(U));
    expectClose(matrixExpm(S).toArray(), EXPM_U);
    expectClose(matrixLogm(S).toArray(), LOGM_U);
    expectClose(matrixSqrtm(S).toArray(), SQRTM_U);
  });

  it('an object with toArray (the MathJS matrix) is read through toArray', () => {
    const duck = { toArray: () => U };
    expectClose(matrixExpm(duck as never).toArray(), EXPM_U);
    expectClose(matrixLogm(duck as never).toArray(), LOGM_U);
    expectClose(matrixSqrtm(duck as never).toArray(), SQRTM_U);
  });

  it('an object whose toArray result is a 1-D array throws the named TypeError', () => {
    const duck = { toArray: () => [1, 2] };
    expect(() => matrixExpm(duck as never)).toThrow(TypeError);
    expect(() => matrixExpm(duck as never)).toThrow(/Matrix decomposition expected/);
    expect(() => matrixLogm(duck as never)).toThrow(/Matrix decomposition expected/);
    expect(() => matrixSqrtm(duck as never)).toThrow(/Matrix decomposition expected/);
  });

  it('an empty object keeps the shape that it reports, so a 0 x 3 matrix is not square', () => {
    // `toArray` of an empty 0 x 3 matrix is [], which reads as 0 x 0 (#1233)
    const duck = { toArray: () => [], rows: 0, cols: 3 };
    for (const fn of [matrixExpm, matrixLogm, matrixSqrtm]) {
      expect(() => fn(duck as never)).toThrow(/must be square \(got 0×3\)/);
    }
    expect(matrixExpm({ toArray: () => [] } as never).rows).toBe(0);
  });

  it('a string throws the named TypeError', () => {
    expect(() => matrixExpm('x' as never)).toThrow(TypeError);
    expect(() => matrixExpm('x' as never)).toThrow(/Matrix decomposition expected/);
  });

  it('a non-square nested array still throws the square error', () => {
    expect(() => matrixExpm([[1, 2, 3]])).toThrow(/square/);
  });
});
