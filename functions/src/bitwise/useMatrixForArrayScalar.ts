import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';

// Type definitions for useMatrixForArrayScalar
interface Matrix {
  valueOf(): unknown[][];
}

interface MatrixConstructor {
  (data: unknown[]): Matrix;
}

interface UseMatrixDependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
}

export const createUseMatrixForArrayScalar = /* #__PURE__ */ factory(
  'useMatrixForArrayScalar',
  ['typed', 'matrix'],
  ({ typed, matrix }: UseMatrixDependencies) => {
    // `typed.referTo` is published as `referTo(signature, callback)` but the
    // local TypedFunction type models it in curried form; bind it to its real
    // (signature, callback) call signature here.
    const referTo = typed.referTo as unknown as (
      signature: string,
      callback: (
        ...refs: Array<(...args: unknown[]) => unknown>
      ) => (...args: never[]) => unknown
    ) => (...args: unknown[]) => unknown;

    return {
      'Array, number': referTo(
        'DenseMatrix, number',
        (selfDn) =>
          (x: unknown[], y: number): unknown[] =>
            (selfDn(matrix(x), y) as Matrix).valueOf() as unknown[]
      ),

      'Array, BigNumber': referTo(
        'DenseMatrix, BigNumber',
        (selfDB) =>
          (x: unknown[], y: BigNumber): unknown[] =>
            (selfDB(matrix(x), y) as Matrix).valueOf() as unknown[]
      ),

      'number, Array': referTo(
        'number, DenseMatrix',
        (selfnD) =>
          (x: number, y: unknown[]): unknown[] =>
            (selfnD(x, matrix(y)) as Matrix).valueOf() as unknown[]
      ),

      'BigNumber, Array': referTo(
        'BigNumber, DenseMatrix',
        (selfBD) =>
          (x: BigNumber, y: unknown[]): unknown[] =>
            (selfBD(x, matrix(y)) as Matrix).valueOf() as unknown[]
      ),
    };
  }
);
