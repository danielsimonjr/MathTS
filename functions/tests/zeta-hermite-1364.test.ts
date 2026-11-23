import { describe, expect, it } from 'vitest';
import { zeta } from '../src/factories/index.js';
import { hermiteH } from '../src/typed/special.js';

describe('zeta and Hermite edge cases (#1364)', () => {
  // mpmath at 65 decimal digits, using the exact IEEE 754 arguments.
  it.each([
    [1.0000000001, 9999999173.173574],
    [0.9999999999, -9999999172.019142],
    [-1e-10, -0.4999999999081062],
    [1e-10, -0.5000000000918939],
    [-0.0001, -0.4999081161774611],
    [0.0001, -0.5000919038861036],
  ])('computes zeta(%s) close to the reference', (s, expected) => {
    expect(Math.abs(Number(zeta(s)) / expected - 1)).toBeLessThan(2e-15);
  });

  it('retains the value at zero and domain behavior at the pole', () => {
    expect(zeta(0)).toBe(-0.5);
    expect(zeta(1)).toBeNaN();
  });

  it('rejects negative Hermite degrees in scalar and array calls', () => {
    expect(hermiteH(-3, 2)).toBeNaN();
    expect(hermiteH(-0.25, 2)).toBeNaN();
    expect(hermiteH(-3, new Float64Array([2, 3]))).toEqual(new Float64Array([NaN, NaN]));
    expect(hermiteH(3, 2)).toBe(40);
  });
});
