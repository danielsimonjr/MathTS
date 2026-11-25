import { factory } from '../../../utils/factory.js';
import type {
  DataType,
  MatrixValue,
  MatrixCallback,
  TypedFunction,
  SparseMatrixConstructorData,
} from '../types.js';

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
  createSparseMatrix(data: SparseMatrixConstructorData): SparseMatrix;
  /** The zero value of the matrix's datatype (mathjs 15.3.0 SparseMatrix API). */
  zero?: MatrixValue;
  /** The zero test for the matrix's datatype. */
  isZero(value: MatrixValue): boolean;
  /** The full typed-function `isZero`, whatever the matrix datatype. */
  isZero_Full(value: MatrixValue): boolean;
}

const name = 'matAlgo11xS0s';
const dependencies = ['typed'];

export const createMatAlgo11xS0s = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: { typed: TypedFunction }) => {
    /**
     * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b).
     * Callback function invoked NZ times (number of nonzero items in S).
     *
     *
     *          ┌  f(Sij, b)  ; S(i,j) !== 0
     * C(i,j) = ┤
     *          └  0          ; otherwise
     *
     *
     * @param {Matrix}   s                 The SparseMatrix instance (S)
     * @param {Scalar}   b                 The Scalar value
     * @param {Function} callback          The f(Aij,b) operation to invoke
     * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
     *
     * @return {Matrix}                    SparseMatrix (C)
     *
     * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
     */
    return function matAlgo11xS0s(
      s: SparseMatrix,
      b: MatrixValue,
      callback: MatrixCallback,
      inverse: boolean
    ): SparseMatrix {
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
      // isZero signature to use
      let isZ: (value: MatrixValue) => boolean = (v) => s.isZero(v);
      // callback signature to use
      let cf: MatrixCallback = callback;

      // process data types
      if (typeof adt === 'string') {
        // datatype
        dt = adt;
        // resolve the callback against the scalar zero of the matrix datatype
        cf = (inverse
          ? typed.resolve(callback as never, [b, s.zero])
          : typed.resolve(callback as never, [s.zero, b])
        )?.implementation as unknown as MatrixCallback;
        if (cf === undefined || cf === null) cf = callback;
      }

      // result arrays
      const cvalues: MatrixValue[] = [];
      const cindex: number[] = [];
      const cptr: number[] = [];

      // loop columns
      for (let j = 0; j < columns; j++) {
        // initialize ptr
        cptr[j] = cindex.length;
        // values in j
        for (let k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
          // row
          const i = aindex[k];
          // invoke callback
          const v = inverse ? cf(b, avalues[k]) : cf(avalues[k], b);
          // check value is zero
          if (!isZ(v)) {
            // push index & value
            cindex.push(i);
            cvalues.push(v);
          }
        }
      }
      // update ptr
      cptr[columns] = cindex.length;

      // return sparse matrix
      return s.createSparseMatrix({
        values: cvalues,
        index: cindex,
        ptr: cptr,
        size: [rows, columns],
        datatype: dt,
      });
    };
  }
);
