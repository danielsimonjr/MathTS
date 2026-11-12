/**
 * Canonical polynomial forms for CAS simplify / factor (G21).
 *
 * Collapses repeated identical factors to powers and attempts full factorization
 * of univariate integer-coefficient polynomials.
 */

import { expand, factor, variables } from '../typed/algebra.js';

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
  const vars = variables(trimmed);
  if (vars.length !== 1) return null;
  try {
    if (!/\^\s*2\b/.test(trimmed)) return null;
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
