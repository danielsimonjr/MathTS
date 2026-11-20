/**
 * #1022: `limit` of a 0/0 or c/0 quotient.
 *
 * The sampling path returned the last finite sample at h = 1e-10. At that step 1 - cos(h)
 * rounds to 0 (so the limit of (1 - cos(x))/x^2 was 0, not 0.5), and 1/h = 1e10 stood in
 * for Infinity. A quotient now takes L'Hopital's rule before any sampling.
 */

import { describe, it, expect } from 'vitest';
import { limit } from '../src/index.js';

describe('#1022 limit of a quotient', () => {
  it('limit((1-cos(x))/x^2, x, 0) is 0.5', () => {
    expect(limit('(1-cos(x))/x^2', 'x', 0)).toBeCloseTo(0.5, 12);
  });

  it('limit(1/x, x, 0, right) is Infinity', () => {
    expect(limit('1/x', 'x', 0, 'right')).toBe(Infinity);
  });

  it('limit(1/x, x, 0, left) is -Infinity', () => {
    expect(limit('1/x', 'x', 0, 'left')).toBe(-Infinity);
  });

  it('limit(1/x, x, 0) is NaN: the two sides disagree', () => {
    expect(limit('1/x', 'x', 0)).toBeNaN();
  });

  it('limit(1/x^2, x, 0) is Infinity: the two sides agree', () => {
    expect(limit('1/x^2', 'x', 0)).toBe(Infinity);
  });

  it('limit((x^3-1)/(x-1), x, 1) is 3', () => {
    expect(limit('(x^3-1)/(x-1)', 'x', 1)).toBeCloseTo(3, 12);
  });

  it("limit((exp(x)-1-x)/x^2, x, 0) is 0.5 (two L'Hopital steps)", () => {
    expect(limit('(exp(x)-1-x)/x^2', 'x', 0)).toBeCloseTo(0.5, 12);
  });

  it('limit(sin(x)/x, x, 0) is 1 (regression)', () => {
    expect(limit('sin(x)/x', 'x', 0)).toBeCloseTo(1, 12);
  });
});

describe("#1022 pole sign after L'Hopital steps", () => {
  it('(1-cos(x))/x^3 is +Infinity from the right and -Infinity from the left', () => {
    expect(limit('(1-cos(x))/x^3', 'x', 0, 'right')).toBe(Infinity);
    expect(limit('(1-cos(x))/x^3', 'x', 0, 'left')).toBe(-Infinity);
  });

  it('(1-cos(x))/x^3 has no two-sided limit', () => {
    expect(limit('(1-cos(x))/x^3', 'x', 0)).toBeNaN();
  });
});

describe('#1022 guards', () => {
  it('abs(x)/x: the derivative of abs is not continuous at 0, so the sampling path decides', () => {
    expect(limit('abs(x)/x', 'x', 0)).toBeNaN();
    expect(limit('abs(x)/x', 'x', 0, 'right')).toBe(1);
    expect(limit('abs(x)/x', 'x', 0, 'left')).toBe(-1);
  });

  it('a limit at infinity is unchanged', () => {
    expect(limit('1/x', 'x', Infinity)).toBeCloseTo(0, 6);
    expect(limit('(2*x+1)/x', 'x', Infinity)).toBeCloseTo(2, 6);
  });

  it('a limit that direct evaluation gives is unchanged', () => {
    expect(limit('x^2+1', 'x', 2)).toBe(5);
  });
});
