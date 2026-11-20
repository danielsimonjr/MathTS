import { isNumber, isBigNumber } from '../utils/is.js';
import { flatten } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import { assertLoopOrder } from '../utils/limits.js';
import type { TypedFunction } from '../core/function/typed.js';
import { isFloatTyped, type FloatTyped } from './numeric-data.js';
import {
  NUMBER_ARITH,
  blendNumber,
  orderStatistics,
  parseQuantileThirdArg,
  quantileOfSorted,
  quantileOfUnsorted,
  quantilePlan,
  type NumpyQuantileMethod,
  type ParsedQuantileOptions,
  type QuantileArith,
  type QuantilePlan,
  type QuantileSeqOptions,
} from './quantile-numpy-methods.js';

// Type definitions for quantileSeq
interface MatrixType {
  valueOf(): unknown[] | unknown[][];
}

interface BigNumberType {
  times(n: number): BigNumberType;
  floor(): BigNumberType;
  toNumber(): number;
  sub(n: number | BigNumberType): BigNumberType;
  isNaN(): boolean;
  valueOf(): number;
}

interface QuantileSeqDependencies {
  typed: TypedFunction;
  bignumber?: (value: unknown) => BigNumberType;
  add: TypedFunction;
  subtract: TypedFunction;
  divide: (a: unknown, b: unknown) => number | BigNumberType;
  multiply: TypedFunction;
  partitionSelect: TypedFunction;
  compare: (a: unknown, b: unknown) => number;
  isInteger: TypedFunction;
  smaller: (a: unknown, b: unknown) => boolean;
  smallerEq: (a: unknown, b: unknown) => boolean;
  larger: (a: unknown, b: unknown) => boolean;
  mapSlices: TypedFunction;
}

/** A probability: a number or a BigNumber. */
type Prob = number | BigNumberType;

/** The parsed options of one call, passed through `mapSlices` for the dimension forms. */
type Options = ParsedQuantileOptions;

/** True for a number NaN or a BigNumber NaN. Fraction and Unit values are never NaN here. */
function isNaNValue(v: unknown): boolean {
  return (
    (isNumber(v) && v !== v) || (isBigNumber(v) && (v as unknown as { isNaN(): boolean }).isNaN())
  );
}

/**
 * From this many probabilities on, an unsorted number sample is sorted once, with the native
 * typed-array sort, and every probability reads its values from the sorted copy. Below it, each
 * probability takes its two order statistics by selection (O(n) each, no sort). Measured on
 * 1e6 numbers (Node 26): a selection costs about 20 ms per probability and one native sort about
 * 550 ms, so the break-even is near 28 probabilities (near 13 at n = 1e3, where the sort has
 * fewer levels). 16 is within a factor of 2 of the best choice at both sizes.
 */
const SORT_FROM_PROBS = 16;

/** The values of `values` as numbers: the buffer, the count that it holds and whether NaN was met. */
interface NumberScan {
  work: Float64Array;
  count: number;
  sawNaN: boolean;
}

/**
 * Read every value as a number, in one pass and into one `Float64Array` (the only copy of the
 * input). Returns `null` at the first value that is not a number. NaN is dropped when `skipNaN`
 * is set, and otherwise ends the scan with `sawNaN`.
 */
function readNumbers(values: ArrayLike<unknown>, skipNaN: boolean): NumberScan | null {
  const n = values.length;
  if (n > 0 && typeof values[0] !== 'number') return null;
  const work = new Float64Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (typeof v !== 'number') return null;
    if (v !== v) {
      if (!skipNaN) return { work, count, sawNaN: true };
      continue;
    }
    work[count++] = v;
  }
  return { work, count, sawNaN: false };
}

const name = 'quantileSeq';
const dependencies = [
  'typed',
  '?bignumber',
  'add',
  'subtract',
  'divide',
  'multiply',
  'partitionSelect',
  'compare',
  'isInteger',
  'smaller',
  'smallerEq',
  'larger',
  'mapSlices',
];

