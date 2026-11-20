/**
 * Pivot floor relative to the scale of the pivot row — the same factor `linsolve` uses
 * (`typed/numeric.ts` `solvePivoted`). Applied as `|U_ii| < LU_PIVOT_TOL * rowScale`
 * where `rowScale` is the scale of row `i` (see `validate-u-pivots.ts`), so a matrix that
 * is only small (or only large), or that has a small pivot in a small row, is not judged
 * singular.
 */
export const LU_PIVOT_TOL = 1e-15;

export const LUSOLVE_SINGULAR_MESSAGE = 'Linear system cannot be solved since matrix is singular';

/**
 * After LU: a numeric pivot is unusable when it is non-finite, exact zero, or tiny
 * relative to `rowScale`, the scale of its own row (#1287). A pivot is not compared with
 * the entries of other rows: the diagonal matrix `diag(1e10, 1e-7)` is regular.
 * Non-numbers (BigNumber, Fraction, Complex) are not judged here — substitution still
 * handles them.
 */
export function isBadLuFactorPivot(value: unknown, rowScale: number): boolean {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value) || value === 0) return true;
  return Math.abs(value) < LU_PIVOT_TOL * rowScale;
}
