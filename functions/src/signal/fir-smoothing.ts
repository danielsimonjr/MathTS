/**
 * Phase 6 Task 3 — FIR bandpass design, least-squares/equiripple FIR design,
 * Savitzky-Golay smoothing, the Wiener adaptive filter, and polynomial
 * (FIR) deconvolution. Matches `scipy.signal` for `savgol`, `deconvolve`,
 * `firwinBandpass`, `firls`, and `remez` (the last is now the exact
 * Parks-McClellan / Remez exchange — see `./remez-exchange.ts`).
 */
import { sinc } from '../signal-filter-extra.js';
import { convDirect } from './conv.js';
import { remezExchange, type RemezType } from './remez-exchange.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Polynomial/deconvolution division result: `signal = conv(divisor, quotient) + remainder`. */
export interface DeconvolveResult {
  quotient: number[];
  remainder: number[];
}

// --- Small dense linear solve, shared by savgol's per-window polynomial fit
// and firls/remez's normal-equations solve. Gaussian elimination with partial
// pivoting — matrices here are tiny (window length / basis size), so this is
// simple and adequately stable. ----------------------------------------------

function solveLinearSystem(Ain: readonly (readonly number[])[], bin: readonly number[]): number[] {
  const n = bin.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (piv !== col) {
      [A[col], A[piv]] = [A[piv], A[col]];
      [b[col], b[piv]] = [b[piv], b[col]];
    }
    const pivotVal = A[col][col];
    if (Math.abs(pivotVal) < 1e-14) throw new Error('solveLinearSystem: singular matrix');
    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= factor * A[col][c];
      b[r] -= factor * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let c = row + 1; c < n; c++) sum -= A[row][c] * x[c];
    x[row] = sum / A[row][row];
  }
  return x;
}

// --- firwinBandpass ----------------------------------------------------------

/**
 * FIR bandpass filter coefficients by the windowed-sinc method (Hamming
 * window): `h[n] = (f2·sinc(f2·(n−M/2)) − f1·sinc(f1·(n−M/2)))·hamming[n]`,
 * `M = numtaps−1`. `[f1, f2]` are cutoffs normalized to Nyquist (1 = Nyquist).
 * This is the array-cutoff (bandpass) case the scalar-only `firwin` in
 * `../signal-filter-extra.ts` didn't support (resolves the Phase-0 note).
 */
export function firwinBandpass(numtaps: number, cutoffs: readonly [number, number]): number[] {
  if (!Number.isInteger(numtaps) || numtaps < 2)
    throw new Error('firwinBandpass: numtaps must be an integer >= 2');
  const [f1, f2] = cutoffs;
  if (!(f1 > 0 && f1 < f2 && f2 < 1))
    throw new Error('firwinBandpass: require 0 < f1 < f2 < 1 (normalized to Nyquist)');
  const M = numtaps - 1;
  const h = new Array<number>(numtaps);
  for (let n = 0; n <= M; n++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / M); // Hamming
    h[n] = (f2 * sinc(f2 * (n - M / 2)) - f1 * sinc(f1 * (n - M / 2))) * w;
  }
  return h;
}

// --- savgol -------------------------------------------------------------------

/** Least-squares fit of a degree-`polyorder` polynomial to `(offsets[i], values[i])`; returns coefficients c[0..polyorder] (ascending powers), solved via the normal equations `(AᵀA)c = Aᵀy`. */
function polyFitCoeffs(
  offsets: readonly number[],
  values: readonly number[],
  polyorder: number
): number[] {
  const p = polyorder + 1;
  const A = offsets.map((t) => Array.from({ length: p }, (_, k) => Math.pow(t, k)));
  const AtA = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => A.reduce((s, row) => s + row[i] * row[j], 0))
  );
  const Atb = Array.from({ length: p }, (_, i) =>
    A.reduce((s, row, idx) => s + row[i] * values[idx], 0)
  );
  return solveLinearSystem(AtA, Atb);
}

function evalPoly(c: readonly number[], t: number): number {
  let s = 0;
  let tk = 1;
  for (let k = 0; k < c.length; k++) {
    s += c[k] * tk;
    tk *= t;
  }
  return s;
}

/**
 * Savitzky-Golay smoothing (`scipy.signal.savgol_filter`, default `mode='interp'`).
 * For each interior position, fits a degree-`polyorder` polynomial (via the
 * normal equations over a Vandermonde of the window offsets) to the centered
 * `windowLength`-point window and takes the fitted value at the center. Edge
 * points reuse the nearest full boundary window's fit, evaluated at the edge
 * point's actual offset from that window's center (scipy's boundary handling).
 * Exact on polynomials of degree <= `polyorder`.
 */
