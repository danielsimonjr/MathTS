import { BigNumber as CoreBigNumber } from '@danielsimonjr/mathts-core';
import { bigHypot, pNormSumInRange } from '../utils/bignumber-hypot.js';
import { factory } from '../utils/factory.js';
import { norm2 } from '@danielsimonjr/mathts-core';
import type { TypedFunction } from '../core/function/typed.js';
import { realScale, isDegenerate } from '../utils/real-scale.js';

// Type definitions for norm
interface ComplexType {
  abs(): number;
}

interface BigNumberType {
  abs(): BigNumberType;
}

interface MatrixType {
  size(): number[];
  forEach(
    callback: (
      value: number | BigNumberType | ComplexType,
      index: number[],
      matrix: MatrixType
    ) => void,
    skipZeros?: boolean
  ): void;
  toArray(): (number | BigNumberType | ComplexType)[];
}

interface EigsResult {
  values: MatrixType;
}

interface NormDependencies {
  typed: TypedFunction;
  abs: TypedFunction;
  add: TypedFunction;
  pow: TypedFunction;
  conj: TypedFunction;
  sqrt: TypedFunction;
  multiply: TypedFunction;
  equalScalar: TypedFunction;
  larger: (a: number | BigNumberType, b: number | BigNumberType) => boolean;
  smaller: (a: number | BigNumberType, b: number | BigNumberType) => boolean;
  matrix: (data: unknown) => MatrixType;
  ctranspose: TypedFunction;
  eigs: (x: MatrixType) => EigsResult;
}

const name = 'norm';
const dependencies = [
  'typed',
  'abs',
  'add',
  'pow',
  'conj',
  'sqrt',
  'multiply',
  'equalScalar',
  'larger',
  'smaller',
  'matrix',
  'ctranspose',
  'eigs',
];

