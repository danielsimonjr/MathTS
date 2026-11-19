import { arraySize as size } from '../utils/array.js';
import { factory } from '../utils/factory.js';

// Type definitions
interface Matrix {
  toArray(): unknown[];
  size(): number[];
  resize(size: number[]): Matrix;
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
}

interface MatrixConstructor {
  (data: unknown[]): Matrix;
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  multiplyScalar: TypedFunction;
}

const name = 'kron';
const dependencies = ['typed', 'matrix', 'multiplyScalar'];

export const createKron = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, multiplyScalar }: Dependencies) => {
    /**
     * Calculates the Kronecker product of 2 matrices or vectors.
     *
     * NOTE: If a one dimensional vector / matrix is given, it will be
     * wrapped so its two dimensions.
     * See the examples.
     *
     * Syntax:
     *
     *    math.kron(x, y)
     *
     * Examples:
     *
     *    math.kron([[1, 0], [0, 1]], [[1, 2], [3, 4]])
     *    // returns [ [ 1, 2, 0, 0 ], [ 3, 4, 0, 0 ], [ 0, 0, 1, 2 ], [ 0, 0, 3, 4 ] ]
     *
     *    math.kron([1,1], [2,3,4])
     *    // returns [2, 3, 4, 2, 3, 4]
     *
     * See also:
     *
     *    multiply, dot, cross
     *
     * @param  {Array | Matrix} x     First vector
     * @param  {Array | Matrix} y     Second vector
     * @return {Array | Matrix}       Returns the Kronecker product of `x` and `y`
     */
    return typed(name, {
      'Matrix, Matrix': function (x: Matrix, y: Matrix): Matrix {
        return _kronMatrix(x, x.size(), y, y.size());
      },

      'Matrix, Array': function (x: Matrix, y: unknown[]): Matrix {
        return _kronMatrix(x, x.size(), y, size(y));
      },

      'Array, Matrix': function (x: unknown[], y: Matrix): Matrix {
        return _kronMatrix(x, size(x), y, y.size());
      },

      'Array, Array': _kron,
    });

    /**
     * Kronecker product with a Matrix operand. A Matrix with a zero dimension has no
     * entries, and toArray() drops its shape (a 0 x n matrix gives []), so the result
     * size is the product of the operand sizes and the result is built empty (#1233).
     */
    function _kronMatrix(
      x: Matrix | unknown[],
      sx: number[],
      y: Matrix | unknown[],
      sy: number[]
    ): Matrix {
      if (sx.includes(0) || sy.includes(0)) {
        const d = Math.max(sx.length, sy.length);
        const px = [...Array<number>(d - sx.length).fill(1), ...sx];
        const py = [...Array<number>(d - sy.length).fill(1), ...sy];
        return matrix([]).resize(px.map((n, i) => n * (py[i] as number)));
      }
      const a = Array.isArray(x) ? x : x.toArray();
      const b = Array.isArray(y) ? y : y.toArray();
      return matrix(_kron(a, b));
    }

    /**
     * Calculate the Kronecker product of two (1-dimensional) vectors,
     * with no dimension checking
     * @param {Array} a  First vector
     * @param {Array} b  Second vector
     * @returns {Array}  the 1-dimensional Kronecker product of a and b
     * @private
     */
    function _kron1d(a: unknown[], b: unknown[]): unknown[] {
      // TODO in core overhaul: would be faster to see if we can choose a
      // particular implementation of multiplyScalar at the beginning,
      // rather than re-dispatch for _every_ ordered pair of entries.
      return a.flatMap((x) => b.map((y) => multiplyScalar(x, y)));
    }

    /**
     * Calculate the Kronecker product of two possibly multidimensional arrays
     * @param {Array} a  First array
     * @param {Array} b  Second array
     * @param {number} [d]  common dimension; if missing, compute and match args
     * @returns {Array} Returns the Kronecker product of x and y
     * @private
     */
    function _kron(a: unknown[], b: unknown[], d: number = -1): unknown[] {
      if (d < 0) {
        let adim = size(a).length;
        let bdim = size(b).length;
        d = Math.max(adim, bdim);
        while (adim++ < d) a = [a];
        while (bdim++ < d) b = [b];
      }

      if (d === 1) return _kron1d(a, b);

      return a.flatMap((aSlice) =>
        b.map((bSlice) => _kron(aSlice as unknown[], bSlice as unknown[], d - 1))
      );
    }
  }
);
