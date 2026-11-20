/**
 * Mathieu functions: the characteristic values `a_n(q)` / `b_n(q)` and the
 * `2π`-periodic angular functions `ce_n(x, q)` / `se_n(x, q)` of the Mathieu
 * equation
 *
 *     y'' + (a − 2q·cos 2x)·y = 0.
 *
 * Method — the symmetric tridiagonal eigenvalue problem. Expanding the periodic
 * solutions in a Fourier series produces a three-term recurrence among the
 * coefficients, which is a symmetric tridiagonal eigenproblem in each of the
 * four parity classes (DLMF §28.4). The eigenvalues are the characteristic
 * values; the eigenvectors are the Fourier coefficients.
 *
 * A mode needs more harmonics at a large `q` and at a high order (it spreads over about
 * `(10 + 2√(2n+1))·|q|^{1/4}` harmonics), so every function builds the matrix of the size
 * `harmonicsNeeded(n, q)` and takes one eigenvalue by Sturm bisection and, for `ce` and `se`, one
 * eigenvector by inverse iteration (`numeric/tridiagonal-eigen.ts`). A call of `ce` or `se` that
 * needs more than `MAX_MATHIEU_HARMONICS` harmonics throws a RangeError. For
 * `|q| ≥ max(1e5, 10 s⁴)` the characteristic values `a_n` and `b_n` use the asymptotic series
 * DLMF 28.8.1, whose cost does not grow with `q`.
 *
 * Normalization / sign — the standard DLMF / Abramowitz & Stegun convention
 * (identical to `scipy`): `(1/π)∫₀^{2π} ce_n(x,q)² dx = 1` (so
 * `ce_0(x,0) = 1/√2`, `ce_n(x,0) = cos nx`, `se_n(x,0) = sin nx` for `n ≥ 1`),
 * and the sign of DLMF 28.2(vi): the sign at `q = 0`, carried to every real `q` by continuity.
 * That sign is `ce_n(0, q) > 0` and `se_n'(0, q) > 0` for every `q` (see `anchorSign`).
 * Oracle-pinned against `scipy.special` (the installed `mpmath` 1.3.0 lacks the
 * Mathieu family) in `functions/tests/gap-special-mathieu-oracle.test.ts`.
 *
 * These follow the same plain-exported-function pattern as `wave-functions.ts`
 * and `niche.ts` — pure real-valued `number`-in/`number`-out math.
 *
 * @packageDocumentation
 */

import { symTridiagEigenvalue, symTridiagEigenvector } from '../numeric/tridiagonal-eigen.js';
import { MAX_MATHIEU_HARMONICS } from '../utils/limits.js';

/** 64-bit float (default for decimals) */
type f64 = number;

/** Highest order of `mathieuA` and `mathieuCe` (the 50th mode of each cosine class). */
const MAX_MATHIEU_A_ORDER = 99;

/** Highest order of `mathieuB` and `mathieuSe` (the 50th mode of each sine class). */
const MAX_MATHIEU_B_ORDER = 100;

/** The four parity classes of periodic Mathieu solution. */
type MathieuClass =
  | 'even-cos' // ce_{2m}   : cos(2k·x),   harmonics 0,2,4,...
  | 'odd-cos' //  ce_{2m+1} : cos((2k+1)x), harmonics 1,3,5,...
  | 'odd-sin' //  se_{2m+1} : sin((2k+1)x), harmonics 1,3,5,...
  | 'even-sin'; // se_{2m+2}: sin((2k+2)x), harmonics 2,4,6,...

/** The Fourier coefficients of one periodic solution: index `k` weights harmonic `harmonicAt(cls, k)`. */
interface MathieuMode {
  /** Parity class of the solution. */
  cls: MathieuClass;
  /** Normalised Fourier coefficients (the length is the size of the matrix). */
  coeffs: Float64Array;
}

/** Harmonic multiple weighting coefficient `k` for a parity class. */
function harmonicAt(cls: MathieuClass, k: number): number {
  switch (cls) {
    case 'even-cos':
      return 2 * k;
    case 'odd-cos':
    case 'odd-sin':
      return 2 * k + 1;
    case 'even-sin':
      return 2 * k + 2;
  }
}

/**
 * The symmetric tridiagonal matrix (DLMF §28.4 recurrences) of a parity class for `size`
 * harmonics. Diagonal = harmonic²; off-diagonal = coupling `q`, with the class-specific
 * first-entry corrections: `even-cos` scales the (0,1) coupling by `√2` (the `A_0` folding),
 * and the two odd classes shift the first diagonal by `±q`.
 */
