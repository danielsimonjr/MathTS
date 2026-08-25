/* eslint-disable no-loss-of-precision -- special-function math constants (Airy, etc.)
   are written at full precision and round to the nearest IEEE-754 double. */
/**
 * Canonical special-function scalar implementations.
 *
 * Single source of truth for the special-function scalars that are needed by
 * BOTH the typed dispatch surface (`functions/src/typed/special.ts`) and the
 * WASM dispatch bridge JS fallbacks (`functions/src/wasm/special/wasm-bridge.ts`).
 * Previously each of these scalars existed in two near-identical copies, so a
 * numeric fix to one could silently diverge `f(x)` (scalar / sub-threshold path)
 * from `f([x])` (≥-threshold WASM-fallback path). They now live here once.
 *
 * Serialization invariant (do NOT regress):
 *   Every function in this module is a standalone declaration that references
 *   ONLY `Math.*`, its own arguments, and the other functions in this module.
 *   It must NOT reference module-level constants or imports. This is required
 *   because `typed/special.ts` serializes these into self-contained worker
 *   kernels via `Function.prototype.toString()` (the worker `eval`s the text in
 *   an isolated context — see `kernelSource` / `packages/workerpool/src/worker.ts`).
 *   Numeric constants are therefore inlined as literals:
 *     Euler-gamma 0.5772156649015328606, 2/pi 0.63661977236758134308,
 *     1/pi 0.31830988618379067154, Bessel series/asymptotic split |x| = 13.
 *
 * @packageDocumentation
 */

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// Log-gamma
// =============================================================================

/**
 * Log-gamma function using Lanczos approximation (g=7, n=9).
 * Poles at non-positive integers return +Infinity; negative non-integers use
 * the reflection formula.
 */
export function _lgamma(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    // Reflection: lgamma is log|Γ(x)|, so use |sin(πx)| — bare sin(πx) is
    // negative for negative non-integer x and would yield NaN. (The earlier
    // typed/special.ts copy used bare sin and returned NaN for e.g. -0.5; the
    // WASM-bridge copy used abs and was correct. Reconciled to the correct form.)
    const sinPiX = Math.abs(Math.sin(Math.PI * x));
    if (sinPiX === 0) return Infinity;
    return Math.log(Math.PI / sinPiX) - _lgamma(1 - x);
  }
  x -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let sum = c[0];
  for (let i = 1; i < g + 2; i++) {
    sum += c[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

// =============================================================================
// Bessel J0/J1/Y0/Y1: ascending series (|x| <= 13) + Hankel asymptotic (above),
// both with in-loop-generated coefficients. Validated to <1e-9 vs mpmath
// (tests/diff-special.test.mjs). Mirrors assembly/src/special.ts.
// =============================================================================

// Hankel asymptotic shared by J_nu/Y_nu (nu = 0 or 1):
//   J_nu ~ sqrt(2/(pi x)) [P cos(chi) - Q sin(chi)],
//   Y_nu ~ sqrt(2/(pi x)) [P sin(chi) + Q cos(chi)], chi = x - (nu/2+1/4)pi.
export function besselHankel(nu: f64, x: f64, wantY: boolean): f64 {
  const mu = 4 * nu * nu;
  let P = 1.0;
  let Q = 0.0;
  let a = 1.0;
  let xk = 1.0;
  let prevMag = Infinity;
  for (let k = 1; k <= 40; k++) {
    const twokm1 = 2 * k - 1;
    a = (a * (mu - twokm1 * twokm1)) / (8 * k);
    xk *= x;
    const t = a / xk;
    const mag = Math.abs(t);
    if (mag > prevMag) break;
    prevMag = mag;
    const m4 = k & 3;
    const s = m4 === 1 || m4 === 0 ? 1.0 : -1.0;
    if ((k & 1) === 1) Q += s * t;
    else P += s * t;
  }
  const chi = x - (nu * 0.5 + 0.25) * Math.PI;
  const amp = Math.sqrt(2.0 / (Math.PI * x));
  return wantY
    ? amp * (P * Math.sin(chi) + Q * Math.cos(chi))
    : amp * (P * Math.cos(chi) - Q * Math.sin(chi));
}

export function besselJ0Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * k);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return sum;
}

