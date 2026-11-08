import { describe, it, expect, expectTypeOf } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { gcd, lcm } from '../src/index.js';

describe('gcd typed result (compile-time)', () => {
  it('gives each signature the type of its arguments without a cast', () => {
    expectTypeOf(gcd(12, 18)).toEqualTypeOf<number>();
    expectTypeOf(gcd(12n, 18n)).toEqualTypeOf<bigint>();
    expectTypeOf(
      gcd(BigNumber.fromNumber(12), BigNumber.fromNumber(18))
    ).toEqualTypeOf<BigNumber>();
  });
});

describe('gcd typed result (runtime)', () => {
  it('returns the value of the declared type', () => {
    const n: number = gcd(-12, 18);
    const b: bigint = gcd(12n, -18n);
    const big: BigNumber = gcd(BigNumber.fromNumber(12), BigNumber.fromNumber(18));
    expect(n).toBe(6);
    expect(b).toBe(6n);
    expect(big.toNumber()).toBe(6);
  });

  it('keeps lcm, which reads gcd, unchanged', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(4n, 6n)).toBe(12n);
  });
});
