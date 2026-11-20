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
 * values; the eigenvectors are the Fourier coefficients. We build the truncated
 * matrix and reuse the maintained symmetric eigensolver in
 * `@danielsimonjr/mathts-matrix` (`eig`).
 *
 * The characteristic values `a_n(q)` and `b_n(q)` need more harmonics at a large `q` and at a
 * high order (a mode spreads over about `(10 + 2√(2n+1))·|q|^{1/4}` harmonics), so they use a
 * matrix sized to `n` and `q` (`harmonicsNeeded`) and one eigenvalue by Sturm bisection
 * (`numeric/tridiagonal-eigen.ts`). From `|q| ≥ max(1e5, 10 s⁴)` they use the asymptotic
 * series DLMF 28.8.1, whose cost does not grow with `q`.
 *
 * Normalization / sign — the standard DLMF / Abramowitz & Stegun convention
 * (identical to `mpmath`/`scipy`): `(1/π)∫₀^{2π} ce_n(x,q)² dx = 1` (so
 * `ce_0(x,0) = 1/√2`, `ce_n(x,0) = cos nx`, `se_n(x,0) = sin nx` for `n ≥ 1`),
 * with the global sign fixed so the dominant Fourier coefficient is positive.
 * Oracle-pinned against `scipy.special` (the installed `mpmath` 1.3.0 lacks the
 * Mathieu family) in `functions/tests/gap-special-mathieu-oracle.test.ts`.
 *
 * These follow the same plain-exported-function pattern as `wave-functions.ts`
 * and `niche.ts` — pure real-valued `number`-in/`number`-out math.
 *
 * @packageDocumentation
 */

import { eig } from '@danielsimonjr/mathts-matrix';
import { symTridiagEigenvalue } from '../numeric/tridiagonal-eigen.js';

/** 64-bit float (default for decimals) */
type f64 = number;

/**
 * Truncation order of the Fourier expansion / size of the tridiagonal matrix of `ce` and `se`.
 * The coefficients decay super-exponentially, so 50 terms are machine-precision
 * accurate for the pinned range (n ≤ 6, q ≤ 10) with wide margin.
 */
const N = 50;

/** Highest order of `mathieuA` and `mathieuCe` (each parity class holds 50 modes). */
const MAX_MATHIEU_A_ORDER = 99;

/** Highest order of `mathieuB` and `mathieuSe`. */
const MAX_MATHIEU_B_ORDER = 100;

/** The four parity classes of periodic Mathieu solution. */
type MathieuClass =
  | 'even-cos' // ce_{2m}   : cos(2k·x),   harmonics 0,2,4,...
  | 'odd-cos' //  ce_{2m+1} : cos((2k+1)x), harmonics 1,3,5,...
  | 'odd-sin' //  se_{2m+1} : sin((2k+1)x), harmonics 1,3,5,...
  | 'even-sin'; // se_{2m+2}: sin((2k+2)x), harmonics 2,4,6,...

/** A recovered eigenpair: characteristic value `a` and Fourier coefficients. */
interface MathieuMode {
  /** Characteristic value (`a_n` or `b_n`). */
  a: f64;
  /** Fourier coefficients, index `k` weighting harmonic `harmonics[k]`. */
  coeffs: Float64Array;
  /** Harmonic multiple for each coefficient. */
  harmonics: Int32Array;
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

/** Harmonic multiple `h[k]` weighting coefficient `k` for a parity class. */
function harmonicsFor(cls: MathieuClass): Int32Array {
  const h = new Int32Array(N);
  for (let k = 0; k < N; k++) h[k] = harmonicAt(cls, k);
  return h;
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

/** The matrix of `classTridiagonal` for `N` harmonics as a dense `number[][]` for the eigensolver. */
function buildMatrix(cls: MathieuClass, q: f64): number[][] {
  const { diag, off } = classTridiagonal(cls, q, N);
  const A: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let k = 0; k < N; k++) A[k][k] = diag[k];
  for (let k = 0; k < N - 1; k++) {
    A[k][k + 1] = off[k];
    A[k + 1][k] = off[k];
  }
  return A;
}

/** Cache of the full sorted eigendecomposition, keyed by class + q. */
const modeCache = new Map<string, MathieuMode[]>();

/**
 * Solve the eigenproblem for a parity class and return every mode, ascending by
 * characteristic value. The `m`-th entry is the `m`-th periodic solution of that
 * class (ce_{2m}, ce_{2m+1}, se_{2m+1}, or se_{2m+2}).
 */
function solveClass(cls: MathieuClass, q: f64): MathieuMode[] {
  const key = `${cls}:${q}`;
  const cached = modeCache.get(key);
  if (cached) return cached;

  const harmonics = harmonicsFor(cls);
  const { values, vectors } = eig(buildMatrix(cls, q));

  // Sort eigenpairs ascending by (real) eigenvalue.
  const order = values.map((_, i) => i).sort((i, j) => values[i].re - values[j].re);

  const modes: MathieuMode[] = order.map((idx, m) => {
    const g = vectors[idx]; // unit-norm symmetric eigenvector
    const coeffs = new Float64Array(N);

    if (cls === 'even-cos') {
      // Undo the A_0 symmetrization: A_0 = g_0, A_{2k} = √2·g_k (k ≥ 1).
      coeffs[0] = g[0];
      for (let k = 1; k < N; k++) coeffs[k] = Math.SQRT2 * g[k];
    } else {
      for (let k = 0; k < N; k++) coeffs[k] = g[k];
    }

    // Renormalize to (1/π)∫ f² = 1. For the cosine even class the constant
    // term carries weight 2 (∫cos²0 = 2π); every other harmonic weight 1.
    let norm2 = 0;
    for (let k = 0; k < N; k++) {
      const w = cls === 'even-cos' && k === 0 ? 2 : 1;
      norm2 += w * coeffs[k] * coeffs[k];
    }
    const scale = 1 / Math.sqrt(norm2);

    // Global sign: dominant coefficient (index m) positive.
    const sign = coeffs[m] < 0 ? -scale : scale;
    for (let k = 0; k < N; k++) coeffs[k] *= sign;

    return { a: values[idx].re, coeffs, harmonics };
  });

  modeCache.set(key, modes);
  return modes;
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
  const even = n % 2 === 0;
  const cls: MathieuClass =
    kind === 'a' ? (even ? 'even-cos' : 'odd-cos') : even ? 'even-sin' : 'odd-sin';
  const m = Math.floor((n - (kind === 'b' ? (even ? 2 : 1) : 0)) / 2);
  const size = Math.max(harmonicsNeeded(n, q), m + 40);
  const { diag, off } = classTridiagonal(cls, q, size);
  return symTridiagEigenvalue(diag, off, m);
}

/** Validate an order argument is a nonnegative integer. */
function checkOrder(n: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${name}: order n must be an integer ≥ ${min}, got ${n}`);
  }
  // Each parity class solves N modes, so the highest order is 2N - 1 (2N for the sine classes).
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
  const { coeffs, harmonics } = mode;
  for (let k = 0; k < N; k++) s += coeffs[k] * basis(harmonics[k] * x);
  return s;
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
  const cls: MathieuClass = n % 2 === 0 ? 'even-cos' : 'odd-cos';
  const m = Math.floor(n / 2);
  return evalSeries(solveClass(cls, q)[m], x, Math.cos);
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
  const cls: MathieuClass = n % 2 === 0 ? 'even-sin' : 'odd-sin';
  const m = Math.floor((n - (n % 2 === 0 ? 2 : 1)) / 2);
  return evalSeries(solveClass(cls, q)[m], x, Math.sin);
}
