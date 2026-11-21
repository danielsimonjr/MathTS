import { describe, it, expect } from 'vitest';
// Issues #977 and #1003: linsolve with a matrix argument. A native DenseMatrix b gave NaN, a
// MathJS matrix b gave `dimension mismatch`, and a DenseMatrix or MathJS matrix A gave
// `reading 'length'`. Now A is a nested array, a DenseMatrix, a SparseMatrix or a MathJS matrix,
// and b is a vector, an n x 1 column or an n x 1 / 1 x n matrix. Imported from `src`.
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { evaluate, linsolve, matrix as fmatrix, sparse as fsparse } from '../src/index.js';

// x = [1, 2]: 1*1 + 2*2 = 5 and 3*1 + 4*2 = 11
const A = [
  [1, 2],
  [3, 4],
];
const EXPECTED = [1, 2];

function expectSolution(actual: unknown): void {
  const x = actual as number[];
  expect(x.length).toBe(2);
  for (let i = 0; i < 2; i++) expect(Math.abs(x[i] - EXPECTED[i])).toBeLessThan(1e-12);
}

const denseA = (): DenseMatrix => new DenseMatrix(A);

// The factory `matrix` and `sparse` return `unknown`; one commented choke point gives them the
// parameter types of `linsolve`.
type MatrixA = Parameters<typeof linsolve>[0];
type MatrixB = Parameters<typeof linsolve>[1];
const mathjsB = (data: number[] | number[][]): MatrixB => fmatrix(data) as MatrixB;
const mathjsA = (data: number[] | number[][]): MatrixA => fmatrix(data) as MatrixA;
const mathjsSparseA = (data: number[][]): MatrixA => fsparse(data) as MatrixA;

describe('issues #977 and #1003: linsolve accepts a matrix argument', () => {
  it('nested A, native n x 1 column b', () => {
    expectSolution(linsolve(A, new DenseMatrix([[5], [11]])));
  });

  it('nested A, native 1 x n row b (a 1-D native input is a row)', () => {
    expectSolution(linsolve(A, new DenseMatrix([5, 11])));
  });

  it('nested A, MathJS n x 1 column b', () => {
    expectSolution(linsolve(A, mathjsB([[5], [11]])));
  });

  it('nested A, MathJS vector b', () => {
    expectSolution(linsolve(A, mathjsB([5, 11])));
  });

  it('nested A, nested n x 1 column b (pin: worked before)', () => {
    expectSolution(linsolve(A, [[5], [11]]));
  });

  it('nested A, Float64Array b', () => {
    expectSolution(linsolve(A, new Float64Array([5, 11])));
  });

  it('native A, vector b', () => {
    expectSolution(linsolve(denseA(), [5, 11]));
  });

  it('native A, nested column b', () => {
    expectSolution(linsolve(denseA(), [[5], [11]]));
  });

  it('native A, native column b', () => {
    expectSolution(linsolve(denseA(), new DenseMatrix([[5], [11]])));
  });

  it('MathJS A, vector b', () => {
    expectSolution(linsolve(mathjsA(A), [5, 11]));
  });

  it('native SparseMatrix A, native column b', () => {
    expectSolution(linsolve(SparseMatrix.fromDense(denseA()), new DenseMatrix([[5], [11]])));
  });

  it('MathJS sparse A, vector b', () => {
    expectSolution(linsolve(mathjsSparseA(A), [5, 11]));
  });

  it('pin: a 1-D b with string entries still coerces', () => {
    expectSolution(linsolve(A, ['5', '11'] as never));
  });

  it('the expression path: linsolve(matrix(..), matrix(..))', () => {
    expectSolution(evaluate('linsolve(matrix([[1,2],[3,4]]), matrix([5,11]))'));
  });
});

describe('issues #977 and #1003: linsolve refuses a b or A of the wrong shape', () => {
  it('an n x 2 nested b throws a TypeError that names the n x 1 column', () => {
    expect(() =>
      linsolve(A, [
        [5, 1],
        [11, 1],
      ])
    ).toThrow(TypeError);
    expect(() =>
      linsolve(A, [
        [5, 1],
        [11, 1],
      ])
    ).toThrow(/n x 1/);
  });

  it('a native 2 x 2 b throws a TypeError', () => {
    expect(() =>
      linsolve(
        A,
        new DenseMatrix([
          [5, 1],
          [11, 1],
        ])
      )
    ).toThrow(TypeError);
  });

  it('a nested 1 x n row b (n > 1) throws a TypeError', () => {
    expect(() => linsolve(A, [[5, 11]])).toThrow(TypeError);
  });

  it('a number b throws a TypeError', () => {
    expect(() => linsolve(A, 5 as never)).toThrow(TypeError);
    expect(() => linsolve(A, null as never)).toThrow(TypeError);
  });

  it('a 1-D b of the wrong length throws dimension mismatch (pin)', () => {
    expect(() => linsolve(A, [5])).toThrow(/dimension mismatch/);
  });

  it('a column b of the wrong length throws dimension mismatch', () => {
    expect(() => linsolve(A, [[5]])).toThrow(/dimension mismatch/);
    expect(() => linsolve(A, new DenseMatrix([[5], [11], [1]]))).toThrow(/dimension mismatch/);
    expect(() => linsolve(A, mathjsB([5, 11, 1]))).toThrow(/dimension mismatch/);
  });

  it('a column b with a non-number entry throws a TypeError', () => {
    expect(() => linsolve(A, [[5], ['x']] as never)).toThrow(TypeError);
  });

  it('a 1-D MathJS A throws a TypeError that names A', () => {
    expect(() => linsolve(mathjsA([1, 2]) as never, [5, 11])).toThrow(TypeError);
    expect(() => linsolve(mathjsA([1, 2]) as never, [5, 11])).toThrow(/A must be/);
  });

  it('a string A throws a TypeError that names A', () => {
    expect(() => linsolve('x' as never, [5, 11])).toThrow(TypeError);
    expect(() => linsolve('x' as never, [5, 11])).toThrow(/A must be/);
  });

  it('pin: an empty system and a non-square A keep their errors', () => {
    expect(() => linsolve([], [])).toThrow(/empty/);
    expect(() => linsolve([[1, 2, 3]], [1])).toThrow(/square/);
  });
});
