import { isInteger } from '../utils/number.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';
import type { ConfigOptions } from '../core/config.js';
import { createMod } from './mod.js';
import { createMatAlgo01xDSid } from '../type/matrix/utils/matAlgo01xDSid.js';
import { createMatAlgo04xSidSid } from '../type/matrix/utils/matAlgo04xSidSid.js';
import { createMatAlgo10xSids } from '../type/matrix/utils/matAlgo10xSids.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';
import { wasmLoader } from '../wasm/WasmLoader.js';

// Minimum array length for WASM to be beneficial
const WASM_GCD_ARRAY_THRESHOLD = 50;

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

interface FractionType {
  gcd(other: FractionType): FractionType;
}

interface MatrixType {
  toArray(): unknown[];
}

interface GcdDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  round: TypedFunction;
  matrix: TypedFunction;
  equalScalar: TypedFunction;
  zeros: TypedFunction;
  BigNumber: BigNumberConstructor;
  DenseMatrix: unknown;
  concat: TypedFunction;
}

const name = 'gcd';
const dependencies = [
  'typed',
  'config',
  'round',
  'matrix',
  'equalScalar',
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
    equalScalar,
    zeros,
    BigNumber,
    DenseMatrix,
    concat,
  }: GcdDependencies): TypedFunction => {
    const mod = createMod({
      typed,
      config,
      round,
      matrix,
      equalScalar,
      zeros,
      DenseMatrix,
      concat,
    }) as TypedFunction;
    const matAlgo01xDSid = createMatAlgo01xDSid({ typed });
    const matAlgo04xSidSid = createMatAlgo04xSidSid({ typed, equalScalar });
    const matAlgo10xSids = createMatAlgo10xSids({ typed, DenseMatrix });
    const matrixAlgorithmSuite = createMatrixAlgorithmSuite({
      typed,
      matrix,
      concat,
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
        'Fraction, Fraction': (x: FractionType, y: FractionType): FractionType => x.gcd(y),
      },
      matrixAlgorithmSuite({
        SS: matAlgo04xSidSid as unknown as AlgorithmFunction,
        DS: matAlgo01xDSid as unknown as AlgorithmFunction,
        Ss: matAlgo10xSids as unknown as AlgorithmFunction,
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
            // Try WASM for flat number arrays
            const flat = array[0];
            const wasmResult = _tryWasmGcdArray(flat);
            if (wasmResult !== null) return wasmResult;
            return self(...flat);
          }
          if (is1d(array)) {
            // Try WASM for flat number arrays
            const wasmResult = _tryWasmGcdArray(array);
            if (wasmResult !== null) return wasmResult;
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
     * Try WASM-accelerated GCD for plain number arrays
     */
    function _tryWasmGcdArray(array: unknown[]): number | null {
      if (array.length < WASM_GCD_ARRAY_THRESHOLD) return null;

      const wasm = wasmLoader.getModule();
      if (!wasm) return null;

      // Check all elements are integer numbers
      const n = array.length;
      const data = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        if (typeof array[i] !== 'number' || !isInteger(array[i] as number)) {
          return null;
        }
        data[i] = array[i] as number;
      }

      const alloc = wasmLoader.allocateFloat64Array(data);
      try {
        return wasm.gcdArray(alloc.ptr, n);
      } catch {
        return null;
      } finally {
        wasmLoader.free(alloc.ptr);
      }
    }

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
