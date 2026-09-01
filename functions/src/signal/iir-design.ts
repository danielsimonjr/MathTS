/**
 * Chebyshev I/II and elliptic (Cauer) IIR filter design, plus the supporting
 * `zpk2sos`/`sosfilt`/`bilinear`/`buttord` utilities. Extends the Butterworth
 * pipeline in `../signal-filter-extra.ts` with two more analog prototypes and
 * reuses its shared zpk→transfer-function plumbing (`analogToDigital`,
 * `polyFromRoots`). Matches `scipy.signal` — every coefficient set pinned
 * against `scipy.signal.{cheby1,cheby2,ellip,bilinear,buttord}` (see
 * `functions/tests/iir-design.test.ts`).
 *
 * The elliptic prototype (`ellipap`) follows Orfanidis, "Lecture Notes on
 * Elliptic Filter Design" (the algorithm scipy itself implements): the filter
 * degree equation is solved in closed form via the theta-function nome
 * expansion (`ellipdeg`), and the "arc Jacobi sc" root (`arcJacSc1`) via the
 * descending Landen transformation (`arcJacSn`) — no numerical optimizer is
 * needed. Reuses the repo's existing AGM-based `ellipticKScalar` and
 * `jacobiSN`/`jacobiCN`/`jacobiDN` (Phase 5 special functions, `m = k²`
 * convention, matching scipy's `ellipk`/`ellipj`).
 */
import { Complex } from '@danielsimonjr/mathts-core';
import {
  analogToDigital,
  cDiv,
  cMul,
  cScale,
  polyFromRoots,
  type AnalogProto,
  type FilterBtype,
} from '../signal-filter-extra.js';
import { lfilter } from '../signal-filter-extra.js';
import { ellipticKScalar } from '../wasm/special/scalars.js';
import { jacobiCN, jacobiDN, jacobiSN } from '../special/jacobi-elliptic.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

// --- Chebyshev Type I prototype (scipy `cheb1ap`) ---------------------------

function cheb1ap(N: number, rp: number): AnalogProto {
  const eps = Math.sqrt(Math.pow(10, 0.1 * rp) - 1);
  const mu = (1 / N) * Math.asinh(1 / eps);
  const p: Complex[] = [];
  for (let m = -N + 1; m < N; m += 2) {
    const theta = (Math.PI * m) / (2 * N);
    p.push(new Complex(-Math.sinh(mu) * Math.cos(theta), -Math.cosh(mu) * Math.sin(theta)));
  }
  let prod = new Complex(1, 0);
  for (const pv of p) prod = cMul(prod, pv.negate());
  let k = prod.re;
  if (N % 2 === 0) k /= Math.sqrt(1 + eps * eps);
  return { z: [], p, k };
}

/**
 * Chebyshev Type I digital IIR filter design — equiripple in the passband, `rp`
 * dB of ripple. `Wn` is the cutoff (scalar) or `[low, high]` band edges,
 * normalized to Nyquist. Matches `scipy.signal.cheby1(N, rp, Wn, btype)`.
 */
export function cheby1(
  N: number,
  rp: number,
  Wn: number | readonly number[],
  btype: FilterBtype = 'low'
): { b: number[]; a: number[] } {
  if (!Number.isInteger(N) || N < 1) throw new Error('cheby1: order N must be a positive integer');
  if (!(rp > 0)) throw new Error('cheby1: rp (passband ripple, dB) must be positive');
  return analogToDigital(cheb1ap(N, rp), Wn, btype);
}

// --- Chebyshev Type II prototype (scipy `cheb2ap`) --------------------------

function cheb2ap(N: number, rs: number): AnalogProto {
  const de = 1 / Math.sqrt(Math.pow(10, 0.1 * rs) - 1);
  const mu = Math.asinh(1 / de) / N;

  const mVals: number[] = [];
  if (N % 2) {
    for (let m = -N + 1; m < 0; m += 2) mVals.push(m);
    for (let m = 2; m < N; m += 2) mVals.push(m);
  } else {
    for (let m = -N + 1; m < N; m += 2) mVals.push(m);
  }
  const z: Complex[] = mVals.map((m) => new Complex(0, 1 / Math.sin((m * Math.PI) / (2 * N))));

  const p: Complex[] = [];
  for (let m = -N + 1; m < N; m += 2) {
    const theta = (Math.PI * m) / (2 * N);
    const s = new Complex(Math.sinh(mu) * Math.cos(theta), Math.cosh(mu) * Math.sin(theta));
    p.push(cDiv(new Complex(1, 0), s).negate());
  }

  let prodP = new Complex(1, 0);
  for (const pv of p) prodP = cMul(prodP, pv.negate());
  let prodZ = new Complex(1, 0);
  for (const zv of z) prodZ = cMul(prodZ, zv.negate());
  const k = cDiv(prodP, prodZ).re;
  return { z, p, k };
}

