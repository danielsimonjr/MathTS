/**
 * Hypergeometric functions.
 *
 * Implements the generalized hypergeometric series pFq via the ascending
 * Pochhammer-ratio method: each term is generated from the previous one by
 * multiplying by the ratio of rising factorials,
 *
 *   term_{n+1} / term_n = ( prod_i (a_i + n) / prod_j (b_j + n) ) * z / (n + 1)
 *
 * accumulating until the term becomes negligible relative to the running sum
 * (|term| < 1e-16 * |sum|) or a hard iteration cap is hit. This incremental
 * form avoids recomputing factorials/Pochhammer symbols from scratch at each
 * order and is numerically well-behaved for the convergent regimes documented
 * per function below.
 *
 * @packageDocumentation
 */

/** Hard cap on the number of series terms accumulated. */
const MAX_TERMS = 500;

/** Relative convergence tolerance: stop once |term| < RELTOL * |sum|. */
const RELTOL = 1e-16;

/**
 * Generalized hypergeometric function pFq(a; b; z), computed via the
 * ascending Pochhammer-ratio series:
 *
 *   pFq(a_1..a_p; b_1..b_q; z) = sum_{n=0}^inf
 *     ( prod_i (a_i)_n / prod_j (b_j)_n ) * z^n / n!
 *
 * This is the generic engine that hyp0f1/hyp1f1/hyp2f1 delegate to. No
 * convergence-region check is performed here (that is the caller's
 * responsibility, see hyp2f1's |z| < 1 guard) — the series is simply summed
 * until it converges to machine precision or MAX_TERMS is reached.
 *
 * @param a - Upper (numerator) parameters
 * @param b - Lower (denominator) parameters
 * @param z - Argument
 * @returns pFq(a; b; z)
 */
export function pFq(a: number[], b: number[], z: number): number {
  let sum = 1;
  let term = 1;

  for (let n = 0; n < MAX_TERMS; n++) {
    let ratio = z / (n + 1);
    for (const ai of a) ratio *= ai + n;
    for (const bj of b) ratio /= bj + n;

    term *= ratio;
    sum += term;

    if (Math.abs(term) < RELTOL * Math.abs(sum)) break;
  }

  return sum;
}

/**
 * Confluent hypergeometric limit function 0F1(; b; z):
 *
 *   hyp0f1(b, z) = sum_{n=0}^inf z^n / ((b)_n n!)
 *
 * Entire in z (converges for all finite z, real or otherwise real-valued
 * here); related to the Bessel functions.
 *
 * @param b - Parameter
 * @param z - Argument
 * @returns 0F1(; b; z)
 *
 * @example
 * hyp0f1(2, 0.5) // ~1.2717234563
 */
export function hyp0f1(b: number, z: number): number {
  return pFq([], [b], z);
}

/**
 * Kummer's confluent hypergeometric function 1F1(a; b; z) (Kummer's M):
 *
 *   hyp1f1(a, b, z) = sum_{n=0}^inf ( (a)_n / (b)_n ) * z^n / n!
 *
 * Entire in z. The direct ascending series targets moderate |z| — for large
 * |z| the series requires many terms and loses accuracy to cancellation
 * (particularly when a and b have opposite signs); an asymptotic expansion
 * would be needed for large |z| but is not implemented here.
 *
 * @param a - Numerator parameter
 * @param b - Denominator parameter
 * @param z - Argument
 * @returns 1F1(a; b; z)
 *
 * @example
 * hyp1f1(1, 2, 0.5) // ~1.2974425414
 */
export function hyp1f1(a: number, b: number, z: number): number {
  return pFq([a], [b], z);
}

/**
 * Gauss's hypergeometric function 2F1(a, b; c; z):
 *
 *   hyp2f1(a, b, c, z) = sum_{n=0}^inf ( (a)_n (b)_n / (c)_n ) * z^n / n!
 *
 * The ascending series converges only for |z| < 1. Analytic continuation
 * beyond the unit disk (e.g. via connection formulas or a transformation to
 * 1-z) is not yet implemented.
 *
 * @param a - First numerator parameter
 * @param b - Second numerator parameter
 * @param c - Denominator parameter
 * @param z - Argument, must satisfy |z| < 1
 * @returns 2F1(a, b; c; z)
 * @throws {Error} If |z| >= 1
 *
 * @example
 * hyp2f1(1, 2, 3, 0.5) // ~1.5451774445
 */
export function hyp2f1(a: number, b: number, c: number, z: number): number {
  if (Math.abs(z) >= 1) {
    throw new Error('hyp2f1: |z| must be < 1 (analytic continuation not yet implemented)');
  }
  return pFq([a, b], [c], z);
}
