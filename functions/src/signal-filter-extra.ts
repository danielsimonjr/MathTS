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
    throw new Error(
      'lfilterZi: filter has a pole at z=1 (singular I − Aᵀ); steady-state zi is undefined'
    );
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
  const fwd = lfilterState(
    bb,
    aa,
    ext,
    zi.map((v) => v * ext[0])
  ).y;
  // backward pass seeded with steady state for the (reversed) first sample
  const rev = fwd.slice().reverse();
  const back = lfilterState(
    bb,
    aa,
    rev,
    zi.map((v) => v * rev[0])
  ).y.reverse();
  return back.slice(pad, pad + n);
}

// --- IIR design shared plumbing (zpk analog prototype → frequency transform →
// bilinear → transfer function). Reused by butter here and by cheby1/cheby2/ellip
// in signal/iir-design.ts. ---------------------------------------------------

export const cAdd = (p: Complex, q: Complex): Complex => p.add(q);
export const cSub = (p: Complex, q: Complex): Complex => p.sub(q);
export const cMul = (p: Complex, q: Complex): Complex => p.multiply(q);
export const cDiv = (p: Complex, q: Complex): Complex => p.divide(q);
/** Scale a Complex by a real number (`Complex.mul` only accepts `Scalar`, not `number`). */
export const cScale = (p: Complex, s: number): Complex => cMul(p, new Complex(s, 0));

