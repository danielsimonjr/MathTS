/**
 * Layer 1 rational-function symbolic integration — Task 1: parse a
 * single-variable rational-function expression into exact integer
 * numerator/denominator polynomials, split off the polynomial part via
 * exact-ℚ long division, and integrate a polynomial termwise (power rule).
 *
 * Reuses the univariate expression parser (`polyFromExpression`, from the
 * Gröbner-basis module) for parsing and the bigint dense-polynomial
 * convention (`IntPoly`, index = degree) from the #7 factorization engine
 * for the integer representation.
 *
 * See docs/superpowers/plans/2026-07-20-risch-layer1-rational-integration.md
 * (Task 1). Later tasks build denominator factorization, exact-ℚ partial
 * fractions, and per-factor closed-form integration on top of this module.
 */

import { polyFromExpression, type Poly } from '../typed/polynomial-ideal.js';
import {
  trim as trimIntPoly,
  bigintGcd,
  type IntPoly,
} from '../typed/factorization/integer-poly.js';
import { factorUnivariateZ } from '../typed/factorization/zassenhaus.js';

/** Exact rational number, always normalized to lowest terms with a positive denominator. */
export interface Rat {
  num: bigint;
  den: bigint;
}

/** A rational function `numer(x)/denom(x)` with integer dense (`IntPoly`) coefficients. */
export interface RatFunc {
  numer: IntPoly;
  denom: IntPoly;
}

/** Reduces `num/den` to lowest terms with a positive denominator. Throws on a zero denominator. */
function ratNormalize(num: bigint, den: bigint): Rat {
  if (den === 0n) {
    throw new Error('Rat: zero denominator');
  }
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) {
    return { num: 0n, den: 1n };
  }
  const g = bigintGcd(n, d);
  return { num: n / g, den: d / g };
}

export function ratAdd(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function ratSub(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function ratMul(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.num, a.den * b.den);
}

export function ratDiv(a: Rat, b: Rat): Rat {
  if (b.num === 0n) {
    throw new Error('Rat: division by zero');
  }
  return ratNormalize(a.num * b.den, a.den * b.num);
}

export function ratFromBigint(n: bigint): Rat {
  return { num: n, den: 1n };
}

const RAT_ZERO: Rat = { num: 0n, den: 1n };

/**
 * Splits `expr` at the first top-level (paren-depth 0) `/`, yielding
 * numerator/denominator substrings. When no top-level `/` is present, `expr`
 * is a bare polynomial: numerator = `expr`, denominator = `'1'`.
 */
function splitTopLevelDivision(expr: string): { numerStr: string; denomStr: string } {
  let depth = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(') {
      depth += 1;
    } else if (c === ')') {
      depth -= 1;
    } else if (c === '/' && depth === 0) {
      return { numerStr: expr.slice(0, i), denomStr: expr.slice(i + 1) };
    }
  }
  return { numerStr: expr, denomStr: '1' };
}

/** Dense ascending coefficients (index = power) of a single-variable `Poly`. */
function denseFromPoly(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) {
    maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  }
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) {
    dense[t.powers[0]] += t.coeff;
  }
  return dense;
}

const INT_EPS = 1e-7;

function isCloseToInteger(x: number): boolean {
  return Math.abs(x - Math.round(x)) < INT_EPS;
}

/** Smallest `k` in `[1, LIMIT]` such that `k*c` is (numerically) an integer for every `c`, or `null`. */
function commonDenominator(coeffs: number[]): number | null {
  const LIMIT = 100_000;
  for (let k = 1; k <= LIMIT; k += 1) {
    if (coeffs.every((c) => isCloseToInteger(c * k))) {
      return k;
    }
  }
  return null;
}

/**
 * Parses a single-variable expression `numerExpr/denomExpr` (or a bare
 * polynomial, denominator `[1n]`) into integer numerator/denominator dense
 * polynomials. Rational coefficients are cleared by the LCM of their
 * denominators (numerator and denominator are each cleared independently,
 * then cross-scaled by the other's factor so the represented ratio
 * `numer(x)/denom(x)` is unchanged).
 *
 * Returns `null` when `expr` is not a rational function of `v`: it contains
 * a transcendental call (`sin`/`exp`/... — any identifier other than `v`),
 * more than one variable, a zero denominator, or coefficients that cannot be
 * cleared to integers.
 */
export function parseRationalFunction(expr: string, v: string): RatFunc | null {
  const { numerStr, denomStr } = splitTopLevelDivision(expr);

  let numerPoly: Poly;
  let denomPoly: Poly;
  try {
    numerPoly = polyFromExpression(numerStr, [v]);
    denomPoly = polyFromExpression(denomStr, [v]);
  } catch {
    return null;
  }

  const numerDense = denseFromPoly(numerPoly);
  const denomDense = denseFromPoly(denomPoly);
  if (denomDense.every((c) => c === 0)) {
    return null; // zero denominator: not a rational function
  }

  const kNumer = commonDenominator(numerDense);
  const kDenom = commonDenominator(denomDense);
  if (kNumer === null || kDenom === null) {
    return null;
  }
  const scale = kNumer * kDenom;

  const toIntPoly = (dense: number[]): IntPoly | null => {
    const out: bigint[] = new Array<bigint>(dense.length);
    for (let i = 0; i < dense.length; i += 1) {
      const scaled = dense[i] * scale;
      if (!isCloseToInteger(scaled)) {
        return null;
      }
      out[i] = BigInt(Math.round(scaled));
    }
    return trimIntPoly(out);
  };

  const numer = toIntPoly(numerDense);
  const denom = toIntPoly(denomDense);
  if (numer === null || denom === null || denom.length === 0) {
    return null;
  }

  return { numer, denom };
}

