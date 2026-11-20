/**
 * Safety factor on `n * eps` in {@link pivotTolerance}.
 *
 * The value 8 comes from a measurement on 9,000 systems of order 2 to 12, judged against an
 * exact rational solution. With 8, 21 systems returned an answer with no correct digit (10 of
 * those matrices were exactly singular), and the test refused 2 of 550 systems of condition
 * number 1e12. With 4 the first count is 38. With 16 the counts are 8 and 5. A fixed floor of
 * 1e-15 (4.5 eps) gave 234.
 */
export const PIVOT_EPS_FACTOR = 8;

/**
 * Pivot floor of an `n x n` system: `PIVOT_EPS_FACTOR * n * eps`. It is relative to the
 * cancellation scale of the pivot (see {@link isBadLuFactorPivot}). `linsolve` and `lusolve`
 * share it. It has the form of the singular-value cutoff of `rank` (`max(m, n) * eps`): the
 * rounding residue of a pivot that should be zero grows with the number of terms.
 */
export function pivotTolerance(n: number): number {
  return PIVOT_EPS_FACTOR * n * Number.EPSILON;
}

export const LUSOLVE_SINGULAR_MESSAGE = 'Linear system cannot be solved since matrix is singular';

/**
 * After LU: a numeric pivot is unusable when it is non-finite, exact zero, or below
 * `pivotTolerance(n)` times `cancelScale`.
 *
 * `cancelScale` is the largest term that the elimination subtracted from the pivot entry:
 * `max over k < i of |L[i][k] * U[k][i]|`. The rounding error of the pivot is about eps times
 * that term, so a smaller pivot holds no digits (a rank-deficient matrix leaves such a pivot).
 * A pivot that no term cancelled is valid at any size (#1287): `diag(1e10, 1e-7)` is regular.
 * The test does not change when a row or a column of the matrix is multiplied by a constant.
 * Non-numbers (BigNumber, Fraction, Complex) are not judged here: substitution still handles
 * them.
 */
export function isBadLuFactorPivot(value: unknown, cancelScale: number, n = 1): boolean {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value) || value === 0) return true;
  return Math.abs(value) < pivotTolerance(n) * cancelScale;
}