/**
 * Chebyshev Type II digital IIR filter design — equiripple in the stopband,
 * `rs` dB of stopband attenuation, monotone passband. `Wn` is the cutoff
 * (scalar) or `[low, high]` band edges, normalized to Nyquist. Matches
 * `scipy.signal.cheby2(N, rs, Wn, btype)`.
 */
export function cheby2(
  N: number,
  rs: number,
  Wn: number | readonly number[],
  btype: FilterBtype = 'low'
): { b: number[]; a: number[] } {
  if (!Number.isInteger(N) || N < 1) throw new Error('cheby2: order N must be a positive integer');
  if (!(rs > 0)) throw new Error('cheby2: rs (stopband attenuation, dB) must be positive');
  return analogToDigital(cheb2ap(N, rs), Wn, btype);
}

// --- Elliptic (Cauer) prototype (scipy `ellipap`) ---------------------------
// Orfanidis eq. (49): degree equation solved via the nome q of m1 = ck1².

const ELLIPDEG_MMAX = 7;

/** Solve `N·K(m)/K'(m) = K(m1)/K'(m1)` for `m`, in closed form via nomes. */
function ellipdeg(N: number, m1: number): number {
  const K1 = ellipticKScalar(m1);
  const K1p = ellipticKScalar(1 - m1); // K'(m1) = K(1 − m1)
  const q1 = Math.exp((-Math.PI * K1p) / K1);
  const q = Math.pow(q1, 1 / N);
  let num = 0;
  for (let i = 0; i <= ELLIPDEG_MMAX; i++) num += Math.pow(q, i * (i + 1));
  let den = 1;
  for (let i = 1; i <= ELLIPDEG_MMAX + 1; i++) den += 2 * Math.pow(q, i * i);
  return 16 * q * Math.pow(num / den, 4);
}

/** `sqrt((1-kx)(1+kx))`, real modulus (Orfanidis eq. 56 helper). */
function complementReal(kx: number): number {
  return Math.sqrt((1 - kx) * (1 + kx));
}

/** Complex-valued analogue of `complementReal`, used inside the Landen recursion. */
function complementComplex(kx: Complex): Complex {
  const one = new Complex(1, 0);
  return one.sub(kx).mul(one.add(kx)).sqrt();
}

const ARC_JAC_SN_MAX_ITER = 100;

/**
 * Inverse Jacobi elliptic sn: solve `w = sn(z, m)` for `z`, via the descending
 * Landen transformation (Orfanidis eq. 56). `w` may be complex; `m` is a real
 * modulus parameter in `[0, 1]`.
 */
function arcJacSn(w: Complex, m: number): Complex {
  const k = Math.sqrt(m);
  if (k > 1) throw new Error('arcJacSn: modulus out of range');
  if (k === 1) return w.atanh();

  const ks: number[] = [k];
  let niter = 0;
  while (ks[ks.length - 1] !== 0) {
    const kCur = ks[ks.length - 1];
    const kp = complementReal(kCur);
    const next = (1 - kp) / (1 + kp);
    ks.push(next);
    niter++;
    if (niter > ARC_JAC_SN_MAX_ITER)
      throw new Error('arcJacSn: Landen transformation did not converge');
    if (next < 1e-18) {
      ks[ks.length - 1] = 0;
      break;
    }
  }
  let K = 1;
  for (let i = 1; i < ks.length; i++) K *= 1 + ks[i];
  K *= Math.PI / 2;

  let wn = w;
  for (let i = 0; i < ks.length - 1; i++) {
    const knext = ks[i + 1];
    const comp = complementComplex(cScale(wn, ks[i]));
    wn = cDiv(cScale(wn, 2), cMul(new Complex(1 + knext, 0), new Complex(1, 0).add(comp)));
  }
  return cScale(cScale(wn.asin(), 2 / Math.PI), K);
}

