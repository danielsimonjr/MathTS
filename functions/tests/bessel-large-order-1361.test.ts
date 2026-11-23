import { describe, expect, it } from 'vitest';
import { besselJ, besselY } from '../src/index.js';

describe('#1361 large-order uniform Bessel expansion', () => {
  // SciPy 1.17.0 jv/yv, including both sides of the turning point.
  it.each([
    [1e6, 999900, 0.0012396743498099855, -0.018868059508410164],
    [1e6, 1e6, 0.004473073183377776, -0.007747590021617347],
    [1e6 + 0.5, 1000100.5, 0.0065343119968862065, 0.0006525318354695651],
    [1e8, 100000500, 0.0013608305145726995, 0.0002976971572477781],
    [1.25e9, 1249999999, 0.0004148892710834839, -0.0007198357966631473],
  ])('matches independent values for order %s at %s', (n, x, j, y) => {
    expect(Math.abs((besselJ(n, x) as number) / j - 1)).toBeLessThan(2e-8);
    expect(Math.abs((besselY(n, x) as number) / y - 1)).toBeLessThan(2e-8);
  });

  it('retains parity and negative half-order reflection', () => {
    expect(besselJ(1000001, -1000001)).toBe(-(besselJ(1000001, 1000001) as number));
    const order = 1000000.5;
    expect(besselJ(-order, order)).toBe(-(besselY(order, order) as number));
    expect(besselY(-order, order)).toBe(besselJ(order, order));
  });
});
