import { isInteger } from '../utils/number.js';
import { factory } from '../utils/factory.js';
import { fractionGcd } from './fraction-gcd.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';
import type { ConfigOptions } from '../core/config.js';
import { createMod } from './mod.js';
import { createMatAlgo03xDSf } from '../type/matrix/utils/matAlgo03xDSf.js';
import { createMatAlgo05xSfSf } from '../type/matrix/utils/matAlgo05xSfSf.js';
import { createMatAlgo12xSfs } from '../type/matrix/utils/matAlgo12xSfs.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';

// Type definitions for gcd
interface BigNumberType {
  isInt(): boolean;
  isZero(): boolean;
  lt(other: BigNumberType): boolean;
  neg(): BigNumberType;
}

interface BigNumberConstructor {
  new (value: number): BigNumberType;
}

interface MatrixType {
  toArray(): unknown[];
}

interface GcdDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  round: TypedFunction;
  matrix: TypedFunction;

  zeros: TypedFunction;
  BigNumber: BigNumberConstructor;
  DenseMatrix: unknown;
  concat: TypedFunction;

  isZero: TypedFunction;
}

const name = 'gcd';
const dependencies = [
  'typed',
  'config',
  'round',
  'matrix',
  'isZero',
  'zeros',
  'BigNumber',
  'DenseMatrix',
  'concat',
];

const gcdTypes = 'number | BigNumber | Fraction | Matrix | Array';
const gcdManyTypesSignature = `${gcdTypes}, ${gcdTypes}, ...${gcdTypes}`;

function is1d(array: unknown[]): boolean {
  return !array.some((element) => Array.isArray(element));
}

export const createGcd = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix,
    config,
    round,
    zeros,
    BigNumber,
    DenseMatrix,
    concat,
    isZero,
  }: GcdDependencies): TypedFunction => {
    const mod = createMod({
      typed,
      config,
      round,
      matrix,
      isZero,
      zeros,
      DenseMatrix,
      concat,
    } as never) as TypedFunction;
    const matAlgo03xDSf = createMatAlgo03xDSf({ typed });
    const matAlgo05xSfSf = createMatAlgo05xSfSf({ typed });
    const matAlgo12xSfs = createMatAlgo12xSfs({ typed, DenseMatrix });
    const matrixAlgorithmSuite = createMatrixAlgorithmSuite({
      typed,
      matrix,
    });

    /**
     * Calculate the greatest common divisor for two or more values or arrays.
     *
     * For matrices, the function is evaluated element wise.
     *
     * Syntax:
     *
     *    math.gcd(a, b)
     *    math.gcd(a, b, c, ...)
     *
     * Examples:
     *
     *    math.gcd(8, 12)              // returns 4
     *    math.gcd(-4, 6)              // returns 2
     *    math.gcd(25, 15, -10)        // returns 5
     *
     *    math.gcd([8, -4], [12, 6])   // returns [4, 2]
     *
     * See also:
     *
     *    lcm, xgcd
     *
     * @param {... number | BigNumber | Fraction | Array | Matrix} args  Two or more integer numbers
     * @return {number | BigNumber | Fraction | Array | Matrix}                           The greatest common divisor
     */
    return typed(
      name,
      {
        'number, number': _gcdNumber,
        'BigNumber, BigNumber': _gcdBigNumber,
        'Fraction, Fraction': fractionGcd,
      },
      matrixAlgorithmSuite({
        // gcd(x, 0) is abs(x), not x, so the result can differ from both
        // operands wherever one of them is zero
        SS: matAlgo05xSfSf as unknown as AlgorithmFunction,
        DS: matAlgo03xDSf as unknown as AlgorithmFunction,
        Ss: matAlgo12xSfs as unknown as AlgorithmFunction,
      }),
      {
        [gcdManyTypesSignature]: typed.referToSelf(
          (self: TypedFunction) => (a: unknown, b: unknown, args: unknown[]) => {
            let res = self(a, b);
            for (let i = 0; i < args.length; i++) {
              res = self(res, args[i]);
            }
            return res;
          }
        ),
        Array: typed.referToSelf((self: TypedFunction) => (array: unknown[]) => {
          if (array.length === 1 && Array.isArray(array[0]) && is1d(array[0])) {
            return self(...array[0]);
          }
          if (is1d(array)) {
            return self(...array);
          }
          throw new Error('gcd() supports only 1d matrices!');
        }),
        Matrix: typed.referToSelf((self: TypedFunction) => (matrixArg: MatrixType) => {
          return self(matrixArg.toArray());
        }),
      }
    ) as TypedFunction;

    /**
     * Calculate gcd for numbers
     * @param {number} a
     * @param {number} b
     * @returns {number} Returns the greatest common denominator of a and b
     * @private
     */
    function _gcdNumber(a: number, b: number): number {
      if (!isInteger(a) || !isInteger(b)) {
        throw new Error('Parameters in function gcd must be integer numbers');
      }

      // https://en.wikipedia.org/wiki/Euclidean_algorithm
      let r: number;
      while (b !== 0) {
        r = mod(a, b) as number;
        a = b;
        b = r;
      }
      return a < 0 ? -a : a;
    }

    /**
     * Calculate gcd for BigNumbers
     * @param {BigNumber} a
     * @param {BigNumber} b
     * @returns {BigNumber} Returns greatest common denominator of a and b
     * @private
     */
    function _gcdBigNumber(a: BigNumberType, b: BigNumberType): BigNumberType {
      if (!a.isInt() || !b.isInt()) {
        throw new Error('Parameters in function gcd must be integer numbers');
      }

      // https://en.wikipedia.org/wiki/Euclidean_algorithm
      const zero = new BigNumber(0);
      while (!b.isZero()) {
        const r = mod(a, b) as BigNumberType;
        a = b;
        b = r;
      }
      return a.lt(zero) ? a.neg() : a;
    }
  }
);
