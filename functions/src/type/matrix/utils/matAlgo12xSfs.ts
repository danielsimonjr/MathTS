import { factory } from '../../../utils/factory.js';
import { createMatAlgo11xS0s } from './matAlgo11xS0s.js';
import type {
  DataType,
  MatrixValue,
  MatrixArray,
  MatrixCallback,
  TypedFunction,
  DenseMatrixConstructorData,
} from '../types.js';

/**
 * DenseMatrix interface for algorithm operations.
 * Note: This algorithm only operates on 2D matrices, so we use MatrixArray (T[][]).
 */
interface DenseMatrix {
  _data: MatrixArray;
  _size: [number, number];
  _datatype?: DataType;
}

/**
 * DenseMatrix constructor interface for creating new dense matrices.
 */
interface DenseMatrixConstructor {
  new (data: DenseMatrixConstructorData): DenseMatrix;
}

/**
 * SparseMatrix interface for algorithm operations.
 * Note: SparseMatrix is always 2D.
 */
interface SparseMatrix {
  _values?: MatrixValue[];
  _index: number[];
  _ptr: number[];
  _size: [number, number];
  _datatype?: DataType;
  /** The zero value of the matrix's datatype (mathjs 15.3.0 SparseMatrix API). */
  zero?: MatrixValue;
  /** The zero test for the matrix's datatype. */
  isZero(value: MatrixValue): boolean;
  /** The full typed-function `isZero`, whatever the matrix datatype. */
  isZero_Full(value: MatrixValue): boolean;
}

const name = 'matAlgo12xSfs';
const dependencies = ['typed', 'DenseMatrix'];

export const createMatAlgo12xSfs = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, DenseMatrix }: { typed: TypedFunction; DenseMatrix: DenseMatrixConstructor }) => {
    const matAlgo11xS0s = createMatAlgo11xS0s({ typed });
    /**
     * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b).
     * Callback function invoked MxN times.
     *
     *
     *          ┌  f(Sij, b)  ; S(i,j) !== 0
     * C(i,j) = ┤
     *          └  f(0, b)    ; otherwise
     *
     *
     * @param {Matrix}   s                 The SparseMatrix instance (S)
     * @param {Scalar}   b                 The Scalar value
     * @param {Function} callback          The f(Aij,b) operation to invoke
     * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
     *
     * @return {Matrix}                    DenseMatrix (C)
     *
     * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
     */
    return function matAlgo12xSfs(
      s: SparseMatrix,
      b: MatrixValue,
      callback: MatrixCallback,
      inverse: boolean
    ): DenseMatrix | SparseMatrix {
      // sparse matrix arrays
      const avalues = s._values;
      const aindex = s._index;
      const aptr = s._ptr;
      const asize = s._size;
      const adt: DataType = s._datatype;

      // sparse matrix cannot be a Pattern matrix
      if (!avalues) {
        throw new Error('Cannot perform operation on Pattern Sparse Matrix and Scalar value');
      }

      // rows & columns
      const rows = asize[0];
      const columns = asize[1];

      // datatype
      let dt: DataType;
      // callback signature to use
      let cf: MatrixCallback = callback;

      // process data types
      if (typeof adt === 'string') {
        // datatype
        dt = adt;
        // resolve the callback against the scalar zero of the matrix datatype
        const resolved = (
          inverse
            ? typed.resolve(callback as never, [b, s.zero])
            : typed.resolve(callback as never, [s.zero, b])
        ) as { implementation: MatrixCallback } | null;
        if (resolved && resolved.implementation) cf = resolved.implementation;
      }

      // the value for all zero items of S
      const fzero: MatrixValue = inverse
        ? cf(b, s.zero as MatrixValue)
        : cf(s.zero as MatrixValue, b);

      // the zero items stay zero, so the result is sparse. A boolean result
      // stays dense, since false would become 0 in a sparse matrix (#1565)
      if (typeof fzero !== 'boolean' && s.isZero(fzero)) {
        return matAlgo11xS0s(
          s as Parameters<typeof matAlgo11xS0s>[0],
          b,
          callback,
          inverse
        ) as unknown as DenseMatrix;
      }

      // result arrays
      const cdata: MatrixArray = [];

      // workspaces
      const x: MatrixValue[] = [];
      // marks indicating we have a value in x for a given column
      const w: number[] = [];

      // loop columns
      for (let j = 0; j < columns; j++) {
        // columns mark
        const mark = j + 1;
        // values in j
        for (let k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
          // row
          const r = aindex[k];
          // update workspace
          x[r] = avalues[k];
          w[r] = mark;
        }
        // loop rows
        for (let i = 0; i < rows; i++) {
          // initialize C on first column
          if (j === 0) {
            // create row array
            cdata[i] = [];
          }
          // check sparse matrix has a value @ i,j
          if (w[i] === mark) {
            // invoke callback, update C
            cdata[i][j] = inverse ? cf(b, x[i]) : cf(x[i], b);
          } else {
            // dense matrix value @ i, j
            cdata[i][j] = fzero;
          }
        }
      }

      // return dense matrix
      return new DenseMatrix({
        data: cdata,
        size: [rows, columns],
        datatype: dt,
      });
    };
  }
);
