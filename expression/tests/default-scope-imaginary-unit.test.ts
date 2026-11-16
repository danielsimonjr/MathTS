import { describe, it, expect } from 'vitest';
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

  it('a real-only function throws on a complex argument instead of coercing it', () => {
    expect(() => evaluate('sin(i)')).toThrow(TypeError);
    expect(() => evaluate('abs(i)')).toThrow(TypeError);
  });

  it('real arithmetic is unchanged', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('2 ^ 10')).toBe(1024);
    expect(evaluate('-5')).toBe(-5);
  });
});
