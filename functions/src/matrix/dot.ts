import { factory } from '../utils/factory.js';
import { isMatrix } from '../utils/is.js';
import { pairwiseDot } from '@danielsimonjr/mathts-core';
import type { TypedFunction } from '../core/function/typed.js';

/** A scalar implementation resolved from a typed-function (e.g. via typed.find) */
type ScalarFn = (...args: unknown[]) => unknown;

/** True when every element is a plain JS number (so pairwiseDot's real arithmetic applies). */
function _isFlatNumbers(arr: unknown[]): arr is number[] {
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') return false;
  }
  return true;
}

interface DenseMatrix {
  _data: unknown[] | unknown[][];
  _size: number[];
  _datatype?: string;
  storage(): 'dense';
  size(): number[];
  getDataType(): string;
  valueOf(): unknown[] | unknown[][];
}

interface SparseMatrix {
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  _data?: unknown;
  storage(): 'sparse';
  size(): number[];
  getDataType(): string;
  valueOf(): unknown[] | unknown[][];
}

type Matrix = DenseMatrix | SparseMatrix;

interface Dependencies {
  typed: TypedFunction;
  addScalar: TypedFunction;
  multiplyScalar: TypedFunction;
  conj: TypedFunction;
  size: TypedFunction;
}

const name = 'dot';
const dependencies = ['typed', 'addScalar', 'multiplyScalar', 'conj', 'size'];

