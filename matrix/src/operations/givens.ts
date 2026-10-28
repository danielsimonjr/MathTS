/**
 * Givens rotation on matrix columns (shared by Schur and SVD).
 */

/**
 * Cosine/sine pair for a Givens rotation that zeroes the second component when
 * applied as `[c, -s; s, c] · [a; b] = [c·a − s·b; 0]`. This is the same `(c, s)`
 * convention as `applyGivensCols` / `applyGivensLeft` (`temp = c*x - s*y`).
 * Shared by Schur and Golub–Kahan SVD. Sign of `c`/`s` (including a negative
 * hypot) is part of the contract — a flip would change every Schur and SVD result.
 */
export function givensRotation(a: number, b: number): { c: number; s: number } {
  if (b === 0) return { c: 1, s: 0 };
  if (Math.abs(b) > Math.abs(a)) {
    const t = -a / b;
    const s = 1 / Math.sqrt(1 + t * t);
    return { c: s * t, s };
  }
  const t = -b / a;
  const c = 1 / Math.sqrt(1 + t * t);
  return { c, s: c * t };
}

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
