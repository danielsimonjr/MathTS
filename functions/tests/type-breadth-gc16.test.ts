import { describe, it, expect } from 'vitest';
import { round, floor, ceil, fix, sign, gcd, lcm, atan2 } from '@danielsimonjr/mathts-functions';
import { Complex, BigNumber } from '@danielsimonjr/mathts-core';

/**
 * GC16 — broaden narrow type signatures for mathjs parity:
 * round/floor/ceil/fix gain Complex (per-part), sign gains Complex (z/|z|),
 * gcd/lcm gain BigNumber.
 */
describe('GC16: round/floor/ceil/fix on Complex (per-part)', () => {
  const z = new Complex(2.7, -3.2);
  it('rounds each component', () => {
    expect(round(z)).toMatchObject({ re: 3, im: -3 });
    expect(floor(z)).toMatchObject({ re: 2, im: -4 });
    expect(ceil(z)).toMatchObject({ re: 3, im: -3 });
    expect(fix(z)).toMatchObject({ re: 2, im: -3 }); // toward zero
  });
});

describe('GC16: sign(Complex) = z/|z|', () => {
  it('returns the unit-modulus complex', () => {
    const s = sign(new Complex(3, 4)) as Complex;
    expect(s.re).toBeCloseTo(0.6, 12);
    expect(s.im).toBeCloseTo(0.8, 12);
  });
  it('sign(0) = 0', () => {
    expect(sign(new Complex(0, 0))).toMatchObject({ re: 0, im: 0 });
  });
});

describe('GC16: gcd/lcm on BigNumber', () => {
  it('gcd matches the integer result', () => {
    const g = gcd(BigNumber.fromNumber(48), BigNumber.fromNumber(36)) as BigNumber;
    expect(g.toNumber()).toBe(12);
  });
  it('lcm matches the integer result', () => {
    const l = lcm(BigNumber.fromNumber(4), BigNumber.fromNumber(6)) as BigNumber;
    expect(l.toNumber()).toBe(12);
  });
  it('agrees with the number path on large coprime values', () => {
    const g = gcd(BigNumber.fromNumber(1071), BigNumber.fromNumber(462)) as BigNumber;
    expect(g.toNumber()).toBe(gcd(1071, 462)); // 21
  });
});

describe('GC16: atan2(BigNumber, BigNumber)', () => {
  it('matches the number path', () => {
    // BigNumber.atan2 uses the ~11-digit atan series (a pre-existing core trait).
    const r = atan2(BigNumber.fromNumber(1), BigNumber.fromNumber(1)) as BigNumber;
    expect(r.toNumber()).toBeCloseTo(Math.atan2(1, 1), 10);
    const r2 = atan2(BigNumber.fromNumber(-3), BigNumber.fromNumber(4)) as BigNumber;
    expect(r2.toNumber()).toBeCloseTo(Math.atan2(-3, 4), 10);
  });
});