/** Trims trailing (highest-degree) zero `Rat` coefficients. */
function trimRat(p: Rat[]): Rat[] {
  let n = p.length;
  while (n > 0 && p[n - 1].num === 0n) {
    n -= 1;
  }
  return p.slice(0, n);
}

/**
 * Exact-ℚ polynomial long division of `rf.numer` by `rf.denom`:
 * `numer = quotient·denom + remainder`, `deg(remainder) < deg(denom)`.
 * Division is performed over ℚ (so a non-monic denominator is handled
 * correctly); the result is converted back to `bigint` coefficients, which
 * requires every intermediate `Rat` to reduce to an integer denominator —
 * true whenever the division is itself exact-integer, as it is for a
 * genuine rational-function reduction. Throws if it is not (a caller that
 * expects a non-integer quotient/remainder is out of this module's scope).
 */
export function polynomialPart(rf: RatFunc): { quotient: IntPoly; remainder: IntPoly } {
  const denom = trimIntPoly(rf.denom);
  if (denom.length === 0) {
    throw new Error('polynomialPart: zero denominator');
  }
  const db = denom.length - 1;
  const lb = ratFromBigint(denom[db]);
  const denomRat = denom.map(ratFromBigint);

  let rem = trimRat(trimIntPoly(rf.numer).map(ratFromBigint));
  const dq = rem.length - 1 - db;
  const quotient: Rat[] = new Array<Rat>(Math.max(dq + 1, 0)).fill(RAT_ZERO);

  while (rem.length > 0 && rem.length - 1 >= db) {
    const dr = rem.length - 1;
    const shift = dr - db;
    const coeff = ratDiv(rem[dr], lb);
    quotient[shift] = coeff;
    const next = rem.slice();
    for (let i = 0; i <= db; i += 1) {
      next[shift + i] = ratSub(next[shift + i], ratMul(coeff, denomRat[i]));
    }
    rem = trimRat(next);
  }

  const toExactIntPoly = (rs: Rat[]): IntPoly =>
    trimIntPoly(
      rs.map((r) => {
        if (r.den !== 1n) {
          throw new Error('polynomialPart: division introduced a non-integer coefficient');
        }
        return r.num;
      })
    );

  return { quotient: toExactIntPoly(quotient), remainder: toExactIntPoly(rem) };
}

/** Renders a single power-rule term `r * varPart` (`r` already reduced) in the existing rational-rendering style. */
function formatRatTerm(r: Rat, varPart: string): string {
  const sign = r.num < 0n ? '-' : '';
  const absNum = r.num < 0n ? -r.num : r.num;
  const coeffPart = absNum === 1n ? '' : `${absNum}*`;
  const denPart = r.den === 1n ? '' : `/${r.den}`;
  return `${sign}${coeffPart}${varPart}${denPart}`;
}

/**
 * Termwise power rule: the coefficient `c` at degree `n` in `p` integrates
 * to `c/(n+1) · v^(n+1)`. Renders a readable (not contractual beyond
 * containing the expected power) string, e.g. `x^2/2`, `2*x`.
 */
export function integratePolynomial(p: IntPoly, v: string): string {
  const trimmed = trimIntPoly(p);
  const terms: string[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const c = trimmed[i];
    if (c === 0n) {
      continue;
    }
    const n = i + 1;
    const coeff = ratNormalize(c, BigInt(n));
    const varPart = n === 1 ? v : `${v}^${n}`;
    terms.push(formatRatTerm(coeff, varPart));
  }
  if (terms.length === 0) {
    return '0';
  }
  return terms.join(' + ').replace(/\+ -/g, '- ');
}

/**
 * An irreducible factor of a rational function's denominator, classified by
 * degree for Layer 1 closed-form integration: degree 1 ("linear") integrates
 * to a `log`, degree 2 ("quadratic") to a `log` + `atan` pair. Degree ≥ 3
 * irreducible factors are outside Layer 1's scope (see `factorDenominator`).
 */
export interface DenFactor {
  poly: IntPoly;
  mult: number;
  kind: 'linear' | 'quadratic';
}

/**
 * Factors `denom` completely over ℤ/ℚ via the #7 factorization engine
 * (`factorUnivariateZ`) and classifies each irreducible factor by degree.
 *
 * A degree-1 factor is `'linear'`; a degree-2 factor is `'quadratic'` — and,
 * having survived complete factorization over ℚ, necessarily irreducible
 * (any rational root would already have split it into two linear factors,
 * i.e. it has negative discriminant).
 *
 * Returns `null` when any irreducible factor has degree ≥ 3: Layer 1 only
 * handles linear + irreducible-quadratic denominators, so a higher-degree
 * irreducible factor is out of scope and the caller falls back to the
 * `integral(...)` marker (Layer 2/Rothstein–Trager territory).
 */
export function factorDenominator(denom: IntPoly): DenFactor[] | null {
  const { factors } = factorUnivariateZ(trimIntPoly(denom));
  const out: DenFactor[] = [];
  for (const { poly, mult } of factors) {
    const deg = trimIntPoly(poly).length - 1;
    if (deg === 1) {
      out.push({ poly, mult, kind: 'linear' });
    } else if (deg === 2) {
      out.push({ poly, mult, kind: 'quadratic' });
    } else {
      return null;
    }
  }
  return out;
}
