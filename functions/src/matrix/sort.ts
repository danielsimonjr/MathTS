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
    compare: CompareFn;
    compareNatural: CompareFn;
  }): TypedFunction => {
    const compareAsc = compare;
    const compareDesc = (a: unknown, b: unknown): number => -compare(a, b);

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