/** Real inverse Jacobi sc with complementary modulus (Orfanidis, `w = sc(z, 1-m)`). */
function arcJacSc1(w: number, m: number): number {
  const z = arcJacSn(new Complex(0, w), m);
  if (Math.abs(z.re) > 1e-9)
    throw new Error('ellip: elliptic filter design failed to converge (arcJacSc1)');
  return z.im;
}

function ellipap(N: number, rp: number, rs: number): AnalogProto {
  if (N === 1) {
    const p = -Math.sqrt(1 / (Math.pow(10, 0.1 * rp) - 1));
    return { z: [], p: [new Complex(p, 0)], k: -p };
  }
  const epsSq = Math.pow(10, 0.1 * rp) - 1;
  const eps = Math.sqrt(epsSq);
  const ck1Sq = epsSq / (Math.pow(10, 0.1 * rs) - 1);
  if (ck1Sq <= 0) throw new Error('ellip: cannot design a filter with the given rp/rs');

  const val0 = ellipticKScalar(ck1Sq);
  const m = ellipdeg(N, ck1Sq);
  const capk = ellipticKScalar(m);

  const j: number[] = [];
  for (let v = 1 - (N % 2); v < N; v += 2) j.push(v);

  const EPSILON = 2e-16;
  const s: number[] = [];
  const c: number[] = [];
  const d: number[] = [];
  for (const jv of j) {
    const u = (jv * capk) / N;
    s.push(jacobiSN(u, m));
    c.push(jacobiCN(u, m));
    d.push(jacobiDN(u, m));
  }

  const zHalf: Complex[] = [];
  for (let i = 0; i < j.length; i++) {
    if (Math.abs(s[i]) > EPSILON) zHalf.push(new Complex(0, 1 / (Math.sqrt(m) * s[i])));
  }
  const zFull = zHalf.concat(zHalf.map((zv) => new Complex(zv.re, -zv.im)));

  const rr = arcJacSc1(1 / eps, ck1Sq);
  const v0 = (capk * rr) / (N * val0);
  const sv = jacobiSN(v0, 1 - m);
  const cv = jacobiCN(v0, 1 - m);
  const dv = jacobiDN(v0, 1 - m);

  const pHalf: Complex[] = [];
  for (let i = 0; i < j.length; i++) {
    const num = new Complex(c[i] * d[i] * sv * cv, s[i] * dv).negate();
    const den = 1 - Math.pow(d[i] * sv, 2);
    pHalf.push(new Complex(num.re / den, num.im / den));
  }

  let pFull: Complex[];
  if (N % 2) {
    const sumP2 = pHalf.reduce((acc, pv) => acc + pv.re * pv.re + pv.im * pv.im, 0);
    const thresh = EPSILON * Math.sqrt(sumP2);
    const newp = pHalf.filter((pv) => Math.abs(pv.im) > thresh);
    pFull = pHalf.concat(newp.map((pv) => new Complex(pv.re, -pv.im)));
  } else {
    pFull = pHalf.concat(pHalf.map((pv) => new Complex(pv.re, -pv.im)));
  }

  let prodP = new Complex(1, 0);
  for (const pv of pFull) prodP = cMul(prodP, pv.negate());
  let prodZ = new Complex(1, 0);
  for (const zv of zFull) prodZ = cMul(prodZ, zv.negate());
  let k = cDiv(prodP, prodZ).re;
  if (N % 2 === 0) k /= Math.sqrt(1 + epsSq);

  return { z: zFull, p: pFull, k };
}

/**
 * Elliptic (Cauer) digital IIR filter design — equiripple in both passband
 * (`rp` dB) and stopband (`rs` dB); the steepest roll-off of the four classical
 * IIR families for a given order. `Wn` is the cutoff (scalar) or `[low, high]`
 * band edges, normalized to Nyquist. Matches `scipy.signal.ellip(N, rp, rs, Wn,
 * btype)` exactly (verified against `scipy.signal` 1.17.1 — see
 * `functions/tests/iir-design.test.ts`); this is a full port of scipy's
 * closed-form (nome-based) elliptic design, not an approximation.
 */