export function savgol(x: Vec, windowLength: number, polyorder: number): number[] {
  const xx = arr(x);
  const n = xx.length;
  if (!Number.isInteger(windowLength) || windowLength < 1 || windowLength % 2 === 0)
    throw new Error('savgol: windowLength must be a positive odd integer');
  if (!Number.isInteger(polyorder) || polyorder < 0 || polyorder >= windowLength)
    throw new Error('savgol: polyorder must satisfy 0 <= polyorder < windowLength');
  if (windowLength > n) throw new Error('savgol: windowLength must not exceed the signal length');

  const half = (windowLength - 1) / 2;
  const offsets = Array.from({ length: windowLength }, (_, j) => j - half); // -half..half
  const out = new Array<number>(n);

  for (let i = half; i <= n - 1 - half; i++) {
    const values = offsets.map((_, j) => xx[i - half + j]);
    out[i] = polyFitCoeffs(offsets, values, polyorder)[0]; // p(0) at the window center
  }

  if (half > 0) {
    const cLeft = polyFitCoeffs(offsets, xx.slice(0, windowLength), polyorder);
    for (let i = 0; i < half; i++) out[i] = evalPoly(cLeft, i - half);

    const cRight = polyFitCoeffs(offsets, xx.slice(n - windowLength, n), polyorder);
    const rightCenter = n - 1 - half;
    for (let i = n - half; i < n; i++) out[i] = evalPoly(cRight, i - rightCenter);
  }

  return out;
}

// --- deconvolve ----------------------------------------------------------------

/**
 * FIR/polynomial deconvolution (`scipy.signal.deconvolve`): standard
 * synthetic long division so that `signal = conv(divisor, quotient) + remainder`,
 * with `quotient` of length `signal.length - divisor.length + 1` and
 * `remainder` the same length as `signal` (zero when `divisor` exactly divides).
 */
export function deconvolve(signal: Vec, divisor: Vec): DeconvolveResult {
  const s = arr(signal);
  const d = arr(divisor);
  const N = s.length;
  const D = d.length;
  if (D === 0) throw new Error('deconvolve: divisor must be non-empty');
  if (d[0] === 0) throw new Error('deconvolve: divisor[0] (leading coefficient) must be nonzero');
  if (D > N) return { quotient: [], remainder: s.slice() };

  const remainder = s.slice();
  const quotient = new Array<number>(N - D + 1).fill(0);
  for (let i = 0; i < quotient.length; i++) {
    const c = remainder[i] / d[0];
    quotient[i] = c;
    for (let j = 0; j < D; j++) remainder[i + j] -= c * d[j];
  }
  return { quotient, remainder };
}

// --- wiener --------------------------------------------------------------------

/**
 * Wiener adaptive filter (`scipy.signal.wiener`-style, per-sample noise
 * estimate): local mean `m` and variance `v` over a sliding window of size
 * `mysize` (same-length, zero-padded at the edges — matches `convDirect`'s
 * `'same'` convention), noise power `= mean(v)`; output
 * `m + max(0, v−noise)/max(v, noise)·(x−m)` (0 where both `v` and `noise` are 0).
 */
export function wiener(x: Vec, mysize = 3): number[] {
  const xx = arr(x);
  const n = xx.length;
  if (!Number.isInteger(mysize) || mysize < 1)
    throw new Error('wiener: mysize must be a positive integer');

  const kernel = new Array<number>(mysize).fill(1 / mysize);
  const lMean = convDirect(xx, kernel, 'same');
  const lMeanSq = convDirect(
    xx.map((v) => v * v),
    kernel,
    'same'
  );
  const lVar = lMeanSq.map((v, i) => Math.max(0, v - lMean[i] * lMean[i]));
  const noise = lVar.reduce((a, b) => a + b, 0) / n;

  return xx.map((xi, i) => {
    const v = lVar[i];
    const denom = Math.max(v, noise);
    if (denom === 0) return lMean[i];
    return lMean[i] + (Math.max(0, v - noise) / denom) * (xi - lMean[i]);
  });
}

// --- firls / remez: least-squares & (approximate) equiripple FIR design ------

interface FirBasis {
  type1: boolean; // true: odd numtaps (Type I), false: even numtaps (Type II)
  M: number;
  nBasis: number;
  phi(k: number, w: number): number; // k in [0, nBasis)
}

function makeBasis(numtaps: number): FirBasis {
  const type1 = numtaps % 2 === 1;
  const M = type1 ? (numtaps - 1) / 2 : numtaps / 2;
  const nBasis = type1 ? M + 1 : M;
  return {
    type1,
    M,
    nBasis,
    phi: (k, w) => (type1 ? Math.cos(k * Math.PI * w) : Math.cos((k + 0.5) * Math.PI * w)),
  };
}

/** Map the basis coefficients (a_k / b_k for Type I / Type II) back to symmetric FIR taps. */
function coeffsToTaps(numtaps: number, basis: FirBasis, coeffs: readonly number[]): number[] {
  const h = new Array<number>(numtaps).fill(0);
  const { M, type1 } = basis;
  if (type1) {
    h[M] = coeffs[0];
    for (let k = 1; k <= M; k++) {
      h[M - k] = coeffs[k] / 2;
      h[M + k] = coeffs[k] / 2;
    }
  } else {
    for (let k = 1; k <= M; k++) {
      const v = coeffs[k - 1] / 2;
      h[M - k] = v;
      h[M - 1 + k] = v;
    }
  }
  return h;
}

