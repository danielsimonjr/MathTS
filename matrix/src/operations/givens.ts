/**
 * Givens rotation on matrix columns (shared by Schur and SVD).
 */

/**
 * Apply a Givens rotation to columns `i` and `k` for rows `[rowStart, rowEnd)`.
 * Updates `A` in place: `A[j][i] = c*A[j][i] - s*A[j][k]`, `A[j][k] = s*A[j][i] + c*A[j][k]`.
 */
export function applyGivensCols(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  rowStart: number,
  rowEnd: number
): void {
  for (let j = rowStart; j < rowEnd; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

/** Right application on all rows from `startRow` through the last row. */
export function applyGivensRight(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  startRow: number
): void {
  applyGivensCols(A, c, s, i, k, startRow, A.length);
}
