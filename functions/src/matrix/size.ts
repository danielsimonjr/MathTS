import { arraySize } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions
interface MatrixLike {
  size?: () => number[];
  _size?: number[];
  rows?: number;
  cols?: number;
  type?: string;
}

interface Dependencies {
  typed: TypedFunction;
}

const name = 'size';
const dependencies = ['typed'];

/**
 * Native `DenseMatrix` / `SparseMatrix` are not the factory Matrix type (no
 * prototype `isMatrix`). They expose numeric `rows` / `cols` and a string `type`.
 * Factory matrices have a `size()` method and stay on the typed `Matrix` signature.
 */
function nativeMatrixDims(x: unknown): number[] | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as MatrixLike;
  if (typeof o.size === 'function') return null;
  if (typeof o.rows === 'number' && typeof o.cols === 'number' && typeof o.type === 'string') {
    return [o.rows, o.cols];
  }
  return null;
}

export const createSize = /* #__PURE__ */ factory(name, dependencies, ({ typed }: Dependencies) => {
  /**
   * Calculate the size of a matrix or scalar. Always returns an Array containing numbers.
   *
   * Note that in mathjs v14 and older, function size could return a Matrix depending on
   * the input type and configuration. The compat `math.size` applies that config; this
   * factory always returns a number array so internal callers can read `.length` / `.join`.
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

  const impl = typed(name, {
    Matrix: (x: MatrixLike): number[] => matrixDims(x),

    Array: arraySize,

    string: (x: string): number[] => [x.length],

    // scalar
    'number | Complex | BigNumber | Unit | boolean | null': (_x: unknown): number[] => [],
  });

  const sizeOf = (x: unknown): number[] => {
    const native = nativeMatrixDims(x);
    if (native) return native;
    return impl(x) as number[];
  };
  return Object.assign(sizeOf, impl);
});