export function ellip(
  N: number,
  rp: number,
  rs: number,
  Wn: number | readonly number[],
  btype: FilterBtype = 'low'
): { b: number[]; a: number[] } {
  if (!Number.isInteger(N) || N < 1) throw new Error('ellip: order N must be a positive integer');
  if (!(rp > 0)) throw new Error('ellip: rp (passband ripple, dB) must be positive');
  if (!(rs > 0)) throw new Error('ellip: rs (stopband attenuation, dB) must be positive');
  return analogToDigital(ellipap(N, rp, rs), Wn, btype);
}

// --- bilinear(b, a, fs): analog → digital transfer-function transform -------

type Poly = number[]; // ascending powers of z: poly[i] is the coefficient of z^i

function polyMul(p: Poly, q: Poly): Poly {
  const res = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) res[i + j] += p[i] * q[j];
  return res;
}
function polyAdd(p: Poly, q: Poly): Poly {
  const res = new Array<number>(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) res[i] += p[i];
  for (let i = 0; i < q.length; i++) res[i] += q[i];
  return res;
}
function polyPow(p: Poly, n: number): Poly {
  let res: Poly = [1];
  for (let i = 0; i < n; i++) res = polyMul(res, p);
  return res;
}
function trimLeadingZeros(coeffs: number[]): number[] {
  let i = 0;
  while (i < coeffs.length - 1 && coeffs[i] === 0) i++;
  return coeffs.slice(i);
}

/**
 * Analog-to-digital bilinear (Tustin) transform of a transfer function: given
 * `H(s) = b(s)/a(s)` (coefficients highest-degree-first), substitutes
 * `s = 2·fs·(z−1)/(z+1)` to produce the digital `{ b, a }` (no pre-warping is
 * done — the caller pre-warps `fs`/critical frequencies if needed). Matches
 * `scipy.signal.bilinear(b, a, fs)`.
 */
export function bilinear(bIn: Vec, aIn: Vec, fs: number): { b: number[]; a: number[] } {
  const bTrim = trimLeadingZeros(arr(bIn));
  const aTrim = trimLeadingZeros(arr(aIn));
  const Q = bTrim.length - 1;
  const P = aTrim.length - 1;
  const N = Math.max(P, Q);
  const kappa = 2 * fs;
  const zp1: Poly = [1, 1]; // (z + 1)
  const zm1: Poly = [-kappa, kappa]; // kappa·(z − 1)

  let numerator: Poly = [0];
  for (let q = 0; q <= Q; q++) {
    const bq = bTrim[Q - q];
    numerator = polyAdd(
      numerator,
      polyMul(polyPow(zp1, N - q), polyPow(zm1, q)).map((v) => v * bq)
    );
  }
  let denominator: Poly = [0];
  for (let p = 0; p <= P; p++) {
    const ap = aTrim[P - p];
    denominator = polyAdd(
      denominator,
      polyMul(polyPow(zp1, N - p), polyPow(zm1, p)).map((v) => v * ap)
    );
  }
  const bDesc = numerator.slice().reverse();
  const aDesc = denominator.slice().reverse();
  const a0 = aDesc[0];
  return { b: bDesc.map((v) => v / a0), a: aDesc.map((v) => v / a0) };
}

// --- buttord(wp, ws, gpass, gstop): minimum Butterworth order ---------------

/**
 * Band-stop order objective (`scipy.signal.band_stop_obj`, `type='butter'`):
 * the non-integer Butterworth order when passband edge `ind` is moved to `wp`,
 * with the other passband/stopband edges held fixed. Minimized over each
 * passband edge to find the order-minimizing bandstop geometry.
 */
function bandStopObj(
  wp: number,
  ind: number,
  passb: readonly [number, number],
  stopb: readonly [number, number],
  gpass: number,
  gstop: number
): number {
  const passbC: [number, number] = [passb[0], passb[1]];
  passbC[ind] = wp;
  const nat0 = (stopb[0] * (passbC[0] - passbC[1])) / (stopb[0] * stopb[0] - passbC[0] * passbC[1]);
  const nat1 = (stopb[1] * (passbC[0] - passbC[1])) / (stopb[1] * stopb[1] - passbC[0] * passbC[1]);
  const nat = Math.min(Math.abs(nat0), Math.abs(nat1));
  const GSTOP = Math.pow(10, 0.1 * Math.abs(gstop));
  const GPASS = Math.pow(10, 0.1 * Math.abs(gpass));
  return Math.log10((GSTOP - 1.0) / (GPASS - 1.0)) / (2 * Math.log10(nat));
}

