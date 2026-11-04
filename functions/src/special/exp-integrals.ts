/**
 * Exponential-type integrals: E1 / E_n, Shi (sinh integral) and Chi (cosh integral).
 */

const EULER_GAMMA = 0.5772156649015329;
const EPS = 1e-16;
const FPMIN = 1e-300;
const MAX_ITER = 1000;

/** E_n(x) for n ≥ 1 and x > 1 via the modified Lentz continued fraction. */
function expnContinuedFraction(n: number, x: number): number {
  let b = x + n;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITER; i += 1) {
    const an = -i * (n - 1 + i);
    b += 2;
    d = 1 / (an * d + b);
    c = b + an / c;
    const del = c * d;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h * Math.exp(-x);
}

/**
 * Generalized exponential integral `E_n(x) = ∫₁^∞ e^{-xt} t^{-n} dt`.
 *
 * - `n = 0`: `e^{-x}/x`.
 * - `x ≤ 1`: E1 by its power series, then the (stable for x < 1) upward recurrence.
 * - `x > 1`: continued fraction.
 *
 * @example
 * expn(2, 1)  // 0.14849550677592205
 * expn(3, 0)  // 0.5
 */
export function expn(n: number, x: number): number {
  if (!Number.isInteger(n) || n < 0 || Number.isNaN(x) || x < 0) return NaN;
  if (n === 0) return x === 0 ? Infinity : Math.exp(-x) / x;
  if (x === 0) return n === 1 ? Infinity : 1 / (n - 1);
  if (x > 1) return expnContinuedFraction(n, x);
  // E1(x) = −γ − ln x − Σ_{k≥1} (−x)^k / (k·k!)
  let term = 1;
  let series = 0;
  for (let k = 1; k < MAX_ITER; k += 1) {
    term *= -x / k;
    const add = -term / k;
    series += add;
    if (Math.abs(add) <= EPS * Math.abs(series)) break;
  }
  let e = -EULER_GAMMA - Math.log(x) + series;
  const ex = Math.exp(-x);
  for (let k = 1; k < n; k += 1) {
    e = (ex - x * e) / k;
  }
  return e;
}

/**
 * Exponential integral E1(x) for real x > 0 (`−Ei(−x)`). Returns Infinity at 0, NaN for x < 0.
 *
 * @example
 * expIntegralE1(1) // 0.21938393439552029
 */
export function expIntegralE1(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return Infinity;
  return expn(1, x);
}

/**
 * Sinh integral `Shi(x) = ∫₀ˣ sinh(t)/t dt` (odd function).
 *
 * @example
 * sinhIntegral(1) // 1.0572508753757285
 */
export function sinhIntegral(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -sinhIntegral(-x);
  if (x === 0) return 0;
  // Shi(x) = Σ_k x^{2k+1} / ((2k+1)·(2k+1)!) — all terms positive.
  const x2 = x * x;
  let a = x; // x^{2k+1} / (2k+1)!
  let sum = x;
  for (let k = 1; k < MAX_ITER; k += 1) {
    a = (a * x2) / (2 * k * (2 * k + 1));
    const term = a / (2 * k + 1);
    sum += term;
    if (term <= EPS * sum) break;
  }
  return sum;
}

/**
 * Cosh integral `Chi(x) = γ + ln x + ∫₀ˣ (cosh t − 1)/t dt` for x > 0.
 * Returns −Infinity at 0 and NaN for x < 0.
 *
 * @example
 * coshIntegral(1) // 0.8378669409802082
 */
export function coshIntegral(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  // Chi(x) = γ + ln x + Σ_{k≥1} x^{2k} / (2k · (2k)!) — all terms positive.
  const x2 = x * x;
  let b = 1; // x^{2k} / (2k)!
  let sum = 0;
  for (let k = 1; k < MAX_ITER; k += 1) {
    b = (b * x2) / ((2 * k - 1) * (2 * k));
    const term = b / (2 * k);
    sum += term;
    if (term <= EPS * sum) break;
  }
  return EULER_GAMMA + Math.log(x) + sum;
}