export function besselJ1Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * (k + 1));
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return 0.5 * x * sum;
}

// Y0 = (2/pi)[ (ln(x/2)+gamma) J0 + sum_{k>=1} (-1)^{k+1} H_k (x^2/4)^k/(k!)^2 ].
export function besselY0Series(x: f64): f64 {
  const z = 0.25 * x * x;
  let u = 1.0;
  let h = 0.0;
  let s = 0.0;
  let sign = 1.0;
  for (let k = 1; k <= 80; k++) {
    u *= z / (k * k);
    h += 1 / k;
    const d = sign * h * u;
    s += d;
    sign = -sign;
    if (k > 2 && Math.abs(d) <= Math.abs(s) * 1e-17) break;
  }
  return (
    0.63661977236758134308 * ((Math.log(0.5 * x) + 0.5772156649015328606) * besselJ0Series(x) + s)
  );
}

// Y1 = (2/pi)[ln(x/2)+gamma] J1 - 2/(pi x)
//      - (1/pi) sum_{k>=0} (-1)^k (H_k + H_{k+1}) (x/2)^{2k+1}/(k!(k+1)!).
export function besselY1Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let v = 0.5 * x;
  let hk = 0.0;
  let hk1 = 1.0;
  let s = (hk + hk1) * v;
  for (let k = 1; k <= 80; k++) {
    v *= z / (k * (k + 1));
    hk += 1 / k;
    hk1 += 1 / (k + 1);
    const d = (hk + hk1) * v;
    s += d;
    if (k > 2 && Math.abs(d) <= Math.abs(s) * 1e-17) break;
  }
  return (
    0.63661977236758134308 * (Math.log(0.5 * x) + 0.5772156649015328606) * besselJ1Series(x) -
    0.63661977236758134308 / x -
    0.31830988618379067154 * s
  );
}

/** Bessel function of the first kind, order 0: J0(x). */
export function besselJ0Scalar(x: f64): f64 {
  const ax = Math.abs(x);
  return ax <= 13.0 ? besselJ0Series(ax) : besselHankel(0, ax, false);
}

/** Bessel function of the first kind, order 1: J1(x). */
export function besselJ1Scalar(x: f64): f64 {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1; // J1 is odd
  const val = ax <= 13.0 ? besselJ1Series(ax) : besselHankel(1, ax, false);
  return sign * val;
}

/** Bessel function of the second kind, order 0: Y0(x). */
export function besselY0Scalar(x: f64): f64 {
  if (x <= 0) return NaN;
  return x <= 13.0 ? besselY0Series(x) : besselHankel(0, x, true);
}

/** Bessel function of the second kind, order 1: Y1(x). */
export function besselY1Scalar(x: f64): f64 {
  if (x <= 0) return NaN;
  return x <= 13.0 ? besselY1Series(x) : besselHankel(1, x, true);
}

/** Bessel function of the first kind, general integer order n: J_n(x). */
export function besselJScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * besselJScalar(-ni, x);
  if (ni === 0) return besselJ0Scalar(x);
  if (ni === 1) return besselJ1Scalar(x);

  if (Math.abs(x) < 1e-15) return 0;

  // Upward recurrence is stable only when x > n; otherwise it amplifies
  // round-off (J_n decays in n for n > x), so use Miller's backward recurrence.
  if (Math.abs(x) > ni) {
    let jPrev: f64 = besselJ0Scalar(x);
    let jCurr: f64 = besselJ1Scalar(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2 * k) / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return jCurr;
  } else {
    const nStart = ni + 2 * Math.max(10, Math.ceil(Math.sqrt(40 * ni)));
    let jNext = 0;
    let jCurr = 1;
    let result = 0;
    let sum = 0;
    for (let k = nStart; k >= 0; k--) {
      const jPrev = ((2 * (k + 1)) / x) * jCurr - jNext;
      jNext = jCurr;
      jCurr = jPrev;
      // After the assignments jCurr = J_k and jNext = J_{k+1}; capture J_ni.
      if (k === ni) result = jCurr;
      if (k % 2 === 0) sum += jCurr;
    }
    sum = 2 * sum - jCurr;
    return result / sum;
  }
}