/**
 * Bounded scalar minimizer — a faithful port of scipy's
 * `optimize.fminbound` / `_minimize_scalar_bounded` (Brent's method with
 * golden-section fallback, `xatol = 1e-5`, `maxiter = 500`). Reproduced exactly
 * so `buttord`'s bandstop passband-edge optimization matches scipy bit-for-bit.
 */
function fminbound(f: (x: number) => number, x1: number, x2: number): number {
  const xatol = 1e-5;
  const maxfun = 500;
  const sqrtEps = Math.sqrt(2.2e-16);
  const goldenMean = 0.5 * (3.0 - Math.sqrt(5.0));
  const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

  let a = x1;
  let b = x2;
  let fulc = a + goldenMean * (b - a);
  let nfc = fulc;
  let xf = fulc;
  let rat = 0.0;
  let e = 0.0;
  let x = xf;
  let fx = f(x);
  let num = 1;
  let fu: number;

  let ffulc = fx;
  let fnfc = fx;
  let xm = 0.5 * (a + b);
  let tol1 = sqrtEps * Math.abs(xf) + xatol / 3.0;
  let tol2 = 2.0 * tol1;

  while (Math.abs(xf - xm) > tol2 - 0.5 * (b - a)) {
    let golden = true;
    if (Math.abs(e) > tol1) {
      golden = false;
      let r = (xf - nfc) * (fx - ffulc);
      let q = (xf - fulc) * (fx - fnfc);
      let p = (xf - fulc) * q - (xf - nfc) * r;
      q = 2.0 * (q - r);
      if (q > 0.0) p = -p;
      q = Math.abs(q);
      r = e;
      e = rat;
      if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (a - xf) && p < q * (b - xf)) {
        rat = p / q;
        x = xf + rat;
        if (x - a < tol2 || b - x < tol2) {
          const si = sign(xm - xf) + (xm - xf === 0 ? 1 : 0);
          rat = tol1 * si;
        }
      } else {
        golden = true;
      }
    }
    if (golden) {
      e = xf >= xm ? a - xf : b - xf;
      rat = goldenMean * e;
    }
    const si = sign(rat) + (rat === 0 ? 1 : 0);
    x = xf + si * Math.max(Math.abs(rat), tol1);
    fu = f(x);
    num += 1;

    if (fu <= fx) {
      if (x >= xf) a = xf;
      else b = xf;
      fulc = nfc;
      ffulc = fnfc;
      nfc = xf;
      fnfc = fx;
      xf = x;
      fx = fu;
    } else {
      if (x < xf) a = x;
      else b = x;
      if (fu <= fnfc || nfc === xf) {
        fulc = nfc;
        ffulc = fnfc;
        nfc = x;
        fnfc = fu;
      } else if (fu <= ffulc || fulc === xf || fulc === nfc) {
        fulc = x;
        ffulc = fu;
      }
    }
    xm = 0.5 * (a + b);
    tol1 = sqrtEps * Math.abs(xf) + xatol / 3.0;
    tol2 = 2.0 * tol1;
    if (num >= maxfun) break;
  }
  return xf;
}

/**
 * Minimum Butterworth filter order and the corresponding natural frequency
 * `Wn` (the "3 dB" frequency) meeting a passband/stopband spec, for a digital
 * lowpass, highpass, bandpass, or bandstop filter. Frequencies are normalized
 * to Nyquist (`0..1`); `gpass`/`gstop` are in dB. For lowpass/highpass, `wp`
 * and `ws` are scalars and `Wn` is a scalar; for bandpass/bandstop, `wp` and
 * `ws` are `[low, high]` pairs and `Wn` is the `[low, high]` natural-frequency
 * array. Matches `scipy.signal.buttord(wp, ws, gpass, gstop)`.
 *
 * Filter type follows scipy: scalar `wp < ws` → lowpass, `wp > ws` → highpass;
 * array with `wp[0] > ws[0]` (passband inside stopband) → bandpass, `wp[0] <
 * ws[0]` (stopband inside passband) → bandstop.
 */
