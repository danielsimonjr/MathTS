/**
 * `BigNumber.fromBigInt` and the result of every operation remove the trailing decimal zeros of a
 * coefficient (#1164, code-review finding F1). A long coefficient is divided by powers 10^(2^j),
 * largest first, in place of one zero in each step. These rows pin the values for every count of
 * zeros around each power of two, for short and long coefficients. The time bound is the
 * wall-clock gate "bignumber-from-bigint-zeros" (tools/test/wall-clock-gates.json).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { BigNumber } from '../src/index.js';

/** The significand digits of a BigNumber as printed by toExponential, with no point or sign. */
const significand = (x: BigNumber): string => x.toExponential().split('e')[0]!.replace(/[-.]/g, '');

/** Each count of zeros near a power of two, up to 2^11 + 1, and a few others. */
const ZERO_COUNTS = [0, 1, 2, 3, 7, 39, 40, 41, 100, 1023, 1024, 1025, 2047, 2048, 2049, 5000];
/** Odd parts: one digit, one of 45 digits (above the short-coefficient limit 10^40), one even. */
const PARTS = [1n, 7n, 123456789012345678901234567890123456789012345n, 2n ** 70n];

describe('#1164 BigNumber trailing zeros', () => {
  afterEach(() => BigNumber.resetConfig());

  it('fromBigInt keeps the value and strips every trailing zero', () => {
    for (const part of PARTS) {
      for (const zeros of ZERO_COUNTS) {
        for (const sign of [1n, -1n]) {
          const value = sign * part * 10n ** BigInt(zeros);
          const x = BigNumber.fromBigInt(value);
          expect(x.toBigInt()).toBe(value);
          expect(x.e).toBe((part * 10n ** BigInt(zeros)).toString().length - 1);
          const digits = significand(x);
          expect(digits).toBe(part.toString().replace(/0+$/, ''));
        }
      }
    }
  });

  it('fromBigInt(10^100000) is 1e100000', () => {
    const x = BigNumber.fromBigInt(10n ** 100000n);
    expect(x.e).toBe(100000);
    expect(significand(x)).toBe('1');
  });

  it('a product with many trailing zeros is normalized at a high precision', () => {
    BigNumber.config({ precision: 6000 });
    for (const k of [40, 1024, 2049, 5000]) {
      const p = BigNumber.fromBigInt(2n ** BigInt(k)).times(BigNumber.fromBigInt(5n ** BigInt(k)));
      expect(p.e).toBe(k);
      expect(significand(p)).toBe('1');
      expect(p.toBigInt()).toBe(10n ** BigInt(k));
    }
  });
});
