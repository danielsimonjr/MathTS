/**
 * The one canonical string form of a polynomial.
 *
 * Every CAS function that returns a polynomial as text (`expand`, `casExpand`, `factor`,
 * `cancel`, `together`, `apart`, `collect`, `minimalPolynomial`, `groebnerBasis`, and the
 * polynomial pieces of the partial-fraction and Layer 3 integrals) renders it through
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

/** A coefficient text that is a zero: `0`, `-0`, `0.0`, `0/5`. */
const ZERO_COEFFICIENT = /^[+-]?0+(?:\.0*)?(?:\/\d+)?$/;

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
 * a zero (`'0'`, `'-0'`, `'0.0'`) is dropped, so the text never holds `-0*x`. The coefficients
 * are text, so the function cannot add two of them: the caller passes a polynomial with its like
 * terms already collected, and two terms with the same exponent vector throw a `TypeError`.
 *
 * @param terms - The terms, each with an exponent vector and a coefficient text.
 * @param vars - The variable names; `vars[i]` goes with `exps[i]`.
 * @returns The polynomial as text, for example `x^2 + 2*x + 1`.
 * @throws TypeError when two terms have the same exponent vector.
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
    .filter((t) => !ZERO_COEFFICIENT.test(t.coeff))
    .sort((a, b) => compareExponents(b.exps, a.exps));
  if (ordered.length === 0) return '0';
  for (let i = 1; i < ordered.length; i++) {
    if (compareExponents(ordered[i - 1].exps, ordered[i].exps) === 0) {
      throw new TypeError(
        'renderPolynomial: two terms have the same exponent vector; collect like terms first'
      );
    }
  }
  const written = ordered.map(({ exps, coeff }) => {
    const monomial = monomialText(exps, vars);
    if (monomial === '') return coeff;
    if (coeff === '1') return monomial;
    if (coeff === '-1') return `-${monomial}`;
    return `${coeff}*${monomial}`;
  });
  return written.join(' + ').replace(/\+ -/g, '- ');
}

/** An integer coefficient that is rounding noise away from a whole number reads as the integer. */
const WHOLE_NUMBER_NOISE = 1e-12;
/** A fraction matches a coefficient when the two differ by no more than this, relative to size. */
const FRACTION_NOISE = 1e-14;
/** The largest denominator of a fraction that a coefficient is written as. */
const MAX_COEFFICIENT_DENOMINATOR = 10_000;

/** The fraction `n/d` (`d` at most {@link MAX_COEFFICIENT_DENOMINATOR}) that equals `c`, or null. */
function coefficientFraction(c: number): [n: number, d: number] | null {
  const tolerance = FRACTION_NOISE * Math.max(1, Math.abs(c));
  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let rest = c;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(rest);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > MAX_COEFFICIENT_DENOMINATOR) return null;
    if (Math.abs(c - h2 / k2) <= tolerance) return [h2, k2];
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    const fractionalPart = rest - a;
    if (fractionalPart === 0) return null;
    rest = 1 / fractionalPart;
  }
  return null;
}

/** True when `1/d` has a finite decimal expansion: `d` has no prime factor besides 2 and 5. */
function hasFiniteDecimal(d: number): boolean {
  let rest = d;
  while (rest % 2 === 0) rest /= 2;
  while (rest % 5 === 0) rest /= 5;
  return rest === 1;
}

/**
 * Write the coefficients of one polynomial as text, without a rounded digit.
 *
 * A coefficient that is an integer up to rounding noise (a relative error of 1e-12) is written as
 * that integer. Only an exact zero is zero: a small coefficient such as `1e-13` stays. A
 * coefficient that equals a fraction `n/d` with a denominator up to 10000 and an infinite decimal
 * expansion (`1/3`, not `1/2`) is written as that fraction, so `x/3` is `1/3*x` and not
 * `0.333333333333*x`. If any coefficient of the polynomial needs a fraction, every fractional
 * coefficient of it is written as a fraction (`1/3*x + 1/2`). A polynomial whose fractional
 * coefficients all have a finite decimal (`0.5*x + 0.25`) keeps the decimals. Any other
 * coefficient is written with 12 digits.
 *
 * @param values - The numeric coefficients of one polynomial.
 * @returns The text of each coefficient, in the order of `values`.
 *
 * @example
 * coefficientTexts([1 / 3, 0.5, 2]); // ['1/3', '1/2', '2']
 * coefficientTexts([0.5, 0.25, 2]); // ['0.5', '0.25', '2']
 */
export function coefficientTexts(values: readonly number[]): string[] {
  const whole = (c: number): number | null => {
    const r = Math.round(c);
    // Around zero the size of the terms that made `c` is not known, so only an exact zero is
    // zero: `1e-13` is a coefficient, not rounding noise.
    if (r === 0) return c === 0 ? 0 : null;
    return Math.abs(c - r) <= WHOLE_NUMBER_NOISE * Math.abs(c) ? r : null;
  };
  const fractions = values.map((c) =>
    Number.isFinite(c) && whole(c) === null ? coefficientFraction(c) : null
  );
  const useFractions = fractions.some((f) => f !== null && !hasFiniteDecimal(f[1]));
  return values.map((c, i) => {
    const r = whole(c);
    if (r !== null) return String(r + 0);
    const fraction = fractions[i];
    if (useFractions && fraction !== null) return `${fraction[0]}/${fraction[1]}`;
    return String(Number(c.toPrecision(12)));
  });
}
