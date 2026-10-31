import { arraySize as size } from '../utils/array.js';
import { factory } from '../utils/factory.js';

import { TypedFunction, Matrix } from '../types.js';

/** Comparator: returns >0, 0, or <0 for (a, b). */
type CompareFn = (a: unknown, b: unknown) => number;

const name = 'sort';
const dependencies = ['typed', 'matrix', 'compare', 'compareNatural'];

export const createSort = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix,
    compare,
    compareNatural,
  }: {
    typed: TypedFunction;
    matrix: (data: unknown, storage?: string) => Matrix;
    compare: TypedFunction;
    compareNatural: CompareFn;
  }): TypedFunction => {
    const compareAsc = compare as CompareFn;
    const compareDesc = (a: unknown, b: unknown): number => -compareAsc(a, b);

    type NumberCompare = (a: number, b: number) => number;
    let cachedNumberCompare: NumberCompare | null | undefined;

    function getNumberCompare(): NumberCompare | null {
      if (cachedNumberCompare === undefined) {
        cachedNumberCompare = typed.find(compare, ['number', 'number']) as NumberCompare | null;
      }
      return cachedNumberCompare;
    }

    function arrayAllNumbers(arr: unknown[]): boolean {
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== 'number') return false;
      }
      return true;
    }

    function sortNumberArray(arr: unknown[], cmp: NumberCompare, descending: boolean): unknown[] {
      const c = descending ? (a: number, b: number) => -cmp(a, b) : cmp;
      arr.sort(c as (a: unknown, b: unknown) => number);
      return arr;
    }

    /**
     * Sort the items in a matrix.
     *
     * Syntax:
     *
     *    math.sort(x)
     *    math.sort(x, compare)
     *
     * Examples:
     *
     *    math.sort([5, 10, 1]) // returns [1, 5, 10]
     *    math.sort(['C', 'B', 'A', 'D'], math.compareNatural)
     *    // returns ['A', 'B', 'C', 'D']
     *
     *    function sortByLength (a, b) {
     *      return a.length - b.length
     *    }
     *    math.sort(['Langdon', 'Tom', 'Sara'], sortByLength)
     *    // returns ['Tom', 'Sara', 'Langdon']
     *
     * See also:
     *
     *    filter, forEach, map, compare, compareNatural
     *
     * @param {Matrix | Array} x    A one dimensional matrix or array to sort
     * @param {Function | 'asc' | 'desc' | 'natural'} [compare='asc']
     *        An optional _comparator function or name. The function is called as
     *        `compare(a, b)`, and must return 1 when a > b, -1 when a < b,
     *        and 0 when a == b.
     * @return {Matrix | Array} Returns the sorted matrix.
     */
    return typed(name, {
      Array: function (x: unknown[]) {
        _arrayIsVector(x);
        const cmp = arrayAllNumbers(x) ? getNumberCompare() : null;
        if (cmp) return sortNumberArray(x, cmp, false);
        return x.sort(compareAsc);
      },

      Matrix: function (x: Matrix) {
        _matrixIsVector(x);
        return matrix(x.toArray().sort(compareAsc), x.storage());
      },

      'Array, function': function (x: unknown[], _comparator: CompareFn): unknown[] {
        _arrayIsVector(x);
        return x.sort(_comparator);
      },

      'Matrix, function': function (x: Matrix, _comparator: CompareFn): Matrix {
        _matrixIsVector(x);
        return matrix(x.toArray().sort(_comparator), x.storage());
      },

      'Array, string': function (x: unknown[], order: string): unknown[] {
        _arrayIsVector(x);
        if (order === 'asc' || order === 'desc') {
          const cmp = arrayAllNumbers(x) ? getNumberCompare() : null;
          if (cmp) return sortNumberArray(x, cmp, order === 'desc');
        }
        return x.sort(_comparator(order));
      },

      'Matrix, string': function (x: Matrix, order: string): Matrix {
        _matrixIsVector(x);
        return matrix(x.toArray().sort(_comparator(order)), x.storage());
      },
    }) as unknown as TypedFunction;

    /**
     * Get the comparator for given order ('asc', 'desc', 'natural')
     * @param {'asc' | 'desc' | 'natural'} order
     * @return {Function} Returns a _comparator function
     */
    function _comparator(order: string): CompareFn {
      if (order === 'asc') {
        return compareAsc;
      } else if (order === 'desc') {
        return compareDesc;
      } else if (order === 'natural') {
        return compareNatural;
      } else {
        throw new Error('String "asc", "desc", or "natural" expected');
      }
    }

    /**
     * Validate whether an array is one dimensional
     * Throws an error when this is not the case
     * @param {Array} array
     * @private
     */
    function _arrayIsVector(array: unknown[]) {
      if (size(array).length !== 1) {
        throw new Error('One dimensional array expected');
      }
    }

    /**
     * Validate whether a matrix is one dimensional
     * Throws an error when this is not the case
     * @param {Matrix} matrix
     * @private
     */
    function _matrixIsVector(matrix: Matrix) {
      if (matrix.size().length !== 1) {
        throw new Error('One dimensional matrix expected');
      }
    }
  }
);
