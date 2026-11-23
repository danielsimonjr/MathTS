/**
 * Orthogonal polynomials and integral special functions — AssemblyScript
 * fallback.
 */

const EULER: f64 = 0.5772156649015329;

// --- Orthogonal polynomials -------------------------------------------------

// These kernels follow chebyshevTScalar, hermiteHScalar, laguerreLScalar and legendrePScalar
// in functions/src/typed/special.ts: a non-finite order gives NaN, a NaN x gives NaN, a value
// that leaves the double range is the signed Infinity of the leading term (never NaN), and an
// order above the family limit of functions/src/utils/limits.ts aborts (the binding throws an
// `Error`; the message names the function), where the JS scalar throws a RangeError.
// legendreP and chebyshevT try an equivalent step with no early overflow when the usual step is
// not finite, so a finite result keeps its bits. hermiteH and laguerreL run on a copy that is
// rescaled by 2^600 (an exact power of 2): the sign of H_n and L_n oscillates with n. The loop
// counter is an i32, so no order can exceed 2147483646. That cap is below the JS limits of
// Chebyshev (4e9), Legendre and Hermite (2.5e9), so for an order above 2147483646 a raw caller
// aborts where JS computes. No bridge calls these kernels.
const _ORDER_MAX_I32: f64 = 2147483646.0;
const _ORDER_MAX_LAGUERRE: f64 = 1000000000.0;
// 2^600 and 2^-600, as the scalars of functions/src/typed/special.ts compute them.
const _SCALE_BIG: f64 = 4.149515568880993e180;
const _SCALE_SMALL: f64 = 2.409919865102884e-181;

/** Chebyshev polynomial of the first kind, T_n(x). */
export function chebyshevT(n: f64, x: f64): f64 {
  if (!isFinite(n)) return NaN;
  const nr: f64 = Math.round(n);
  if (nr < 0.0) return NaN;
  if (nr > _ORDER_MAX_I32) throw new RangeError('chebyshevT: order exceeds the supported maximum');
  const ni: i32 = <i32>nr;
  if (ni == 0) return 1.0;
  if (ni == 1) return x;
  let prev: f64 = 1.0;
  let curr: f64 = x;
  for (let k: i32 = 2; k <= ni; k++) {
    let next: f64 = 2.0 * x * curr - prev;
    if (!isFinite(next)) {
      // 2 x T_{k-1} can leave the range one step before T_k does; this form has no such
      // intermediate (scaling by 2 is exact).
      next = 2.0 * (x * curr - 0.5 * prev);
      if (isNaN(next)) return NaN;
      // For |x| > 1 the first overflow decides, with the sign (-1)^n when x < -1.
      if (!isFinite(next)) return x < 0.0 && ni % 2 == 1 ? -Infinity : Infinity;
    }
    prev = curr;
    curr = next;
  }
  return curr;
}

/** Hermite polynomial H_n(x) (physicists' convention). */
export function hermiteH(n: f64, x: f64): f64 {
  if (!isFinite(n) || n < 0) return NaN;
  const nr: f64 = Math.round(n);
  if (nr > _ORDER_MAX_I32) throw new RangeError('hermiteH: order exceeds the supported maximum');
  const ni: i32 = <i32>nr;
  if (ni == 0) return 1.0;
  if (ni == 1) return 2.0 * x;
  // The scaled recurrence keeps |curr| at or below 2^600, so a step leaves the range only for
  // |x| above about 2^422 (or infinite): the value is then the leading term (2 x)^n.
  let prev: f64 = 1.0;
  let curr: f64 = 2.0 * x;
  let e: i32 = 0;
  for (let k: i32 = 2; k <= ni; k++) {
    const next: f64 = 2.0 * x * curr - 2.0 * <f64>(k - 1) * prev;
    if (isNaN(next)) return NaN;
    if (!isFinite(next)) return x < 0.0 && ni % 2 == 1 ? -Infinity : Infinity;
    prev = curr;
    curr = next;
    if (Math.abs(curr) > _SCALE_BIG) {
      prev *= _SCALE_SMALL;
      curr *= _SCALE_SMALL;
      e++;
    }
  }
  // H_n(x) = curr * 2^(600 e); no shortcut: H_1001(0) is exactly 0.
  for (let i: i32 = 0; i < e && curr != 0.0 && isFinite(curr); i++) curr *= _SCALE_BIG;
  return curr;
}

/** Laguerre polynomial L_n(x). */
export function laguerreL(n: f64, x: f64): f64 {
  if (!isFinite(n)) return NaN;
  const nr: f64 = Math.round(n);
  if (nr < 0.0) return NaN;
  if (nr > _ORDER_MAX_LAGUERRE) throw new RangeError('laguerreL: order exceeds the supported maximum');
  const ni: i32 = <i32>nr;
  if (ni == 0) return 1.0;
  if (ni == 1) return 1.0 - x;
  let prev: f64 = 1.0;
  let curr: f64 = 1.0 - x;
  let e: i32 = 0;
  for (let k: i32 = 2; k <= ni; k++) {
    const kf: f64 = <f64>k;
    const next: f64 = ((2.0 * kf - 1.0 - x) * curr - (kf - 1.0) * prev) / kf;
    if (isNaN(next)) return NaN;
    // A step out of range means |x| above about 2^422: the leading term (-x)^n / n! decides.
    if (!isFinite(next)) return x > 0.0 && ni % 2 == 1 ? -Infinity : Infinity;
    prev = curr;
    curr = next;
    if (Math.abs(curr) > _SCALE_BIG) {
      prev *= _SCALE_SMALL;
      curr *= _SCALE_SMALL;
      e++;
    }
  }
  for (let i: i32 = 0; i < e && curr != 0.0 && isFinite(curr); i++) curr *= _SCALE_BIG;
  return curr;
}

