import { factory } from '../../../utils/factory.js';
import { DimensionError } from '../../../error/DimensionError.js';
import type {
  DataType,
  MatrixValue,
  MatrixArray,
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
  _data?: MatrixArray;
  _datatype?: DataType;
  getDataType(): string;
  /** The zero value of the matrix's datatype (mathjs 15.3.0 SparseMatrix API). */
  zero?: MatrixValue;
  /** The zero test for the matrix's datatype. */
  isZero(value: MatrixValue): boolean;
  /** The full typed-function `isZero`, whatever the matrix datatype. */
  isZero_Full(value: MatrixValue): boolean;
}

/**
 * SparseMatrix constructor interface for creating new sparse matrices.
 */
interface SparseMatrixConstructor {
  new (config: SparseMatrixConstructorData): SparseMatrix;
}

const name = 'matAlgo07xSSf';
const dependencies = ['typed', 'SparseMatrix'];

export const createMatAlgo07xSSf = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, SparseMatrix }: { typed: TypedFunction; SparseMatrix: SparseMatrixConstructor }) => {
    /**
     * Iterates over SparseMatrix A and SparseMatrix B items (zero and nonzero) and invokes the callback function f(Aij, Bij).
     * Callback function invoked MxN times.
     *
     * C(i,j) = f(Aij, Bij)
     *
     * @param {Matrix}   a                 The SparseMatrix instance (A)
     * @param {Matrix}   b                 The SparseMatrix instance (B)
     * @param {Function} callback          The f(Aij,Bij) operation to invoke
     *
     * @return {Matrix}                    SparseMatrix (C)
     *
     * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97620294
     */
    return function matAlgo07xSSf(
      a: SparseMatrix,
      b: SparseMatrix,
      callback: MatrixCallback
    ): SparseMatrix {
      // sparse matrix arrays
      const asize: number[] = a._size;
      const adt: DataType = a._datatype || a._data === undefined ? a._datatype : a.getDataType();
      const bsize: number[] = b._size;
      const bdt: DataType = b._datatype || b._data === undefined ? b._datatype : b.getDataType();

      // validate dimensions
      if (asize.length !== bsize.length) {
        throw new DimensionError(asize.length, bsize.length);
      }
      if (asize[0] !== bsize[0] || asize[1] !== bsize[1]) {
        throw new RangeError(
          'Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')'
        );
      }

      // rows & columns
      const rows: number = asize[0];
      const columns: number = asize[1];

      // datatype
      let dt: DataType;
      let zero: MatrixValue = 0;
      let cf: MatrixCallback = callback;

      // process data types
      if (typeof adt === 'string' && adt === bdt && adt !== 'mixed') {
        dt = adt;
        if (dt === a._datatype) {
          zero = a.zero as MatrixValue;
        } else if (dt === b._datatype) {
          zero = b.zero as MatrixValue;
        } else {
          zero = typed.convert(0, dt) as MatrixValue;
        }
      }
      // find callback signature
      if (
        typeof adt === 'string' &&
        adt !== 'mixed' &&
        typeof bdt === 'string' &&
        bdt !== 'mixed'
      ) {
        cf = typed.find(callback, [adt, bdt]) as unknown as MatrixCallback;
      }

      // isZero signature to use (#1582: `!== 0` kept BigNumber/Fraction/Unit zeros)
      let isZ: (value: MatrixValue) => boolean = (v) => a.isZero_Full(v);
      if (typeof adt === 'string' && adt !== 'mixed') {
        isZ = (v) => a.isZero(v);
      } else if (typeof bdt === 'string' && bdt !== 'mixed') {
        isZ = (v) => b.isZero(v);
      }

      // result arrays for sparse format
      const cvalues: MatrixValue[] = [];
      const cindex: number[] = [];
      const cptr: number[] = new Array(columns + 1).fill(0); // Start with column pointer array

      // workspaces
      const xa: MatrixValue[] = [];
      const xb: MatrixValue[] = [];
      const wa: number[] = [];
      const wb: number[] = [];

      // loop columns
      for (let j = 0; j < columns; j++) {
        const mark: number = j + 1;
        let nonZeroCount: number = 0;

        _scatter(a, j, wa, xa, mark);
        _scatter(b, j, wb, xb, mark);

        // loop rows
        for (let i = 0; i < rows; i++) {
          const va: MatrixValue = wa[i] === mark ? xa[i] : zero;
          const vb: MatrixValue = wb[i] === mark ? xb[i] : zero;

          // invoke callback
          const cij: MatrixValue = cf(va, vb);
          // Store non-zero and true values (typed zeros use isZero, not `!== 0`)
          if (cij !== false && !isZ(cij)) {
            cindex.push(i); // row index
            cvalues.push(cij); // computed value
            nonZeroCount++;
          }
        }

        // Update column pointer with cumulative count of non-zero values
        cptr[j + 1] = cptr[j] + nonZeroCount;
      }

      // Return the result as a sparse matrix
      return new SparseMatrix({
        values: cvalues,
        index: cindex,
        ptr: cptr,
        size: [rows, columns],
        datatype: adt === a._datatype && bdt === b._datatype ? dt : undefined,
      });
    };

    function _scatter(
      m: SparseMatrix,
      j: number,
      w: number[],
      x: MatrixValue[],
      mark: number
    ): void {
      // a arrays
      const values: MatrixValue[] | undefined = m._values;
      const index: number[] = m._index;
      const ptr: number[] = m._ptr;
      // loop values in column j
      for (let k = ptr[j], k1 = ptr[j + 1]; k < k1; k++) {
        // row
        const i: number = index[k];
        // update workspace
        w[i] = mark;
        if (values) {
          x[i] = values[k];
        }
      }
    }
  }
);
