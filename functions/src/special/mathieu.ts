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

/** 64-bit float (default for decimals) */
type f64 = number;

/**
 * Truncation order of the Fourier expansion / size of the tridiagonal matrix.
 * The coefficients decay super-exponentially, so 50 terms are machine-precision
 * accurate for the pinned range (n ≤ 6, q ≤ 10) with wide margin.
 */
const N = 50;

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

/** Harmonic multiple `h[k]` weighting coefficient `k` for a parity class. */
function harmonicsFor(cls: MathieuClass): Int32Array {
  const h = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    switch (cls) {
      case 'even-cos':
        h[k] = 2 * k;
        break;
      case 'odd-cos':
      case 'odd-sin':
        h[k] = 2 * k + 1;
        break;
      case 'even-sin':
        h[k] = 2 * k + 2;
        break;
    }
  }
  return h;
}

/**
 * Build the symmetric tridiagonal matrix (DLMF §28.4 recurrences) for a parity
 * class as a dense `number[][]` for the eigensolver. Diagonal = harmonic²;
 * off-diagonal = coupling `q`, with the class-specific first-entry corrections:
 * `even-cos` scales the (0,1) coupling by `√2` (the `A_0` folding), and the two
 * odd classes shift the first diagonal by `±q`.
 */
function buildMatrix(cls: MathieuClass, q: f64): number[][] {
  const A: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const h = harmonicsFor(cls);
  for (let k = 0; k < N; k++) A[k][k] = h[k] * h[k];

  // First-diagonal corrections for the odd-harmonic classes.
  if (cls === 'odd-cos') A[0][0] = 1 + q;
  else if (cls === 'odd-sin') A[0][0] = 1 - q;

  for (let k = 0; k < N - 1; k++) {
    // even-cos couples A_0↔A_2 with q·√2 (symmetrized A_0 folding).
    const off = cls === 'even-cos' && k === 0 ? q * Math.SQRT2 : q;
    A[k][k + 1] = off;
    A[k + 1][k] = off;
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

/** Validate an order argument is a nonnegative integer. */
function checkOrder(n: number, min: number, name: string): void {
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${name}: order n must be an integer ≥ ${min}, got ${n}`);
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
  checkOrder(n, 0, 'mathieuA');
  const cls: MathieuClass = n % 2 === 0 ? 'even-cos' : 'odd-cos';
  const m = Math.floor(n / 2);
  return solveClass(cls, q)[m].a;
}

/**
 * Characteristic value `b_n(q)` for the odd (sine-elliptic `se_n`) Mathieu
 * solutions, `n ≥ 1`. As `q → 0`, `b_n → n²`.
 *
 * @param n - Integer order ≥ 1.
 * @param q - Mathieu parameter.
 */
export function mathieuB(n: number, q: f64): f64 {
  checkOrder(n, 1, 'mathieuB');
  const cls: MathieuClass = n % 2 === 0 ? 'even-sin' : 'odd-sin';
  const m = Math.floor((n - (n % 2 === 0 ? 2 : 1)) / 2);
  return solveClass(cls, q)[m].a;
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
  checkOrder(n, 0, 'mathieuCe');
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
  checkOrder(n, 1, 'mathieuSe');
  const cls: MathieuClass = n % 2 === 0 ? 'even-sin' : 'odd-sin';
  const m = Math.floor((n - (n % 2 === 0 ? 2 : 1)) / 2);
  return evalSeries(solveClass(cls, q)[m], x, Math.sin);
}
