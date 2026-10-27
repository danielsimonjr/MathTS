/**
 * Cubic-Hermite interpolation on `[ta, tb]` (internal; shared by DDE/ODE solvers).
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