export const createNorm = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    abs,
    add,
    pow,
    conj,
    sqrt,
    multiply,
    equalScalar,
    larger,
    smaller,
    matrix,
    ctranspose,
    eigs,
  }: NormDependencies): TypedFunction => {
    /**
     * Calculate the norm of a number, vector or matrix.
     *
     * The second parameter p is optional. If not provided, it defaults to 2.
     *
     * Syntax:
     *
     *    math.norm(x)
     *    math.norm(x, p)
     *
     * Examples:
     *
     *    math.abs(-3.5)                         // returns 3.5
     *    math.norm(-3.5)                        // returns 3.5
     *
     *    math.norm(math.complex(3, -4))         // returns 5
     *
     *    math.norm([1, 2, -3], Infinity)        // returns 3
     *    math.norm([1, 2, -3], -Infinity)       // returns 1
     *
     *    math.norm([3, 4], 2)                   // returns 5
     *
     *    math.norm([[1, 2], [3, 4]], 1)          // returns 6
     *    math.norm([[1, 2], [3, 4]], 'inf')     // returns 7
     *    math.norm([[1, 2], [3, 4]], 'fro')     // returns 5.477225575051661
     *
     * See also:
     *
     *     abs, hypot
     *
     * @param  {number | BigNumber | Complex | Array | Matrix} x
     *            Value for which to calculate the norm
     * @param  {number | BigNumber | string} [p=2]
     *            Vector space.
     *            Supported numbers include Infinity and -Infinity.
     *            Supported strings are: 'inf', '-inf', and 'fro' (The Frobenius norm)
     * @return {number | BigNumber} the p-norm
     */
    return typed(name, {
      number: Math.abs,

      Complex: function (x: ComplexType): number {
        return x.abs();
      },

      BigNumber: function (x: BigNumberType): BigNumberType {
        // norm(x) = abs(x)
        return x.abs();
      },

      boolean: function (x: boolean): number {
        // norm(x) = abs(x)
        return Math.abs(x ? 1 : 0);
      },

      Array: function (x: unknown[]): number | BigNumberType {
        return _norm(matrix(x), 2);
      },

      Matrix: function (x: MatrixType): number | BigNumberType {
        return _norm(x, 2);
      },

      'Array, number | BigNumber | string': function (
        x: unknown[],
        p: number | BigNumberType | string
      ): number | BigNumberType {
        return _norm(matrix(x), p);
      },

      'Matrix, number | BigNumber | string': function (
        x: MatrixType,
        p: number | BigNumberType | string
      ): number | BigNumberType {
        return _norm(x, p);
      },
    }) as TypedFunction;

    /**
     * Calculate the plus infinity norm for a vector
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _vectorNormPlusInfinity(x: MatrixType): number | BigNumberType {
      // norm(x, Infinity) = max(abs(x))
      let pinf: number | BigNumberType = 0;
      // skip zeros since abs(0) === 0
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        const v = abs(value) as number | BigNumberType;
        if (larger(v, pinf)) {
          pinf = v;
        }
      }, true);
      return pinf;
    }

    /**
     * Calculate the minus infinity norm for a vector
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _vectorNormMinusInfinity(x: MatrixType): number | BigNumberType {
      // norm(x, -Infinity) = min(abs(x))
      let ninf: number | BigNumberType | undefined;
      // skip zeros since abs(0) === 0
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        const v = abs(value) as number | BigNumberType;
        if (!ninf || smaller(v, ninf)) {
          ninf = v;
        }
      }, true);
      return ninf || 0;
    }

    /**
     * Calculate the norm for a vector
     * @param {Matrix} x
     * @param {number | BigNumberType | string} p
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    /** The scaled 2-norm of the real entries when one is a BigNumber and none is complex (#1255). */
    function _scaledBigNorm(x: MatrixType): BigNumberType | undefined {
      const vals: (number | CoreBigNumber)[] = [];
      let big = false;
      let real = true;
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        if (value instanceof CoreBigNumber) {
          big = true;
          vals.push(value);
        } else if (typeof value === 'number') vals.push(value);
        else real = false;
      });
      return big && real ? (bigHypot(vals) as unknown as BigNumberType) : undefined;
    }

    /**
     * A sum of p-th powers can overflow or underflow when the p-norm is in range (#1255). Then
     * the p-norm is m * norm(x / m, p). The scale m is max(abs(x)) for a positive p and
     * min(abs(x)) for a negative p, so each scaled term is at most 1. Else `plain` is returned,
     * so the digits of an in-range sum do not change. A sum of numbers is also out of range
     * when its terms are subnormal. A NaN, an infinite or a zero scale keeps `plain`.
     */
    function _scaledPNorm(
      x: MatrixType,
      p: number,
      sum: number | BigNumberType,
      plain: number | BigNumberType
    ): number | BigNumberType {
      const inRange =
        sum instanceof CoreBigNumber
          ? !(plain instanceof CoreBigNumber) || (plain.isFinite() && !plain.isZero())
          : typeof sum !== 'number' || p === 1 || pNormSumInRange(sum);
      if (inRange) return plain;
      let m: number | CoreBigNumber | undefined;
      let real = true;
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        const v = abs(value) as number | CoreBigNumber;
        if (typeof v === 'number' ? Number.isNaN(v) : !(v instanceof CoreBigNumber) || v.isNaN()) {
          real = false;
        } else if (m === undefined || (p > 0 ? exactCompare(v, m) > 0 : exactCompare(v, m) < 0)) {
          m = v;
        }
      });
      const scale = m as number | CoreBigNumber | undefined;
      if (!real || scale === undefined) return plain;
      const usable =
        scale instanceof CoreBigNumber
          ? scale.isFinite() && !scale.isZero()
          : Number.isFinite(scale) && scale !== 0;
      if (!usable) return plain;
      // A quotient, not a product with 1 / m: the inverse of a subnormal number is Infinity.
      const ratio = (v: number | CoreBigNumber): number | CoreBigNumber =>
        typeof v === 'number' && typeof scale === 'number'
          ? v / scale
          : toBig(v).divide(toBig(scale));
      let n: number | BigNumberType = 0;
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        const term = pow(ratio(abs(value) as number | CoreBigNumber), p);
        n = add(term, n) as number | BigNumberType;
      });
      return multiply(scale, pow(n, 1 / p)) as number | BigNumberType;
    }

    /** The sign of a - b with no tolerance: `larger` and `smaller` read tiny values as equal. */
    function exactCompare(a: number | CoreBigNumber, b: number | CoreBigNumber): number {
      if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
      return toBig(a).compare(toBig(b));
    }

    /** A guard on `unknown`: the compiler narrows a sum that a callback assigns to `number`. */
    function isCoreBig(v: unknown): v is CoreBigNumber {
      return v instanceof CoreBigNumber;
    }

    function toBig(v: number | CoreBigNumber): CoreBigNumber {
      return typeof v === 'number' ? CoreBigNumber.fromNumber(v) : v;
    }

    function _vectorNorm(
      x: MatrixType,
      p: number | BigNumberType | string
    ): number | BigNumberType {
      // check p
      if (p === Number.POSITIVE_INFINITY || p === 'inf') {
        return _vectorNormPlusInfinity(x);
      }
      if (p === Number.NEGATIVE_INFINITY || p === '-inf') {
        return _vectorNormMinusInfinity(x);
      }
      if (p === 'fro') {
        return _norm(x, 2);
      }
      if (typeof p === 'number' && !isNaN(p)) {
        // check p != 0
        if (!equalScalar(p, 0)) {
          // norm(x, p) = sum(abs(xi) ^ p) ^ 1/p
          let n: number | BigNumberType = 0;
          // skip zeros since abs(0) === 0
          x.forEach(function (value: number | BigNumberType | ComplexType) {
            n = add(pow(abs(value), p), n) as number | BigNumberType;
          }, true);
          // A BigNumber sum means a BigNumber entry: the scaled 2-norm replaces it (#1255). The
          // test is on the sum, so a vector of numbers pays for no second pass.
          if (p === 2 && isCoreBig(n)) {
            const scaled = _scaledBigNorm(x);
            if (scaled !== undefined) return scaled;
          }
          // sqrt is exact for a perfect square and rounds once; pow(n, 0.5) goes through exp/ln.
          const plain = (p === 2 ? sqrt(n) : pow(n, 1 / p)) as number | BigNumberType;
          return p === 2 ? _finiteOr(plain, x) : _scaledPNorm(x, p, n, plain);
        }
        return Number.POSITIVE_INFINITY;
      }
      // invalid parameter value
      throw new Error('Unsupported parameter value');
    }

    /**
     * Calculate the Frobenius norm for a matrix
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _matrixNormFrobenius(x: MatrixType): number | BigNumberType {
      // norm(x) = sqrt(sum(diag(x'x)))
      let fro: number | BigNumberType = 0;
      x.forEach(function (value: number | BigNumberType | ComplexType) {
        fro = add(fro, multiply(value, conj(value))) as number | BigNumberType;
      });
      // A BigNumber sum means a BigNumber entry: the scaled norm replaces it (#1255). The test
      // is on the sum, so a matrix of numbers pays for no second pass.
      if (isCoreBig(fro)) {
        const scaledBig = _scaledBigNorm(x);
        if (scaledBig !== undefined) return scaledBig;
      }
      // A sum of squares of plain numbers overflows above about 1e154 and loses its
      // digits below about 1e-150 (#1104). Then the scaled norm of the entries is
      // returned. A NaN, infinite, complex or BigNumber entry keeps the plain sum.
      if (typeof fro === 'number' && !(fro >= 2 ** -800 && fro < Infinity)) {
        const entries: number[] = [];
        let plain = true;
        x.forEach(function (value: number | BigNumberType | ComplexType) {
          if (typeof value === 'number' && Number.isFinite(value)) entries.push(value);
          else plain = false;
        });
        if (plain) return norm2(entries);
      }
      return _finiteOr(abs(sqrt(fro)) as number | BigNumberType, x);
    }

    /**
     * `plain` when it is finite. Else the non-finite norm of the entries of `x`: the plain sum
     * gives NaN for an infinite entry with a NaN entry, and the IEEE rule gives Infinity (#1259).
     */
    function _finiteOr(plain: number | BigNumberType, x: MatrixType): number | BigNumberType {
      const finite =
        typeof plain === 'number'
          ? Number.isFinite(plain)
          : !(plain instanceof CoreBigNumber) || plain.isFinite();
      if (finite) return plain;
      return (_nonFiniteNorm(x.toArray() as unknown[]) ?? plain) as number | BigNumberType;
    }

    /**
     * Calculate the norm L1 for a matrix
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _matrixNormSum(x: MatrixType, axis: 0 | 1): number | BigNumberType {
      const sums: (number | BigNumberType)[] = [];
      let maxSum: number | BigNumberType = 0;
      x.forEach(function (value: number | BigNumberType | ComplexType, index: number[]) {
        const k = index[axis];
        const sk = add(sums[k] || 0, abs(value)) as number | BigNumberType;
        if (larger(sk, maxSum)) {
          maxSum = sk;
        }
        sums[k] = sk;
      }, true);
      return maxSum;
    }

    /**
     * Calculate the norm L2 for a matrix
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _matrixNormTwo(x: MatrixType): number | BigNumberType {
      // norm(x) = sqrt( max eigenvalue of A*.A)
      const sizeX = x.size();
      if (sizeX[0] !== sizeX[1]) {
        throw new RangeError('Invalid matrix dimensions');
      }
      // A NaN or an infinite entry has no eigenvalues to find (eigs throws a RangeError, #1243),
      // and the norm is NaN or Infinity (#1285).
      const nonFinite = _nonFiniteNorm(x.toArray());
      if (nonFinite !== undefined) return nonFinite as number | BigNumberType;
      // A*.A squares each entry, so it can overflow or underflow when the norm is in range
      // (#1257). An overflow gives eigs a non-finite entry, and eigs throws a RangeError for
      // it (#1243). The norm is s * norm(x / s) for an exact scale s, so retry with the scaled
      // entries. A matrix with a Complex entry or a non-finite entry keeps the plain result
      // or the plain error.
      let plain: number | BigNumberType | undefined;
      let plainError: unknown;
      try {
        plain = _matrixNormTwoOf(x);
        if (!isDegenerate(plain)) return plain;
      } catch (err) {
        if (!(err instanceof RangeError)) throw err;
        plainError = err;
      }
      const rows = x.toArray() as unknown[];
      const scale = realScale(rows.flat(Infinity));
      if (scale === undefined) {
        if (plainError !== undefined) throw plainError;
        return plain as number | BigNumberType;
      }
      const scaled = matrix(
        rows.map(function down(row: unknown): unknown {
          return Array.isArray(row) ? row.map(down) : scale.down(row as number);
        })
      );
      return scale.up(_matrixNormTwoOf(scaled) as number) as number | BigNumberType;
    }

    /**
     * The 2-norm or the Frobenius norm of entries of which one is not finite: Infinity when a part
     * of an entry is infinite, also with a NaN; else NaN (the IEEE 754 rule of `hypot`, #1259). A
     * BigNumber when an entry is a BigNumber, else a number. `undefined` when every entry is
     * finite.
     */
    function _nonFiniteNorm(rows: unknown[]): number | CoreBigNumber | undefined {
      let anyBig = false;
      let anyNaN = false;
      let anyInfinite = false;
      for (const v of rows.flat(Infinity)) {
        let re: number;
        let im = 0;
        if (v instanceof CoreBigNumber) {
          anyBig = true;
          re = v.isNaN() ? NaN : v.isFinite() ? 0 : Infinity;
        } else if (typeof v === 'number') {
          re = v;
        } else if (typeof v === 'object' && v !== null && 're' in v && 'im' in v) {
          ({ re, im } = v as { re: number; im: number });
        } else {
          continue;
        }
        if (Math.abs(re) === Infinity || Math.abs(im) === Infinity) anyInfinite = true;
        else if (Number.isNaN(re) || Number.isNaN(im)) anyNaN = true;
      }
      if (!anyNaN && !anyInfinite) return undefined;
      const result = anyInfinite ? Infinity : NaN;
      return anyBig ? CoreBigNumber.fromNumber(result) : result;
    }

    function _matrixNormTwoOf(x: MatrixType): number | BigNumberType {
      const tx = ctranspose(x) as MatrixType;
      const squaredX = multiply(tx, x) as MatrixType;
      const eigenVals = eigs(squaredX).values.toArray();
      const rho = eigenVals[eigenVals.length - 1];
      return abs(sqrt(rho)) as number | BigNumberType;
    }

    /**
     * Calculate the infinity norm for a matrix
     * @param {Matrix} x
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    /**
     * Calculate the norm for a 2D Matrix (M*N)
     * @param {Matrix} x
     * @param {number | BigNumberType | string} p
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _matrixNorm(
      x: MatrixType,
      p: number | BigNumberType | string
    ): number | BigNumberType {
      // check p
      if (p === 1) {
        return _matrixNormSum(x, 1);
      }
      if (p === Number.POSITIVE_INFINITY || p === 'inf') {
        return _matrixNormSum(x, 0);
      }
      if (p === 'fro') {
        return _matrixNormFrobenius(x);
      }
      if (p === 2) {
        return _matrixNormTwo(x);
      } // invalid parameter value

      throw new Error('Unsupported parameter value ' + p);
    }

    /**
     * Calculate the norm for an array
     * @param {Matrix} x
     * @param {number | BigNumberType | string} p
     * @returns {number | BigNumberType} Returns the norm
     * @private
     */
    function _norm(x: MatrixType, p: number | BigNumberType | string): number | BigNumberType {
      // ROBUST 2-NORM for a flat vector of plain numbers.
      //
      // The generic path below computes `sqrt(sum(|x|^p))` — it SQUARES before it adds, so it
      // dies well inside the representable range:
      //
      //     norm([1e200 x 4])   -> Infinity   (the true answer, 2e200, is representable)
      //     norm([1e-200 x 4])  -> 0          (silently wrong, which is worse)
      //
      // NumPy has this bug too (`np.linalg.norm([1e200]*4)` is `inf`). LAPACK's dnrm2 does not:
      // it carries a running scale so the accumulator only ever holds ratios in [0, 1].
      // `norm2` is that algorithm.
      if ((p === 2 || p === 'fro') && x.size().length === 1) {
        const v = x.valueOf() as unknown[];
        if (v.every((e) => typeof e === 'number')) {
          return norm2(v as number[]);
        }
      }

      // size
      const sizeX = x.size();

      // check if it is a vector
      if (sizeX.length === 1) {
        return _vectorNorm(x, p);
      }
      // MxN matrix
      if (sizeX.length === 2) {
        if (sizeX[0] && sizeX[1]) {
          return _matrixNorm(x, p);
        } else {
          throw new RangeError('Invalid matrix dimensions');
        }
      }
      throw new Error('Unsupported matrix dimensions');
    }
  }
);
