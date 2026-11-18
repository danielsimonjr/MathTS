/**
 * #1201: `sqrt` and `cbrt` seeded Newton with a double root of the value, which is 0 or Infinity
 * outside the double range, so `bignumber('1e-330').sqrt()` was Infinity. The seed now splits the
 * value as m * 10^(n*k).
 *
 * Oracle: exact powers of ten, and root(x)^n == x to the configured precision.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (v: string): BigNumber => BigNumber.parse(v);

afterEach(() => {
  BigNumber.resetConfig();
});

describe('BigNumber.sqrt outside the double range (#1201)', () => {
  it.each([
    ['1e-330', '1e-165'],
    ['1e-400', '1e-200'],
    ['1e310', '1e155'],
    ['1e350', '1e175'],
    ['1e400', '1e200'],
    ['4e-400', '2e-200'],
  ])('sqrt(%s)', (input, expected) => {
    const r = bn(input).sqrt();
    expect(r.isFinite()).toBe(true);
    expect(r.toExponential()).toBe(bn(expected).toExponential());
  });

  it.each(['1e-400', '7.3e-345', '1e400', '5.5e999', '2e-1001', '1.234567e123456'])(
    'sqrt(%s)^2 equals the value to the precision, at 20, 64 and 500 digits',
    (input) => {
      for (const precision of [20, 64, 500]) {
        BigNumber.config({ precision });
        const x = bn(input);
        const r = x.sqrt();
        expect(r.isFinite()).toBe(true);
        const rel = r.multiply(r).subtract(x).abs().divide(x);
        expect(rel.compareTo(bn('1e-' + (precision - 2))) <= 0).toBe(true);
      }
    }
  );

  it('cbrt has the same seed: cbrt(1e-400) and cbrt(1e400)', () => {
    expect(bn('1e-399').cbrt().toExponential()).toBe(bn('1e-133').toExponential());
    expect(bn('8e600').cbrt().toExponential()).toBe(bn('2e200').toExponential());
  });

  it('keeps zero, negative, NaN and Infinity as before', () => {
    expect(bn('0').sqrt().isZero()).toBe(true);
    expect(bn('-1e-400').sqrt().isNaN()).toBe(true);
    expect(BigNumber.fromNumber(NaN).sqrt().isNaN()).toBe(true);
    expect(BigNumber.fromNumber(Infinity).sqrt().isFinite()).toBe(false);
    expect(bn('2').sqrt().toString()).toBe(
      '1.414213562373095048801688724209698078569671875376948073176679738'
    );
  });
});
