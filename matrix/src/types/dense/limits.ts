/**
 * Preflight limits for dense matrix allocation (DoS guard).
 */

/** Maximum number of stored elements in a {@link DenseMatrix} (8-byte doubles → ~800 MiB at cap). */
export const DENSE_MATRIX_MAX_ELEMENTS = 100_000_000;

/**
 * Reject dimensions whose product overflows or exceeds {@link DENSE_MATRIX_MAX_ELEMENTS}
 * before `Float64Array` allocation.
 */
export function assertDenseMatrixSize(rows: number, cols: number): void {
  if (
    !Number.isFinite(rows) ||
    !Number.isFinite(cols) ||
    !Number.isInteger(rows) ||
    !Number.isInteger(cols)
  ) {
    throw new TypeError(`Matrix dimensions must be finite integers, got ${rows}×${cols}`);
  }
  if (rows < 0 || cols < 0) {
    throw new RangeError('Matrix dimensions must be non-negative');
  }
  // Compare against the cap by division so `rows * cols` cannot overflow to Infinity
  // and ask the engine for an invalid typed-array length.
  if (rows > 0 && cols > DENSE_MATRIX_MAX_ELEMENTS / rows) {
    throw new RangeError(
      `DenseMatrix too large (${rows}×${cols} exceeds limit of ${DENSE_MATRIX_MAX_ELEMENTS} elements)`
    );
  }
}
