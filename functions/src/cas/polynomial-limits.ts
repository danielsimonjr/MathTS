/**
 * The size limit of a polynomial that the CAS builds from an expression.
 *
 * The module imports nothing, so the low-level polynomial code (`typed/polynomial-ideal.ts`) and
 * the syntax-tree reader (`cas/syntax-tree.ts`) share one limit without a dependency cycle.
 */

/**
 * The highest degree of a polynomial that the CAS builds. A power such as `(x+1)^2000` or a
 * product with a higher degree is refused, so that an input like `(x+1)^1000000000` cannot
 * use time or memory without bound.
 */
export const MAX_POLYNOMIAL_DEGREE = 1000;

/** Thrown when a polynomial would have a degree above {@link MAX_POLYNOMIAL_DEGREE}. */
export class PolynomialDegreeError extends RangeError {
  constructor(message = polynomialDegreeMessage()) {
    super(message);
    this.name = 'PolynomialDegreeError';
  }
}

/** The text of the error: it names the limit, so a caller can say why the input was refused. */
export function polynomialDegreeMessage(): string {
  return `the polynomial has a degree above ${MAX_POLYNOMIAL_DEGREE}, the highest degree that the CAS builds`;
}

/**
 * The largest number of terms of a polynomial that the CAS builds. The terms of a product are
 * counted as they are combined, so a power such as `(a+b+c+d+x)^60`, whose expansion has more than
 * 10000 terms, is refused as soon as its partial product passes the limit, and does not run for
 * minutes. A univariate polynomial of the highest degree has 1001 terms, far below the limit.
 */
export const MAX_POLYNOMIAL_TERMS = 10_000;

/** Thrown when a polynomial would have more than {@link MAX_POLYNOMIAL_TERMS} terms. */
export class PolynomialSizeError extends RangeError {
  constructor(message = polynomialSizeMessage()) {
    super(message);
    this.name = 'PolynomialSizeError';
  }
}

/** The text of the error: it names the limit, so a caller can say why the input was refused. */
export function polynomialSizeMessage(): string {
  return `the polynomial has more than ${MAX_POLYNOMIAL_TERMS} terms, the most that the CAS builds`;
}
