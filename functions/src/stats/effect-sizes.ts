/**
 * Standardized effect sizes (gap-analysis 2026-11-04, Batch A).
 */
import { divideByScale, scaleForVariance } from '@danielsimonjr/mathts-core';
import { hasNaN, numberVector } from '../typed/number-matrix.js';
type Vec = readonly number[] | Float64Array;

const meanOf = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
const varOf = (a: number[]): number => {
  const m = meanOf(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};

/**
 * The samples of one unit, divided by one exact power of 2 when `variance` is outside
 * `[2^-400, 2^400]` (#1280): the squares of the deviations then lose digits or leave the range.
 * Each effect size here does not change when the data is multiplied by a positive constant, so
 * the scale is not applied to the result. Samples inside the window are returned as they are, so
 * ordinary data keeps its plain path, bit for bit.
 *
 * @param variance - The variance of the data that the effect size squares.
 * @param samples - The samples of one unit.
 * @returns The samples, or the scaled copies.
 */
function unitScaled(variance: number, samples: number[][]): number[][] {
  const scale = scaleForVariance(variance, ...samples);
  return scale === 1 ? samples : samples.map((s) => divideByScale(s, scale));
}

/** The larger variance of two samples (a sample of one value has the variance 0). */
const largerVariance = (a: number[], b: number[]): number =>
  Math.max(a.length > 1 ? varOf(a) : 0, b.length > 1 ? varOf(b) : 0);

/** Cohen's d with the pooled (ddof 1) standard deviation. */
export function cohensD(a: Vec, b: Vec): number {
  const ra = numberVector('cohensD', a);
  const rb = numberVector('cohensD', b);
  const [xa, xb] = unitScaled(largerVariance(ra, rb), [ra, rb]);
  const n1 = xa.length;
  const n2 = xb.length;
  if (n1 < 2 || n2 < 2) throw new RangeError('cohensD: each sample needs at least 2 values');
  const pooled = ((n1 - 1) * varOf(xa) + (n2 - 1) * varOf(xb)) / (n1 + n2 - 2);
  return (meanOf(xa) - meanOf(xb)) / Math.sqrt(pooled);
}

/** Hedges' g: Cohen's d with the small-sample correction 1 − 3/(4(n₁+n₂) − 9). */
export function hedgesG(a: Vec, b: Vec): number {
  const n = numberVector('hedgesG', a).length + numberVector('hedgesG', b).length;
  return cohensD(a, b) * (1 - 3 / (4 * n - 9));
}

/** Glass's Δ: (mean a − mean b) / sd(b). */
export function glassDelta(a: Vec, b: Vec): number {
  const ra = numberVector('glassDelta', a);
  const rb = numberVector('glassDelta', b);
  if (ra.length < 1 || rb.length < 2)
    throw new RangeError('glassDelta: needs a non-empty a and at least 2 values in b');
  // Only sd(b) squares the data. The scale comes from b alone: the variance of a is not read, so
  // a small b among an a of order 1 still gets its scale (#1280).
  const vb = varOf(rb);
  const scale = scaleForVariance(vb, rb);
  const sd = scale === 1 ? Math.sqrt(vb) : scale * Math.sqrt(varOf(divideByScale(rb, scale)));
  return (meanOf(ra) - meanOf(rb)) / sd;
}

/** η² = SS_between / SS_total across groups. */
export function etaSquared(groups: readonly Vec[]): number {
  const raw = groups.map((g) => numberVector('etaSquared', g));
  const rawAll = raw.flat();
  const gs = unitScaled(rawAll.length > 1 ? varOf(rawAll) : 0, raw);
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
  const xa = numberVector('rankBiserial', a);
  const xb = numberVector('rankBiserial', b);
  if (xa.length === 0 || xb.length === 0) throw new RangeError('rankBiserial: empty sample');
  if (hasNaN(xa) || hasNaN(xb)) return NaN;
  let u = 0;
  for (const av of xa) {
    for (const bv of xb) {
      if (av > bv) u += 1;
      else if (av === bv) u += 0.5;
    }
  }
  return (2 * u) / (xa.length * xb.length) - 1;
}
