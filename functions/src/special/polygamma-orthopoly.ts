/**
 * Polygamma functions and classical orthogonal polynomials.
 *
 * `polygamma(n, x)` is the n-th derivative of the digamma function,
 * ψ^(n)(x) = d^n/dx^n ψ(x). It is computed by shifting the argument up via
 * the standard recurrence
 *
 *   ψ^(n)(x) = ψ^(n)(x + m) + (-1)^(n+1) n! * sum_{k=0}^{m-1} 1/(x+k)^(n+1)
 *
 * until x + m is large enough (>= SHIFT_THRESHOLD) for the asymptotic
 * (Bernoulli) expansion (DLMF 5.15.8) to converge to machine precision:
 *
 *   psi^(n)(X) ~ (-1)^(n-1) * [ (n-1)!/X^n + n!/(2 X^(n+1))
 *                 + sum_j B_{2j} * (2j+n-1)! / ((2j)! * X^(2j+n)) ]
 *
 * Since (-1)^(n+1) = (-1)^(n-1), both pieces share the same overall sign.
 *
 * `jacobiP` and `gegenbauerC` are evaluated with their standard stable
 * three-term recurrences (DLMF 18.9.2 and 18.9.1 respectively), matching the
 * pattern already used for `chebyshevT` / `hermiteH` / `laguerreL` /
 * `legendreP`.
 *
 * @packageDocumentation
 */

import { digamma } from '../typed/special.js';

/** Argument threshold above which the Bernoulli asymptotic series is accurate. */
const SHIFT_THRESHOLD = 12;

/** Bernoulli numbers B_2, B_4, B_6, B_8 (even-index only; odd ones vanish). */
const BERNOULLI_EVEN = [1 / 6, -1 / 30, 1 / 42, -1 / 30];

/** Factorial of a small nonnegative integer (exact for n <= ~20, double-precision beyond). */
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Polygamma function ψ^(n)(x): the n-th derivative of the digamma function.
 *
 * `polygamma(0, x)` delegates to `digamma(x)`. For `n >= 1`, x is shifted up
 * via the standard recurrence until it is large enough for the Bernoulli
 * asymptotic expansion to converge.
 *
 * @param n - Derivative order (nonnegative integer)
 * @param x - Argument (must not be a nonpositive integer, where ψ^(n) has poles)
 * @returns ψ^(n)(x)
 *
 * @example
 * polygamma(1, 2) // ~0.6449340668 (trigamma(2))
 * polygamma(2, 1) // ~-2.4041138063
 */
export function polygamma(n: number, x: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('polygamma: n must be a nonnegative integer');
  }
  if (n === 0) {
    return digamma(x) as number;
  }
  if (x <= 0 && Number.isInteger(x)) {
    return NaN;
  }

  // (-1)^(n+1): +1 for odd n, -1 for even n. Also equals (-1)^(n-1).
  const sign = n % 2 === 1 ? 1 : -1;
  const nFactorial = factorial(n);

  let recurrenceSum = 0;
  let shifted = x;
  while (shifted < SHIFT_THRESHOLD) {
    recurrenceSum += 1 / Math.pow(shifted, n + 1);
    shifted += 1;
  }

  let bracket =
    factorial(n - 1) / Math.pow(shifted, n) + nFactorial / (2 * Math.pow(shifted, n + 1));
  for (let j = 1; j <= BERNOULLI_EVEN.length; j++) {
    const twoJ = 2 * j;
    const term =
      (BERNOULLI_EVEN[j - 1] * factorial(twoJ + n - 1)) /
      factorial(twoJ) /
      Math.pow(shifted, twoJ + n);
    bracket += term;
  }

  return sign * (nFactorial * recurrenceSum + bracket);
}

/**
 * Trigamma function ψ'(x) = ψ^(1)(x): the first derivative of the digamma
 * function. Equivalent to `polygamma(1, x)`.
 *
 * @param x - Argument
 * @returns ψ'(x)
 *
 * @example
 * trigamma(2) // ~0.6449340668 (= zeta(2) - 1 = pi^2/6 - 1)
 */
export function trigamma(x: number): number {
  return polygamma(1, x);
}

/**
 * Jacobi polynomial P_n^(alpha,beta)(x), evaluated via the standard
 * three-term recurrence (DLMF 18.9.2).
 *
 * @param n - Degree (nonnegative integer)
 * @param alpha - Parameter alpha (> -1)
 * @param beta - Parameter beta (> -1)
 * @param x - Evaluation point
 * @returns P_n^(alpha,beta)(x)
 *
 * @example
 * jacobiP(2, 1, 1, 0.5) // 0.1875
 */
export function jacobiP(n: number, alpha: number, beta: number, x: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('jacobiP: n must be a nonnegative integer');
  }
  if (n === 0) return 1;

  let pPrev = 1; // P_0
  let pCurr = alpha + 1 + ((alpha + beta + 2) * (x - 1)) / 2; // P_1
  if (n === 1) return pCurr;

  for (let k = 2; k <= n; k++) {
    const a1 = 2 * k * (k + alpha + beta) * (2 * k + alpha + beta - 2);
    const a2 =
      (2 * k + alpha + beta - 1) *
      ((2 * k + alpha + beta) * (2 * k + alpha + beta - 2) * x + alpha * alpha - beta * beta);
    const a3 = 2 * (k + alpha - 1) * (k + beta - 1) * (2 * k + alpha + beta);
    const pNext = (a2 * pCurr - a3 * pPrev) / a1;
    pPrev = pCurr;
    pCurr = pNext;
  }
  return pCurr;
}

/**
 * Gegenbauer (ultraspherical) polynomial C_n^(alpha)(x), evaluated via the
 * standard three-term recurrence (DLMF 18.9.1).
 *
 * @param n - Degree (nonnegative integer)
 * @param alpha - Parameter alpha (> -1/2, alpha != 0)
 * @param x - Evaluation point
 * @returns C_n^(alpha)(x)
 *
 * @example
 * gegenbauerC(2, 1, 1) // 3 (C_2^(1)(x) = 4x^2 - 1)
 */
export function gegenbauerC(n: number, alpha: number, x: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('gegenbauerC: n must be a nonnegative integer');
  }
  if (n === 0) return 1;

  let cPrev = 1; // C_0
  let cCurr = 2 * alpha * x; // C_1
  if (n === 1) return cCurr;

  for (let k = 2; k <= n; k++) {
    const cNext = (2 * x * (k + alpha - 1) * cCurr - (k + 2 * alpha - 2) * cPrev) / k;
    cPrev = cCurr;
    cCurr = cNext;
  }
  return cCurr;
}
