import { describe, it, expect } from 'vitest';
import {
  fromAlgebraExpr,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
import { factorMultivariateKronecker } from '../../src/typed/factorization/kronecker-factor.js';

// factor-set equality up to order and per-factor sign/content normalization
function sameFactorSet(got: MultiPoly[], expectedExprs: string[], vars: string[]): boolean {
  const exp = expectedExprs.map((e) => fromAlgebraExpr(e, vars)!);
  if (got.length !== exp.length) return false;
  const used = new Array(exp.length).fill(false);
  for (const g of got) {
    let hit = -1;
    for (let i = 0; i < exp.length; i++) {
      if (!used[i] && (equals(g, exp[i]) || equals(g, negate(exp[i])))) {
        hit = i;
        break;
      }
    }
    if (hit < 0) return false;
    used[hit] = true;
  }
  return true;
}
function negate(p: MultiPoly): MultiPoly {
  return { vars: p.vars, terms: new Map([...p.terms].map(([k, v]) => [k, -v])) };
}

const F = (expr: string, vars: string[]) => {
  const r = factorMultivariateKronecker(fromAlgebraExpr(expr, vars)!);
  return { r, vars };
};

describe('factorMultivariateKronecker (sympy-pinned)', () => {
  it('x^2 - y^2 = (x-y)(x+y)', () => {
    const { r } = F('x^2 - y^2', ['x', 'y']);
    expect(r).not.toBeNull();
    expect(r!.factors.map((f) => f.mult)).toEqual([1, 1]);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x - y', 'x + y'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('(x+y+1)(x+2y+3) expanded', () => {
    const { r } = F('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3', ['x', 'y']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y + 1', 'x + 2*y + 3'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('x^2*y + x*y^2 + x + y = (x+y)(x*y+1)', () => {
    const { r } = F('x^2*y + x*y^2 + x + y', ['x', 'y']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y', 'x*y + 1'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('(x+y)^2 (x+2y): multiplicity', () => {
    const { r } = F('x^3 + 4*x^2*y + 5*x*y^2 + 2*y^3', ['x', 'y']);
    const byMult = Object.fromEntries(r!.factors.map((f) => [f.mult, f.poly] as const));
    expect(new Set(r!.factors.map((f) => f.mult))).toEqual(new Set([1, 2]));
    expect(equals(byMult[2], fromAlgebraExpr('x + y', ['x', 'y'])!)).toBe(true);
    expect(equals(byMult[1], fromAlgebraExpr('x + 2*y', ['x', 'y'])!)).toBe(true);
  });
  it('irreducible x^2 + y^2 stays whole (single factor)', () => {
    const { r } = F('x^2 + y^2', ['x', 'y']);
    expect(r!.factors.length).toBe(1);
    expect(r!.factors[0].mult).toBe(1);
  });
  it('three variables: (x+y+z)(x-y+z)', () => {
    const { r } = F('x^2 + 2*x*z - y^2 + z^2', ['x', 'y', 'z']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y + z', 'x - y + z'],
        ['x', 'y', 'z']
      )
    ).toBe(true);
  });
});
