/**
 * The one canonical string form of a polynomial.
 *
 * Every CAS function that returns a polynomial as text (`expand`, `casExpand`, `factor`,
 * `cancel`, `apart`, `together`, `groebnerBasis`, `symbolicIntegral`, ...) renders it through
 * {@link renderPolynomial}, so the same polynomial has the same text wherever it comes from.
 *
 * The canonical form:
 * - terms in descending lexicographic order of the exponent vector (the first variable is the
 *   most significant), so `(x+1)^2` is `x^2 + 2*x + 1` and `(x+y)^2` is `x^2 + 2*x*y + y^2`;
 * - no unit coefficient in front of a variable: `x^2`, `-x`, never `1*x^2`;
 * - a negative term joins with ` - `, a negative leading term starts with `-`;
 * - the zero polynomial is `0`.
 *
 * The module imports nothing, so any layer can use it without a dependency cycle.
 */

/**
 * One term of a polynomial to render.
 *
 * `coeff` is the coefficient already written as text (`'2'`, `'-3'`, `'0.5'`), so the same
 * renderer serves `number`, `bigint` and rational coefficients without rounding them.
 */
export interface PolynomialTermText {
  /** Exponent of each variable; index `i` belongs to `vars[i]`. */
  readonly exps: readonly number[];
  /** The coefficient as text. A leading `-` marks a negative coefficient. */
  readonly coeff: string;
}

/** Compare exponent vectors lexicographically: positive when `a` ranks above `b`. */
function compareExponents(a: readonly number[], b: readonly number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The monomial of one term, such as `x^2*y`. An empty string means the constant term. */
function monomialText(exps: readonly number[], vars: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < exps.length; i++) {
    const e = exps[i];
    if (e === 1) parts.push(vars[i]);
    else if (e > 1) parts.push(`${vars[i]}^${e}`);
  }
  return parts.join('*');
}

/**
 * Render a polynomial in its canonical string form.
 *
 * The terms can arrive in any order; the function sorts them. A term whose coefficient text is
 * `'0'` is dropped. Two terms with the same exponent vector are not merged: the caller passes a
 * polynomial with its like terms already collected.
 *
 * @param terms - The terms, each with an exponent vector and a coefficient text.
 * @param vars - The variable names; `vars[i]` goes with `exps[i]`.
 * @returns The polynomial as text, for example `x^2 + 2*x + 1`.
 *
 * @example
 * renderPolynomial(
 *   [
 *     { exps: [0], coeff: '1' },
 *     { exps: [1], coeff: '2' },
 *     { exps: [2], coeff: '1' },
 *   ],
 *   ['x']
 * ); // 'x^2 + 2*x + 1'
 */
export function renderPolynomial(
  terms: Iterable<PolynomialTermText>,
  vars: readonly string[]
): string {
  const ordered = [...terms]
    .filter((t) => t.coeff !== '0')
    .sort((a, b) => compareExponents(b.exps, a.exps));
  if (ordered.length === 0) return '0';
  const written = ordered.map(({ exps, coeff }) => {
    const monomial = monomialText(exps, vars);
    if (monomial === '') return coeff;
    if (coeff === '1') return monomial;
    if (coeff === '-1') return `-${monomial}`;
    return `${coeff}*${monomial}`;
  });
  return written.join(' + ').replace(/\+ -/g, '- ');
}
