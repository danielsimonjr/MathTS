import { rightArithShiftBigNumber } from '../utils/bignumber/bitwise.js';
import { createMatAlgo02xDS0 } from '../type/matrix/utils/matAlgo02xDS0.js';
import { createMatAlgo11xS0s } from '../type/matrix/utils/matAlgo11xS0s.js';
import { createMatAlgo14xDs } from '../type/matrix/utils/matAlgo14xDs.js';
import { createMatAlgo01xDSid } from '../type/matrix/utils/matAlgo01xDSid.js';
import { createMatAlgo10xSids } from '../type/matrix/utils/matAlgo10xSids.js';
import { createMatAlgo08xS0Sid } from '../type/matrix/utils/matAlgo08xS0Sid.js';
import { factory } from '../utils/factory.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';
import { createUseMatrixForArrayScalar } from './useMatrixForArrayScalar.js';
import { rightArithShiftNumber } from '../plain/number/index.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';

// Type definitions for rightArithShift
interface Matrix {
  size(): number[];
  storage(): string;
  clone(): Matrix;
}

interface RightArithShiftDependencies {
  typed: TypedFunction;
  matrix: (data: unknown[]) => Matrix;
  equalScalar: TypedFunction;
  zeros: (size: number[], storage?: string) => Matrix;
  DenseMatrix: new (data: unknown) => Matrix;
  concat: TypedFunction;
}

const name = 'rightArithShift';
const dependencies = ['typed', 'matrix', 'equalScalar', 'zeros', 'DenseMatrix', 'concat'];

export const createRightArithShift = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, equalScalar, zeros, DenseMatrix, concat }: RightArithShiftDependencies) => {
    const matAlgo01xDSid = createMatAlgo01xDSid({ typed });
    const matAlgo02xDS0 = createMatAlgo02xDS0({ typed, equalScalar });
    const matAlgo08xS0Sid = createMatAlgo08xS0Sid({ typed, equalScalar });
    const matAlgo10xSids = createMatAlgo10xSids({ typed, DenseMatrix });
    const matAlgo11xS0s = createMatAlgo11xS0s({ typed, equalScalar });
    const matAlgo14xDs = createMatAlgo14xDs({ typed });
    const matrixAlgorithmSuite = createMatrixAlgorithmSuite({
      typed,
      matrix,
      concat,
    });
    const useMatrixForArrayScalar = createUseMatrixForArrayScalar({
      typed,
      matrix,
    });

    /**
     * Bitwise right arithmetic shift of a value x by y number of bits, `x >> y`.
     * For matrices, the function is evaluated element wise.
     * For units, the function is evaluated on the best prefix base.
     *
     * Syntax:
     *
     *    math.rightArithShift(x, y)
     *
     * Examples:
     *
     *    math.rightArithShift(4, 2)               // returns number 1
     *
     *    math.rightArithShift([16, -32, 64], 4)   // returns Array [1, -2, 4]
     *
     * See also:
     *
     *    bitAnd, bitNot, bitOr, bitXor, rightArithShift, rightLogShift
     *
     * @param  {number | BigNumber | bigint | Array | Matrix} x Value to be shifted
     * @param  {number | BigNumber | bigint} y Amount of shifts
     * @return {number | BigNumber | bigint | Array | Matrix} `x` zero-filled shifted right `y` times
     */
    return typed(
      name,
      {
        'number, number': rightArithShiftNumber,

        'BigNumber, BigNumber': rightArithShiftBigNumber,

        'bigint, bigint': (x: bigint, y: bigint): bigint => x >> y,

        'SparseMatrix, number | BigNumber': typed.referToSelf(
          (self: TypedFunction) =>
            (x: Matrix, y: number | BigNumber): Matrix => {
              // check scalar
              if (equalScalar(y, 0)) {
                return x.clone();
              }
              return matAlgo11xS0s(x as unknown as Parameters<typeof matAlgo11xS0s>[0], y, self, false) as unknown as Matrix;
            }
        ),

        'DenseMatrix, number | BigNumber': typed.referToSelf(
          (self: TypedFunction) =>
            (x: Matrix, y: number | BigNumber): Matrix => {
              // check scalar
              if (equalScalar(y, 0)) {
                return x.clone();
              }
              return matAlgo14xDs(x as unknown as Parameters<typeof matAlgo14xDs>[0], y, self, false) as unknown as Matrix;
            }
        ),

        'number | BigNumber, SparseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number | BigNumber, y: Matrix): Matrix => {
              // check scalar
              if (equalScalar(x, 0)) {
                return zeros(y.size(), y.storage());
              }
              return matAlgo10xSids(y as unknown as Parameters<typeof matAlgo10xSids>[0], x, self, true) as unknown as Matrix;
            }
        ),

        'number | BigNumber, DenseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number | BigNumber, y: Matrix): Matrix => {
              // check scalar
              if (equalScalar(x, 0)) {
                return zeros(y.size(), y.storage());
              }
              return matAlgo14xDs(y as unknown as Parameters<typeof matAlgo14xDs>[0], x, self, true) as unknown as Matrix;
            }
        ),
      },
      useMatrixForArrayScalar,
      matrixAlgorithmSuite({
        SS: matAlgo08xS0Sid as unknown as AlgorithmFunction,
        DS: matAlgo01xDSid as unknown as AlgorithmFunction,
        SD: matAlgo02xDS0 as unknown as AlgorithmFunction,
      })
    );
  }
);