function classTridiagonal(
  cls: MathieuClass,
  q: f64,
  size: number
): { diag: Float64Array; off: Float64Array } {
  const diag = new Float64Array(size);
  const off = new Float64Array(size - 1);
  for (let k = 0; k < size; k++) {
    const h = harmonicAt(cls, k);
    diag[k] = h * h;
  }
  // First-diagonal corrections for the odd-harmonic classes.
  if (cls === 'odd-cos') diag[0] = 1 + q;
  else if (cls === 'odd-sin') diag[0] = 1 - q;
  for (let k = 0; k < size - 1; k++) {
    // even-cos couples A_0↔A_2 with q·√2 (symmetrized A_0 folding).
    off[k] = cls === 'even-cos' && k === 0 ? q * Math.SQRT2 : q;
  }
  return { diag, off };
}

/** The parity class of the order `n` (`ce_n` or `a_n`; `se_n` or `b_n` when `sine`) and its mode index `m`. */
function classOf(sine: boolean, n: number): { cls: MathieuClass; m: number } {
  const even = n % 2 === 0;
  if (!sine) return { cls: even ? 'even-cos' : 'odd-cos', m: Math.floor(n / 2) };
  return { cls: even ? 'even-sin' : 'odd-sin', m: Math.floor((n - (even ? 2 : 1)) / 2) };
}

/**
 * Number of harmonics that a matrix needs for the characteristic value of order `n` at `q`.
 * The mode `n` spreads over about `(10 + 2√(2n+1))·|q|^{1/4}` harmonics around its own
 * (`n/2`-th), and 30 more harmonics make the truncation error negligible.
 */
function harmonicsNeeded(n: number, q: f64): number {
  return (
    Math.ceil(n / 2) + Math.ceil((10 + 2 * Math.sqrt(2 * n + 1)) * Math.pow(Math.abs(q), 0.25)) + 30
  );
}

/**
 * The asymptotic series of DLMF 28.8.1 for `q = h²` large (`s = 2m + 1` for `a_m` and for
 * `b_{m+1}`): `−2q + 2s√q − (s²+1)/8 − (s³+3s)/(2⁷√q) − …`, eight terms.
 */
function asymptoticCharacteristic(s: number, q: f64): f64 {
  const root = Math.sqrt(q);
  const s2 = s * s;
  const s3 = s2 * s;
  const s4 = s2 * s2;
  const s5 = s4 * s;
  const s6 = s4 * s2;
  const s7 = s6 * s;
  return (
    -2 * q +
    2 * s * root -
    (s2 + 1) / 8 -
    (s3 + 3 * s) / (128 * root) -
    (5 * s4 + 34 * s2 + 9) / (4096 * q) -
    (33 * s5 + 410 * s3 + 405 * s) / (131072 * q * root) -
    (63 * s6 + 1260 * s4 + 2943 * s2 + 486) / (1048576 * q * q) -
    (527 * s7 + 15617 * s5 + 69001 * s3 + 41607 * s) / (33554432 * q * q * root)
  );
}

/**
 * The characteristic value `a_n(q)` (`kind` `'a'`) or `b_n(q)` (`kind` `'b'`).
 *
 * A non-NaN `q` and an order within the limits give a result: 0 at `q = 0` is `n²` exactly,
 * `−Infinity` for an infinite `q`, the asymptotic series for `|q| ≥ max(1e5, 10 s⁴)` (`s = 2n+1`;
 * a negative `q` maps by DLMF 28.2.21: `a_{2m}(−q) = a_{2m}(q)`, `a_{2m+1}(−q) = b_{2m+1}(q)`,
 * `b_{2m+1}(−q) = a_{2m+1}(q)`, `b_{2m+2}(−q) = b_{2m+2}(q)`), and otherwise the `m`-th
 * eigenvalue of the sized matrix of the parity class.
 */
function characteristicValue(kind: 'a' | 'b', n: number, q: f64): f64 {
  if (Number.isNaN(q)) return NaN;
  if (q === 0) return n * n;
  const absQ = Math.abs(q);
  if (absQ === Infinity) return -Infinity;
  const s = 2 * n + 1;
  if (absQ >= Math.max(1e5, 10 * s ** 4)) {
    // For a negative q and an odd order, a and b swap.
    const useA = (kind === 'a') !== (q < 0 && n % 2 === 1);
    return asymptoticCharacteristic(useA ? 2 * n + 1 : 2 * n - 1, absQ);
  }
  const { cls, m } = classOf(kind === 'b', n);
  const size = Math.max(harmonicsNeeded(n, q), m + 40);
  const { diag, off } = classTridiagonal(cls, q, size);
  return symTridiagEigenvalue(diag, off, m);
}

