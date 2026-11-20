/**
 * #1022 follow-up (final review): the sampling path of `limit` returned the sample nearest the
 * point. So `x*log(x)` at 0+ gave -2.3e-9 (SymPy: 0), and `sin(1/x)` at 0+ gave a number,
 * although the limit does not exist (SymPy: AccumBounds(-1, 1)). The public
 * `inverseLaplaceTransform('1/(s^2-1e-14)')` gave `t` (true: sinh(1e-7*t)/1e-7), because its
 * sampled table cannot tell the input from 1/s^2.
 */
import { describe, it, expect } from 'vitest';
import { limit, inverseLaplaceTransform } from '../src/typed/cas.js';

describe('#1022 limit: samples that shrink to zero, and an oscillation', () => {
  it.each([
    ['x*log(x)', 'right'],
    ['x^2*log(x)', 'right'],
    ['x*log(x)^2', 'right'],
    ['sqrt(x)*log(x)', 'right'],
  ] as const)('%s at 0 %s is 0', (expr, dir) => {
    expect(limit(expr, 'x', 0, dir)).toBe(0);
  });

  it('a slow convergent sequence is not read as divergent: x^0.001*log(x)/log(x) at 0+ is near 1', () => {
    const value = limit('x^0.001*log(x)/log(x)', 'x', 0, 'right');
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value - 1)).toBeLessThan(0.05);
  });

  it('sin(1/x) at 0+ is NaN (no limit)', () => {
    expect(limit('sin(1/x)', 'x', 0, 'right')).toBeNaN();
  });

  it('sin(1/x) at 0 is NaN (no limit)', () => {
    expect(limit('sin(1/x)', 'x', 0)).toBeNaN();
  });

  it('cos(1/x) at 0- is NaN (no limit)', () => {
    expect(limit('cos(1/x)', 'x', 0, 'left')).toBeNaN();
  });

  it('log(x) at 0+ stays -Infinity, sin(x)/x stays 1', () => {
    expect(limit('log(x)', 'x', 0, 'right')).toBe(-Infinity);
    expect(limit('sin(x)/x', 'x', 0)).toBe(1);
  });
});

describe('#1024 inverseLaplaceTransform: poles the sampled table cannot see', () => {
  it('1/(s^2-1e-14) throws, and does not give t', () => {
    expect(() => inverseLaplaceTransform('1/(s^2-1e-14)', 's', 't')).toThrow(/too close/);
  });

  it('1/(s-1e-9) is not read as 1/s', () => {
    expect(inverseLaplaceTransform('1/(s-1e-9)', 's', 't')).not.toBe('1');
  });

  it('the documented examples keep their text', () => {
    expect(inverseLaplaceTransform('1/s', 's', 't')).toBe('1');
    expect(inverseLaplaceTransform('1/s^2', 's', 't')).toBe('t');
    expect(inverseLaplaceTransform('1/(s^2-1)', 's', 't')).toBe('sinh(1 * t)');
  });
});
