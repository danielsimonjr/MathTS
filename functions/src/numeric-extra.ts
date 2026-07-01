/**
 * Elementwise / cumulative / log-domain primitives (Wave A of the gap analysis).
 *
 * Compositions over existing reductions (`max`, `sum`) where one exists; the
 * cumulative scans (`cumprod`/`cummax`/`cummin`) and `cumtrapz` have no prior
 * equivalent (only `cumsum` existed) and are written as plain O(n) scans.
 * See `docs/roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md` (C1, Wave A).
 */
import { sum as _sum } from './typed/arithmetic.js';

type Vec = readonly number[] | Float64Array;
const toArr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/**
 * Spread-free maximum. `Math.max(...arr)` throws `RangeError: Maximum call stack
 * size exceeded` once the array exceeds the engine's argument limit (~1e5–1e6),
 * so `logsumexp`/`softmax` — precisely the primitives applied to large
 * log-probability vectors — must compute the max with an O(n) loop.
 */
const maxOf = (a: number[]): number => {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
};

/** Clamp a number — or each element of an array — to `[lo, hi]`. */
export function clamp(x: number, lo: number, hi: number): number;
export function clamp(x: readonly number[], lo: number, hi: number): number[];
export function clamp(x: number | readonly number[], lo: number, hi: number): number | number[] {
  const c = (v: number) => (v < lo ? lo : v > hi ? hi : v);
  return Array.isArray(x) ? x.map(c) : c(x as number);
}

/** Logistic sigmoid `1/(1+e^-x)`, computed in the numerically stable branch. */
export function sigmoid(x: number): number;
export function sigmoid(x: readonly number[]): number[];
export function sigmoid(x: number | readonly number[]): number | number[] {
  const s = (v: number) => (v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v)));
  return Array.isArray(x) ? x.map(s) : s(x as number);
}

/**
 * Log-sum-exp: `log(Σ exp(xᵢ))`, shifted by the max for numerical stability.
 * Reuses `max`/`sum`. The backbone of log-probability arithmetic.
 */
export function logsumexp(x: Vec): number {
  const a = toArr(x);
  if (a.length === 0) return -Infinity;
  const m = maxOf(a);
  if (!Number.isFinite(m)) return m; // all -Inf → -Inf; any +Inf → +Inf
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += Math.exp(a[i] - m);
  return m + Math.log(acc);
}

/** Softmax: `exp(xᵢ − max) / Σ exp(x − max)`. Returns a probability vector. */
export function softmax(x: Vec): number[] {
  const a = toArr(x);
  if (a.length === 0) return [];
  const m = maxOf(a);
  const e = a.map((v) => Math.exp(v - m));
  const z = _sum(e) as number;
  return e.map((v) => v / z);
}

/** Cumulative product (running ∏). Output has the same length as the input. */
export function cumprod(x: Vec): number[] {
  const a = toArr(x);
  const out = new Array<number>(a.length);
  let p = 1;
  for (let i = 0; i < a.length; i++) {
    p *= a[i];
    out[i] = p;
  }
  return out;
}

/** Cumulative maximum (running max). */
export function cummax(x: Vec): number[] {
  const a = toArr(x);
  const out = new Array<number>(a.length);
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > m) m = a[i];
    out[i] = m;
  }
  return out;
}

/** Cumulative minimum (running min). */
export function cummin(x: Vec): number[] {
  const a = toArr(x);
  const out = new Array<number>(a.length);
  let m = Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < m) m = a[i];
    out[i] = m;
  }
  return out;
}

/**
 * Cumulative trapezoidal integral of samples `y` (optionally over abscissae
 * `x`, else unit spacing or a scalar `dx`). Output has the same length as `y`
 * with a leading 0 (the MATLAB `cumtrapz` convention).
 */
export function cumtrapz(y: Vec, x?: Vec | number): number[] {
  const a = toArr(y);
  const out = new Array<number>(a.length).fill(0);
  let dxAt: (i: number) => number;
  if (typeof x === 'number') {
    dxAt = () => x;
  } else if (x !== undefined) {
    const xs = toArr(x);
    if (xs.length < a.length)
      throw new Error(`cumtrapz: abscissa x (length ${xs.length}) is shorter than y (length ${a.length})`);
    dxAt = (i: number) => xs[i + 1] - xs[i];
  } else {
    dxAt = () => 1;
  }
  let acc = 0;
  for (let i = 1; i < a.length; i++) {
    acc += ((a[i] + a[i - 1]) / 2) * dxAt(i - 1);
    out[i] = acc;
  }
  return out;
}
