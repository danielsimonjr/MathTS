import { createMatAlgo02xDS0 } from '../type/matrix/utils/matAlgo02xDS0.js';
import { createMatAlgo11xS0s } from '../type/matrix/utils/matAlgo11xS0s.js';
import { createMatAlgo14xDs } from '../type/matrix/utils/matAlgo14xDs.js';
import { createMatAlgo03xDSf } from '../type/matrix/utils/matAlgo03xDSf.js';
import { createMatAlgo10xSids } from '../type/matrix/utils/matAlgo10xSids.js';
import { createMatAlgo09xS0Sf } from '../type/matrix/utils/matAlgo09xS0Sf.js';
import { isBigNumber } from '../utils/is.js';
import { factory } from '../utils/factory.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';
import { rightLogShiftNumber } from '../plain/number/index.js';
import { createMatAlgo15xAs } from '../type/matrix/utils/matAlgo15xAs.js';
import { deepMap } from '../utils/array.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';

// Type definitions for rightLogShift
interface Matrix {
  size(): number[];
  storage(): string;
  clone(): Matrix;
}

interface RightLogShiftDependencies {
  typed: TypedFunction;
  matrix: (data: unknown[]) => Matrix;

  zeros: (size: number[], storage?: string) => Matrix;
  DenseMatrix: new (data: unknown) => Matrix;

  isZero: TypedFunction;
}

const name = 'rightLogShift';
const dependencies = ['typed', 'matrix', 'isZero', 'zeros', 'DenseMatrix'];

/** Keep the dispatcher's implicit BigNumber-to-number conversion out of logical shifts. */
export function rejectBigNumberShift<T extends (...args: never[]) => unknown>(fn: T): T {
  const checked = (...args: never[]) => {
    if (args.some(isBigNumber)) {
      throw new TypeError('rightLogShift: BigNumber operands are not supported');
    }
    return fn(...args);
  };
  return Object.assign(checked, fn);
}

export const createRightLogShift = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, zeros, DenseMatrix, isZero }: RightLogShiftDependencies) => {
    const matAlgo03xDSf = createMatAlgo03xDSf({ typed });
    const matAlgo02xDS0 = createMatAlgo02xDS0({ typed });
    const matAlgo09xS0Sf = createMatAlgo09xS0Sf({ typed });
    const matAlgo10xSids = createMatAlgo10xSids({ typed, DenseMatrix });
    const matAlgo11xS0s = createMatAlgo11xS0s({ typed });
    const matAlgo14xDs = createMatAlgo14xDs({ typed });
    const matrixAlgorithmSuite = createMatrixAlgorithmSuite({
      typed,
      matrix,
    });
    const matAlgo15xAs = createMatAlgo15xAs({});

    /**
     * Bitwise right logical shift of value x by y number of bits, `x >>> y`.
     * For matrices, the function is evaluated element wise.
     * For units, the function is evaluated on the best prefix base.
     *
     * Syntax:
     *
     *    math.rightLogShift(x, y)
     *
     * Examples:
     *
     *    math.rightLogShift(4, 2)               // returns number 1
     *
     *    math.rightLogShift([16, 32, 64], 4)    // returns Array [1, 2, 4]
     *
     * See also:
     *
     *    bitAnd, bitNot, bitOr, bitXor, leftShift, rightLogShift
     *
     * @param  {number | Array | Matrix} x Value to be shifted
     * @param  {number} y Amount of shifts
     * @return {number | Array | Matrix} `x` zero-filled shifted right `y` times
     */

    const shift = typed(
      name,
      {
        'number, number': rightLogShiftNumber,

        // note that x >>> 0 is not x for a negative x, so there is no shortcut
        // for shifting a matrix by zero
        'SparseMatrix, number': typed.referToSelf(
          (self: TypedFunction) =>
            (x: Matrix, y: number): Matrix =>
              matAlgo11xS0s(
                x as unknown as Parameters<typeof matAlgo11xS0s>[0],
                y,
                self,
                false
              ) as unknown as Matrix
        ),

        'DenseMatrix, number': typed.referToSelf(
          (self: TypedFunction) =>
            (x: Matrix, y: number): Matrix =>
              matAlgo14xDs(
                x as unknown as Parameters<typeof matAlgo14xDs>[0],
                y,
                self,
                false
              ) as unknown as Matrix
        ),

        'number, SparseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number, y: Matrix): Matrix => {
              // check scalar
              if (isZero(x)) {
                return zeros(y.size(), y.storage());
              }
              return matAlgo10xSids(
                y as unknown as Parameters<typeof matAlgo10xSids>[0],
                x,
                self,
                true
              ) as unknown as Matrix;
            }
        ),

        'number, DenseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number, y: Matrix): Matrix => {
              // check scalar
              if (isZero(x)) {
                return zeros(y.size(), y.storage());
              }
              return matAlgo14xDs(
                y as unknown as Parameters<typeof matAlgo14xDs>[0],
                x,
                self,
                true
              ) as unknown as Matrix;
            }
        ),
      },
      {
        'Array, number': typed.referToSelf(
          (self: TypedFunction) =>
            (x: unknown[], y: number): unknown[] =>
              matAlgo15xAs(x, y, self as never, false) as unknown[]
        ),
        'number, Array': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number, y: unknown[]): unknown[] => {
              // check scalar
              if (isZero(x)) {
                return deepMap(y, () => x) as unknown[];
              }
              return matAlgo15xAs(y, x, self as never, true) as unknown[];
            }
        ),
      },
      matrixAlgorithmSuite({
        // a zero shift still has to be evaluated: x >>> 0 is not x for x < 0
        SS: matAlgo09xS0Sf as unknown as AlgorithmFunction,
        DS: matAlgo03xDSf as unknown as AlgorithmFunction,
        SD: matAlgo02xDS0 as unknown as AlgorithmFunction,
      })
    );
    return rejectBigNumberShift(shift);
  }
);

export const createSelectedRightLogShift = /* #__PURE__ */ factory(
  name,
  dependencies,
  (deps: RightLogShiftDependencies) => {
    const { typed, isZero, matrix, zeros } = deps;
    const shift = createRightLogShift({ ...deps }) as unknown as {
      signatures: Record<string, (...args: never[]) => unknown>;
    };
    const checkZero = (value: unknown) => {
      if (!isZero(value)) {
        throw new TypeError('rightLogShift: BigNumber operands are not supported');
      }
    };
    const copy = (value: Matrix | unknown[], count: unknown) => {
      checkZero(count);
      if (Array.isArray(value)) return matrix(value).clone().valueOf();
      return value.clone();
    };
    const clear = (value: unknown, counts: Matrix | unknown[]) => {
      checkZero(value);
      if (Array.isArray(counts)) return zeros(matrix(counts).size(), 'dense').valueOf();
      return zeros(counts.size(), counts.storage());
    };
    return typed(name, {
      ...shift.signatures,
      'Array | DenseMatrix | SparseMatrix, BigNumber': copy,
      'BigNumber, Array | DenseMatrix | SparseMatrix': clear,
    });
  }
);