/** Legendre polynomial P_n(x). */
export function legendreP(n: f64, x: f64): f64 {
  if (!isFinite(n)) return NaN;
  const nr: f64 = Math.round(n);
  if (nr < 0.0) return NaN;
  if (nr > _ORDER_MAX_I32) throw new RangeError('legendreP: order exceeds the supported maximum');
  const ni: i32 = <i32>nr;
  if (ni == 0) return 1.0;
  if (ni == 1) return x;
  let prev: f64 = 1.0;
  let curr: f64 = x;
  for (let k: i32 = 2; k <= ni; k++) {
    const kf: f64 = <f64>k;
    let next: f64 = ((2.0 * kf - 1.0) * x * curr - (kf - 1.0) * prev) / kf;
    if (!isFinite(next)) {
      // (2k - 1) x P_{k-1} is about k times the result, so it can leave the range before P_k
      // does; this form has no such intermediate.
      next = x * curr + ((kf - 1.0) / kf) * (x * curr - prev);
      if (isNaN(next)) return NaN;
      // For |x| > 1 the first overflow decides, with the sign of x^n.
      if (!isFinite(next)) return x < 0.0 && ni % 2 == 1 ? -Infinity : Infinity;
    }
    prev = curr;
    curr = next;
  }
  return curr;
}

// --- Error / integral functions ---------------------------------------------

/** Imaginary error function erfi(x). */
export function erfi(x: f64): f64 {
  const c: f64 = 2.0 / Math.sqrt(Math.PI);
  let sum: f64 = 0.0;
  let term: f64 = x;
  for (let n: i32 = 0; n < 100; n++) {
    const nf: f64 = <f64>n;
    sum += term / (2.0 * nf + 1.0);
    term *= (x * x) / (nf + 1.0);
    if (Math.abs(term / (2.0 * nf + 3.0)) < Math.abs(sum) * 1e-15) break;
  }
  return c * sum;
}

/** Exponential integral Ei(x). */
export function expIntegralEi(x: f64): f64 {
  if (x == 0.0) return -Infinity;
  if (Math.abs(x) <= 40.0) {
    let sum: f64 = 0.0;
    let term: f64 = 1.0;
    for (let n: i32 = 1; n < 200; n++) {
      const nf: f64 = <f64>n;
      term *= x / nf;
      sum += term / nf;
      if (Math.abs(term / nf) < Math.abs(sum) * 1e-15) break;
    }
    return EULER + Math.log(Math.abs(x)) + sum;
  }
  let sum: f64 = 1.0;
  let term: f64 = 1.0;
  for (let n: i32 = 1; n <= 30; n++) {
    term *= <f64>n / x;
    sum += term;
    if (Math.abs(term) < 1e-15) break;
  }
  return (Math.exp(x) / x) * sum;
}

/** Sine integral Si(x). */
export function sinIntegral(x: f64): f64 {
  if (x == 0.0) return 0.0;
  const sign: f64 = x < 0.0 ? -1.0 : 1.0;
  const ax: f64 = Math.abs(x);
  let sum: f64 = 0.0;
  let term: f64 = ax;
  for (let n: i32 = 0; n < 100; n++) {
    const nf: f64 = <f64>n;
    sum += term / (2.0 * nf + 1.0);
    term *= (-ax * ax) / ((2.0 * nf + 2.0) * (2.0 * nf + 3.0));
    if (Math.abs(term / (2.0 * nf + 3.0)) < 1e-15) break;
  }
  return sign * sum;
}

/** Cosine integral Ci(x), x > 0. */
export function cosIntegral(x: f64): f64 {
  if (x <= 0.0) return NaN;
  if (x <= 25.0) {
    let sum: f64 = 0.0;
    let term: f64 = 1.0;
    for (let n: i32 = 1; n < 200; n++) {
      const nf: f64 = <f64>n;
      term *= (-x * x) / ((2.0 * nf - 1.0) * (2.0 * nf));
      sum += term / (2.0 * nf);
      if (Math.abs(term / (2.0 * nf)) < 1e-16) break;
    }
    return EULER + Math.log(x) + sum;
  }
  const x2: f64 = x * x;
  let f: f64 = 1.0;
  let g: f64 = 1.0;
  let fTerm: f64 = 1.0;
  let gTerm: f64 = 1.0;
  for (let n: i32 = 1; n <= 25; n++) {
    const nf: f64 = <f64>n;
    fTerm *= (-(2.0 * nf) * (2.0 * nf - 1.0)) / x2;
    gTerm *= (-(2.0 * nf + 1.0) * (2.0 * nf)) / x2;
    f += fTerm;
    g += gTerm;
    if (Math.abs(fTerm) < 1e-17 && Math.abs(gTerm) < 1e-17) break;
  }
  return (f / x) * Math.sin(x) - (g / x2) * Math.cos(x);
}

/** Logarithmic integral li(x) = Ei(ln x), x > 0 and x != 1. */
export function logIntegral(x: f64): f64 {
  if (x <= 0.0 || x == 1.0) return NaN;
  return expIntegralEi(Math.log(x));
}
