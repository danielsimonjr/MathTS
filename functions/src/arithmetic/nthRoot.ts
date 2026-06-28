import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';
import { createMatAlgo01xDSid } from '../type/matrix/utils/matAlgo01xDSid.js';
import { createMatAlgo02xDS0 } from '../type/matrix/utils/matAlgo02xDS0.js';
import { createMatAlgo06xS0S0 } from '../type/matrix/utils/matAlgo06xS0S0.js';
import { createMatAlgo11xS0s } from '../type/matrix/utils/matAlgo11xS0s.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';
import { nthRootNumber } from '../plain/number/index.js';

// Type definitions for nthRoot
interface BigNumberType {
  isNegative(): boolean;
  isZero(): boolean;
  isFinite(): boolean;
  isNeg(): boolean;
  neg(): BigNumberType;
  abs(): BigNumberType;
  pow(exp: BigNumberType): BigNumberType;
  div(other: BigNumberType): BigNumberType;
  mod(n: number): BigNumberType;
  equals(n: number): boolean;
  toPrecision(digits: number): string;
}

interface BigNumberConstructor {
  new (value: number | string | BigNumberType): BigNumberType;
  precision: number;
  clone(config: { precision: number }): BigNumberConstructor;
}

interface MatrixType {
  density(): number;
  valueOf(): unknown[];
}

interface NthRootDependencies {
  typed: TypedFunction;
  matrix: (data: unknown) => MatrixType;
  equalScalar: TypedFunction;
  BigNumber: BigNumberConstructor;
  concat: TypedFunction;
}

const name = 'nthRoot';
const dependencies = ['typed', 'matrix', 'equalScalar', 'BigNumber', 'concat'];

