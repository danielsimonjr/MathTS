/**
 * Cubic-Hermite dense interpolation of the state on an accepted step `[ta, tb]`,
 * using the endpoint states `ya`, `yb` and endpoint derivatives
 * `fa = f(ta, ya)`, `fb = f(tb, yb)`. C¹ and O(h⁴) accurate, so an event root
 * located on it matches the true crossing to well under the solver `tol`.
 * Shared by `solveDDE` and `solveODE` (internal; not a public export).
 *
 * @param ta - Left endpoint of the step.
 * @param tb - Right endpoint of the step.
 * @param ya - State at `ta`.
 * @param yb - State at `tb`.
 * @param fa - Derivative at `ta`.
 * @param fb - Derivative at `tb`.
 * @param t - Query time in `[ta, tb]` (or either side; `h === 0` yields `ya`).
 * @returns Interpolated state at `t`.
 *
 * @example
 * // y(t)=t³ on [0,1]: ya=0, yb=1, fa=0, fb=3 → midpoint 0.125
 * hermiteCubic(0, 1, [0], [1], [0], [3], 0.5) // [0.125]
 */
export function hermiteCubic(
  ta: number,
  tb: number,
  ya: number[],
  yb: number[],
  fa: number[],
  fb: number[],
  t: number
): number[] {
  const h = tb - ta;
  const theta = h === 0 ? 0 : (t - ta) / h;
  const th2 = theta * theta;
  const th3 = th2 * theta;
  const h00 = 2 * th3 - 3 * th2 + 1;
  const h10 = th3 - 2 * th2 + theta;
  const h01 = -2 * th3 + 3 * th2;
  const h11 = th3 - th2;
  return ya.map((_, i) => h00 * ya[i] + h10 * h * fa[i] + h01 * yb[i] + h11 * h * fb[i]);
}
