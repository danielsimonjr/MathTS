/**
 * LTI system responses, transfer-function / state-space conversions, and
 * simple IIR notch / peak designs (scipy.signal parity for the covered cases).
 *
 * Transfer-function coefficient arrays are highest-power first (scipy order).
 *
 * @packageDocumentation
 */

import { lfilter } from '../signal-filter-extra.js';
import type { ComplexNumber } from './fft.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Continuous or discrete state-space realisation. */
export interface StateSpace {
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
}

/** Discretisation method for {@link cont2discrete}. */
export type DiscretizeMethod = 'zoh' | 'bilinear' | 'euler';

/** Second-order-section filter coefficients. */
export interface BiquadCoefficients {
  b: number[];
  a: number[];
}

// ---------------------------------------------------------------------------
// Small dense-matrix helpers (square / rectangular, plain arrays)
// ---------------------------------------------------------------------------

function zeros(r: number, c: number): number[][] {
  return Array.from({ length: r }, () => new Array<number>(c).fill(0));
}

function identity(n: number): number[][] {
  const I = zeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function matMul(X: number[][], Y: number[][]): number[][] {
  const r = X.length;
  const k = Y.length;
  const c = k > 0 ? Y[0].length : 0;
  const out = zeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let p = 0; p < k; p++) {
      const xip = X[i][p];
      if (xip === 0) continue;
      for (let j = 0; j < c; j++) out[i][j] += xip * Y[p][j];
    }
  }
  return out;
}

function scale(X: number[][], s: number): number[][] {
  return X.map((row) => row.map((v) => v * s));
}

function add(X: number[][], Y: number[][]): number[][] {
  return X.map((row, i) => row.map((v, j) => v + Y[i][j]));
}

/** Gauss-Jordan inverse with partial pivoting. */
function inverse(M: number[][]): number[][] {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...identity(n)[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[piv][col])) piv = r;
    }
    if (Math.abs(aug[piv][col]) < 1e-300) throw new RangeError('matrix is singular');
    [aug[col], aug[piv]] = [aug[piv], aug[col]];
    const p = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

