/**
 * Matrix Type Exports
 * @packageDocumentation
 */

export { Matrix, isMatrix } from './Matrix.js';
export type {
  MatrixDimensions,
  MatrixIndex,
  SliceSpec,
  MatrixEntry,
  MatrixType,
} from './Matrix.js';

export { DenseMatrix, isDenseMatrix } from './DenseMatrix.js';
export { DENSE_MATRIX_MAX_ELEMENTS, assertDenseMatrixSize } from './dense/limits.js';

export { SparseMatrix, isSparseMatrix } from './SparseMatrix.js';
