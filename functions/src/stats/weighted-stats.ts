/**
 * Weighted descriptive statistics (gap-analysis 2026-11-04, Batch A).
 *
 * Weights are non-negative frequency-style weights. Zero-weight points never
 * contribute to a quantile.
 */
type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Validates matching lengths and weights; returns true when some weight is NaN. */
function checkWeights(x: number[], w: number[]): boolean {
  if (x.length !== w.length) throw new RangeError('weights must have the same length as x');
  let hasNaN = false;
  let total = 0;
  for (const wi of w) {
    if (Number.isNaN(wi)) {
      hasNaN = true;
      continue;
    }
    if (wi < 0) throw new RangeError('weights must be non-negative');
    total += wi;
  }
  if (!hasNaN && total === 0) throw new RangeError('weights must not sum to zero');
  return hasNaN;
}

/** Weighted arithmetic mean: Σwᵢxᵢ / Σwᵢ. */
export function weightedMean(x: Vec, w: Vec): number {
  const xs = arr(x);
  const ws = arr(w);
  if (checkWeights(xs, ws)) return NaN;
  let sw = 0;
  let swx = 0;
  for (let i = 0; i < xs.length; i++) {
    sw += ws[i];
    swx += ws[i] * xs[i];
  }
  return swx / sw;
}

/**
 * Weighted variance. `ddof: 0` (default) gives Σw(x−m)²/Σw; `ddof: 1` divides
 * by (Σw − 1), the frequency-weight unbiased form.
 */
export function weightedVariance(x: Vec, w: Vec, opts?: { ddof?: 0 | 1 }): number {
  const xs = arr(x);
  const ws = arr(w);
  if (checkWeights(xs, ws)) return NaN;
  const ddof = opts?.ddof ?? 0;
  const m = weightedMean(xs, ws);
  let sw = 0;
  let ss = 0;
  for (let i = 0; i < xs.length; i++) {
    sw += ws[i];
    ss += ws[i] * (xs[i] - m) ** 2;
  }
  const denom = ddof === 1 ? sw - 1 : sw;
  return denom <= 0 ? NaN : ss / denom;
}

/**
 * Weighted quantile, lower rule: sort by x and return the first value whose
 * cumulative weight reaches p·Σw. Points with zero weight are never returned
 * unless every weight is zero (which is rejected).
 */
export function weightedQuantile(x: Vec, w: Vec, p: number): number {
  const xs = arr(x);
  const ws = arr(w);
  if (!(p >= 0 && p <= 1)) throw new RangeError('p must be in [0, 1]');
  if (checkWeights(xs, ws)) return NaN;
  if (xs.length === 1) return xs[0];
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const total = ws.reduce((s, v) => s + v, 0);
  const target = p * total;
  let cum = 0;
  for (const i of order) {
    if (ws[i] === 0) continue;
    cum += ws[i];
    if (cum >= target) return xs[i];
  }
  return xs[order[order.length - 1]];
}

/** Weighted median (lower rule): `weightedQuantile(x, w, 0.5)`. */
export function weightedMedian(x: Vec, w: Vec): number {
  return weightedQuantile(x, w, 0.5);
}
