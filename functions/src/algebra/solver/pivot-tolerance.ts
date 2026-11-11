/** Absolute pivot floor — matches `linsolve` (`typed/numeric.ts` `solvePivoted`). */
export const LU_PIVOT_TOL = 1e-15;

export const LUSOLVE_SINGULAR_MESSAGE = 'Linear system cannot be solved since matrix is singular';

/** After `lusolve`'s LU factorization: reject non-finite entries and tiny pivots. */
export function isBadLuFactorPivot(value: unknown, tol: number = LU_PIVOT_TOL): boolean {
  return typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) < tol;
}

/**
 * During `usolve` substitution: reject a zero/tiny **finite** pivot (including when the
 * RHS is zero). Non-finite pivots are left to divideScalar so direct `usolve` stays
 * bit-exact on NaN/±Infinity (P7 number-path contract).
 */
export function isSingularSubstitutionPivot(value: unknown, tol: number = LU_PIVOT_TOL): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < tol;
}