/** Matrix exponential by scaling and squaring with a Taylor series. */
function expm(M: number[][]): number[][] {
  const n = M.length;
  let norm = 0;
  for (const row of M)
    norm = Math.max(
      norm,
      row.reduce((s, v) => s + Math.abs(v), 0)
    );
  const s = norm > 0.5 ? Math.ceil(Math.log2(norm / 0.5)) : 0;
  const X = scale(M, 1 / Math.pow(2, s));
  let E = identity(n);
  let term = identity(n);
  for (let k = 1; k <= 24; k++) {
    term = scale(matMul(term, X), 1 / k);
    E = add(E, term);
  }
  for (let i = 0; i < s; i++) E = matMul(E, E);
  return E;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Impulse response h[0..n-1] of the filter b / a. */
export function impulseResponse(b: Vec, a: Vec, n: number): number[] {
  if (!(a.length > 0 && a[0] !== 0)) throw new RangeError('impulseResponse: a[0] must be nonzero');
  const x = new Array<number>(n).fill(0);
  if (n > 0) x[0] = 1;
  return lfilter(b, a, x);
}

/** Step response y[0..n-1] of the filter b / a. */
export function stepResponse(b: Vec, a: Vec, n: number): number[] {
  return lfilter(b, a, new Array<number>(n).fill(1));
}

// ---------------------------------------------------------------------------
// State-space <-> transfer function (SISO, controllable canonical form)
// ---------------------------------------------------------------------------

/**
 * Transfer function to controllable canonical state space (SISO), as scipy.signal.tf2ss.
 *
 * @example
 * tf2ss([1], [1, 3, 2]); // A = [[-3, -2], [1, 0]], B = [[1], [0]], C = [[0, 1]], D = [[0]]
 */
export function tf2ss(b: Vec, a: Vec): StateSpace {
  const av = arr(a);
  const a0 = av[0];
  if (a0 === undefined || a0 === 0)
    throw new RangeError('tf2ss: leading denominator coefficient must be non-zero');
  const an = av.map((v) => v / a0);
  const bn = arr(b).map((v) => v / a0);
  const n = an.length - 1;
  if (bn.length > an.length) throw new RangeError('tf2ss: transfer function must be proper');
  if (n === 0) return { A: [], B: [], C: [], D: [[bn[bn.length - 1] ?? 0]] };

  const padded = new Array<number>(an.length - bn.length).fill(0).concat(bn);
  const D = padded[0];
  const A = zeros(n, n);
  const B = zeros(n, 1);
  const C = zeros(1, n);
  for (let j = 0; j < n; j++) A[0][j] = -an[j + 1];
  for (let i = 1; i < n; i++) A[i][i - 1] = 1;
  B[0][0] = 1;
  for (let j = 0; j < n; j++) C[0][j] = padded[j + 1] - D * an[j + 1];
  return { A, B, C, D: [[D]] };
}

/** Characteristic polynomial det(lambda I - M), highest power first (Faddeev-LeVerrier). */
function charPoly(M: number[][]): number[] {
  const n = M.length;
  const c = new Array<number>(n + 1).fill(0);
  c[n] = 1;
  let Mk = zeros(n, n);
  for (let k = 1; k <= n; k++) {
    Mk = add(matMul(M, Mk), scale(identity(n), c[n - k + 1]));
    const AM = matMul(M, Mk);
    let tr = 0;
    for (let i = 0; i < n; i++) tr += AM[i][i];
    c[n - k] = -tr / k;
  }
  return c.slice().reverse();
}

/** Strip leading zeros, keeping at least one coefficient. */
function trimLeading(p: number[]): number[] {
  let k = 0;
  while (k < p.length - 1 && p[k] === 0) k++;
  return p.slice(k);
}

/**
 * State space to transfer function (SISO), as scipy.signal.ss2tf.
 * num is returned without leading zeros.
 */
export function ss2tf(
  A: number[][],
  B: number[][],
  C: number[][],
  D: number[][]
): { num: number[]; den: number[] } {
  const n = A.length;
  if (B[0]?.length !== 1 || C.length !== 1)
    throw new RangeError('ss2tf: only SISO systems are supported');
  const d = D[0][0];
  if (n === 0) return { num: [d], den: [1] };
  const den = charPoly(A);
  const ABC = A.map((row, i) => row.map((v, j) => v - B[i][0] * C[0][j]));
  const base = charPoly(ABC);
  const num = base.map((v, k) => v + (d - 1) * den[k]);
  return { num: trimLeading(num), den };
}

/**
 * Convert a continuous state-space system to discrete time with sample period dt.
 *
 * - `zoh`: exact zero-order hold, via the exponential of [[A, B], [0, 0]] dt
 * - `bilinear`: Tustin (scipy, alpha = 1/2), with M = (I - A dt/2)^-1:
 *   Ad = M (I + A dt/2), Bd = M B dt, Cd = C M, Dd = D + C Bd / 2
 * - `euler`: forward Euler, Ad = I + A dt, Bd = B dt
 */
export function cont2discrete(
  sys: StateSpace,
  dt: number,
  method: DiscretizeMethod = 'zoh'
): StateSpace {
  if (!(dt > 0)) throw new RangeError(`cont2discrete: dt must be > 0, got ${dt}`);
  const { A, B, C, D } = sys;
  const n = A.length;
  const m = n > 0 ? B[0].length : 0;
  let Ad: number[][];
  let Bd: number[][];
  let Cd: number[][] = C.map((row) => row.slice());
  let Dd: number[][] = D.map((row) => row.slice());
  switch (method) {
    case 'zoh': {
      const big = zeros(n + m, n + m);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) big[i][j] = A[i][j] * dt;
        for (let j = 0; j < m; j++) big[i][n + j] = B[i][j] * dt;
      }
      const E = expm(big);
      Ad = E.slice(0, n).map((row) => row.slice(0, n));
      Bd = E.slice(0, n).map((row) => row.slice(n, n + m));
      break;
    }
    case 'bilinear': {
      const inv = inverse(add(identity(n), scale(A, -dt / 2)));
      Ad = matMul(inv, add(identity(n), scale(A, dt / 2)));
      Bd = scale(matMul(inv, B), dt);
      Cd = matMul(C, inv);
      Dd = add(D, scale(matMul(C, Bd), 0.5));
      break;
    }
    case 'euler':
      Ad = add(identity(n), scale(A, dt));
      Bd = scale(B, dt);
      break;
    default:
      throw new Error(`cont2discrete: unknown method '${String(method)}'`);
  }
  return {
    A: Ad,
    B: Bd,
    C: Cd,
    D: Dd,
  };
}

// ---------------------------------------------------------------------------
// Notch / peak designs and conversions
// ---------------------------------------------------------------------------

function checkW0Q(w0: number, Q: number, name: string): void {
  if (!(w0 > 0 && w0 < 1)) throw new RangeError(`${name}: w0 must be in (0, 1) (x pi rad/sample)`);
  if (!(Q > 0)) throw new RangeError(`${name}: Q must be > 0`);
}

/** scipy's band-edge parameter: bandwidth w0 pi / Q rad, edge gain 1/sqrt(2). */
function notchPeakGain(w0: number, Q: number): number {
  const bw = (w0 / Q) * Math.PI;
  const gb = Math.SQRT1_2;
  const beta = (Math.sqrt(1 - gb * gb) / gb) * Math.tan(bw / 2);
  return 1 / (1 + beta);
}

