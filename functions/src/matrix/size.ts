import { arraySize } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions
interface MatrixLike {
  size?: () => number[];
  _size?: number[];
  rows?: number;
  cols?: number;
}

interface MatrixConstructor {
  (data: number[]): unknown;
}

interface Config {
  matrix: 'Array' | 'Matrix';
}

interface Dependencies {
  typed: TypedFunction;
  config: Config;
  matrix: MatrixConstructor;
}

const name = 'size';
const dependencies = ['typed', 'config', 'matrix'];

export const createSize = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, matrix }: Dependencies) => {
    function out(dims: number[]): number[] | unknown {
      if (config.matrix === 'Matrix') {
        return matrix(dims);
      }
      return dims;
    }
    /**
     * Calculate the size of a matrix or scalar. Always returns an Array containing numbers.
     *
     * Note that in mathjs v14 and older, function size could return a Matrix depending on
     * the input type and configuration.
     *
     * Syntax:
     *
     *     math.size(x)
     *
     * Examples:
     *
     *     math.size(2.3)                       // returns []
     *     math.size('hello world')             // returns [11]
     *
     *     const A = [[1, 2, 3], [4, 5, 6]]
     *     math.size(A)                         // returns [2, 3]
     *     math.size(math.range(1,6).toArray()) // returns [5]
     *
     * See also:
     *
     *     count, resize, squeeze, subset
     *
     * @param {boolean | number | Complex | Unit | string | Array | Matrix} x  A matrix
     * @return {Array} A vector with size of `x`.
     */
    function matrixDims(x: MatrixLike): number[] {
      if (typeof x.size === 'function') {
        return x.size();
      }
      if (Array.isArray(x._size)) {
        return [...x._size];
      }
      if (typeof x.rows === 'number' && typeof x.cols === 'number') {
        return [x.rows, x.cols];
      }
      throw new TypeError('Cannot compute size: expected a Matrix');
    }

    return typed(name, {
      // Native DenseMatrix is not the factory Matrix type (no prototype `isMatrix`).
      // It still has numeric `rows` / `cols`. Objects that are not matrices throw below.
      'Matrix | Object': (x: MatrixLike) => out(matrixDims(x)),

      Array: (x: unknown) => out(arraySize(x as number[])),

      string: (x: string) => out([x.length]),

      // scalar
      'number | Complex | BigNumber | Unit | boolean | null': (_x: unknown) => out([]),
    });
  }
);
