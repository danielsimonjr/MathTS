/**
 * Generalized means, geometric standard deviation, robust regression slopes
 * and partial correlation (gap-analysis 2026-11-04, Batch A).
 */
type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

const meanOf = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

function medianOf(a: number[]): number {
  const s = [...a].sort((p, q) => p - q);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdOf(a: number[], ddof: number): number {
  const m = meanOf(a);
  const ss = a.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(ss / (a.length - ddof));
}

/**
 * Power mean M_p = (Σxᵖ / n)^(1/p). p = 0 is the geometric mean, p = 1 the
 * arithmetic mean and p = −1 the harmonic mean. Non-integer p requires x > 0.
 */
export function pmean(x: Vec, p: number): number {
  const a = arr(x);
  if (a.length === 0) return NaN;
  if (!Number.isInteger(p) && a.some((v) => v <= 0)) {
    throw new RangeError('pmean: non-integer p requires all entries > 0');
  }
  if (p === 0) {
    if (a.some((v) => v < 0)) throw new RangeError('pmean: p = 0 requires entries >= 0');
    return Math.exp(meanOf(a.map(Math.log)));
  }
  const m = meanOf(a.map((v) => v ** p));
  // An odd integer p admits negative entries, and the real odd root of a
  // negative mean keeps its sign (`(-8) ** (1/3)` is NaN in JavaScript).
  if (m < 0 && Math.abs(p) % 2 === 1) return -((-m) ** (1 / p));
  return m ** (1 / p);
}

/** Geometric standard deviation: exp(std(ln x)). Default ddof 1 (scipy). */
export function gstd(x: Vec, opts?: { ddof?: number }): number {
  const a = arr(x);
  if (a.some((v) => v <= 0)) throw new RangeError('gstd: all entries must be > 0');
  if (a.length <= (opts?.ddof ?? 1)) throw new RangeError('gstd: needs more values than ddof');
  return Math.exp(stdOf(a.map(Math.log), opts?.ddof ?? 1));
}

/** Geometric z-score: (ln xᵢ − mean(ln x)) / std(ln x). */
export function gzscore(x: Vec, opts?: { ddof?: number }): number[] {
  const a = arr(x);
  if (a.some((v) => v <= 0)) throw new RangeError('gzscore: all entries must be > 0');
  if (a.length <= (opts?.ddof ?? 1)) throw new RangeError('gzscore: needs more values than ddof');
  const logs = a.map(Math.log);
  const m = meanOf(logs);
  const s = stdOf(logs, opts?.ddof ?? 1);
  return logs.map((v) => (v - m) / s);
}

/** Pairwise slopes over all pairs with distinct x; duplicate-x pairs are skipped. */
function pairwiseSlopes(x: number[], y: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) {
    for (let j = i + 1; j < x.length; j++) {
      if (x[i] !== x[j]) out.push((y[j] - y[i]) / (x[j] - x[i]));
    }
  }
  return out;
}

function checkPairs(x: Vec, y: Vec, name: string): [number[], number[]] {
  const xs = arr(x);
  const ys = arr(y);
  if (xs.length !== ys.length) throw new RangeError(`${name}: x and y must have the same length`);
  if (xs.length < 2) throw new RangeError(`${name}: needs at least 2 points`);
  return [xs, ys];
}

/**
 * Theil–Sen estimator: slope = median of all pairwise slopes, intercept =
 * median(y) − slope·median(x).
 */
export function theilSen(x: Vec, y: Vec): { slope: number; intercept: number } {
  const [xs, ys] = checkPairs(x, y, 'theilSen');
  const slopes = pairwiseSlopes(xs, ys);
  if (slopes.length === 0) throw new RangeError('theilSen: all x values are equal');
  const slope = medianOf(slopes);
  return { slope, intercept: medianOf(ys) - slope * medianOf(xs) };
}

/**
 * Siegel repeated-medians estimator: slope = median over i of the median of
 * slopes from point i to every other point; intercept = median(y − slope·x).
 */
export function siegelSlopes(x: Vec, y: Vec): { slope: number; intercept: number } {
  const [xs, ys] = checkPairs(x, y, 'siegelSlopes');
  const perPoint: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const s: number[] = [];
    for (let j = 0; j < xs.length; j++) {
      if (j !== i && xs[j] !== xs[i]) s.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
    if (s.length > 0) perPoint.push(medianOf(s));
  }
  if (perPoint.length === 0) throw new RangeError('siegelSlopes: all x values are equal');
  const slope = medianOf(perPoint);
  return { slope, intercept: medianOf(ys.map((v, i) => v - slope * xs[i])) };
}

function pearson(a: number[], b: number[]): number {
  const ma = meanOf(a);
  const mb = meanOf(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

/** Partial correlation of x and y controlling for z (first-order formula). */
export function partialCorrelation(x: Vec, y: Vec, z: Vec): number {
  const xs = arr(x);
  const ys = arr(y);
  const zs = arr(z);
  if (xs.length !== ys.length || xs.length !== zs.length) {
    throw new RangeError('partialCorrelation: x, y and z must have the same length');
  }
  const rxy = pearson(xs, ys);
  const rxz = pearson(xs, zs);
  const ryz = pearson(ys, zs);
  return (rxy - rxz * ryz) / Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
}
