/**
 * Digital filter design + application (Wave D / remaining). FIR window design
 * (`firwin`), IIR Butterworth design (`butter`), the direct-form filter (`lfilter`),
 * and zero-phase filtering (`filtfilt`). Matches `scipy.signal`. `butter` reuses the
 * core `Complex` type for the analog-pole bilinear-transform pipeline.
 */
import { Complex } from '@danielsimonjr/mathts-core';
import { inv as _invRaw } from './factories/index.js';
import { companion } from './linalg-extra.js';

const _inv = _invRaw as unknown as (m: number[][]) => number[][];

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

const sinc = (x: number): number => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

/**
 * FIR lowpass filter coefficients by the windowed-sinc method (Hamming window,
 * normalized to unit DC gain) — `scipy.signal.firwin(numtaps, cutoff)` with the
 * default window. `cutoff` is normalized to Nyquist (1 = Nyquist).
 */
export function firwin(numtaps: number, cutoff: number): number[] {
  if (!Number.isInteger(numtaps) || numtaps < 2)
    throw new Error('firwin: numtaps must be an integer >= 2');
  const M = numtaps - 1;
  const h = new Array<number>(numtaps);
  for (let n = 0; n <= M; n++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / M); // Hamming
    h[n] = cutoff * sinc(cutoff * (n - M / 2)) * w;
  }
  const s = h.reduce((a, b) => a + b, 0);
  if (Math.abs(s) < 1e-12)
    throw new Error('firwin: degenerate design — taps sum to ~0 (cutoff at/near 0)');
  return h.map((v) => v / s); // scale to unit gain at DC
}

/** Normalize (b, a) by a[0] and zero-pad both to length n = max(len a, len b). */
function padCoeffs(b: number[], a: number[]): { b: number[]; a: number[]; n: number } {
  const n = Math.max(a.length, b.length);
  const a0 = a[0];
  const bn = Array.from({ length: n }, (_, i) => (i < b.length ? b[i] : 0) / a0);
  const an = Array.from({ length: n }, (_, i) => (i < a.length ? a[i] : 0) / a0);
  return { b: bn, a: an, n };
}

/**
 * Direct-form II transposed filter with optional initial state `zi` (length n−1).
 * Returns the output and the final state — the building block for `lfilter`/`filtfilt`.
 */
function lfilterState(
  b: number[],
  a: number[],
  x: number[],
  zi?: number[]
): { y: number[]; zf: number[] } {
  const { b: bb, a: aa, n } = padCoeffs(b, a);
  const z = zi ? zi.slice() : new Array<number>(Math.max(n - 1, 0)).fill(0);
  const y = new Array<number>(x.length);
  for (let m = 0; m < x.length; m++) {
    const xm = x[m];
    const ym = bb[0] * xm + (z.length ? z[0] : 0);
    for (let i = 0; i < n - 2; i++) z[i] = bb[i + 1] * xm + z[i + 1] - aa[i + 1] * ym;
    if (n >= 2) z[n - 2] = bb[n - 1] * xm - aa[n - 1] * ym;
    y[m] = ym;
  }
  return { y, zf: z };
}

/**
 * Apply an IIR/FIR filter with coefficients `b` (numerator), `a` (denominator) to
 * `x` (direct form II transposed). `a[0]` normalizes. Matches `scipy.signal.lfilter`.
 */
export function lfilter(b: Vec, a: Vec, x: Vec): number[] {
  return lfilterState(arr(b), arr(a), arr(x)).y;
}

/**
 * Steady-state initial conditions for `lfilter` so a constant input is unchanged at
 * the boundary — `scipy.signal.lfilter_zi`. Solves `(I − Aᵀ) zi = B` where `A` is the
 * companion matrix of `a` and `B = b[1:] − a[1:]·b[0]`. Reuses `companion` + `inv`.
 */
export function lfilterZi(b: Vec, a: Vec): number[] {
  const { b: bb, a: aa, n } = padCoeffs(arr(b), arr(a));
  if (n < 2) return [];
  const C = companion(aa); // (n−1)×(n−1) companion of the (monic) denominator
  const M = Array.from({ length: n - 1 }, (_, i) =>
    Array.from({ length: n - 1 }, (_, j) => (i === j ? 1 : 0) - C[j][i])
  ); // I − Aᵀ
  const B = Array.from({ length: n - 1 }, (_, i) => bb[i + 1] - aa[i + 1] * bb[0]);
  let Minv: number[][];
  try {
    Minv = _inv(M);
  } catch {
    // (I − Aᵀ) is singular ⇔ the denominator has a root at z = 1 (a pure integrator /
    // marginally-stable filter); the steady state is undefined. Fail with a clear message
    // instead of leaking inv's cryptic "determinant is zero".
    throw new Error('lfilterZi: filter has a pole at z=1 (singular I − Aᵀ); steady-state zi is undefined');
  }
  const zi = Minv.map((row) => row.reduce((s, v, k) => s + v * B[k], 0));
  if (zi.some((v) => !Number.isFinite(v)))
    throw new Error('lfilterZi: non-finite steady state (unstable or marginally-stable filter)');
  return zi;
}

