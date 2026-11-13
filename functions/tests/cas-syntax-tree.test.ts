import { describe, it, expect } from 'vitest';
import {
  MAX_POLYNOMIAL_DEGREE,
  PolynomialDegreeError,
  parseTree,
  polynomialCoefficients,
} from '../src/cas/syntax-tree.js';

function coefficients(expr: string, variable = 'x'): number[] | null {
  const tree = parseTree(expr);
  if (tree === null) throw new Error(`not parsed: ${expr}`);
  return polynomialCoefficients(tree, variable);
}

describe('polynomialCoefficients reads the shape from the syntax tree', () => {
  it('returns the coefficients, lowest degree first', () => {
    expect(coefficients('x^2 - 3')).toEqual([-3, 0, 1]);
    expect(coefficients('(x+1)^3')).toEqual([1, 3, 3, 1]);
    expect(coefficients('2*x*(x-1) + 4')).toEqual([4, -2, 2]);
    expect(coefficients('-x + x/2')).toEqual([0, -0.5]);
    expect(coefficients('x^0')).toEqual([1]);
    expect(coefficients('7')).toEqual([7]);
    expect(coefficients('(x-1)^2*(x+2)^2')).toEqual([4, -4, -3, 2, 1]);
  });

  it('treats a subtree without the variable as a coefficient', () => {
    const [c0, c1] = coefficients('pi*x - 1') as number[];
    expect(c0).toBe(-1);
    expect(c1).toBeCloseTo(Math.PI, 15);
    const [d0, d1, d2] = coefficients('sqrt(2)*x^2 + 3') as number[];
    expect([d0, d1]).toEqual([3, 0]);
    expect(d2).toBeCloseTo(Math.SQRT2, 15);
  });

  it('keeps the zero coefficients that cancel', () => {
    expect(coefficients('x^2 - x^2')).toEqual([0, 0, 0]);
  });

  it('gives null for a function of the variable, including one with period 1 or 0.5', () => {
    // sin(2*pi*x) is 0 at every integer and half-integer; a sampled test calls it a polynomial.
    for (const expr of ['sin(2*pi*x)', 'cos(2*pi*x) - 1', 'abs(x)', 'sqrt(x)', 'exp(x)']) {
      expect(coefficients(expr), expr).toBeNull();
    }
  });

  it('gives null for the variable in a denominator or an exponent, or a bad exponent', () => {
    for (const expr of ['1/x', 'x^x', '2^x', 'x^-1', 'x^0.5', 'x/0', 'x^2/(x+1)']) {
      expect(coefficients(expr), expr).toBeNull();
    }
  });

  it('gives null for an unknown symbol', () => {
    expect(coefficients('a*x + 1')).toBeNull();
  });

  it('throws PolynomialDegreeError for a degree above the limit, a polynomial that is too high', () => {
    expect(() => coefficients(`x^${MAX_POLYNOMIAL_DEGREE + 1}`)).toThrow(PolynomialDegreeError);
    expect(() => coefficients('(x-x)^1000000000')).toThrow(PolynomialDegreeError);
    expect(() => coefficients('(x+1)^1001')).toThrow(PolynomialDegreeError);
    expect(() => coefficients('x^1001')).toThrow(/degree above 1000/);
    expect(() => coefficients('x^1001')).toThrow(RangeError);
    expect(coefficients(`x^${MAX_POLYNOMIAL_DEGREE}`)).toHaveLength(MAX_POLYNOMIAL_DEGREE + 1);
  });

  it('a form that is not a polynomial wins over the degree limit', () => {
    expect(coefficients('x^1001 + sin(x)')).toBeNull();
    expect(coefficients('x^1001/x')).toBeNull();
  });

  it('drops a coefficient that is only the rounding noise of the terms summed into it', () => {
    // 0.1x^2 - 0.3x^2 + 0.2x^2 is 2.7e-17 x^2 in floating point, and is 0.
    expect(coefficients('0.1*x^2 - 0.3*x^2 + 0.2*x^2')).toEqual([0, 0, 0]);
    expect(coefficients('0.1*x^2 - 0.3*x^2 + 0.2*x^2 + x - 2')).toEqual([-2, 1, 0]);
  });

  it('keeps a small or a large coefficient that is not noise next to a larger one', () => {
    // The size of a coefficient next to the largest one is not a test for noise.
    expect(coefficients('x^2 - 1e20')).toEqual([-1e20, 0, 1]);
    expect(coefficients('x^2 - 1e12')).toEqual([-1e12, 0, 1]);
    expect(coefficients('1e-20*x - 1e-30')).toEqual([-1e-30, 1e-20]);
    expect(coefficients('x - 1e-10')).toEqual([-1e-10, 1]);
  });

  it('does not loop over a huge exponent of a constant base', () => {
    // x^0 is the constant 1: `(x^0)^1e9` must answer at once, not after 1e9 multiplications.
    const started = Date.now();
    expect(coefficients('(x^0)^1000000000')).toEqual([1]);
    expect(coefficients('(2*x^0)^3')).toEqual([8]);
    expect(coefficients('(x^0)^1e300')).toEqual([1]);
    expect(coefficients('(2*x^0)^1e300')).toEqual([Infinity]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('parseTree gives null for text that is not an expression', () => {
    expect(parseTree('x +* 2')).toBeNull();
  });
});
