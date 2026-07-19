/**
 * Oracle tests for MULTIVARIATE `expand` / `factor` (CAS breadth).
 *
 * Reference is implementation-independent (see
 * [[feedback-oracle-tests-implementation-independent]]): a transform is correct
 * iff its result is numerically equal to the ORIGINAL expression at several
 * random multi-variable points — the exact factored/expanded string form is not
 * contractual. The specific forms were cross-checked against `sympy.expand` /
 * `sympy.factor` when authored (e.g. `expand((x+y)^2)=x^2+2xy+y^2`,
 * `factor(4x^2-9y^2)=(2x-3y)(2x+3y)`).
 */
import { describe, it, expect } from 'vitest';
import { expand, factor, evaluate } from '../src/index.js';

/** Assert `transformed` ≡ `original` at several random points over `vars`. */
function equivAt(transformed: string, original: string, vars: string[]): void {
  for (let trial = 0; trial < 6; trial++) {
    const scope: Record<string, number> = {};
    for (const v of vars) scope[v] = (trial + 1) * 0.7 - 2 + vars.indexOf(v);
    const got = evaluate(transformed, scope) as number;
    const want = evaluate(original, scope) as number;
    expect(got).toBeCloseTo(want, 8);
  }
}

describe('multivariate expand (exact, like terms collected)', () => {
  const cases = [
    ['(x+y)^2', ['x', 'y']],
    ['(x+y)*(x-y)', ['x', 'y']],
    ['(x+y)^3', ['x', 'y']],
    ['(a+b)*(c+d)', ['a', 'b', 'c', 'd']],
    ['(x+2*y)^2', ['x', 'y']],
    ['(x-y)^4', ['x', 'y']],
    ['(2*x+3*y)^2', ['x', 'y']],
    ['(x+y+z)^2', ['x', 'y', 'z']],
  ] as const;
  for (const [expr, vars] of cases) {
    it(`expand(${expr})`, () => {
      const e = expand(expr);
      equivAt(e, expr, [...vars]);
      // Collected: (x+y)^2 must not leave a bare 'x*x'/'y*y' product.
      expect(e).not.toMatch(/(\b[a-z])\*\1\b/);
    });
  }
});

describe('multivariate factor (tractable subset)', () => {
  const cases = [
    ['x^2*y + x*y^2', ['x', 'y']], // common monomial: x*y*(x+y)
    ['x^2 - y^2', ['x', 'y']], // difference of squares
    ['4*x^2 - 9*y^2', ['x', 'y']], // scaled difference of squares
    ['2*x^2*y + 4*x*y^2', ['x', 'y']], // content + monomial + cofactor
    ['9*a^2 - 16*b^2', ['a', 'b']],
    ['3*x^3*y - 3*x*y^3', ['x', 'y']], // content*monomial*(diff of squares)
    ['6*x + 4*y', ['x', 'y']], // integer content only (legacy path)
    ['3*x + 5*y', ['x', 'y']], // irreducible → unchanged
  ] as const;
  for (const [expr, vars] of cases) {
    it(`factor(${expr})`, () => {
      equivAt(factor(expr), expr, [...vars]);
    });
  }

  it('factors a genuine common monomial (not just integer content)', () => {
    expect(factor('x^2*y + x*y^2')).toContain('x*y');
  });

  it('recognizes a difference of squares', () => {
    // (2x-3y)(2x+3y) — both factors present
    const f = factor('4*x^2 - 9*y^2');
    expect(f).toContain('2*x - 3*y');
    expect(f).toContain('2*x + 3*y');
  });
});