/** Real polynomial coefficients (highest degree first) of ∏(x − rₖ). */
export function polyFromRoots(roots: Complex[]): number[] {
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

/** Analog lowpass prototype: zeros, poles, gain (cutoff normalized to 1 rad/s). */
export interface AnalogProto {
  z: Complex[];
  p: Complex[];
  k: number;
}

export type FilterBtype = 'low' | 'high' | 'bandpass' | 'bandstop';

function relativeDegree(z: Complex[], p: Complex[]): number {
  const degree = p.length - z.length;
  if (degree < 0) throw new Error('Improper transfer function: fewer poles than zeros');
  return degree;
}

/** s → s/wo (scipy `lp2lp_zpk`). */
function lp2lpZpk(z: Complex[], p: Complex[], k: number, wo: number): AnalogProto {
  const degree = relativeDegree(z, p);
  return {
    z: z.map((zv) => cScale(zv, wo)),
    p: p.map((pv) => cScale(pv, wo)),
    k: k * Math.pow(wo, degree),
  };
}

/** s → wo/s (scipy `lp2hp_zpk`). */
function lp2hpZpk(z: Complex[], p: Complex[], k: number, wo: number): AnalogProto {
  const degree = relativeDegree(z, p);
  const woC = new Complex(wo, 0);
  const zHp = z.map((zv) => cDiv(woC, zv));
  for (let i = 0; i < degree; i++) zHp.push(new Complex(0, 0));
  let prodZ = new Complex(1, 0);
  for (const zv of z) prodZ = cMul(prodZ, zv.negate());
  let prodP = new Complex(1, 0);
  for (const pv of p) prodP = cMul(prodP, pv.negate());
  return { z: zHp, p: p.map((pv) => cDiv(woC, pv)), k: k * cDiv(prodZ, prodP).re };
}

/** s → (s² + wo²)/(s·bw) (scipy `lp2bp_zpk`, "wideband" transform). */
function lp2bpZpk(z: Complex[], p: Complex[], k: number, wo: number, bw: number): AnalogProto {
  const degree = relativeDegree(z, p);
  const wo2 = new Complex(wo * wo, 0);
  const shift = (roots: Complex[]): Complex[] => {
    const lp = roots.map((r) => cScale(r, bw / 2));
    const plus = lp.map((r) => cAdd(r, cSub(cMul(r, r), wo2).sqrt()));
    const minus = lp.map((r) => cSub(r, cSub(cMul(r, r), wo2).sqrt()));
    return plus.concat(minus);
  };
  const zBp = shift(z);
  for (let i = 0; i < degree; i++) zBp.push(new Complex(0, 0));
  return { z: zBp, p: shift(p), k: k * Math.pow(bw, degree) };
}

/** s → (s·bw)/(s² + wo²) (scipy `lp2bs_zpk`, "wideband" transform). */
function lp2bsZpk(z: Complex[], p: Complex[], k: number, wo: number, bw: number): AnalogProto {
  const degree = relativeDegree(z, p);
  const wo2 = new Complex(wo * wo, 0);
  const bw2 = new Complex(bw / 2, 0);
  const shift = (roots: Complex[]): Complex[] => {
    const hp = roots.map((r) => cDiv(bw2, r));
    const plus = hp.map((r) => cAdd(r, cSub(cMul(r, r), wo2).sqrt()));
    const minus = hp.map((r) => cSub(r, cSub(cMul(r, r), wo2).sqrt()));
    return plus.concat(minus);
  };
  const zBs = shift(z);
  for (let i = 0; i < degree; i++) zBs.push(new Complex(0, wo));
  for (let i = 0; i < degree; i++) zBs.push(new Complex(0, -wo));
  let prodZ = new Complex(1, 0);
  for (const zv of z) prodZ = cMul(prodZ, zv.negate());
  let prodP = new Complex(1, 0);
  for (const pv of p) prodP = cMul(prodP, pv.negate());
  return { z: zBs, p: shift(p), k: k * cDiv(prodZ, prodP).re };
}

/** Tustin's bilinear transform of a zpk analog filter (scipy `bilinear_zpk`). */
function bilinearZpk(z: Complex[], p: Complex[], k: number, fs: number): AnalogProto {
  const degree = relativeDegree(z, p);
  const fs2 = new Complex(2 * fs, 0);
  const zZ = z.map((zv) => cDiv(cAdd(fs2, zv), cSub(fs2, zv)));
  for (let i = 0; i < degree; i++) zZ.push(new Complex(-1, 0));
  let prodZ = new Complex(1, 0);
  for (const zv of z) prodZ = cMul(prodZ, cSub(fs2, zv));
  let prodP = new Complex(1, 0);
  for (const pv of p) prodP = cMul(prodP, cSub(fs2, pv));
  return {
    z: zZ,
    p: p.map((pv) => cDiv(cAdd(fs2, pv), cSub(fs2, pv))),
    k: k * cDiv(prodZ, prodP).re,
  };
}

/** zpk → transfer-function coefficients (scipy `zpk2tf`). */
export function zpkToTf(z: Complex[], p: Complex[], k: number): { b: number[]; a: number[] } {
  return { b: polyFromRoots(z).map((v) => v * k), a: polyFromRoots(p) };
}

function validateWn(Wn: number | readonly number[], btype: FilterBtype): number[] {
  const needsPair = btype === 'bandpass' || btype === 'bandstop';
  const arr = Array.isArray(Wn) ? Wn.slice() : [Wn as number];
  if (needsPair && arr.length !== 2)
    throw new Error(`${btype} filter design requires Wn = [low, high]`);
  if (!needsPair && arr.length !== 1)
    throw new Error(`${btype} filter design requires a scalar Wn`);
  for (const w of arr) {
    if (!(w > 0 && w < 1)) throw new Error('Wn must satisfy 0 < Wn < 1 (normalized to Nyquist)');
  }
  if (needsPair && !(arr[0] < arr[1])) throw new Error('Wn[0] must be less than Wn[1]');
  return arr;
}

/**
 * Digital IIR filter design pipeline shared by butter/cheby1/cheby2/ellip:
 * pre-warp `Wn` → frequency-transform the analog lowpass prototype (`proto`,
 * cutoff normalized to 1 rad/s) to the requested `btype` → bilinear transform →
 * zpk2tf. Matches `scipy.signal.iirfilter`'s internal pipeline (fs = 2 convention).
 */
export function analogToDigital(
  proto: AnalogProto,
  Wn: number | readonly number[],
  btype: FilterBtype
): { b: number[]; a: number[] } {
  const WnArr = validateWn(Wn, btype);
  const fs = 2;
  const warped = WnArr.map((w) => 2 * fs * Math.tan((Math.PI * w) / fs));
  let { z, p, k } = proto;
  if (btype === 'low') {
    ({ z, p, k } = lp2lpZpk(z, p, k, warped[0]));
  } else if (btype === 'high') {
    ({ z, p, k } = lp2hpZpk(z, p, k, warped[0]));
  } else {
    const bw = warped[1] - warped[0];
    const wo = Math.sqrt(warped[0] * warped[1]);
    ({ z, p, k } = btype === 'bandpass' ? lp2bpZpk(z, p, k, wo, bw) : lp2bsZpk(z, p, k, wo, bw));
  }
  ({ z, p, k } = bilinearZpk(z, p, k, fs));
  return zpkToTf(z, p, k);
}

/** Analog Butterworth prototype poles (scipy `buttap`): all-pole, no zeros. */
function buttap(N: number): AnalogProto {
  const p: Complex[] = [];
  for (let k = 0; k < N; k++) {
    const m = -N + 1 + 2 * k;
    const theta = (Math.PI * m) / (2 * N);
    p.push(new Complex(-Math.cos(theta), -Math.sin(theta)));
  }
  return { z: [], p, k: 1 };
}

/**
 * Butterworth IIR filter design — returns `{ b, a }` transfer-function coefficients.
 * `N` is the order, `Wn` the cutoff (scalar) or `[low, high]` band edges, normalized
 * to Nyquist (0..1). `btype` defaults to `'low'` (matches the original 2-arg call
 * unchanged). Matches `scipy.signal.butter(N, Wn, btype)`.
 */
export function butter(
  N: number,
  Wn: number | readonly number[],
  btype: FilterBtype = 'low'
): { b: number[]; a: number[] } {
  if (!Number.isInteger(N) || N < 1) throw new Error('butter: order N must be a positive integer');
  return analogToDigital(buttap(N), Wn, btype);
}
