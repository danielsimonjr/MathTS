import { isArray, isMatrix, isDenseMatrix, isSparseMatrix } from '../../../utils/is.js';
import { arraySize } from '../../../utils/array.js';
import { format } from '../../../utils/string.js';

// Type definitions
interface DenseMatrixType {
  type: 'DenseMatrix';
  isDenseMatrix: true;
  _data: unknown[][];
  _size: number[];
  _datatype?: string;
  size(): number[];
}

interface SparseMatrixType {
  type: 'SparseMatrix';
  isSparseMatrix: true;
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  size(): number[];
}

interface DenseMatrixConstructor {
  new (data: { data: unknown[][]; size: number[]; datatype?: string }): DenseMatrixType;
}

interface SolveValidationDependencies {
  DenseMatrix: DenseMatrixConstructor;
}

/** Runtime access to a matrix's internal fields (after an isMatrix narrowing) */
interface MatrixInternal {
  size(): number[];
  _data?: unknown[];
  _datatype?: string;
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
}

export function createSolveValidation({ DenseMatrix }: SolveValidationDependencies) {
  /**
   * Validates matrix and column vector b for backward/forward substitution algorithms.
   *
   * @param {Matrix} m            An N x N matrix
   * @param {Array | Matrix} b    A column vector
   * @param {Boolean} copy        Return a copy of vector b
   *
   * @return {DenseMatrix}        Dense column vector b
   */
  return function solveValidation(
    m: DenseMatrixType | SparseMatrixType,
    b: unknown[][] | DenseMatrixType | SparseMatrixType,
    copy?: boolean
  ): DenseMatrixType {
    const mSize = m.size();

    if (mSize.length !== 2) {
      throw new RangeError('Matrix must be two dimensional (size: ' + format(mSize, {}) + ')');
    }

    const rows = mSize[0];
    const columns = mSize[1];

    if (rows !== columns) {
      throw new RangeError('Matrix must be square (size: ' + format(mSize, {}) + ')');
    }

    let data: unknown[][] = [];

    if (isMatrix(b)) {
      const bm = b as unknown as MatrixInternal;
      const bSize = bm.size();
      const bdata = bm._data as unknown[];

      // 1-dim vector
      if (bSize.length === 1) {
        if (bSize[0] !== rows) {
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        }

        for (let i = 0; i < rows; i++) {
          data[i] = [bdata[i]];
        }

        return new DenseMatrix({
          data,
          size: [rows, 1],
          datatype: bm._datatype,
        });
      }

      // 2-dim column
      if (bSize.length === 2) {
        if (bSize[0] !== rows || bSize[1] !== 1) {
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        }

        if (isDenseMatrix(b)) {
          if (copy) {
            data = [];

            for (let i = 0; i < rows; i++) {
              data[i] = [(bdata[i] as unknown[])[0]];
            }

            return new DenseMatrix({
              data,
              size: [rows, 1],
              datatype: bm._datatype,
            });
          }

          return b as unknown as DenseMatrixType;
        }

        if (isSparseMatrix(b)) {
          for (let i = 0; i < rows; i++) {
            data[i] = [0];
          }

          const values = bm._values!;
          const index = bm._index!;
          const ptr = bm._ptr!;

          for (let k1 = ptr[1], k = ptr[0]; k < k1; k++) {
            const i = index[k];
            (data[i] as unknown[])[0] = values[k];
          }

          return new DenseMatrix({
            data,
            size: [rows, 1],
            datatype: bm._datatype,
          });
        }
      }

      throw new RangeError(
        'Dimension mismatch. The right side has to be either 1- or 2-dimensional vector.'
      );
    }

    if (isArray(b)) {
      const bsize = arraySize(b);

      if (bsize.length === 1) {
        if (bsize[0] !== rows) {
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        }

        for (let i = 0; i < rows; i++) {
          data[i] = [b[i]];
        }

        return new DenseMatrix({
          data,
          size: [rows, 1],
        });
      }

      if (bsize.length === 2) {
        if (bsize[0] !== rows || bsize[1] !== 1) {
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        }

        for (let i = 0; i < rows; i++) {
          data[i] = [(b[i] as unknown[])[0]];
        }

        return new DenseMatrix({
          data,
          size: [rows, 1],
        });
      }

      throw new RangeError(
        'Dimension mismatch. The right side has to be either 1- or 2-dimensional vector.'
      );
    }

    // Unreachable: `b` is always a Matrix or Array per the parameter type.
    throw new TypeError('Unexpected type of right-hand side; expected Matrix or Array.');
  };
}