/**
 * Zero-phase forward–backward filtering (`scipy.signal.filtfilt`), with odd
 * reflection padding (default pad length `3·max(len a, len b)`). The squared
 * magnitude response is applied with no phase distortion.
 */
export function filtfilt(b: Vec, a: Vec, x: Vec): number[] {
  const bb = arr(b);
  const aa = arr(a);
  const xx = arr(x);
  const n = xx.length;
  const ntaps = Math.max(aa.length, bb.length);
  const pad = 3 * ntaps; // scipy default padlen = 3·max(len a, len b)
  if (pad >= n) throw new Error(`filtfilt: signal length ${n} must exceed padlen ${pad}`);
  // odd reflection padding at both ends: 2·x[edge] − x[edge∓k]
  const left: number[] = [];
  for (let k = pad; k >= 1; k--) left.push(2 * xx[0] - xx[k]);
  const right: number[] = [];
  for (let k = 1; k <= pad; k++) right.push(2 * xx[n - 1] - xx[n - 1 - k]);
  const ext = [...left, ...xx, ...right];
  const zi = lfilterZi(bb, aa);
  // forward pass seeded with steady state for ext[0]
  const fwd = lfilterState(bb, aa, ext, zi.map((v) => v * ext[0])).y;
  // backward pass seeded with steady state for the (reversed) first sample
  const rev = fwd.slice().reverse();
  const back = lfilterState(bb, aa, rev, zi.map((v) => v * rev[0])).y.reverse();
  return back.slice(pad, pad + n);
}

// --- Butterworth IIR design (zpk → bilinear → transfer function) -----------------

const cAdd = (p: Complex, q: Complex): Complex => p.add(q);
const cSub = (p: Complex, q: Complex): Complex => p.sub(q);
const cMul = (p: Complex, q: Complex): Complex => p.multiply(q);
const cDiv = (p: Complex, q: Complex): Complex => p.divide(q);

/** Real polynomial coefficients (highest degree first) of ∏(x − rₖ). */
function polyFromRoots(roots: Complex[]): number[] {
  let c: Complex[] = [new Complex(1, 0)];
  for (const r of roots) {
    const next: Complex[] = Array.from({ length: c.length + 1 }, () => new Complex(0, 0));
    for (let i = 0; i < c.length; i++) {
      next[i] = cAdd(next[i], c[i]);
      next[i + 1] = cSub(next[i + 1], cMul(c[i], r));
    }
    c = next;
  }
  return c.map((z) => z.re); // imaginary parts cancel for conjugate-symmetric root sets
}

/**
 * Butterworth IIR filter design — returns `{ b, a }` transfer-function coefficients.
 * `N` is the order, `Wn` the cutoff normalized to Nyquist (0..1). Lowpass only
 * (`btype='low'`, the common case). Matches `scipy.signal.butter(N, Wn)`.
 */
export function butter(N: number, Wn: number): { b: number[]; a: number[] } {
  if (!Number.isInteger(N) || N < 1) throw new Error('butter: order N must be a positive integer');
  if (!(Wn > 0 && Wn < 1))
    throw new Error('butter: Wn must satisfy 0 < Wn < 1 (normalized to Nyquist)');
  // analog prototype poles (buttap): pₖ = −exp(jπ·mₖ/(2N)), mₖ = −N+1, −N+3, …, N−1
  const ap: Complex[] = [];
  for (let k = 0; k < N; k++) {
    const m = -N + 1 + 2 * k;
    const theta = (Math.PI * m) / (2 * N);
    ap.push(new Complex(-Math.cos(theta), -Math.sin(theta)));
  }
  // lowpass warp (scipy fs = 2): warped = 2·fs·tan(π·Wn/fs) = 4·tan(π·Wn/2)
  const fs = 2;
  const warped = 2 * fs * Math.tan((Math.PI * Wn) / fs);
  const pLp = ap.map((p) => cMul(p, new Complex(warped, 0))); // lp2lp poles
  const kLp = Math.pow(warped, N); // analog gain (no zeros)
  // bilinear transform (fs2 = 2·fs = 4): zd = (fs2 + s)/(fs2 − s)
  const fs2 = new Complex(2 * fs, 0);
  const pd = pLp.map((p) => cDiv(cAdd(fs2, p), cSub(fs2, p)));
  const zd: Complex[] = Array.from({ length: N }, () => new Complex(-1, 0)); // zeros at Nyquist
  // bilinear gain: k_d = k · Re(∏(fs2 − z) / ∏(fs2 − p)); zeros are at infinity → ∏ = 1
  let denom = new Complex(1, 0);
  for (const p of pLp) denom = cMul(denom, cSub(fs2, p));
  const kd = kLp / denom.re;
  // zpk → tf
  const b = polyFromRoots(zd).map((v) => v * kd);
  const a = polyFromRoots(pd);
  return { b, a };
}