export function buttord(
  wp: number,
  ws: number,
  gpass: number,
  gstop: number
): { N: number; Wn: number };
export function buttord(
  wp: readonly [number, number],
  ws: readonly [number, number],
  gpass: number,
  gstop: number
): { N: number; Wn: [number, number] };
export function buttord(
  wp: number | readonly [number, number],
  ws: number | readonly [number, number],
  gpass: number,
  gstop: number
): { N: number; Wn: number | [number, number] } {
  const wpArr = typeof wp === 'number' ? [wp] : [wp[0], wp[1]];
  const wsArr = typeof ws === 'number' ? [ws] : [ws[0], ws[1]];
  if (wpArr.length !== wsArr.length)
    throw new Error('buttord: wp and ws must both be scalars or both be [low, high] pairs');
  for (const v of [...wpArr, ...wsArr])
    if (!(v > 0 && v < 1)) throw new Error('buttord: all edge frequencies must satisfy 0 < f < 1');

  // filter_type: 1 low, 2 high, 3 stop, 4 pass (scipy _validate_wp_ws)
  let filterType = 2 * (wpArr.length - 1) + 1;
  if (wpArr[0] >= wsArr[0]) filterType += 1;

  // Pre-warp to analog frequencies.
  const passb = wpArr.map((f) => Math.tan((Math.PI * f) / 2));
  const stopb = wsArr.map((f) => Math.tan((Math.PI * f) / 2));

  const GSTOP = Math.pow(10, 0.1 * Math.abs(gstop));
  const GPASS = Math.pow(10, 0.1 * Math.abs(gpass));

  let nat: number;
  if (filterType === 1) {
    nat = stopb[0] / passb[0];
  } else if (filterType === 2) {
    nat = passb[0] / stopb[0];
  } else if (filterType === 3) {
    // Bandstop: optimize each passband edge to minimize the order.
    const sb: [number, number] = [stopb[0], stopb[1]];
    const pb0: [number, number] = [passb[0], passb[1]];
    const wp0 = fminbound(
      (v) => bandStopObj(v, 0, pb0, sb, gpass, gstop),
      passb[0],
      stopb[0] - 1e-12
    );
    const wp1 = fminbound(
      (v) => bandStopObj(v, 1, pb0, sb, gpass, gstop),
      stopb[1] + 1e-12,
      passb[1]
    );
    passb[0] = wp0;
    passb[1] = wp1;
    const nat0 = (stopb[0] * (passb[0] - passb[1])) / (stopb[0] * stopb[0] - passb[0] * passb[1]);
    const nat1 = (stopb[1] * (passb[0] - passb[1])) / (stopb[1] * stopb[1] - passb[0] * passb[1]);
    nat = Math.min(Math.abs(nat0), Math.abs(nat1));
  } else {
    // Bandpass.
    const nat0 = (stopb[0] * stopb[0] - passb[0] * passb[1]) / (stopb[0] * (passb[0] - passb[1]));
    const nat1 = (stopb[1] * stopb[1] - passb[0] * passb[1]) / (stopb[1] * (passb[0] - passb[1]));
    nat = Math.min(Math.abs(nat0), Math.abs(nat1));
  }

  const N = Math.ceil(Math.log10((GSTOP - 1.0) / (GPASS - 1.0)) / (2 * Math.log10(nat)));
  const W0 = Math.pow(GPASS - 1.0, -1.0 / (2.0 * N));

  const toDigital = (WN: number): number => (Math.atan(WN) * 2.0) / Math.PI;

  if (filterType === 1) return { N, Wn: toDigital(W0 * passb[0]) };
  if (filterType === 2) return { N, Wn: toDigital(passb[0] / W0) };
  if (filterType === 3) {
    const discr = Math.sqrt(Math.pow(passb[1] - passb[0], 2) + 4 * W0 * W0 * passb[0] * passb[1]);
    const wn0 = (passb[1] - passb[0] + discr) / (2 * W0);
    const wn1 = (passb[1] - passb[0] - discr) / (2 * W0);
    const sorted = [Math.abs(wn0), Math.abs(wn1)].sort((x, y) => x - y);
    return { N, Wn: [toDigital(sorted[0]), toDigital(sorted[1])] };
  }
  // Bandpass.
  const w0s = [-W0, W0].map(
    (s) =>
      -s * ((passb[1] - passb[0]) / 2.0) +
      Math.sqrt(((s * s) / 4.0) * Math.pow(passb[1] - passb[0], 2) + passb[0] * passb[1])
  );
  const sorted = w0s.map(Math.abs).sort((x, y) => x - y);
  return { N, Wn: [toDigital(sorted[0]), toDigital(sorted[1])] };
}

