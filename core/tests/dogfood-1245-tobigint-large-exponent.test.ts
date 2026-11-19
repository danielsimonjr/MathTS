/**
 * #1245: `BigNumber.toBigInt()` built a zero-padded string for a large exponent and hung on 1e100000000.
 * It now multiplies the coefficient by `10n ** exponent`. It throws a RangeError at once only when the
 * result is certainly above the V8 bigint limit of 2^30 bits (about 3.23e8 digits).
 */
import { describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);

describe('#1245 toBigInt with a large exponent', () => {
  it('gives the exact value of 1e2000000 (main returned it, a 1e6 digit cap threw)', () => {
    const v = bn('1e2000000').toBigInt();
    expect(v === 10n ** 2000000n).toBe(true);
    const s = v.toString();
    expect(s.length).toBe(2000001);
    expect(s.startsWith('10000')).toBe(true);
    expect(s.endsWith('00000')).toBe(true);
  });

  it('gives the exact value of -2.5e1000000', () => {
    const s = bn('-2.5e1000000').toBigInt().toString();
    expect(s.length).toBe(1000002);
    expect(s.startsWith('-25000')).toBe(true);
    expect(s.endsWith('00000')).toBe(true);
  });

  it.each(['1e1000000000', '-1e1000000000', '1e100000000000', '1e1000000000000'])(
    '%s is above the V8 limit and throws a RangeError at once',
    (s) => {
      const start = Date.now();
      expect(() => bn(s).toBigInt()).toThrow(RangeError);
      expect(Date.now() - start).toBeLessThan(100);
    }
  );

  it.each([
    ['0', 0n],
    ['-0', 0n],
    ['1e20', 10n ** 20n],
    ['-1.5e20', -150000000000000000000n],
    ['1.9', 1n],
    ['-1.9', -1n],
    ['0.5', 0n],
    ['-123.456', -123n],
    ['1e-5', 0n],
    ['1.5e-1000000000', 0n],
    ['12345678901234567890.99', 12345678901234567890n],
  ])('%s keeps the truncating result', (s, expected) => {
    expect(bn(s).toBigInt() === expected).toBe(true);
  });

  it('still throws for NaN and Infinity', () => {
    expect(() => bn('NaN').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
    expect(() => bn('Infinity').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
    expect(() => bn('-Infinity').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
  });
});
