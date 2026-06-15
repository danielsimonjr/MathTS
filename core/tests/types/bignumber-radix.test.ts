import { describe, it, expect } from 'vitest';
import { BigNumber } from '../../src/types/bignumber.js';

/**
 * Radix conversions: toBinary / toOctal / toHexadecimal.
 * Mirrors Decimal.js semantics: `0b`/`0o`/`0x` prefixes, leading `-` for
 * negatives, exact for integers and terminating fractions. (The expression
 * formatter relies on these for hex/bin/oct BigNumber output.)
 */
describe('BigNumber radix conversions', () => {
  it('converts non-negative integers', () => {
    expect(BigNumber.fromNumber(255).toHexadecimal()).toBe('0xff');
    expect(BigNumber.fromNumber(255).toBinary()).toBe('0b11111111');
    expect(BigNumber.fromNumber(255).toOctal()).toBe('0o377');
    expect(BigNumber.fromNumber(8).toOctal()).toBe('0o10');
    expect(BigNumber.fromNumber(0).toBinary()).toBe('0b0');
    expect(BigNumber.fromNumber(0).toOctal()).toBe('0o0');
    expect(BigNumber.fromNumber(0).toHexadecimal()).toBe('0x0');
  });

  it('converts negative integers with a leading sign', () => {
    expect(BigNumber.fromNumber(-10).toHexadecimal()).toBe('-0xa');
    expect(BigNumber.fromNumber(-10).toBinary()).toBe('-0b1010');
    expect(BigNumber.fromNumber(-10).toOctal()).toBe('-0o12');
  });

  it('handles integers beyond Number range', () => {
    const big = 2n ** 70n + 12345n;
    expect(BigNumber.fromBigInt(big).toHexadecimal()).toBe('0x' + big.toString(16));
    expect(BigNumber.fromBigInt(big).toBinary()).toBe('0b' + big.toString(2));
    expect(BigNumber.fromBigInt(big).toOctal()).toBe('0o' + big.toString(8));
    expect(BigNumber.fromBigInt(-big).toHexadecimal()).toBe('-0x' + big.toString(16));
  });

  it('converts terminating fractions', () => {
    expect(BigNumber.fromNumber(0.5).toBinary()).toBe('0b0.1');
    expect(BigNumber.fromNumber(0.5).toOctal()).toBe('0o0.4');
    expect(BigNumber.fromNumber(10.5).toHexadecimal()).toBe('0xa.8');
    expect(BigNumber.fromNumber(-2.25).toBinary()).toBe('-0b10.01');
  });

  it('handles NaN and Infinity', () => {
    const nan = BigNumber.fromNumber(NaN);
    expect(nan.toBinary()).toBe('NaN');
    expect(nan.toHexadecimal()).toBe('NaN');
    expect(BigNumber.fromNumber(Infinity).toBinary()).toBe('Infinity');
    expect(BigNumber.fromNumber(-Infinity).toOctal()).toBe('-Infinity');
  });
});
