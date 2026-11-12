/**
 * Unit-scale pivot floor — the same absolute cutoff `linsolve` uses on an O(1) matrix
 * (`typed/numeric.ts` `solvePivoted`). Applied as `|U_ii| < LU_PIVOT_TOL * scale`
 * where `scale` is the max absolute entry of the factor, so a well-conditioned
 * matrix that is only small (or only large) is not judged singular.
 */
export const LU_PIVOT_TOL = 1e-15;

export const LUSOLVE_SINGULAR_MESSAGE = 'Linear system cannot be solved since matrix is singular';

/**
 * After LU: a numeric pivot is unusable when it is non-finite, exact zero, or tiny
 * relative to `scale` (max |entry| of the factor). Non-numbers (BigNumber, Fraction,
 * Complex) are not judged here — substitution still handles them.
 */
export function isBadLuFactorPivot(value: unknown, scale: number): boolean {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value) || value === 0) return true;
  return Math.abs(value) < LU_PIVOT_TOL * scale;
}
