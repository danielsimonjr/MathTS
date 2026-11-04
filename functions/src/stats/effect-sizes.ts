/**
 * Standardized effect sizes (gap-analysis 2026-11-04, Batch A).
 */
type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const meanOf = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
const varOf = (a: number[]): number => {
  const m = meanOf(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};

/** Cohen's d with the pooled (ddof 1) standard deviation. */
export function cohensD(a: Vec, b: Vec): number {
  const xa = arr(a);
  const xb = arr(b);
  const n1 = xa.length;
  const n2 = xb.length;
  const pooled = ((n1 - 1) * varOf(xa) + (n2 - 1) * varOf(xb)) / (n1 + n2 - 2);
  return (meanOf(xa) - meanOf(xb)) / Math.sqrt(pooled);
}

/** Hedges' g: Cohen's d with the small-sample correction 1 − 3/(4(n₁+n₂) − 9). */
export function hedgesG(a: Vec, b: Vec): number {
  const n = arr(a).length + arr(b).length;
  return cohensD(a, b) * (1 - 3 / (4 * n - 9));
}

/** Glass's Δ: (mean a − mean b) / sd(b). */
export function glassDelta(a: Vec, b: Vec): number {
  const xb = arr(b);
  return (meanOf(arr(a)) - meanOf(xb)) / Math.sqrt(varOf(xb));
}

/** η² = SS_between / SS_total across groups. */
export function etaSquared(groups: readonly Vec[]): number {
  const gs = groups.map(arr);
  const all = gs.flat();
  const grand = meanOf(all);
  let ssBetween = 0;
  for (const g of gs) ssBetween += g.length * (meanOf(g) - grand) ** 2;
  const ssTotal = all.reduce((s, v) => s + (v - grand) ** 2, 0);
  return ssBetween / ssTotal;
}

/**
 * Rank-biserial correlation r = 2U_a/(n₁n₂) − 1, where U_a counts pairs with
 * aᵢ > bⱼ (ties count ½). r is positive when a tends to exceed b, so its sign
 * is opposite to `cohensD(a, b)`'s convention only in magnitude form; it equals
 * 1 − 2U_b/(n₁n₂) with U_b = n₁n₂ − U_a.
 */
export function rankBiserial(a: Vec, b: Vec): number {
  const xa = arr(a);
  const xb = arr(b);
  if (xa.length === 0 || xb.length === 0) throw new RangeError('rankBiserial: empty sample');
  let u = 0;
  for (const av of xa) {
    for (const bv of xb) {
      if (av > bv) u += 1;
      else if (av === bv) u += 0.5;
    }
  }
  return (2 * u) / (xa.length * xb.length) - 1;
}
