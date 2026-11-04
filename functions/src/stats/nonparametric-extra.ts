/**
 * Nonparametric and categorical tests plus the jackknife (gap-analysis
 * 2026-11-04, Batch A).
 */
import { chiSquaredCDF } from '../distribution-functions.js';
import { normalCDF as _normalCDF } from '../typed/distributions.js';

type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const normalCDF = (z: number): number => _normalCDF(z) as number;
const chi2Sf = (stat: number, df: number): number => 1 - chiSquaredCDF(stat, df);

function median(a: number[]): number {
  const s = [...a].sort((p, q) => p - q);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Sign test on the median. Ties with `median` are dropped; two-sided exact binomial p. */
export function signTest(
  x: Vec,
  medianValue = 0
): { statistic: number; pValue: number; nPos: number; nNeg: number } {
  const xs = arr(x);
  const nPos = xs.filter((v) => v > medianValue).length;
  const nNeg = xs.filter((v) => v < medianValue).length;
  const n = nPos + nNeg;
  if (n === 0) return { statistic: 0, pValue: 1, nPos, nNeg };
  const k = Math.min(nPos, nNeg);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += binomCoef(n, i) / 2 ** n;
  return { statistic: nPos, pValue: Math.min(1, 2 * tail), nPos, nNeg };
}

function binomCoef(n: number, k: number): number {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
}

/**
 * Wald–Wolfowitz runs test. Booleans are used directly; numeric values are
 * classified against `cutoff` (default: the median), with values equal to the
 * cutoff dropped. Normal approximation, two-sided p. With n₁ = 0 or n₂ = 0,
 * z is NaN and p is 1.
 */
export function runsTest(
  x: Vec | readonly boolean[],
  opts?: { cutoff?: number }
): { runs: number; z: number; pValue: number } {
  let seq: boolean[];
  if (x.length > 0 && typeof x[0] === 'boolean') {
    seq = (x as readonly boolean[]).slice();
  } else {
    const nums = arr(x as Vec);
    const cut = opts?.cutoff ?? median(nums);
    seq = nums.filter((v) => v !== cut).map((v) => v > cut);
  }
  const n1 = seq.filter(Boolean).length;
  const n2 = seq.length - n1;
  let runs = seq.length > 0 ? 1 : 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) runs++;
  if (n1 === 0 || n2 === 0) return { runs, z: NaN, pValue: 1 };
  const n = n1 + n2;
  const mean = (2 * n1 * n2) / n + 1;
  const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  const z = (runs - mean) / Math.sqrt(variance);
  return { runs, z, pValue: 2 * (1 - normalCDF(Math.abs(z))) };
}

/** Mood's median test: chi-square test of the above/at-or-below-grand-median table. */
export function moodMedianTest(groups: readonly Vec[]): {
  statistic: number;
  pValue: number;
  grandMedian: number;
} {
  const gs = groups.map(arr);
  const grandMedian = median(gs.flat());
  const above = gs.map((g) => g.filter((v) => v > grandMedian).length);
  const below = gs.map((g, i) => g.length - above[i]);
  const totalAbove = above.reduce((s, v) => s + v, 0);
  const total = gs.reduce((s, g) => s + g.length, 0);
  const totalBelow = total - totalAbove;
  let stat = 0;
  for (let i = 0; i < gs.length; i++) {
    const rowN = gs[i].length;
    const eA = (rowN * totalAbove) / total;
    const eB = (rowN * totalBelow) / total;
    if (eA > 0) stat += (above[i] - eA) ** 2 / eA;
    if (eB > 0) stat += (below[i] - eB) ** 2 / eB;
  }
  const df = gs.length - 1;
  return { statistic: stat, pValue: chi2Sf(stat, df), grandMedian };
}

/**
 * Cressie–Read power divergence statistic for observed counts against expected
 * counts (default: uniform). λ = 1 gives Pearson χ², λ = 0 gives G, λ = −1 is
 * rejected as singular. Zero observed counts contribute 0 when λ = 0.
 */
export function powerDivergence(
  observed: Vec,
  expected?: Vec,
  lambda = 1
): { statistic: number; pValue: number } {
  const o = arr(observed);
  const total = o.reduce((s, v) => s + v, 0);
  const e = expected ? arr(expected) : o.map(() => total / o.length);
  if (e.length !== o.length) throw new RangeError('expected must match observed in length');
  if (lambda === -1) throw new RangeError('powerDivergence: lambda = -1 is singular');
  let stat = 0;
  if (lambda === 0) {
    for (let i = 0; i < o.length; i++) if (o[i] > 0) stat += o[i] * Math.log(o[i] / e[i]);
    stat *= 2;
  } else {
    for (let i = 0; i < o.length; i++) {
      stat += o[i] * ((o[i] / e[i]) ** lambda - 1);
    }
    stat = (2 / (lambda * (lambda + 1))) * stat;
  }
  return { statistic: stat, pValue: chi2Sf(stat, o.length - 1) };
}

/** Log-likelihood ratio G-test: `powerDivergence(observed, expected, 0)`. */
export function gTest(observed: Vec, expected?: Vec): { statistic: number; pValue: number } {
  return powerDivergence(observed, expected, 0);
}

/**
 * Delete-one jackknife. `estimate` is the bias-corrected estimate
 * θ̂ − bias, `bias` = (n−1)(θ̄₋ᵢ − θ̂), and `se` = √((n−1)/n · Σ(θ₋ᵢ − θ̄₋ᵢ)²).
 */
export function jackknife(
  x: Vec,
  stat: (sample: number[]) => number
): { estimate: number; bias: number; se: number } {
  const xs = arr(x);
  const n = xs.length;
  if (n < 2) throw new RangeError('jackknife needs at least 2 observations');
  const theta = stat(xs);
  const loo: number[] = [];
  for (let i = 0; i < n; i++) loo.push(stat(xs.filter((_, j) => j !== i)));
  const thetaBar = loo.reduce((s, v) => s + v, 0) / n;
  const bias = (n - 1) * (thetaBar - theta);
  const ss = loo.reduce((s, v) => s + (v - thetaBar) ** 2, 0);
  return { estimate: theta - bias, bias, se: Math.sqrt(((n - 1) / n) * ss) };
}