export const createQuantileSeq = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    bignumber,
    add,
    subtract,
    divide,
    multiply,
    partitionSelect,
    compare,
    isInteger,
    smaller,
    smallerEq,
    larger,
    mapSlices,
  }: QuantileSeqDependencies) => {
    // Built on first use. Declared before the `return` below: a `let` after it never runs.
    let bigArith: QuantileArith<BigNumberType> | undefined;

    /**
     * Compute the prob order quantile of a matrix or a list with values.
     * The sequence is sorted and the middle value is returned.
     * Supported types of sequence values are: Number, BigNumber, Fraction, Unit
     * Supported types of probability are: Number, BigNumber
     *
     * In case of a multidimensional array or matrix, the prob order quantile
     * of all elements will be calculated.
     *
     * The interpolation `method` is one of the NumPy names (`linear` by default). Every
     * method applies to every value type and to a BigNumber probability.
     *
     * Syntax:
     *
     *     math.quantileSeq(A, prob[, sorted])
     *     math.quantileSeq(A, [prob1, prob2, ...][, sorted])
     *     math.quantileSeq(A, N[, sorted])
     *     math.quantileSeq(A, prob, method)
     *     math.quantileSeq(A, prob, { method, sorted, skipNaN })
     *     math.quantileSeq(A, prob, dim)
     *     math.quantileSeq(A, prob, method, dim)
     *
     * Examples:
     *
     *     math.quantileSeq([3, -1, 5, 7], 0.5)         // returns 4
     *     math.quantileSeq([3, -1, 5, 7], [1/3, 2/3])  // returns [3, 5]
     *     math.quantileSeq([3, -1, 5, 7], 2)           // returns [3, 5]
     *     math.quantileSeq([-1, 3, 5, 7], 0.5, true)   // returns 4
     *     math.quantileSeq([1, 2, 3, 4], 0.1, 'inverted_cdf')  // returns 1
     *
     * See also:
     *
     *     median, mean, min, max, sum, prod, std, variance
     *
     * @param {Array, Matrix} data                A single matrix or Array
     * @param {Number, BigNumber, Array} probOrN  prob is the order of the quantile, while N is
     *                                            the amount of evenly distributed steps of
     *                                            probabilities; only one of these options can
     *                                            be provided
     * @param {Boolean} sorted=false              is data sorted in ascending order
     * @return {Number, BigNumber, Unit, Array}   Quantile(s)
     */
    return typed(name, {
      'Array | Matrix, number | BigNumber': (data: unknown[] | MatrixType, p: Prob): unknown =>
        _quantileSeqProbNumber(data, p, parseQuantileThirdArg()),
      'Float64Array | Float32Array, number | BigNumber': (data: FloatTyped, p: Prob): unknown =>
        _quantileSeqProbNumber(data, p, parseQuantileThirdArg()),
      'Array | Matrix, number | BigNumber, number': (
        data: unknown[] | MatrixType,
        prob: Prob,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(), dim, _quantileSeqProbNumber),
      // Third arg as a string selects the interpolation mode (linear default).
      'Array | Matrix, number | BigNumber, string': (
        data: unknown[] | MatrixType,
        prob: Prob,
        mode: string
      ): unknown => _quantileSeqProbNumber(data, prob, parseQuantileThirdArg(mode)),
      'Array | Matrix, number | BigNumber, Object': (
        data: unknown[] | MatrixType,
        prob: Prob,
        options: QuantileSeqOptions
      ): unknown => _quantileSeqProbNumber(data, prob, parseQuantileThirdArg(options)),
      'Array | Matrix, number | BigNumber, boolean': (
        data: unknown[] | MatrixType,
        prob: Prob,
        sorted: boolean
      ): unknown => _quantileSeqProbNumber(data, prob, parseQuantileThirdArg(sorted)),
      'Array | Matrix, number | BigNumber, string, number': (
        data: unknown[] | MatrixType,
        prob: Prob,
        mode: string,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(mode), dim, _quantileSeqProbNumber),
      'Array | Matrix, number | BigNumber, Object, number': (
        data: unknown[] | MatrixType,
        prob: Prob,
        options: QuantileSeqOptions,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(options), dim, _quantileSeqProbNumber),
      'Array | Matrix, number | BigNumber, boolean, number': (
        data: unknown[] | MatrixType,
        prob: Prob,
        sorted: boolean,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(sorted), dim, _quantileSeqProbNumber),
      'Array | Matrix, number | BigNumber, boolean, string': (
        data: unknown[] | MatrixType,
        prob: Prob,
        sorted: boolean,
        mode: string
      ): unknown => _quantileSeqProbNumber(data, prob, parseQuantileThirdArg(sorted, mode)),
      'Array | Matrix, number | BigNumber, boolean, string, number': (
        data: unknown[] | MatrixType,
        prob: Prob,
        sorted: boolean,
        mode: string,
        dim: number
      ): unknown =>
        _quantileSeqDim(
          data,
          prob,
          parseQuantileThirdArg(sorted, mode),
          dim,
          _quantileSeqProbNumber
        ),
      'Array | Matrix, Array | Matrix': (
        data: unknown[] | MatrixType,
        p: unknown[] | MatrixType
      ): unknown => _quantileSeqProbCollection(data, p, parseQuantileThirdArg()),
      'Array | Matrix, Array | Matrix, number': (
        data: unknown[] | MatrixType,
        prob: unknown[] | MatrixType,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(), dim, _quantileSeqProbCollection),
      'Array | Matrix, Array | Matrix, string': (
        data: unknown[] | MatrixType,
        p: unknown[] | MatrixType,
        mode: string
      ): unknown => _quantileSeqProbCollection(data, p, parseQuantileThirdArg(mode)),
      'Array | Matrix, Array | Matrix, Object': (
        data: unknown[] | MatrixType,
        p: unknown[] | MatrixType,
        options: QuantileSeqOptions
      ): unknown => _quantileSeqProbCollection(data, p, parseQuantileThirdArg(options)),
      'Array | Matrix, Array | Matrix, boolean': (
        data: unknown[] | MatrixType,
        p: unknown[] | MatrixType,
        sorted: boolean
      ): unknown => _quantileSeqProbCollection(data, p, parseQuantileThirdArg(sorted)),
      'Array | Matrix, Array | Matrix, string, number': (
        data: unknown[] | MatrixType,
        prob: unknown[] | MatrixType,
        mode: string,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(mode), dim, _quantileSeqProbCollection),
      'Array | Matrix, Array | Matrix, Object, number': (
        data: unknown[] | MatrixType,
        prob: unknown[] | MatrixType,
        options: QuantileSeqOptions,
        dim: number
      ): unknown =>
        _quantileSeqDim(
          data,
          prob,
          parseQuantileThirdArg(options),
          dim,
          _quantileSeqProbCollection
        ),
      'Array | Matrix, Array | Matrix, boolean, number': (
        data: unknown[] | MatrixType,
        prob: unknown[] | MatrixType,
        sorted: boolean,
        dim: number
      ): unknown =>
        _quantileSeqDim(data, prob, parseQuantileThirdArg(sorted), dim, _quantileSeqProbCollection),
      'Array | Matrix, Array | Matrix, boolean, string': (
        data: unknown[] | MatrixType,
        p: unknown[] | MatrixType,
        sorted: boolean,
        mode: string
      ): unknown => _quantileSeqProbCollection(data, p, parseQuantileThirdArg(sorted, mode)),
      'Array | Matrix, Array | Matrix, boolean, string, number': (
        data: unknown[] | MatrixType,
        prob: unknown[] | MatrixType,
        sorted: boolean,
        mode: string,
        dim: number
      ): unknown =>
        _quantileSeqDim(
          data,
          prob,
          parseQuantileThirdArg(sorted, mode),
          dim,
          _quantileSeqProbCollection
        ),
    });

    /** The quantile of every slice along `dim`; each slice takes the options as parsed. */
    function _quantileSeqDim<T>(
      data: unknown[] | MatrixType,
      prob: T,
      options: Options,
      dim: number,
      fn: (data: unknown[] | MatrixType, prob: T, options: Options) => unknown
    ): unknown {
      return mapSlices(data, dim, (x: unknown) => fn(x as unknown[] | MatrixType, prob, options));
    }

    function _quantileSeqProbNumber(
      data: unknown[] | MatrixType | FloatTyped,
      probOrN: Prob,
      options: Options
    ): unknown {
      const source = isFloatTyped(data) ? data : ((data as MatrixType).valueOf() as unknown[]);
      if (smaller(probOrN, 0)) {
        throw new Error('N/prob must be non-negative');
      }
      // A NaN probability gives NaN (a number NaN, or a BigNumber NaN for a BigNumber).
      if (isNaNProb(probOrN) || smallerEq(probOrN, 1)) {
        // quantileSeq([a, b, c, d, ...], prob[,sorted])
        const result = _quantileSeq(source, [probOrN], options)[0];
        return isNumber(probOrN) ? result : bignumber!(result);
      }
      // larger(probOrN, 1)
      // quantileSeq([a, b, c, d, ...], N[,sorted])
      if (!isInteger(probOrN)) {
        throw new Error('N must be a positive integer');
      }

      // largest possible Array length is 2^32-1
      // 2^32 < 10^15, thus safe conversion guaranteed
      if (larger(probOrN, 4294967295)) {
        throw new Error(
          'N must be less than or equal to 2^32-1, as that is the maximum length of an Array'
        );
      }

      assertLoopOrder('quantileSeq', 'N', Number(probOrN));
      const nPlusOne = add(probOrN, 1);
      const probs: Prob[] = [];
      for (let i = 0; smaller(i, probOrN); i++) {
        probs.push(divide(i + 1, nPlusOne));
      }
      const result = _quantileSeq(source, probs, options);
      return isNumber(probOrN) ? result : bignumber!(result);
    }

    /**
     * Calculate the prob order quantile of an n-dimensional array.
     *
     * @param {Array | Matrix} data - Input data
     * @param {Array | Matrix} probOrN - Probabilities
     * @param {Object} options - Parsed options (sorted, method, skipNaN)
     * @return {Array} prob order quantiles
     * @private
     */
    function _quantileSeqProbCollection(
      data: unknown[] | MatrixType,
      probOrN: unknown[] | MatrixType,
      options: Options
    ): unknown {
      const dataArr = (data as MatrixType).valueOf() as unknown[];
      // quantileSeq([a, b, c, d, ...], [prob1, prob2, ...][,sorted])
      const probs = (probOrN as MatrixType).valueOf() as Prob[];
      return probs.length === 0 ? [] : _quantileSeq(dataArr, probs, options);
    }

    function isNaNProb(p: Prob): boolean {
      return isBigNumber(p) ? (p as BigNumberType).isNaN() : Number.isNaN(p);
    }

    /** The arithmetic of a BigNumber probability: exact decimal indexes. */
    function bigNumberArith(): QuantileArith<BigNumberType> {
      return (bigArith ??= {
        ratio: (num, den = 1) =>
          den === 1 ? bignumber!(num) : (divide(bignumber!(num), bignumber!(den)) as BigNumberType),
        add: (a, b) => add(a, b) as BigNumberType,
        sub: (a, b) => subtract(a, b) as BigNumberType,
        mul: (a, b) => multiply(a, b) as BigNumberType,
        floor: (x) => x.floor().toNumber(),
        cmp: (x, y) => sign(x, y),
      });
    }

    /** The sign of `a - b`. `compare` returns a BigNumber for BigNumber input, so convert it. */
    function sign(a: unknown, b: unknown): number {
      return Number(compare(a, b));
    }

    /** The plan for one probability, in the arithmetic of its own type. */
    function planFor(
      method: NumpyQuantileMethod,
      n: number,
      p: Prob
    ): QuantilePlan<number | BigNumberType> {
      return isBigNumber(p)
        ? quantilePlan(method, n, p as BigNumberType, bigNumberArith())
        : quantilePlan(method, n, p as number, NUMBER_ARITH);
    }

    /**
     * Blend two observations of any type at weight `gamma`: `left * (1 - gamma) + right * gamma`.
     * The weight 0 and equal ends give `left` without arithmetic. A BigNumber `left` with a
     * number weight converts the weight, to avoid floating-point error.
     */
    function blend(left: unknown, right: unknown, gamma: Prob): unknown {
      if (isNumber(left) && isNumber(right) && isNumber(gamma)) {
        return blendNumber(left, right, gamma);
      }
      if (sign(left, right) === 0) return left;
      const g = isBigNumber(left) && isNumber(gamma) ? bignumber!(gamma) : gamma;
      return add(multiply(left, subtract(1, g)), multiply(right, g));
    }

    /**
     * Calculate the quantiles of an n-dimensional array for a list of probabilities.
     * The array is flattened and scanned for NaN once, whatever the number of probabilities.
     *
     * @param {Array | Float32Array | Float64Array} source - Input values
     * @param {Array} probs - Probabilities, each a number or a BigNumber
     * @param {Object} options - Parsed options (sorted, method, skipNaN)
     * @return {Array} one quantile (number, BigNumber, Unit, ...) per probability
     * @private
     */
    function _quantileSeq(
      source: unknown[] | FloatTyped,
      probs: Prob[],
      { sorted, mode, skipNaN }: Options
    ): unknown[] {
      // A flat array of numbers (the common case) is read as it is, with no flatten. A nested
      // array, or values that are not numbers, are flattened into a new array, and read again.
      let values: ArrayLike<unknown> = source;
      let scan = source.length === 0 ? null : readNumbers(source, skipNaN);
      if (scan === null && !isFloatTyped(source)) {
        values = flatten(source) as unknown[];
        scan = values.length === 0 ? null : readNumbers(values, skipNaN);
      }
      if (values.length === 0) {
        throw new Error('Cannot calculate quantile of an empty sequence');
      }

      // Numbers only: one Float64Array, then select (or sort once for many probabilities).
      if (scan !== null) {
        // NaN policy of mean and median: propagate, or omit with skipNaN / skipna.
        if (scan.sawNaN || scan.count === 0) return probs.map(() => NaN);
        const work = scan.count === values.length ? scan.work : scan.work.subarray(0, scan.count);
        let ordered = sorted;
        if (!ordered && probs.length >= SORT_FROM_PROBS) {
          work.sort();
          ordered = true;
        }
        return probs.map((p) => {
          if (isNaNProb(p)) return p;
          if (isNumber(p)) {
            return ordered ? quantileOfSorted(work, p, mode) : quantileOfUnsorted(work, p, mode);
          }
          // A BigNumber probability: exact BigNumber indexes, and numbers to blend.
          const plan = planFor(mode, work.length, p);
          const [left, right] = orderStatistics(work, plan, ordered);
          return plan.leftIdx === plan.rightIdx ? left : blend(left, right, plan.gamma);
        });
      }

      // Any other type (BigNumber, Fraction, Unit, bigint, mixed): compare, then add and multiply.
      // `values` is the flattened copy here, so the selection below may reorder it.
      let flat = values as unknown[];
      // A number or BigNumber NaN is returned as is, so the result keeps its type.
      const firstNaN = flat.find(isNaNValue);
      if (firstNaN !== undefined) {
        if (!skipNaN) return probs.map(() => firstNaN);
        flat = flat.filter((v) => !isNaNValue(v));
        if (flat.length === 0) return probs.map(() => firstNaN);
      }
      return probs.map((p) => {
        if (isNaNProb(p)) return p;
        const plan = planFor(mode, flat.length, p);
        const { leftIdx, rightIdx } = plan;
        let left: unknown;
        let right: unknown;
        if (sorted) {
          left = flat[leftIdx];
          right = flat[rightIdx];
        } else if (leftIdx === rightIdx) {
          left = right = partitionSelect(flat, leftIdx);
        } else {
          right = partitionSelect(flat, rightIdx);

          // max of partition is kth largest
          left = flat[leftIdx];
          for (let i = 0; i < leftIdx; ++i) {
            if (compare(flat[i], left) > 0) {
              left = flat[i];
            }
          }
        }
        return leftIdx === rightIdx ? left : blend(left, right, plan.gamma);
      });
    }
  }
);