/**
 * Bessel function of the second kind, general integer order n: Y_n(x).
 *
 * Negative orders use the parity identity Y_{-n}(x) = (-1)^n Y_n(x). (The
 * earlier `typed/special.ts` copy omitted this and returned Y_1 for any
 * negative order; the WASM-bridge fallback copy applied it. Reconciled here to
 * the mathematically correct form so the scalar and array paths agree.)
 */
export function besselYScalar(n: f64, x: f64): f64 {
  if (x <= 0) return NaN;
  const ni = Math.round(n);
  if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * besselYScalar(-ni, x);
  if (ni === 0) return besselY0Scalar(x);
  if (ni === 1) return besselY1Scalar(x);

  let yPrev: f64 = besselY0Scalar(x);
  let yCurr: f64 = besselY1Scalar(x);
  for (let k = 1; k < ni; k++) {
    const yNext = ((2 * k) / x) * yCurr - yPrev;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return yCurr;
}

// =============================================================================
// Elliptic Integrals — complete K(m) / E(m) via AGM
// =============================================================================

/** Complete elliptic integral of the first kind K(m) via AGM. */
export function ellipticKScalar(m: f64): f64 {
  if (isNaN(m)) return NaN;
  if (m < 0 || m > 1) return NaN;
  if (m === 1) return Infinity;
  if (m === 0) return Math.PI / 2;

  let a: f64 = 1;
  let b: f64 = Math.sqrt(1 - m);
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2;
    const bNew = Math.sqrt(a * b);
    if (Math.abs(aNew - bNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  return Math.PI / (2 * a);
}

/** Complete elliptic integral of the second kind E(m) via Carlson-Bulirsch AGM. */
export function ellipticECompleteScalar(m: f64): f64 {
  if (isNaN(m)) return NaN;
  if (m < 0 || m > 1) return NaN;
  if (m === 0) return Math.PI / 2;
  if (m === 1) return 1.0;

  let a: f64 = 1;
  let b: f64 = Math.sqrt(1 - m);
  let sum: f64 = m; // 2^0 · c_0² = m
  let pow2: f64 = 1;
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2;
    const bNew = Math.sqrt(a * b);
    const cNew = (a - b) / 2;
    pow2 *= 2;
    sum += pow2 * cNew * cNew;
    if (Math.abs(cNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  const k = Math.PI / (2 * a);
  return k * (1 - 0.5 * sum);
}

// =============================================================================
// Airy Functions Ai(x) / Bi(x)
//
// |x| <= 5: power series (DLMF §9.2.2).  x > 5: decaying asymptotic
// (DLMF §9.7.3).  x < -5: oscillatory asymptotic (DLMF §9.7.5).
// =============================================================================

/**
 * Airy asymptotic coefficients u_k (DLMF 9.7.2):
 *   u_0 = 1, u_k = u_{k-1} (6k-5)(6k-3)(6k-1) / ((2k-1) · 216 · k).
 * A function (not a module const) so it stays self-contained when serialized
 * into a worker kernel.
 */
export function airyUCoeffs(): number[] {
  const u = [1];
  for (let k = 1; k <= 12; k++) {
    u.push((u[k - 1] * ((6 * k - 5) * (6 * k - 3) * (6 * k - 1))) / ((2 * k - 1) * 216 * k));
  }
  return u;
}

/**
 * Evaluate the two alternating asymptotic sums used by Ai(-z)/Bi(-z):
 *   P(ζ) = Σ_k (-1)^k u_{2k}   / ζ^{2k}      (even-index coefficients)
 *   Q(ζ) = Σ_k (-1)^k u_{2k+1} / ζ^{2k+1}    (odd-index coefficients)
 * Both series are divergent — each is summed only to its smallest term.
 */
export function airyAsymPQ(zeta: f64): { p: f64; q: f64 } {
  let p = 0,
    q = 0;
  let pTerm = Infinity,
    qTerm = Infinity;
  const U = airyUCoeffs();
  const half = Math.floor((U.length - 1) / 2);
  for (let k = 0; k <= half; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const pt = (sign * U[2 * k]) / Math.pow(zeta, 2 * k);
    if (Math.abs(pt) > Math.abs(pTerm)) break;
    p += pt;
    pTerm = pt;
  }
  for (let k = 0; k <= half - 1; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const qt = (sign * U[2 * k + 1]) / Math.pow(zeta, 2 * k + 1);
    if (Math.abs(qt) > Math.abs(qTerm)) break;
    q += qt;
    qTerm = qt;
  }
  return { p, q };
}

/** Airy function of the first kind Ai(x). */
export function airyAiScalar(x: f64): f64 {
  // 5.0 keeps the golden points x = +/-5 on the (accurate) series side; the
  // asymptotic uses the corrected AIRY_U coefficients.
  const XBIG = 5.0;
  const AI0 = 0.35502805388781723926;
  const AI_PRIME0 = 0.25881940379280679841;
  if (x > XBIG) {
    // Ai(x) ~ e^{-zeta}/(2 sqrt(pi) x^{1/4}) Sum (-1)^k u_k / zeta^k.
    const xp = Math.pow(x, 0.25);
    const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
    let p = 0.0,
      zk = 1.0,
      sign = 1.0,
      prevMag = Infinity;
    for (const uk of airyUCoeffs()) {
      const t = uk / zk;
      if (Math.abs(t) > prevMag) break;
      prevMag = Math.abs(t);
      p += sign * t;
      zk *= zeta;
      sign = -sign;
    }
    return (Math.exp(-zeta) * p) / (2.0 * Math.sqrt(Math.PI) * xp);
  }
  if (x < -XBIG) {
    // Oscillatory asymptotic (DLMF §9.7.9):
    //   Ai(-z) = π^{-1/2} z^{-1/4} ( cos(ζ-π/4)·P(ζ) + sin(ζ-π/4)·Q(ζ) )
    const ax = Math.abs(x);
    const axp = Math.pow(ax, 0.25);
    const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
    const theta = zeta - Math.PI / 4.0;
    const { p, q } = airyAsymPQ(zeta);
    return (Math.cos(theta) * p + Math.sin(theta) * q) / (Math.sqrt(Math.PI) * axp);
  }
  // Power series
  const x3 = x * x * x;
  let f = 1.0,
    g = x,
    fTerm = 1.0,
    gTerm = x;
  let factF = 1.0,
    factG = 1.0,
    prodF = 1.0,
    prodG = 1.0;
  for (let k = 1; k <= 30; k++) {
    factF *= (3 * k - 2) * (3 * k - 1) * (3 * k);
    factG *= (3 * k - 1) * (3 * k) * (3 * k + 1);
    prodF *= 3 * k - 2;
    prodG *= 3 * k - 1;
    fTerm *= x3;
    gTerm *= x3;
    const df = (fTerm * prodF) / factF,
      dg = (gTerm * prodG) / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return AI0 * f - AI_PRIME0 * g;
}

/** Airy function of the second kind Bi(x). */
export function airyBiScalar(x: f64): f64 {
  const XBIG = 5.0;
  const AI0 = 0.35502805388781723926;
  const AI_PRIME0 = 0.25881940379280679841;
  if (x > XBIG) {
    // Bi(x) ~ e^{zeta}/(sqrt(pi) x^{1/4}) Sum u_k / zeta^k.
    const xp = Math.pow(x, 0.25);
    const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
    let p = 0.0,
      zk = 1.0,
      prevMag = Infinity;
    for (const uk of airyUCoeffs()) {
      const t = uk / zk;
      if (Math.abs(t) > prevMag) break;
      prevMag = Math.abs(t);
      p += t;
      zk *= zeta;
    }
    return (Math.exp(zeta) * p) / (Math.sqrt(Math.PI) * xp);
  }
  if (x < -XBIG) {
    // Oscillatory asymptotic (DLMF §9.7.10):
    //   Bi(-z) = π^{-1/2} z^{-1/4} ( -sin(ζ-π/4)·P(ζ) + cos(ζ-π/4)·Q(ζ) )
    const ax = Math.abs(x);
    const axp = Math.pow(ax, 0.25);
    const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
    const theta = zeta - Math.PI / 4.0;
    const { p, q } = airyAsymPQ(zeta);
    return (-Math.sin(theta) * p + Math.cos(theta) * q) / (Math.sqrt(Math.PI) * axp);
  }
  const x3 = x * x * x;
  let f = 1.0,
    g = x,
    fTerm = 1.0,
    gTerm = x;
  let factF = 1.0,
    factG = 1.0,
    prodF = 1.0,
    prodG = 1.0;
  for (let k = 1; k <= 30; k++) {
    factF *= (3 * k - 2) * (3 * k - 1) * (3 * k);
    factG *= (3 * k - 1) * (3 * k) * (3 * k + 1);
    prodF *= 3 * k - 2;
    prodG *= 3 * k - 1;
    fTerm *= x3;
    gTerm *= x3;
    const df = (fTerm * prodF) / factF,
      dg = (gTerm * prodG) / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return Math.sqrt(3.0) * (AI0 * f + AI_PRIME0 * g);
}

// =============================================================================
// Gamma / Beta family + modified Bessel I (lgamma / factorial consumers)
//
// These live here (not in typed/special.ts) so their references to `_lgamma`
// and `factorial` are SAME-MODULE. Under the vitest SSR transform a cross-module
// import reference inside a function body is rewritten to `__vite_ssr_import_*`,
// which would break `Function.prototype.toString()` worker serialization; a
// same-module reference stays a bare identifier and serializes cleanly.
// =============================================================================

/** Factorial of a non-negative integer. */
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Beta function B(a, b) = Gamma(a) Gamma(b) / Gamma(a + b). */
export function betaScalar(a: f64, b: f64): f64 {
  return Math.exp(_lgamma(a) + _lgamma(b) - _lgamma(a + b));
}

/** Regularized lower incomplete gamma function P(a, x). */
export function gammaincScalar(a: f64, x: f64): f64 {
  if (x < 0) return NaN;
  if (x === 0) return 0;

  if (x < a + 1) {
    let sum = 1.0 / a;
    let term = 1.0 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - _lgamma(a));
  } else {
    const TINY = 1e-30;
    const b0 = x + 1 - a;
    let c = 1.0 / TINY;
    let d = 1.0 / b0;
    let f = d;
    for (let n = 1; n < 300; n++) {
      const an = n * (a - n);
      const bn = x + 2 * n + 1 - a;
      d = bn + an * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = bn + an / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1.0 / d;
      const delta = d * c;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    const Q = f * Math.exp(-x + a * Math.log(x) - _lgamma(a));
    return 1 - Q;
  }
}

/** Upper regularized incomplete gamma Q(a, x) = 1 - P(a, x). */
export function gammaincpScalar(a: f64, x: f64): f64 {
  return 1 - gammaincScalar(a, x);
}

/** Regularized incomplete beta function I_x(a, b). */
export function betaincScalar(a: f64, b: f64, x: f64): f64 {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaincScalar(b, a, 1 - x);
  }

  const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  let f: number;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    let num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= d * c;

    num = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-14) break;
  }

  return front * f;
}

/** Modified Bessel function of the first kind, I_n(x). */
export function besselIScalar(n: f64, x: f64): f64 {
  const ni = Math.round(Math.abs(n));
  if (Math.abs(x) < 1e-15) return ni === 0 ? 1 : 0;

  let sum: f64 = 0;
  const halfX = Math.abs(x) / 2;
  for (let m = 0; m < 100; m++) {
    const term = Math.pow(halfX, ni + 2 * m) / (factorial(m) * Math.exp(_lgamma(ni + m + 1)));
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum;
}
