import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  simplify,
  expand,
  factor,
  fullSimplify,
  casSimplify,
  casFactor,
  integrate,
  symbolicIntegral,
  casDerivative,
  derivative,
  solve,
  evaluate,
  summation,
  quad,
} from '../src/index.js';

describe('G21 dogfood CAS (#716 #717 #718 #719 #690 #721 #832)', () => {
  it('#716 polynomial simplify reaches (x+1)^2', () => {
    const expr = 'x^2+2*x+1';
    for (const fn of [simplify, fullSimplify, casSimplify]) {
      const out = String(fn(expr));
      expect(out.replace(/\s+/g, '')).toMatch(/\(x\+1\)\^2/);
    }
    expect(String(factor(expr)).replace(/\s+/g, '')).toMatch(/\(x\+1\)\^2/);
    expect(String(casFactor(expr)).replace(/\s+/g, '')).toMatch(/\(x\+1\)\^2/);
    expect(String(expand('(x+1)^2'))).toMatch(/x\^2/);
  });

  it('#716 leaves non-polynomials alone and does not factor huge coefficients', () => {
    expect(String(simplify('2*sin(x)^2 + 2'))).toBe('2 * (sin(x) ^ 2 + 1)');
    expect(String(fullSimplify('2*sin(x)^2 + 2'))).toBe('2*sin(x)^2 + 2');
    expect(String(casSimplify('2*sin(x)^2 + 2'))).toBe('2 + 2*sin(x)^2');
    // Above the canonical-form coefficient cap. factor()'s divisor walk is O(|c|);
    // running it here would not return within the timeout.
    const huge = 'x^2 + 2000000000';
    const started = Date.now();
    const out = String(simplify(huge));
    expect(Date.now() - started).toBeLessThan(500);
    expect(out).toMatch(/x/);
    expect(out).not.toMatch(/\^2\s*\*/);
  });

  it('#717 integrate and symbolicIntegral agree on log(abs(x)) for 1/x', () => {
    const a = String(integrate('1/x', 'x'));
    const b = String(symbolicIntegral('1/x', 'x')).replace(/\s+/g, '');
    expect(a.replace(/\s+/g, '')).toBe('log(abs(x))');
    expect(b.replace(/\*1\*/g, '*').replace(/^\*1/, '')).toMatch(/log\(abs\(x\)\)/);
    const norm = (s: string) =>
      s
        .replace(/\s+/g, '')
        .replace(/^\*?1\*/g, '')
        .replace(/\*1\*/g, '*');
    expect(norm(a)).toBe(norm(b));
  });

  it('#718 casDerivative matches derivative', () => {
    const d = String(derivative('sin(x)*x', 'x'));
    expect(String(casDerivative('sin(x)*x', 'x'))).toBe(d);
    expect(String(casDerivative('x^2', 'x'))).toMatch(/2/);
  });

  it('#719 solve x^2-2 returns symbolic sqrt(2)', () => {
    const roots = solve('x^2-2', 'x');
    expect(roots).toHaveLength(2);
    expect(roots).toEqual(expect.arrayContaining(['-sqrt(2)', 'sqrt(2)']));
    expect(solve('2*x - 6', 'x')).toEqual([3]);
    expect(solve('x^2 - 4', 'x')).toEqual([-2, 2]);
    const cubic = solve('x^3 - 8', 'x');
    expect(cubic[0]).toBe(2);
    expect(cubic).toHaveLength(3);
    const imag = solve('x^2 + 1', 'x');
    expect(imag).toHaveLength(2);
    for (const r of imag) {
      expect(r).toBeInstanceOf(Complex);
      expect((r as Complex).im).not.toBe(0);
    }
  });

  it('#690 solve(matrix) throws naming linsolve', () => {
    expect(() =>
      solve(
        [
          [4, 3],
          [6, 3],
        ] as never,
        [10, 12] as never
      )
    ).toThrow(/solve\(equation, variable\).*linsolve/);
  });

  it('#721 sum(i,1,3,i) throws; summation returns 6', () => {
    expect(() => evaluate('sum(i, 1, 3, i)')).toThrow(/summation/);
    expect(() => evaluate('sum(i, 1, 3, i)')).toThrow(/imaginary unit/i);
    expect(summation('k', 'k', 1, 3)).toBe(6);
    expect(evaluate('sum([1,2,3])')).toBe(6);
    expect(evaluate('sum(2, 1, 4, 2)')).toBe(9);
    expect(evaluate('sum([[1,2],[3,4]])')).toBe(10);
    expect(evaluate('sum(i, 1, 3, i)', { i: 4 })).toBe(12);
  });

  it('#832 integrate(fn,a,b) dispatches to quad', () => {
    const v = integrate(Math.sin, 0, Math.PI);
    expect(v).toBeCloseTo(2, 8);
    expect(quad(Math.sin, 0, Math.PI).value).toBeCloseTo(v as number, 12);
  });
});

describe('G21 parity: integrate sin definite', () => {
  it('symbolic definite integral of sin on [0, pi]', () => {
    const v = integrate('sin(x)', 'x', 0, Math.PI);
    expect(v).toBeCloseTo(2, 6);
  });
});