export const createNthRoot = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, equalScalar, BigNumber, concat }: NthRootDependencies): TypedFunction => {
    const matAlgo01xDSid = createMatAlgo01xDSid({ typed });
    const matAlgo02xDS0 = createMatAlgo02xDS0({ typed, equalScalar });
    const matAlgo06xS0S0 = createMatAlgo06xS0S0({ typed, equalScalar });
    const matAlgo11xS0s = createMatAlgo11xS0s({ typed, equalScalar });
    const matrixAlgorithmSuite = createMatrixAlgorithmSuite({
      typed,
      matrix,
      concat,
    });

    // `typed.referTo` is published as `referTo(...names, callback)` but the
    // local TypedFunction type models it in curried form; bind it to its real
    // (signature, callback) call signature here.
    const referTo = typed.referTo as unknown as (
      signature: string,
      callback: (
        ...refs: Array<(...args: unknown[]) => unknown>
      ) => (...args: never[]) => unknown
    ) => (...args: unknown[]) => unknown;

    /**
     * Calculate the nth root of a value.
     * The principal nth root of a positive real number A, is the positive real
     * solution of the equation
     *
     *     x^root = A
     *
     * For matrices, the function is evaluated element wise.
     *
     * Syntax:
     *
     *     math.nthRoot(a)
     *     math.nthRoot(a, root)
     *
     * Examples:
     *
     *     math.nthRoot(9, 2)    // returns 3 (since 3^2 == 9)
     *     math.sqrt(9)          // returns 3 (since 3^2 == 9)
     *     math.nthRoot(64, 3)   // returns 4 (since 4^3 == 64)
     *
     * See also:
     *
     *     sqrt, pow
     *
     * @param {number | BigNumber | Array | Matrix | Complex} a
     *              Value for which to calculate the nth root
     * @param {number | BigNumber} [root=2]    The root.
     * @return {number | Complex | Array | Matrix} Returns the nth root of `a`
     */
    function complexErr(): never {
      throw new Error('Complex number not supported in function nthRoot. Use nthRoots instead.');
    }

    return typed(
      name,
      {
        number: nthRootNumber,
        'number, number': nthRootNumber,

        BigNumber: (x: BigNumberType): BigNumberType | number => _bigNthRoot(x, new BigNumber(2)),
        'BigNumber, BigNumber': _bigNthRoot,

        Complex: complexErr,
        'Complex, number': complexErr,

        Array: referTo(
          'DenseMatrix,number',
          (selfDn: (...args: unknown[]) => unknown) =>
            (x: unknown): unknown =>
              (selfDn(matrix(x), 2) as MatrixType).valueOf()
        ),
        DenseMatrix: referTo(
          'DenseMatrix,number',
          (selfDn: (...args: unknown[]) => unknown) =>
            (x: unknown): unknown =>
              selfDn(x, 2)
        ),
        SparseMatrix: referTo(
          'SparseMatrix,number',
          (selfSn: (...args: unknown[]) => unknown) =>
            (x: unknown): unknown =>
              selfSn(x, 2)
        ),

        'SparseMatrix, SparseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: MatrixType, y: MatrixType): unknown => {
              // density must be one (no zeros in matrix)
              if (y.density() === 1) {
                // sparse + sparse
                return matAlgo06xS0S0(
                  x as unknown as Parameters<typeof matAlgo06xS0S0>[0],
                  y as unknown as Parameters<typeof matAlgo06xS0S0>[1],
                  self
                );
              } else {
                // throw exception
                throw new Error('Root must be non-zero');
              }
            }
        ),

        'DenseMatrix, SparseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: MatrixType, y: MatrixType): unknown => {
              // density must be one (no zeros in matrix)
              if (y.density() === 1) {
                // dense + sparse
                return matAlgo01xDSid(
                  x as unknown as Parameters<typeof matAlgo01xDSid>[0],
                  y as unknown as Parameters<typeof matAlgo01xDSid>[1],
                  self,
                  false
                );
              } else {
                // throw exception
                throw new Error('Root must be non-zero');
              }
            }
        ),

        'Array, SparseMatrix': referTo(
          'DenseMatrix,SparseMatrix',
          (selfDS: (...args: unknown[]) => unknown) =>
            (x: unknown, y: unknown): unknown =>
              selfDS(matrix(x), y)
        ),

        'number | BigNumber, SparseMatrix': typed.referToSelf(
          (self: TypedFunction) =>
            (x: number | BigNumberType, y: MatrixType): unknown => {
              // density must be one (no zeros in matrix)
              if (y.density() === 1) {
                // sparse - scalar
                return matAlgo11xS0s(
                  y as unknown as Parameters<typeof matAlgo11xS0s>[0],
                  x,
                  self,
                  true
                );
              } else {
                // throw exception
                throw new Error('Root must be non-zero');
              }
            }
        ),
      },
      matrixAlgorithmSuite({
        scalar: 'number | BigNumber',
        SD: matAlgo02xDS0 as unknown as AlgorithmFunction,
        Ss: matAlgo11xS0s as unknown as AlgorithmFunction,
        sS: false,
      })
    ) as TypedFunction;

    /**
     * Calculate the nth root of a for BigNumbers, solve x^root == a
     * https://rosettacode.org/wiki/Nth_root#JavaScript
     * @param {BigNumber} a
     * @param {BigNumber} root
     * @private
     */
    function _bigNthRoot(a: BigNumberType, root: BigNumberType): BigNumberType | number {
      const precision = BigNumber.precision;
      const Big = BigNumber.clone({ precision: precision + 2 });
      const zero = new BigNumber(0);

      const one = new Big(1);
      const inv = root.isNegative();
      if (inv) {
        root = root.neg();
      }

      if (root.isZero()) {
        throw new Error('Root must be non-zero');
      }
      if (a.isNegative() && !root.abs().mod(2).equals(1)) {
        throw new Error('Root must be odd when a is negative.');
      }

      // edge cases zero and infinity
      if (a.isZero()) {
        return inv ? new Big(Infinity) : 0;
      }
      if (!a.isFinite()) {
        return inv ? zero : a;
      }

      let x = a.abs().pow(one.div(root));
      // If a < 0, we require that root is an odd integer,
      // so (-1) ^ (1/root) = -1
      x = a.isNeg() ? x.neg() : x;
      return new BigNumber((inv ? one.div(x) : x).toPrecision(precision));
    }
  }
);

export const createNthRootNumber = /* #__PURE__ */ factory(
  name,
  ['typed'] as const,
  ({ typed }: { typed: TypedFunction }): TypedFunction => {
    return typed(name, {
      number: nthRootNumber,
      'number, number': nthRootNumber,
    }) as TypedFunction;
  }
);
