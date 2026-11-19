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

describe('BigNumber root seed: edge precisions, signs and exponents (#1201)', () => {
  // Fixed strings from origin/main, where the double seed is finite: the new seed keeps them.
  it.each([
    [20, '2', '1.4142135623730950488e+0', '1.2599210498948731648e+0'],
    [20, '0.5', '7.071067811865475244e-1', '7.9370052598409973738e-1'],
    [20, '7.77e299', '8.8147603484156051104e+149', '9.1933474275714844648e+99'],
    [20, '1e-20', '1e-10', '2.1544346900318837218e-7'],
    [
      64,
      '3.14159',
      '1.77245310234149777912808755005653851462521661833385218540158437e+0',
      '1.464591475198792330567699945267060270560598223521014044556802884e+0',
    ],
    [
      64,
      '123456789.123',
      '1.111111106609055546434728617210443999097758588974304395090984069e+4',
      '4.979338593835383104988618231856145434858858737656647355466172893e+2',
    ],
    [64, '1e-300', '1e-150', '1e-100'],
  ])('precision %i: sqrt and cbrt of %s are the same as on main', (precision, input, sq, cb) => {
    BigNumber.config({ precision });
    expect(bn(input).sqrt().toExponential()).toBe(sq);
    expect(bn(input).cbrt().toExponential()).toBe(cb);
  });

  it.each(['2e-401', '5.5e999', '-7.3e-345', '-1.234567e123456'])(
    'cbrt(%s)^3 equals the value to the precision, at 1, 2, 20 and 1000 digits',
    (input) => {
      for (const precision of [1, 2, 20, 1000]) {
        BigNumber.config({ precision });
        const x = bn(input);
        const r = x.cbrt();
        expect(r.isFinite()).toBe(true);
        expect(r.isNegative()).toBe(x.isNegative());
        const rel = r.multiply(r).multiply(r).subtract(x).abs().divide(x.abs());
        expect(rel.compareTo(bn('1e-' + Math.max(precision - 2, 0))) <= 0).toBe(true);
      }
    }
  );

  it('sqrt at precision 1, 2 and 1000 outside the double range', () => {
    BigNumber.config({ precision: 1 });
    expect(bn('2e-401').sqrt().toExponential()).toBe('4e-201');
    BigNumber.config({ precision: 2 });
    expect(bn('2e-401').sqrt().toExponential()).toBe('4.5e-201');
    BigNumber.config({ precision: 1000 });
    const x = bn('2e-401');
    const r = x.sqrt();
    const rel = r.multiply(r).subtract(x).abs().divide(x);
    expect(rel.compareTo(bn('1e-998')) <= 0).toBe(true);
  });

  it('negative values outside the double range: cbrt keeps the sign', () => {
    expect(bn('-8e600').cbrt().toExponential()).toBe('-2e+200');
    expect(bn('-1e-399').cbrt().toExponential()).toBe('-1e-133');
  });

  it('negative zero is zero for sqrt and cbrt', () => {
    expect(bn('-0').sqrt().isZero()).toBe(true);
    expect(bn('-0').cbrt().isZero()).toBe(true);
  });

  it('exponents near the configured bound (1e15) are fast and exact', () => {
    // The default bound is 1e9 (#1204): a larger exponent is Infinity or 0. Raise it to the
    // largest value that the config accepts.
    BigNumber.config({ maxExponent: 1e15, minExponent: -1e15 });
    try {
      const start = Date.now();
      expect(bn('4e999999999999998').sqrt().toExponential()).toBe('2e+499999999999999');
      expect(bn('8e-999999999999998').sqrt().toExponential()).toBe(
        bn('2e-499999999999999').multiply(bn('2').sqrt()).toExponential()
      );
      expect(bn('27e999999999999996').cbrt().toExponential()).toBe('3e+333333333333332');
      expect(bn('-8e-999999999999999').cbrt().toExponential()).toBe('-2e-333333333333333');
      expect(Date.now() - start).toBeLessThan(2000);
    } finally {
      BigNumber.resetConfig();
    }
  });
});
