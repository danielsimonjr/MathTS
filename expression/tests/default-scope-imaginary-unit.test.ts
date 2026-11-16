import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { evaluate } from '../src/index.js';

/** Real and imaginary parts of an evaluated result (a number or a Complex). */
function parts(value: unknown): { re: number; im: number } {
  if (typeof value === 'number') return { re: value, im: 0 };
  const c = value as { re: number; im: number };
  return { re: c.re, im: c.im };
}

describe('default scope binds the imaginary unit i (#1025)', () => {
  it('evaluate("i") is the imaginary unit, as in mathjs', () => {
    expect(parts(evaluate('i'))).toEqual({ re: 0, im: 1 });
  });

  it('a caller scope value for i wins over the constant', () => {
    expect(evaluate('i', { i: 3 })).toBe(3);
  });

  // Oracles: mathjs 15.2.0 evaluate(...) for each expression.
  const oracles: Array<[string, number, number]> = [
    ['x + i', 1, 1], // x = 1
    ['1 + i', 1, 1],
    ['i*i', -1, 0],
    ['2*i', 0, 2],
    ['-i', 0, -1],
    ['1/i', 0, -1],
    ['i^2', -1, 0],
    ['i-i', 0, 0],
    ['i/i', 1, 0],
    ['(i*0.5 + 2)*i', -0.5, 2],
    ['i*(1+i)', -1, 1],
  ];
  for (const [expr, re, im] of oracles) {
    it(`${expr} matches mathjs (${re} + ${im}i)`, () => {
      const scope = { x: 1 };
      const got = parts(evaluate(expr, scope));
      expect(Math.abs(got.re - re)).toBeLessThan(1e-12);
      expect(Math.abs(got.im - im)).toBeLessThan(1e-12);
    });
  }

  it('exp(i*pi) is -1 within rounding (mathjs: -1 + 1.22e-16i)', () => {
    const got = parts(evaluate('exp(i*pi)'));
    expect(Math.abs(got.re + 1)).toBeLessThan(1e-12);
    expect(Math.abs(got.im)).toBeLessThan(1e-12);
  });

  // Oracle: mathjs 15.2.0 evaluate(<expr>).
  const complexFns: Array<[string, number, number]> = [
    ['sin(i)', 0, 1.1752011936438014],
    ['cos(i)', 1.5430806348152437, 0],
    ['tan(i)', 0, 0.761594155955765],
    ['sqrt(3+4i)', 2, 1],
    ['cbrt(i)', 0.8660254037844387, 0.49999999999999994],
    ['log(i)', 0, 1.5707963267948966],
    ['log(3+4i)', 1.6094379124341003, 0.9272952180016122],
    ['abs(3+4i)', 5, 0],
    ['abs(i)', 1, 0],
    ['sin(3+4i)', 3.853738037919377, -27.016813258003932],
    ['cos(3+4i)', -27.034945603074224, -3.851153334811777],
    ['tan(3+4i)', -0.00018734620462947842, 0.9993559873814732],
  ];
  for (const [expr, re, im] of complexFns) {
    it(`${expr} matches mathjs (${re} + ${im}i)`, () => {
      const got = parts(evaluate(expr));
      expect(Math.abs(got.re - re)).toBeLessThan(1e-12);
      expect(Math.abs(got.im - im)).toBeLessThan(1e-12);
    });
  }

  it('abs of a Complex from the caller scope is its magnitude', () => {
    expect(evaluate('abs(z)', { z: new Complex(3, 4) })).toBe(5);
  });

  it('mod and nthRoot throw on a complex value, as in mathjs', () => {
    expect(() => evaluate('mod(i, 2)')).toThrow(TypeError);
    expect(() => evaluate('nthRoot(i, 2)')).toThrow(TypeError);
  });

  it('real functions are unchanged', () => {
    expect(evaluate('sqrt(4)')).toBe(2);
    expect(evaluate('cbrt(-8)')).toBe(-2);
    expect(evaluate('abs(-3)')).toBe(3);
  });

  it('real arithmetic is unchanged', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('2 ^ 10')).toBe(1024);
    expect(evaluate('-5')).toBe(-5);
  });
});
