import { isMatrix } from '../utils/is.js';
import { isInteger } from '../utils/number.js';
import { factory } from '../utils/factory.js';
import { findTypedImpl } from '../utils/typed-impl.js';

// Type definitions
interface Matrix {
  size(): number[];
  valueOf(): unknown[];
}

interface TypedFunction<T = unknown> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => T;
  (...args: unknown[]): T;
  find(fn: unknown, types: string[]): ((...args: never[]) => unknown) | null;
}

type CompareFunction = (a: unknown, b: unknown) => number;

interface Dependencies {
  typed: TypedFunction;
  isNumeric: TypedFunction<boolean>;
  isNaN: TypedFunction<boolean>;
  compare: CompareFunction;
}

const name = 'partitionSelect';
const dependencies = ['typed', 'isNumeric', 'isNaN', 'compare'];

type NumberCompare = (a: number, b: number) => number;

export const createPartitionSelect = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, isNumeric, isNaN: mathIsNaN, compare }: Dependencies) => {
    const asc = compare;
    const desc = (a: unknown, b: unknown): number => -compare(a, b);

    let cachedNumberCompare: NumberCompare | null | undefined;

    function getNumberCompare(): NumberCompare | null {
      if (cachedNumberCompare === undefined) {
        cachedNumberCompare = findTypedImpl<[number, number], number>(
          typed as unknown as Parameters<typeof findTypedImpl>[0],
          compare,
          ['number', 'number']
        );
      }
      return cachedNumberCompare;
    }

    function scanPlainNumbers(
      arr: unknown[]
    ): { allNumbers: true; nan?: number } | { allNumbers: false } {
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v !== 'number') {
          return { allNumbers: false };
        }
        if (v !== v) {
          return { allNumbers: true, nan: v };
        }
      }
      return { allNumbers: true };
    }

    /**
     * Three-way quickselect: each pass splits the range into values less than, equal to and
     * greater than a random pivot, and stops when k is in the equal band. A range of equal
     * values therefore takes one pass, not one pass per value (#1293).
     */
    function selectThreeWay<T>(arr: T[], k: number, cmp: (a: T, b: T) => number): T {
      let from = 0;
      let to = arr.length - 1;

      while (from < to) {
        const pivot = arr[Math.floor(Math.random() * (to - from + 1)) + from] as T;
        let lt = from;
        let i = from;
        let gt = to;

        while (i <= gt) {
          const c = cmp(arr[i] as T, pivot);
          if (c < 0) {
            const tmp = arr[lt] as T;
            arr[lt++] = arr[i] as T;
            arr[i++] = tmp;
          } else if (c > 0) {
            const tmp = arr[gt] as T;
            arr[gt--] = arr[i] as T;
            arr[i] = tmp;
          } else {
            ++i;
          }
        }

        if (k < lt) {
          to = lt - 1;
        } else if (k > gt) {
          from = gt + 1;
        } else {
          return arr[k] as T;
        }
      }

      return arr[k] as T;
    }

    /**
     * Partition-based selection of an array or 1D matrix.
     * Will find the kth smallest value, and mutates the input array.
     * Uses Quickselect.
     *
     * Syntax:
     *
     *    math.partitionSelect(x, k)
     *    math.partitionSelect(x, k, compare)
     *
     * Examples:
     *
     *    math.partitionSelect([5, 10, 1], 2)                               // returns 10
     *    math.partitionSelect(['C', 'B', 'A', 'D'], 1, math.compareText)   // returns 'B'
     *
     *    function sortByLength (a, b) {
     *      return a.length - b.length
     *    }
     *    math.partitionSelect(['Langdon', 'Tom', 'Sara'], 2, sortByLength) // returns 'Langdon'
     *
     *    // the input array is mutated
     *    arr = [5, 2, 1]
     *    math.partitionSelect(arr, 0) // returns 1, arr is now: [1, 2, 5]
     *    math.partitionSelect(arr, 1, 'desc') // returns 2, arr is now: [5, 2, 1]
     *
     * See also:
     *
     *    sort
     *
     * @param {Matrix | Array} x    A one dimensional matrix or array to sort
     * @param {Number} k            The kth smallest value to be retrieved zero-based index
     * @param {Function | 'asc' | 'desc'} [compare='asc']
     *        An optional comparator function. The function is called as
     *        `compare(a, b)`, and must return 1 when a > b, -1 when a < b,
     *        and 0 when a == b.
     * @return {*} Returns the kth lowest value.
     */
    return typed(name, {
      'Array | Matrix, number': function (x: unknown[] | Matrix, k: number): unknown {
        return _partitionSelect(x, k, asc);
      },

      'Array | Matrix, number, string': function (
        x: unknown[] | Matrix,
        k: number,
        compare: string
      ): unknown {
        if (compare === 'asc') {
          return _partitionSelect(x, k, asc);
        } else if (compare === 'desc') {
          return _partitionSelect(x, k, desc);
        } else {
          throw new Error('Compare string must be "asc" or "desc"');
        }
      },

      'Array | Matrix, number, function': _partitionSelect,
    });

    function _partitionSelect(x: unknown[] | Matrix, k: number, compare: CompareFunction): unknown {
      if (!isInteger(k) || k < 0) {
        throw new Error('k must be a non-negative integer');
      }

      if (isMatrix(x)) {
        const size = (x as Matrix).size();
        if (size.length > 1) {
          throw new Error('Only one dimensional matrices supported');
        }
        return quickSelect((x as Matrix).valueOf(), k, compare);
      }

      return quickSelect(x as unknown[], k, compare);
    }

    /**
     * Quickselect algorithm.
     * Code adapted from:
     * https://blog.teamleadnet.com/2012/07/quick-select-algorithm-find-kth-element.html
     *
     * @param {Array} arr
     * @param {Number} k
     * @param {Function} compare
     * @private
     */
    function quickSelect(arr: unknown[], k: number, compare: CompareFunction): unknown {
      if (k >= arr.length) {
        throw new Error('k out of bounds');
      }

      const scan = scanPlainNumbers(arr);
      if (scan.allNumbers) {
        if ('nan' in scan && scan.nan !== undefined) {
          return scan.nan;
        }
        const cmpNum = getNumberCompare();
        if (cmpNum && (compare === asc || compare === desc)) {
          const cmp = compare === desc ? (a: number, b: number) => -cmpNum(a, b) : cmpNum;
          return selectThreeWay(arr as number[], k, cmp);
        }
      }

      // check for NaN values since these can cause an infinite while loop
      for (let i = 0; i < arr.length; i++) {
        if (isNumeric(arr[i]) && mathIsNaN(arr[i])) {
          return arr[i]; // return NaN
        }
      }

      return selectThreeWay(arr, k, (a, b) => Number(compare(a, b)));
    }
  }
);
