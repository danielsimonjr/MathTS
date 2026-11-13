import type { Matrix } from '../Matrix.js';

/**
 * The private storage fields of `DenseMatrix` that the in-package kernels read.
 * Declared structurally so the kernels under `dense/` never import
 * `DenseMatrix.ts` (which imports them): no runtime import cycle.
 */
export type DenseStorage = {
  isView: boolean;
  offset: number;
  rowStride: number;
  rows: number;
  cols: number;
  data: Float64Array;
  toFlatFloat64Array(): Float64Array;
};

function isDenseStorage(m: unknown): m is DenseStorage {
  const s = m as Partial<DenseStorage> | null;
  return (
    typeof s === 'object' &&
    s !== null &&
    s.data instanceof Float64Array &&
    typeof s.isView === 'boolean' &&
    typeof s.offset === 'number' &&
    typeof s.rowStride === 'number' &&
    typeof s.toFlatFloat64Array === 'function'
  );
}

/** Read-only operations on a `DenseMatrix`. It exposes no storage, so a caller cannot write to the matrix. */
export interface DenseReader {
  readonly rows: number;
  readonly cols: number;
  /** A fresh row-major nested copy, transposed when `transpose` is true. */
  copyRows(transpose: boolean): number[][];
  /** The sum of squares of all entries, summed in row-major order. */
  sumOfSquares(): number;
}

/**
 * A read-only reader for a `DenseMatrix`, or `null` for any other matrix type.
 * It reads through `offset` and `rowStride`, so a view is read in place.
 */
export function denseReader(matrix: Matrix<number>): DenseReader | null {
  if (!isDenseStorage(matrix)) return null;
  const { rows, cols, data, offset, rowStride } = matrix;
  return {
    rows,
    cols,
    copyRows(transpose: boolean): number[][] {
      if (!transpose) {
        const out = new Array<number[]>(rows);
        for (let i = 0; i < rows; i++) {
          const base = offset + i * rowStride;
          const row = new Array<number>(cols);
          for (let j = 0; j < cols; j++) row[j] = data[base + j];
          out[i] = row;
        }
        return out;
      }
      const out = new Array<number[]>(cols);
      for (let j = 0; j < cols; j++) {
        const row = new Array<number>(rows);
        for (let i = 0; i < rows; i++) row[i] = data[offset + i * rowStride + j];
        out[j] = row;
      }
      return out;
    },
    sumOfSquares(): number {
      let sum = 0;
      for (let i = 0; i < rows; i++) {
        const base = offset + i * rowStride;
        for (let j = 0; j < cols; j++) {
          const v = data[base + j];
          sum += v * v;
        }
      }
      return sum;
    },
  };
}

/**
 * Row-major Float64 storage of a matrix for in-package kernels.
 * Returns the backing array when the matrix is a contiguous `DenseMatrix`
 * (no view, offset 0, row stride equal to the column count), a copy for a
 * strided `DenseMatrix` view, and `null` for any other matrix type.
 * Callers must treat the result as read-only.
 */
export function contiguousDenseData(matrix: Matrix<number>): Float64Array | null {
  if (!isDenseStorage(matrix)) return null;
  if (!matrix.isView && matrix.offset === 0 && matrix.rowStride === matrix.cols) {
    return matrix.data;
  }
  return matrix.toFlatFloat64Array();
}