/** Entries of the mode cache. The cache keeps the last modes, because a plot calls `ce` once per `x`. */
const MODE_CACHE_SIZE = 32;

/**
 * The most coefficients that the cache holds in all (25.6 MB). A mode of any size below the cap
 * `MAX_MATHIEU_HARMONICS` fits, so a plot that calls `ce` or `se` once per `x` at a huge `q`
 * does one solve (1 s at the cap) and not one per point.
 */
const MODE_CACHE_MAX_TOTAL = 3_200_000;

/** Modes by `cls:q:m`, oldest first, and the number of coefficients that they hold. */
const modeCache = new Map<string, MathieuMode>();
let modeCacheTotal = 0;

/**
 * The `m`-th mode (from 0, ascending eigenvalue) of a parity class, for the order `n`: the
 * eigenvector of the sized matrix, with the `A_0` folding undone, normalised to
 * `(1/π)∫₀^{2π} f² = 1` (the constant term of the cosine class counts twice) and signed by
 * continuity from `q = 0` (see `anchorSign`).
 *
 * @throws RangeError if the matrix needs more than `MAX_MATHIEU_HARMONICS` harmonics
 */
function solveMode(fn: string, cls: MathieuClass, n: number, m: number, q: f64): MathieuMode {
  const key = `${cls}:${q}:${m}`;
  const cached = modeCache.get(key);
  if (cached) return cached;

  const needed = harmonicsNeeded(n, q);
  if (!(needed <= MAX_MATHIEU_HARMONICS)) {
    throw new RangeError(
      `${fn}: q = ${q} needs ${needed} harmonics, above the supported maximum of ${MAX_MATHIEU_HARMONICS}`
    );
  }
  const size = Math.max(needed, m + 40);
  const { diag, off } = classTridiagonal(cls, q, size);
  const g = symTridiagEigenvector(diag, off, symTridiagEigenvalue(diag, off, m));
  const coeffs = new Float64Array(size);
  if (cls === 'even-cos') {
    // Undo the A_0 symmetrization: A_0 = g_0, A_{2k} = √2·g_k (k ≥ 1).
    coeffs[0] = g[0];
    for (let k = 1; k < size; k++) coeffs[k] = Math.SQRT2 * g[k];
  } else {
    coeffs.set(g);
  }
  let norm2 = 0;
  for (let k = 0; k < size; k++) {
    const w = cls === 'even-cos' && k === 0 ? 2 : 1;
    norm2 += w * coeffs[k] * coeffs[k];
  }
  const scale = anchorSign(cls, coeffs, m) / Math.sqrt(norm2);
  for (let k = 0; k < size; k++) coeffs[k] *= scale;

  const mode: MathieuMode = { cls, coeffs };
  while (modeCache.size >= MODE_CACHE_SIZE || modeCacheTotal + size > MODE_CACHE_MAX_TOTAL) {
    const oldest = modeCache.keys().next().value as string;
    modeCacheTotal -= (modeCache.get(oldest) as MathieuMode).coeffs.length;
    modeCache.delete(oldest);
  }
  modeCache.set(key, mode);
  modeCacheTotal += size;
  return mode;
}

/**
 * The sign factor that gives a mode the sign of DLMF 28.2(vi): the sign at `q = 0`, continued
 * to the actual `q`.
 *
 * Each parity class has one boundary condition at `x = 0` and one at `x = π/2`, so one linear
 * functional `Σ w_k c_k` of the coefficients is `y(x₀)` or `y'(x₀)` at each point. A solution
 * cannot have `y = y' = 0` at a point, so that functional never vanishes while `q` moves, and
 * its sign at the actual `q` is its sign at `q = 0`, where the mode is the unit coefficient `m`.
 * The sign is therefore `sign(w_m)`. The rule "coefficient `m` is positive" is not that sign: the
 * coefficient `m` changes sign near `q = 30` for `ce_2` (SciPy and DLMF agree with the rule above).
 *
 * A mode with a large `q` is exponentially small at `x = 0` or at `x = π/2`, and its sum there is
 * all cancellation. So the function uses the point where the sum is the larger part of the sum of
 * the absolute terms.
 *
 * @returns `1` or `-1`, the factor for `coeffs`
 */
