import { describe, it, expect } from 'vitest';
import { groebnerBasis, laplacian } from '../src/typed/cas.js';
import { eliminate } from '../src/typed/algebra.js';

/**
 * B-5 upstream-audit fixes, oracle-pinned. The upstream commit 3c355ade9 fixed
 * groebnerBasis fabricating output and eliminate silently falling back; MathTS's
 * independent implementations had the SAME bug classes, worse:
 *
 *  - groebnerBasis didn't run Buchberger at all (it returned the inputs
 *    "normalized"), and its evaluation-based parser couldn't distinguish x from
 *    x² (both are 1 at the unit point) — ⟨x²+y²−1, x−y⟩ came back containing
 *    x+y−1, which does NOT vanish on the ideal's variety (x=y=±1/√2).
 *  - eliminate returned decorative strings ("(A) - (B) [x eliminated]") — not
 *    equations — and echoed garbage input unchanged.
 *
 * Both are now real: exact AST-based polynomial parsing + multivariate division
 * + Buchberger with caps; eliminate computes the elimination ideal (lex order
 * with the eliminated variable first, keep basis elements free of it).
 *
 * Oracle: every Gröbner-basis element lies in the ideal, so it MUST vanish at
 * every solution of the original system — checked numerically at hand-computed
 * solutions. See [[feedback-oracle-tests-implementation-independent]].
 */

/** Evaluate a poly-string at a point (vars substituted numerically). */
function evalPoly(p: string, scope: Record<string, number>): number {
  let expr = p;
  for (const [v, x] of Object.entries(scope)) {
    expr = expr.replaceAll(v, `(${x})`);
  }
  expr = expr.replace(/\^/g, '**');
  return Function('"use strict";return ' + expr)() as number;
}

describe('groebnerBasis — real Buchberger (B-5)', () => {
  it('every basis element of ⟨x²+y²−1, x−y⟩ vanishes at x=y=±1/√2', () => {
    const gb = groebnerBasis(['x^2 + y^2 - 1', 'x - y'], ['x', 'y']);
    expect(gb.length).toBeGreaterThan(0);
    const s = Math.SQRT1_2;
    for (const p of gb) {
      expect(Math.abs(evalPoly(p, { x: s, y: s }))).toBeLessThan(1e-9);
      expect(Math.abs(evalPoly(p, { x: -s, y: -s }))).toBeLessThan(1e-9);
    }
  });

  it('the basis contains a univariate-in-y element (elimination property of lex)', () => {
    const gb = groebnerBasis(['x^2 + y^2 - 1', 'x - y'], ['x', 'y']);
    const univariate = gb.filter((p) => !p.includes('x'));
    expect(univariate.length).toBeGreaterThan(0);
    // that element must vanish at y = ±1/√2 (i.e. be ~ y² − ½ up to scale)
    for (const p of univariate) {
      expect(Math.abs(evalPoly(p, { y: Math.SQRT1_2 }))).toBeLessThan(1e-9);
    }
  });

  it('linear system ⟨x+y−1, x−y⟩ reduces to {x−½, y−½}-equivalent', () => {
    const gb = groebnerBasis(['x + y - 1', 'x - y'], ['x', 'y']);
    for (const p of gb) {
      expect(Math.abs(evalPoly(p, { x: 0.5, y: 0.5 }))).toBeLessThan(1e-9);
    }
    expect(gb.length).toBe(2);
  });

  it('three consistent polynomials work (better than upstream, which throws)', () => {
    // x=1, y=2 is the unique solution of all three
    const gb = groebnerBasis(['x - 1', 'y - 2', 'x + y - 3'], ['x', 'y']);
    for (const p of gb) {
      expect(Math.abs(evalPoly(p, { x: 1, y: 2 }))).toBeLessThan(1e-9);
    }
  });

  it('docstring example: ⟨x²+y−1, x+y²−1⟩ elements vanish at (0,1) and (1,0)', () => {
    const gb = groebnerBasis(['x^2 + y - 1', 'x + y^2 - 1'], ['x', 'y']);
    for (const p of gb) {
      expect(Math.abs(evalPoly(p, { x: 0, y: 1 }))).toBeLessThan(1e-9);
      expect(Math.abs(evalPoly(p, { x: 1, y: 0 }))).toBeLessThan(1e-9);
    }
  });

  it('throws on non-polynomial input instead of fabricating', () => {
    expect(() => groebnerBasis(['sin(x)'], ['x'])).toThrow();
  });
});

describe('eliminate — real elimination ideal (B-5)', () => {
  it('eliminate x from {2x+3y=5, x+y=2} yields y = 1', () => {
    // x = 2−y ⇒ 2(2−y)+3y = 5 ⇒ y = 1.
    const r = eliminate(['2*x + 3*y = 5', 'x + y = 2'], 'x');
    expect(r.length).toBeGreaterThan(0);
    for (const eq of r) {
      expect(eq).not.toContain('x');
      const lhs = eq.split('=')[0];
      expect(Math.abs(evalPoly(lhs, { y: 1 }))).toBeLessThan(1e-9);
    }
  });

  it('keeps variable-free relations: z is pinned to 3', () => {
    const r = eliminate(['x + y = 1', 'z = 3', 'x - y = 0'], 'x');
    const zEq = r.find((eq) => eq.includes('z'));
    expect(zEq).toBeDefined();
    expect(Math.abs(evalPoly(zEq!.split('=')[0], { z: 3, y: 0.5 }))).toBeLessThan(1e-9);
  });

  it('throws on garbage input instead of echoing it', () => {
    expect(() => eliminate(['not an equation'], 'x')).toThrow();
  });
});

describe('laplacian — input validation (B-5 upstream parity)', () => {
  it('computes Δ(x²+y²) = 4 with valid input', async () => {
    expect(laplacian('x^2 + y^2', ['x', 'y'], { x: 1, y: 1 })).toBeCloseTo(4, 4);
  });

  it('throws a clear error for an empty variables array', () => {
    expect(() => laplacian('x^2', [], { x: 1 })).toThrow(/variables/);
  });

  it('throws a clear error for empty-string variables', () => {
    expect(() => laplacian('x^2', [''], { x: 1 })).toThrow(/variables/);
  });
});
