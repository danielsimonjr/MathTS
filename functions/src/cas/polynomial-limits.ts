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

/**
 * The most terms that a power of a multivariate polynomial may have. The check uses the number of
 * terms that the power can hold: the smaller of `binomial(n + t - 1, t - 1)` (`n` the exponent and
 * `t` the number of terms of the base) and the number of exponent vectors in the box that the
 * power fills. So `(x+y+z+w)^900` (about 1.2e8 terms) is refused before any product runs, and
 * `(x+y)^1000` (1001 terms) and `(x^3+x^2+x+1)^100` (301 terms) are not.
 */
export const MAX_POLYNOMIAL_TERMS = 100_000;

/** Thrown when a power of a polynomial would have more than {@link MAX_POLYNOMIAL_TERMS} terms. */
export class PolynomialSizeError extends RangeError {
  constructor(message = polynomialSizeMessage()) {
    super(message);
    this.name = 'PolynomialSizeError';
  }
}

/** The text of the size error: it names the limit. */
export function polynomialSizeMessage(): string {
  return `the polynomial would have more than ${MAX_POLYNOMIAL_TERMS} terms, the most that the CAS builds`;
}

/** The text of the error: it names the limit, so a caller can say why the input was refused. */
export function polynomialDegreeMessage(): string {
  return `the polynomial has a degree above ${MAX_POLYNOMIAL_DEGREE}, the highest degree that the CAS builds`;
}