interface BandSample {
  w: number;
  D: number;
  dw: number; // trapezoid quadrature weight
}

function validateBandsDesired(
  numtaps: number,
  bands: readonly number[],
  desired: readonly number[]
): void {
  if (!Number.isInteger(numtaps) || numtaps < 3)
    throw new Error('firls/remez: numtaps must be an integer >= 3');
  if (bands.length < 2 || bands.length % 2 !== 0)
    throw new Error('firls/remez: bands must be a non-empty list of [lo, hi] pairs');
  if (desired.length !== bands.length)
    throw new Error('firls/remez: desired must have the same length as bands');
  for (let i = 0; i < bands.length; i += 2) {
    if (!(bands[i] >= 0 && bands[i] < bands[i + 1] && bands[i + 1] <= 1))
      throw new Error('firls/remez: each band pair must satisfy 0 <= lo < hi <= 1');
  }
}

/** Dense trapezoid-quadrature sample points over the specified bands, with `desired` linearly interpolated within each band (transition regions between bands are unconstrained — "don't care"). */
function sampleBands(
  bands: readonly number[],
  desired: readonly number[],
  samplesPerBand = 400
): BandSample[] {
  const pts: BandSample[] = [];
  for (let band = 0; band < bands.length; band += 2) {
    const w0 = bands[band];
    const w1 = bands[band + 1];
    const d0 = desired[band];
    const d1 = desired[band + 1];
    const dw = (w1 - w0) / samplesPerBand;
    for (let s = 0; s <= samplesPerBand; s++) {
      const w = w0 + s * dw;
      const D = d0 + ((d1 - d0) * (w - w0)) / (w1 - w0);
      const weight = s === 0 || s === samplesPerBand ? 0.5 * dw : dw;
      pts.push({ w, D, dw: weight });
    }
  }
  return pts;
}

/** Weighted least-squares solve of the cosine-basis normal equations over `pts`. */
function solveWeightedBasis(
  basis: FirBasis,
  pts: readonly BandSample[],
  weights: readonly number[]
): number[] {
  const n = basis.nBasis;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  for (let i = 0; i < pts.length; i++) {
    const { w, D, dw } = pts[i];
    const wt = weights[i] * dw;
    const phis = Array.from({ length: n }, (_, k) => basis.phi(k, w));
    for (let a = 0; a < n; a++) {
      b[a] += wt * phis[a] * D;
      for (let c = 0; c < n; c++) A[a][c] += wt * phis[a] * phis[c];
    }
  }
  return solveLinearSystem(A, b);
}

/**
 * Least-squares linear-phase FIR design (`scipy.signal.firls`): `bands` is a
 * flat list of `[lo, hi]` band-edge pairs (normalized to Nyquist, 1 = Nyquist)
 * and `desired` the corresponding response values at those edges (linearly
 * interpolated within each band; gaps between bands are unconstrained
 * transition regions). Solves the normal equations of the cosine-basis
 * representation of a symmetric (Type I odd-length / Type II even-length)
 * linear-phase filter against a dense trapezoid-quadrature sampling of the
 * specified bands, then maps the fitted basis coefficients back to taps.
 */
export function firls(
  numtaps: number,
  bands: readonly number[],
  desired: readonly number[]
): number[] {
  validateBandsDesired(numtaps, bands, desired);
  const basis = makeBasis(numtaps);
  const pts = sampleBands(bands, desired);
  const coeffs = solveWeightedBasis(
    basis,
    pts,
    pts.map(() => 1)
  );
  return coeffsToTaps(numtaps, basis, coeffs);
}

/**
 * Optimal equiripple FIR design (`scipy.signal.remez`) via the exact
 * Parks-McClellan / Remez exchange algorithm (delegates to `remezExchange`).
 *
 * **Convention note:** unlike `firls` above (which follows `scipy.signal.firls`
 * with `1 = Nyquist` and one `desired` value per band *edge*), `remez` follows
 * `scipy.signal.remez` exactly: band edges are normalized to `[0, 0.5]`
 * (`fs = 1`, `0.5 = Nyquist`), and `desired`/`weight` carry one value per band
 * (length `bands.length / 2`). `type` is `'bandpass'` (symmetric, the default),
 * `'differentiator'`, or `'hilbert'` (antisymmetric). Coefficients match
 * `scipy.signal.remez` to machine precision.
 */
export function remez(
  numtaps: number,
  bands: readonly number[],
  desired: readonly number[],
  weight?: readonly number[],
  type: RemezType = 'bandpass'
): number[] {
  return remezExchange(numtaps, bands, desired, weight, type);
}
