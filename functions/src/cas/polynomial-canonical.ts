/**
 * Canonical polynomial forms for CAS simplify / factor (G21).
 *
 * Collapses repeated identical factors to powers and attempts full factorization
 * of univariate integer-coefficient polynomials.
 */

import { expand, factor, variables } from '../typed/algebra.js';
import { polyFromExpression, polyToDenseCoefficients } from '../typed/polynomial-ideal.js';

/**
 * `factor` enumerates every divisor of each integer coefficient (`divisorsOf`).
 * A long expression or a coefficient past this bound makes that walk dominate
 * `simplify`, so the canonical-form pass declines and leaves the input alone.
 */
const MAX_POLY_CHARS = 2_000;
const MAX_ABS_COEFF = 4_096;
const MAX_DEGREE = 8;

function smallIntegerPolynomial(expr: string, variable: string): boolean {
  let dense: number[];
  try {
    dense = polyToDenseCoefficients(polyFromExpression(expr, [variable]));
  } catch {
    return false;
  }
  while (dense.length > 1 && dense[dense.length - 1] === 0) dense.pop();
  const degree = dense.length - 1;
  if (degree < 2 || degree > MAX_DEGREE) return false;
  return dense.every(
    (c) => Number.isFinite(c) && Number.isInteger(c) && Math.abs(c) <= MAX_ABS_COEFF
  );
}

/** Collapse `(expr)*(expr)` → `(expr)^2`, including chained products. */
export function collapseIdenticalFactors(expr: string): string {
  let prev = '';
  let r = expr.trim();
  while (r !== prev) {
    prev = r;
    r = r.replace(/\(([^()]+)\)\s*\*\s*\(\1\)/g, '($1)^2');
    const m = r.match(/^(\w+)\s*\*\s*\1$/);
    if (m) r = `${m[1]}^2`;
  }
  return r;
}

/**
 * If `expr` is a univariate polynomial, expand → factor → collapse powers.
 * Returns null when the input is not a recognizable polynomial.
 */
export function tryPolynomialCanonicalForm(expr: string): string | null {
  const trimmed = expr.trim();
  // Skip trivial monomials / scalars so identity rules (e.g. 1*y → y) stay intact.
  if (!/[+-]/.test(trimmed) && !/\^/.test(trimmed)) return null;
  if (trimmed.length > MAX_POLY_CHARS) return null;
  const vars = variables(trimmed);
  if (vars.length !== 1) return null;
  try {
    if (!/\^\s*2\b/.test(trimmed)) return null;
    // Function calls and other non-polynomials parse as one variable (`sin` is a
    // keyword) but are not integer polynomials. Declining here keeps simplify's
    // result and avoids factor's content-extraction rewrite.
    const variable = vars[0];
    if (variable === undefined || !smallIntegerPolynomial(trimmed, variable)) return null;
    const expanded = expand(trimmed);
    const factored = factor(expanded);
    if (factored === expr.trim()) {
      const collapsedOnly = collapseIdenticalFactors(factored);
      return collapsedOnly === expr.trim() ? null : collapsedOnly;
    }
    return collapseIdenticalFactors(factored);
  } catch {
    return null;
  }
}