// --- zpk2sos / sosfilt -------------------------------------------------------

type ZpkRoot = number | Complex;

function toComplex(x: ZpkRoot): Complex {
  return x instanceof Complex ? x : new Complex(x, 0);
}

/**
 * Split a conjugate-symmetric root list into groups of 2 (a complex-conjugate
 * pair, or two real roots) with at most one group of 1 (a lone real root, when
 * the count is odd) — the grouping `zpk2sos` pairs zeros against poles with.
 */
function groupConjugatePairs(rootsIn: readonly ZpkRoot[]): Complex[][] {
  const roots = rootsIn.map(toComplex);
  const n = roots.length;
  const used = new Array<boolean>(n).fill(false);
  const groups: Complex[][] = [];
  const tol = 1e-6;
  for (let i = 0; i < n; i++) {
    if (used[i] || Math.abs(roots[i].im) <= tol) continue;
    const mag = Math.max(1, Math.abs(roots[i].re), Math.abs(roots[i].im));
    let match = -1;
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      if (
        Math.abs(roots[j].re - roots[i].re) < tol * mag &&
        Math.abs(roots[j].im + roots[i].im) < tol * mag
      ) {
        match = j;
        break;
      }
    }
    if (match === -1)
      throw new Error(
        'zpk2sos: complex root has no matching conjugate (input must have real coefficients)'
      );
    used[i] = true;
    used[match] = true;
    groups.push([roots[i], roots[match]]);
  }
  const reals: Complex[] = [];
  for (let i = 0; i < n; i++) if (!used[i]) reals.push(new Complex(roots[i].re, 0));
  for (let i = 0; i + 1 < reals.length; i += 2) groups.push([reals[i], reals[i + 1]]);
  if (reals.length % 2 === 1) groups.push([reals[reals.length - 1]]);
  return groups;
}

/** Monic quadratic (or linear, padded with a trailing 0) coefficients from 1-2 roots. */
function quadraticFromRoots(roots: Complex[]): [number, number, number] {
  const poly = polyFromRoots(roots);
  return poly.length === 2 ? [poly[0], poly[1], 0] : [poly[0], poly[1], poly[2]];
}

/**
 * Group zeros/poles/gain into cascaded second-order sections:
 * `[[b0,b1,b2,a0,a1,a2], …]`, each a monic-denominator biquad (`a0 = 1`) with
 * the overall gain folded into the first section's numerator. `z` is
 * zero-padded (roots at the origin) if shorter than `p`. Matches
 * `scipy.signal.zpk2sos` in effect (the two decompositions can differ in
 * pairing order, but the resulting cascaded transfer function is identical).
 */
export function zpk2sos(z: readonly ZpkRoot[], p: readonly ZpkRoot[], k: number): number[][] {
  if (z.length > p.length)
    throw new Error('zpk2sos: more zeros than poles (improper transfer function)');
  const zPadded: ZpkRoot[] = z.slice();
  while (zPadded.length < p.length) zPadded.push(0);

  const zGroups = groupConjugatePairs(zPadded);
  const pGroups = groupConjugatePairs(p);
  if (zGroups.length !== pGroups.length)
    throw new Error('zpk2sos: zero/pole group-count mismatch (roots must be conjugate-symmetric)');

  const sos: number[][] = [];
  for (let i = 0; i < pGroups.length; i++) {
    const [b0, b1, b2] = quadraticFromRoots(zGroups[i]);
    const [a0, a1, a2] = quadraticFromRoots(pGroups[i]);
    const gain = i === 0 ? k : 1;
    sos.push([b0 * gain, b1 * gain, b2 * gain, a0, a1, a2]);
  }
  return sos;
}

/**
 * Apply a cascade of second-order sections (`[[b0,b1,b2,a0,a1,a2], …]`, as
 * produced by `zpk2sos`) to `x`, each biquad in direct-form-II transposed.
 * Matches `scipy.signal.sosfilt(sos, x)`.
 */
export function sosfilt(sos: readonly (readonly number[])[], x: Vec): number[] {
  let y = arr(x);
  for (const section of sos) {
    if (section.length !== 6)
      throw new Error('sosfilt: each section must have 6 coefficients [b0,b1,b2,a0,a1,a2]');
    const [b0, b1, b2, a0, a1, a2] = section;
    y = lfilter([b0, b1, b2], [a0, a1, a2], y);
  }
  return y;
}
