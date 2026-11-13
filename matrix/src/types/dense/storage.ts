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

/**
 * The storage of a `DenseMatrix` for in-package kernels, or `null` for any other
 * matrix type. Callers read `data` through `offset` and `rowStride`, so a view is
 * read in place. Callers must not write to it.
 */
export function denseStorage(matrix: Matrix<number>): DenseStorage | null {
  return isDenseStorage(matrix) ? matrix : null;
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
