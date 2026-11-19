/**
 * #1245: `BigNumber.toBigInt()` built a zero-padded string for a large exponent and hung on 1e100000000.
 * It now multiplies the coefficient by `10n ** exponent` and throws a RangeError above 1,000,000 digits.
 */
import { describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);

describe('#1245 toBigInt with a large exponent', () => {
  it('accepts the digit limit and gives the exact value in bounded time', () => {
    const start = Date.now();
    const v = bn('1e999999').toBigInt();
    expect(v === 10n ** 999999n).toBe(true);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('throws a RangeError for 1e2000000 (the string build took about 1 s and returned a value)', () => {
    expect(() => bn('1e2000000').toBigInt()).toThrow(RangeError);
  });

  it.each(['1e100000000', '-1e100000000', '1e1000000000000'])(
    '%s throws a RangeError at once',
    (s) => {
      const start = Date.now();
      expect(() => bn(s).toBigInt()).toThrow(RangeError);
      expect(Date.now() - start).toBeLessThan(500);
    }
  );

  it('rejects one digit above the limit', () => {
    expect(() => bn('1e1000000').toBigInt()).toThrow(RangeError);
  });

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
