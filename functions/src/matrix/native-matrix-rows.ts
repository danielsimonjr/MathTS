import {
  decompositionInputToNestedArray,
  isDenseMatrix,
  isSparseMatrix,
  type DenseMatrix,
  type SparseMatrix,
} from '@danielsimonjr/mathts-matrix';

/** An existing row-array input or its native dense or sparse representation. */
export type NativeMatrixInput<Rows> = Rows | DenseMatrix | SparseMatrix;

/**
 * Read native matrices through the package's numeric row reader.
 * Keep existing row-array inputs by identity, including ragged arrays in APIs that accept them.
 */
export function nativeMatrixRows<Rows>(input: NativeMatrixInput<Rows>): Rows | number[][] {
  if (isDenseMatrix(input) || isSparseMatrix(input)) {
    return decompositionInputToNestedArray(input);
  }
  return input;
}
