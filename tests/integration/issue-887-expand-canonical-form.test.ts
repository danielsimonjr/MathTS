import { describe, it, expect } from 'vitest';
import { expand } from '@danielsimonjr/mathts-functions';

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
});
