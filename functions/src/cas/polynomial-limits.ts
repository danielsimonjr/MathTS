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