export const createDot = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, addScalar, multiplyScalar, conj, size }: Dependencies) => {
    /**
     * Calculate the dot product of two vectors. The dot product of
     * `A = [a1, a2, ..., an]` and `B = [b1, b2, ..., bn]` is defined as:
     *
     *    dot(A, B) = conj(a1) * b1 + conj(a2) * b2 + ... + conj(an) * bn
     *
     * Syntax:
     *
     *    math.dot(x, y)
     *
     * Examples:
     *
     *    math.dot([2, 4, 1], [2, 2, 3])       // returns number 15
     *    math.multiply([2, 4, 1], [2, 2, 3])  // returns number 15
     *
     * See also:
     *
     *    multiply, cross
     *
     * @param  {Array | Matrix} x     First vector
     * @param  {Array | Matrix} y     Second vector
     * @return {number}               Returns the dot product of `x` and `y`
     */
    return typed(name, {
      'Array | DenseMatrix, Array | DenseMatrix': _denseDot,
      'SparseMatrix, SparseMatrix': _sparseDot,
    });

    /**
     * Validate dimensions of vectors for dot product
     * @param x - First vector
     * @param y - Second vector
     * @returns Length of vectors
     */
    function _validateDim(x: unknown[] | Matrix, y: unknown[] | Matrix): number {
      const xSize = _size(x);
      const ySize = _size(y);
      let xLen: number, yLen: number;

      if (xSize.length === 1) {
        xLen = xSize[0];
      } else if (xSize.length === 2 && xSize[1] === 1) {
        xLen = xSize[0];
      } else {
        throw new RangeError(
          'Expected a column vector, instead got a matrix of size (' + xSize.join(', ') + ')'
        );
      }

      if (ySize.length === 1) {
        yLen = ySize[0];
      } else if (ySize.length === 2 && ySize[1] === 1) {
        yLen = ySize[0];
      } else {
        throw new RangeError(
          'Expected a column vector, instead got a matrix of size (' + ySize.join(', ') + ')'
        );
      }

      if (xLen !== yLen)
        throw new RangeError('Vectors must have equal length (' + xLen + ' != ' + yLen + ')');
      if (xLen === 0) throw new RangeError('Cannot calculate the dot product of empty vectors');

      return xLen;
    }

    /**
     * Calculate dot product for dense matrices/arrays
     * @param a - First dense matrix or array
     * @param b - Second dense matrix or array
     * @returns Dot product result
     */
    function _denseDot(a: unknown[] | DenseMatrix, b: unknown[] | DenseMatrix): unknown {
      const N = _validateDim(a, b);

      const adata = isMatrix(a) ? (a as DenseMatrix)._data : a;
      const adt = isMatrix(a)
        ? (a as DenseMatrix)._datatype || (a as DenseMatrix).getDataType()
        : undefined;

      const bdata = isMatrix(b) ? (b as DenseMatrix)._data : b;
      const bdt = isMatrix(b)
        ? (b as DenseMatrix)._datatype || (b as DenseMatrix).getDataType()
        : undefined;

      // are these 2-dimensional column vectors? (as opposed to 1-dimensional vectors)
      const aIsColumn = _size(a).length === 2;
      const bIsColumn = _size(b).length === 2;

      let add: ScalarFn = addScalar;
      let mul: ScalarFn = multiplyScalar;

      // process data types
      if (adt && bdt && adt === bdt && typeof adt === 'string' && adt !== 'mixed') {
        const dt = adt;
        // find signatures that matches (dt, dt)
        add = typed.find(addScalar, [dt, dt]);
        mul = typed.find(multiplyScalar, [dt, dt]);
      }

      // Plain 1-D numeric vectors with no datatype override: pairwise-accurate dot. conj/mul/add
      // are identity/×/+ on reals, so this equals the loop below but sums the products pairwise,
      // matching the typed `dot` (naive left-to-right was ~18× worse than np.dot).
      if (
        !aIsColumn &&
        !bIsColumn &&
        add === addScalar &&
        mul === multiplyScalar &&
        _isFlatNumbers(adata as unknown[]) &&
        _isFlatNumbers(bdata as unknown[])
      ) {
        return pairwiseDot(adata as number[], bdata as number[]);
      }

      // both vectors 1-dimensional
      if (!aIsColumn && !bIsColumn) {
        let c = mul(conj((adata as unknown[])[0]), (bdata as unknown[])[0]);
        for (let i = 1; i < N; i++) {
          c = add(c, mul(conj((adata as unknown[])[i]), (bdata as unknown[])[i]));
        }
        return c;
      }

      // a is 1-dim, b is column
      if (!aIsColumn && bIsColumn) {
        let c = mul(conj((adata as unknown[])[0]), (bdata as unknown[][])[0][0]);
        for (let i = 1; i < N; i++) {
          c = add(c, mul(conj((adata as unknown[])[i]), (bdata as unknown[][])[i][0]));
        }
        return c;
      }

      // a is column, b is 1-dim
      if (aIsColumn && !bIsColumn) {
        let c = mul(conj((adata as unknown[][])[0][0]), (bdata as unknown[])[0]);
        for (let i = 1; i < N; i++) {
          c = add(c, mul(conj((adata as unknown[][])[i][0]), (bdata as unknown[])[i]));
        }
        return c;
      }

      // both vectors are column
      {
        let c = mul(conj((adata as unknown[][])[0][0]), (bdata as unknown[][])[0][0]);
        for (let i = 1; i < N; i++) {
          c = add(c, mul(conj((adata as unknown[][])[i][0]), (bdata as unknown[][])[i][0]));
        }
        return c;
      }
    }

    /**
     * Calculate dot product for sparse matrices
     * @param x - First sparse matrix
     * @param y - Second sparse matrix
     * @returns Dot product result
     */
    function _sparseDot(x: SparseMatrix, y: SparseMatrix): unknown {
      _validateDim(x, y);

      const xindex = x._index!;
      const xvalues = x._values!;

      const yindex = y._index!;
      const yvalues = y._values!;

      // TODO optimize add & mul using datatype
      let c: unknown = 0;
      const add: ScalarFn = addScalar;
      const mul: ScalarFn = multiplyScalar;

      let i = 0;
      let j = 0;
      while (i < xindex.length && j < yindex.length) {
        const I = xindex[i];
        const J = yindex[j];

        if (I < J) {
          i++;
          continue;
        }
        if (I > J) {
          j++;
          continue;
        }
        if (I === J) {
          c = add(c, mul(xvalues[i], yvalues[j]));
          i++;
          j++;
        }
      }

      return c;
    }

    // TODO remove this once #1771 is fixed
    /**
     * Get size of matrix or array
     * @param x - Matrix or array
     * @returns Size array
     */
    function _size(x: unknown[] | Matrix): number[] {
      return isMatrix(x) ? (x as Matrix).size() : (size(x) as number[]);
    }
  }
);