function anchorSign(cls: MathieuClass, coeffs: Float64Array, m: number): number {
  const sine = cls === 'odd-sin' || cls === 'even-sin';
  let best = 0;
  let sign = 1;
  for (let anchor = 0; anchor < 2; anchor++) {
    let sum = 0;
    let magnitude = 0;
    let expected = 1;
    for (let k = 0; k < coeffs.length; k++) {
      const h = harmonicAt(cls, k);
      const alt = k % 2 === 0 ? 1 : -1;
      let w: number;
      if (anchor === 0) w = sine ? h : 1;
      else if (cls === 'even-cos' || cls === 'odd-sin') w = alt;
      else w = -h * alt;
      sum += w * coeffs[k];
      magnitude += Math.abs(w * coeffs[k]);
      if (k === m) expected = w < 0 ? -1 : 1;
    }
    const ratio = magnitude > 0 ? Math.abs(sum) / magnitude : 0;
    if (ratio > best) {
      best = ratio;
      sign = (sum < 0 ? -1 : 1) * expected;
    }
  }
  return sign;
}

/** Validate an order argument is a nonnegative integer. */
function checkOrder(n: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${name}: order n must be an integer ≥ ${min}, got ${n}`);
  }
  // The highest orders are the 50th mode of a class: 99 for the cosine, 100 for the sine classes.
  if (n > max) {
    throw new RangeError(`${name}: order n must be at most ${max}, got ${n}`);
  }
}

/**
 * Characteristic value `a_n(q)` for the even (cosine-elliptic `ce_n`) Mathieu
 * solutions. As `q → 0`, `a_n → n²`.
 *
 * @param n - Nonnegative integer order.
 * @param q - Mathieu parameter.
 */
export function mathieuA(n: number, q: f64): f64 {
  checkOrder(n, 0, MAX_MATHIEU_A_ORDER, 'mathieuA');
  return characteristicValue('a', n, q);
}

/**
 * Characteristic value `b_n(q)` for the odd (sine-elliptic `se_n`) Mathieu
 * solutions, `n ≥ 1`. As `q → 0`, `b_n → n²`.
 *
 * @param n - Integer order ≥ 1.
 * @param q - Mathieu parameter.
 */
export function mathieuB(n: number, q: f64): f64 {
  checkOrder(n, 1, MAX_MATHIEU_B_ORDER, 'mathieuB');
  return characteristicValue('b', n, q);
}

/** Sum a mode's Fourier series with the given trig basis. */
function evalSeries(mode: MathieuMode, x: f64, basis: (t: number) => number): f64 {
  let s = 0;
  const { cls, coeffs } = mode;
  const first = harmonicAt(cls, 0);
  for (let k = 0; k < coeffs.length; k++) s += coeffs[k] * basis((first + 2 * k) * x);
  return s;
}

/** `ce_n(x, q)`, or `se_n(x, q)` when `sine`, for a checked order; NaN for a NaN `q`. */
function angular(fn: string, sine: boolean, n: number, q: f64, x: f64): f64 {
  if (Number.isNaN(q)) return NaN;
  const { cls, m } = classOf(sine, n);
  return evalSeries(solveMode(fn, cls, n, m, q), x, sine ? Math.sin : Math.cos);
}

/**
 * Angular Mathieu function `ce_n(x, q)` (cosine-elliptic), summed from its
 * Fourier coefficients. Normalized so `(1/π)∫₀^{2π} ce_n² = 1`; as `q → 0`,
 * `ce_0 → 1/√2` and `ce_n → cos(nx)` for `n ≥ 1`.
 *
 * @param n - Nonnegative integer order.
 * @param q - Mathieu parameter.
 * @param x - Argument in radians.
 */
export function mathieuCe(n: number, q: f64, x: f64): f64 {
  checkOrder(n, 0, MAX_MATHIEU_A_ORDER, 'mathieuCe');
  return angular('mathieuCe', false, n, q, x);
}

/**
 * Angular Mathieu function `se_n(x, q)` (sine-elliptic), `n ≥ 1`, summed from
 * its Fourier coefficients. Normalized so `(1/π)∫₀^{2π} se_n² = 1`; as `q → 0`,
 * `se_n → sin(nx)`.
 *
 * @param n - Integer order ≥ 1.
 * @param q - Mathieu parameter.
 * @param x - Argument in radians.
 */
export function mathieuSe(n: number, q: f64, x: f64): f64 {
  checkOrder(n, 1, MAX_MATHIEU_B_ORDER, 'mathieuSe');
  return angular('mathieuSe', true, n, q, x);
}
