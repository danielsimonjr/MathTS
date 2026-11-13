import { describe, it, expect } from 'vitest';
import { expand, integrate } from '@danielsimonjr/mathts-functions';

/**
 * The reproduction of #887, written as a user of the published package writes it (import by
 * package name, so the built `dist` is what runs).
 */

describe('#887 expand returns descending degree without unit coefficients', () => {
  it('replays the repro of the issue: x^2 + 2*x + 1', () => {
    // console.log(expand('(x+1)^2').toString()) printed "1 + 2*x + 1*x^2"
    expect(expand('(x+1)^2').toString()).toBe('x^2 + 2*x + 1');
  });

  it('writes no 1* in front of a variable and orders several variables lexicographically', () => {
    expect(expand('(x+1)^3')).toBe('x^3 + 3*x^2 + 3*x + 1');
    expect(expand('(x-1)^2')).toBe('x^2 - 2*x + 1');
    expect(expand('(x+y)^2')).toBe('x^2 + 2*x*y + y^2');
    expect(expand('(x+y)*(x-y)')).toBe('x^2 - y^2');
    expect(expand('1-x^2')).toBe('-x^2 + 1');
  });

  it('integrate prints through the same renderer', () => {
    expect(integrate('3*x^2', 'x')).toBe('x^3');
  });

  it('keeps an exact fraction and never writes a zero term', () => {
    expect(expand('x/3+1/2')).toBe('1/3*x + 1/2');
    expect(expand('x^2 - x^2 + 1')).toBe('1');
  });

  it('refuses a polynomial above the degree limit at once', () => {
    expect(() => expand('(x+1)^1000000000')).toThrow(/degree above 1000/);
    expect(expand('(x^0)^1000000000*x')).toBe('x');
  });
});
