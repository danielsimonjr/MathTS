/**
 * Public entry point of the univariate factorization engine: parse an
 * expression string into an integer polynomial, run the Zassenhaus pipeline
 * (`factorUnivariateZ`), and render the irreducible factorization back to a
 * string that matches `algebra.ts`'s `factor()` output conventions.
 *
 * This module is deliberately self-contained (it does not import `algebra.ts`)
 * so wiring it into `factor()` introduces no import cycle. It reuses the shared
 * polynomial parser from `../polynomial-ideal.js` and the `bigint` engine from
 * this directory.
 *
 * Part of the univariate factorization engine
 * (`functions/src/typed/factorization/`).
 */

import { polyFromExpression, type Poly } from '../polynomial-ideal.js';
import { degree, type IntPoly } from './integer-poly.js';
import { factorUnivariateZ } from './zassenhaus.js';

/** Absolute tolerance for treating a parsed float coefficient as an integer. */
const INT_TOLERANCE = 1e-7;

/**
 * Convert a single-variable `Poly` (from `polynomial-ideal.ts`) to a dense
 * ascending coefficient array (index = power), trimming trailing near-zeros.
 * Mirrors `algebra.ts`'s private `polyToDense` (kept local to avoid an import
 * cycle).
 */
function polyToDense(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) dense[t.powers[0]] += t.coeff;
  let n = dense.length;
  while (n > 0 && Math.abs(dense[n - 1]) < 1e-9) n -= 1;
  return dense.slice(0, n);
}

/**
 * Render a dense integer-coefficient univariate polynomial as a bare (no outer
 * parentheses) human-readable string with the repo's spacing/`*`/`^` style and
 * unit coefficients elided: `[1,0,1] → "x^2 + 1"`, `[-1,0,2] → "2*x^2 - 1"`.
 * Coefficients are rounded for display; zero terms are omitted. Exported so
 * `algebra.ts` can render an unfactorable higher-degree remainder consistently.
 */
export function cleanUnivariatePoly(coeffs: number[], v: string): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    const c = Math.round(coeffs[i]);
    if (c === 0) continue;
    const abs = Math.abs(c);
    let term: string;
    if (i === 0) {
      term = String(abs);
    } else {
      const varPart = i === 1 ? v : `${v}^${i}`;
      term = abs === 1 ? varPart : `${abs}*${varPart}`;
    }
    if (parts.length === 0) {
      parts.push(c < 0 ? `-${term}` : term);
    } else {
      parts.push(c < 0 ? '-' : '+', term);
    }
  }
  return parts.length === 0 ? '0' : parts.join(' ');
}

/**
 * Render a linear integer factor `a*x + b` (primitive, `a > 0`) the same way
 * `algebra.ts`'s `formatLinearFactor` renders it: `(x - 1)`, `(2*x + 1)`,
 * `(x)`, ...
 */
function renderLinearFactor(poly: IntPoly, v: string): string {
  const b = poly[0];
  const a = poly[1];
  const base = a === 1n ? v : `${a}*${v}`;
  if (b === 0n) return `(${base})`;
  return b < 0n ? `(${base} - ${-b})` : `(${base} + ${b})`;
}

/**
 * Render a dense `bigint`-coefficient univariate polynomial (ascending,
 * index = power) the same format as {@link cleanUnivariatePoly}, but staying
 * entirely in `bigint` arithmetic — coefficients produced by the Zassenhaus
 * engine can exceed 2^53 (via Hensel lifting to p^k), and routing them
 * through `Number()` silently rounds. No trailing/leading zero trimming is
 * performed here since `poly` (a factor from `factorUnivariateZ`) is already
 * trimmed by construction.
 */
function renderIntPoly(coeffs: IntPoly, v: string): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    const c = coeffs[i];
    if (c === 0n) continue;
    const abs = c < 0n ? -c : c;
    let term: string;
    if (i === 0) {
      term = abs.toString();
    } else {
      const varPart = i === 1 ? v : `${v}^${i}`;
      term = abs === 1n ? varPart : `${abs}*${varPart}`;
    }
    if (parts.length === 0) {
      parts.push(c < 0n ? `-${term}` : term);
    } else {
      parts.push(c < 0n ? '-' : '+', term);
    }
  }
  return parts.length === 0 ? '0' : parts.join(' ');
}

/**
 * Render one irreducible factor: linears via {@link renderLinearFactor},
 * higher via {@link renderIntPoly} (bigint-native — see its doc comment for
 * why this must not go through `Number()`) wrapped in parentheses. Exported
 * for direct unit testing of the bigint-fidelity path.
 */
export function renderFactor(poly: IntPoly, v: string): string {
  if (degree(poly) === 1) return renderLinearFactor(poly, v);
  return `(${renderIntPoly(poly, v)})`;
}

/**
 * Factor a univariate integer polynomial given as an expression string into
 * its irreducible factors over ℤ/ℚ, rendered to a `*`-joined string matching
 * `factor()`'s conventions (constant prefix when ≠ 1, degree-1 factors via the
 * linear formatter, degree ≥ 2 factors wrapped in parentheses, repeated factors
 * for multiplicity > 1).
 *
 * Returns `null` when the input is not an integer polynomial in `v` (parse
 * failure, another variable, non-integer coefficients, degree < 1) OR when the
 * polynomial is already irreducible over ℚ (a single primitive factor with
 * multiplicity 1) — in that "nothing gained" case the caller keeps its existing
 * behavior (leaving the expression whole / doing plain content extraction).
 * Factor order is `factorUnivariateZ`'s deterministic (degree, coefficients)
 * order.
 */
export function factorPolynomialUnivariate(expr: string, v: string): string | null {
  let dense: number[];
  try {
    dense = polyToDense(polyFromExpression(expr, [v]));
  } catch {
    return null;
  }
  if (dense.length < 2) return null; // degree < 1: nothing to factor
  for (const c of dense) {
    if (!Number.isFinite(c) || Math.abs(c - Math.round(c)) > INT_TOLERANCE) return null;
  }

  const intPoly: IntPoly = dense.map((c) => BigInt(Math.round(c)));
  const fact = factorUnivariateZ(intPoly);

  // Irreducible over ℚ (single primitive factor, multiplicity 1): decline so
  // the caller preserves its prior output (whole expression / content only).
  if (fact.factors.length === 1 && fact.factors[0].mult === 1) return null;

  const parts: string[] = [];
  if (fact.constant !== 1n) parts.push(String(fact.constant));
  for (const { poly, mult } of fact.factors) {
    const term = renderFactor(poly, v);
    for (let i = 0; i < mult; i += 1) parts.push(term);
  }
  return parts.join('*');
}