/**
 * Second-order IIR notch at normalised frequency w0 (x pi rad/sample), quality
 * factor Q = w0 / bandwidth (scipy.signal.iirnotch convention: -3 dB bandwidth
 * w0 pi / Q). Zero at w0, unity gain at DC.
 */
export function iirNotch(w0: number, Q: number): BiquadCoefficients {
  checkW0Q(w0, Q, 'iirNotch');
  const c = Math.cos(Math.PI * w0);
  const gain = notchPeakGain(w0, Q);
  return {
    b: [gain, -2 * gain * c, gain],
    a: [1, -2 * gain * c, 2 * gain - 1],
  };
}

/**
 * Second-order IIR peak (band-pass) at w0 (x pi rad/sample), unity gain at w0 and
 * zero gain at DC and Nyquist (scipy.signal.iirpeak convention, Q = w0 / bandwidth).
 */
export function iirPeak(w0: number, Q: number): BiquadCoefficients {
  checkW0Q(w0, Q, 'iirPeak');
  const c = Math.cos(Math.PI * w0);
  const gain = notchPeakGain(w0, Q);
  return {
    b: [1 - gain, 0, -(1 - gain)],
    a: [1, -2 * gain * c, 2 * gain - 1],
  };
}

/** Roots of a polynomial (highest power first) by Durand-Kerner iteration. */
function polyRoots(coeffs: number[]): ComplexNumber[] {
  const c = trimLeading(coeffs);
  const deg = c.length - 1;
  if (deg < 1) return [];
  const lead = c[0];
  const monic = c.map((v) => v / lead);
  const evalP = (z: ComplexNumber): ComplexNumber => {
    let re = 0;
    let im = 0;
    for (const coef of monic) {
      const nre = re * z.re - im * z.im + coef;
      im = re * z.im + im * z.re;
      re = nre;
    }
    return { re, im };
  };
  let roots: ComplexNumber[] = Array.from({ length: deg }, (_, k) => {
    const base = { re: 0.4, im: 0.9 };
    let p: ComplexNumber = { re: 1, im: 0 };
    for (let i = 0; i <= k; i++)
      p = { re: p.re * base.re - p.im * base.im, im: p.re * base.im + p.im * base.re };
    return p;
  });
  for (let iter = 0; iter < 1000; iter++) {
    let maxStep = 0;
    roots = roots.map((r, i) => {
      let den: ComplexNumber = { re: 1, im: 0 };
      for (let j = 0; j < roots.length; j++) {
        if (j === i) continue;
        const d = { re: r.re - roots[j].re, im: r.im - roots[j].im };
        den = { re: den.re * d.re - den.im * d.im, im: den.re * d.im + den.im * d.re };
      }
      const pv = evalP(r);
      const q = den.re * den.re + den.im * den.im;
      const step =
        q === 0
          ? { re: 0, im: 0 }
          : {
              re: (pv.re * den.re + pv.im * den.im) / q,
              im: (pv.im * den.re - pv.re * den.im) / q,
            };
      maxStep = Math.max(maxStep, Math.hypot(step.re, step.im));
      return { re: r.re - step.re, im: r.im - step.im };
    });
    if (maxStep < 1e-15) break;
  }
  return roots.sort((x, y) => x.re - y.re || x.im - y.im);
}

/**
 * Transfer function to zeros, poles and gain (scipy.signal.tf2zpk). Zeros and
 * poles are sorted by real then imaginary part.
 */
export function tf2zpk(b: Vec, a: Vec): { z: ComplexNumber[]; p: ComplexNumber[]; k: number } {
  const bn = trimLeading(arr(b));
  const an = trimLeading(arr(a));
  if (an.length === 0 || an[0] === 0)
    throw new RangeError('tf2zpk: denominator leading coefficient must be non-zero');
  return { z: polyRoots(bn), p: polyRoots(an), k: bn[0] / an[0] };
}

/**
 * Cascade of second-order sections to a single transfer function. Each section
 * is [b0, b1, b2, a0, a1, a2]; the result is not normalised by a0.
 */
export function sos2tf(sos: ReadonlyArray<readonly number[]>): { b: number[]; a: number[] } {
  let b: number[] = [1];
  let a: number[] = [1];
  const conv = (p: number[], q: number[]): number[] => {
    const out = new Array<number>(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] += p[i] * q[j];
    return out;
  };
  for (const section of sos) {
    if (section.length !== 6) throw new RangeError('sos2tf: each section needs 6 coefficients');
    b = conv(b, section.slice(0, 3));
    a = conv(a, section.slice(3, 6));
  }
  return { b, a };
}
