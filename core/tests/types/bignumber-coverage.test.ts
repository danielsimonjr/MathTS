/**
 * Supplementary BigNumber tests targeting previously-uncovered branches:
 * sign-prefixed/zero parsing, special-value conversion paths, the `.e` getter,
 * Decimal.js-compat aliases (sub/mul/gt/toSignificantDigits), and the various
 * NaN/Infinity sub-branches across arithmetic and comparison.
 * @module @danielsimonjr/mathts-core/tests/types/bignumber-coverage
 */

import { describe, it, expect } from 'vitest';
import { BigNumber } from '../../src/types/bignumber';

const NAN = BigNumber.fromNumber(NaN);
const POS_INF = BigNumber.fromNumber(Infinity);
const NEG_INF = BigNumber.fromNumber(-Infinity);

describe('BigNumber (coverage supplement)', () => {
  describe('parse edge cases', () => {
    it('handles a leading + sign', () => {
      expect(BigNumber.parse('+42').valueOf()).toBe(42);
    });
    it('handles +infinity literal', () => {
      expect(BigNumber.parse('+infinity').isInfinite()).toBe(true);
      expect(BigNumber.parse('+infinity').isPositive()).toBe(true);
    });
    it('parses values that reduce to zero coefficient', () => {
      expect(BigNumber.parse('0.000').isZero()).toBe(true);
      expect(BigNumber.parse('000').isZero()).toBe(true);
    });
  });

  describe('fromBigInt', () => {
    it('returns zero for 0n', () => {
      expect(BigNumber.fromBigInt(0n).isZero()).toBe(true);
    });
    it('strips trailing zeros into the exponent', () => {
      expect(BigNumber.fromBigInt(12000n).valueOf()).toBe(12000);
      expect(BigNumber.fromBigInt(-300n).valueOf()).toBe(-300);
    });
  });

  describe('static compare special values', () => {
    it('NaN compares as NaN', () => {
      expect(Number.isNaN(BigNumber.compare(NAN, BigNumber.fromNumber(1)))).toBe(true);
    });
    it('equal infinities', () => {
      expect(BigNumber.compare(POS_INF, POS_INF)).toBe(0);
      expect(BigNumber.compare(POS_INF, NEG_INF)).toBe(1);
      expect(BigNumber.compare(NEG_INF, POS_INF)).toBe(-1);
    });
    it('infinity vs finite', () => {
      expect(BigNumber.compare(POS_INF, BigNumber.fromNumber(5))).toBe(1);
      expect(BigNumber.compare(BigNumber.fromNumber(5), POS_INF)).toBe(-1);
      expect(BigNumber.compare(BigNumber.fromNumber(5), NEG_INF)).toBe(1);
    });
    it('zero vs signed', () => {
      const zero = BigNumber.fromNumber(0);
      expect(BigNumber.compare(zero, BigNumber.fromNumber(3))).toBe(-1);
      expect(BigNumber.compare(BigNumber.fromNumber(3), zero)).toBe(1);
      expect(BigNumber.compare(zero, BigNumber.fromNumber(-3))).toBe(1);
    });
    it('negative magnitude ordering', () => {
      expect(BigNumber.compare(BigNumber.fromNumber(-5), BigNumber.fromNumber(-2))).toBe(-1);
      // same order of magnitude, equal value
      expect(BigNumber.compare(BigNumber.fromNumber(12), BigNumber.fromNumber(12))).toBe(0);
    });
  });

  describe('valueOf / toNumber special values', () => {
    it('NaN, Infinity, zero', () => {
      expect(Number.isNaN(NAN.valueOf())).toBe(true);
      expect(POS_INF.valueOf()).toBe(Infinity);
      expect(NEG_INF.valueOf()).toBe(-Infinity);
      expect(BigNumber.fromNumber(0).valueOf()).toBe(0);
      expect(BigNumber.fromNumber(7).toNumber()).toBe(7);
    });
  });

  describe('toFixed', () => {
    it('with no argument returns the lossless fixed-point string', () => {
      expect(BigNumber.parse('123.45').toFixed()).toBe('123.45');
      expect(BigNumber.parse('1000').toFixed()).toBe('1000');
      expect(BigNumber.parse('0.0025').toFixed()).toBe('0.0025');
      expect(BigNumber.fromNumber(0).toFixed()).toBe('0');
    });
    it('special values', () => {
      expect(NAN.toFixed(2)).toBe('NaN');
      expect(POS_INF.toFixed(2)).toBe('Infinity');
      expect(NEG_INF.toFixed(2)).toBe('-Infinity');
    });
    it('zero with decimal places', () => {
      expect(BigNumber.fromNumber(0).toFixed(3)).toBe('0.000');
      expect(BigNumber.fromNumber(0).toFixed(0)).toBe('0');
    });
    it('integer values padded with decimal places', () => {
      expect(BigNumber.parse('1000').toFixed(2)).toBe('1000.00');
    });
    it('small decimal padded to width', () => {
      expect(BigNumber.parse('0.0025').toFixed(6)).toBe('0.002500');
    });
  });

  describe('toExponential', () => {
    it('special values', () => {
      expect(NAN.toExponential()).toBe('NaN');
      expect(POS_INF.toExponential()).toBe('Infinity');
      expect(NEG_INF.toExponential()).toBe('-Infinity');
    });
    it('zero with and without decimal places', () => {
      expect(BigNumber.fromNumber(0).toExponential()).toBe('0e+0');
      expect(BigNumber.fromNumber(0).toExponential(3)).toBe('0.000e+0');
    });
    it('no-argument form for single and multi-digit coefficients', () => {
      expect(BigNumber.fromNumber(5).toExponential()).toBe('5e+0');
      expect(BigNumber.parse('123').toExponential()).toBe('1.23e+2');
      expect(BigNumber.parse('0.0042').toExponential()).toBe('4.2e-3');
    });
    it('zero decimal places drops the fraction', () => {
      expect(BigNumber.parse('123').toExponential(0)).toBe('1e+2');
    });
    it('pads fraction to requested width', () => {
      expect(BigNumber.parse('1.2').toExponential(4)).toBe('1.2000e+0');
    });
  });

  describe('toPrecision', () => {
    it('undefined returns toString', () => {
      expect(BigNumber.parse('123.456').toPrecision()).toBe('123.456');
    });
    it('special values', () => {
      expect(NAN.toPrecision(3)).toBe('NaN');
      expect(POS_INF.toPrecision(3)).toBe('Infinity');
    });
    it('zero', () => {
      expect(BigNumber.fromNumber(0).toPrecision(4)).toBe('0.000');
      expect(BigNumber.fromNumber(0).toPrecision(1)).toBe('0');
    });
    it('switches to exponential for very small magnitude (order < -6)', () => {
      // 1e-8 has order = 1 + (-8) = -7 < -6, forcing exponential notation.
      expect(BigNumber.parse('0.00000001').toPrecision(2)).toContain('e-');
    });
    it('switches to exponential when order exceeds requested significant digits', () => {
      expect(BigNumber.parse('12345').toPrecision(2)).toContain('e+');
    });
  });

  describe('toBigInt', () => {
    it('throws on NaN/Infinity', () => {
      expect(() => NAN.toBigInt()).toThrow();
      expect(() => POS_INF.toBigInt()).toThrow();
    });
    it('zero', () => {
      expect(BigNumber.fromNumber(0).toBigInt()).toBe(0n);
    });
    it('integer with positive exponent', () => {
      expect(BigNumber.parse('1200').toBigInt()).toBe(1200n);
    });
    it('truncates fractional values toward zero', () => {
      expect(BigNumber.parse('12.9').toBigInt()).toBe(12n);
      expect(BigNumber.parse('-12.9').toBigInt()).toBe(-12n);
    });
    it('returns 0n for pure-fraction magnitudes below 1', () => {
      expect(BigNumber.parse('0.5').toBigInt()).toBe(0n);
    });
  });

  describe('arithmetic special-value branches', () => {
    it('add: infinities of opposite sign yield NaN; same sign returns self', () => {
      expect(POS_INF.add(NEG_INF).isNaN()).toBe(true);
      expect(POS_INF.add(POS_INF).isInfinite()).toBe(true);
      expect(POS_INF.add(BigNumber.fromNumber(1)).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(1).add(POS_INF).isInfinite()).toBe(true);
    });
    it('multiply: 0 * Infinity is NaN, Infinity * finite is Infinity', () => {
      expect(BigNumber.fromNumber(0).multiply(POS_INF).isNaN()).toBe(true);
      expect(POS_INF.multiply(BigNumber.fromNumber(-2)).isInfinite()).toBe(true);
      expect(POS_INF.multiply(BigNumber.fromNumber(-2)).isNegative()).toBe(true);
    });
    it('divide: Infinity / Infinity is NaN; Infinity / finite is Infinity; finite / Infinity is 0', () => {
      expect(POS_INF.divide(POS_INF).isNaN()).toBe(true);
      expect(POS_INF.divide(BigNumber.fromNumber(2)).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(2).divide(POS_INF).isZero()).toBe(true);
    });
    it('divide by zero: nonzero -> signed Infinity, zero -> NaN', () => {
      expect(BigNumber.fromNumber(3).divide(BigNumber.fromNumber(0)).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(0).divide(BigNumber.fromNumber(0)).isNaN()).toBe(true);
    });
  });

  describe('aliases (Decimal.js / mathjs compat)', () => {
    it('sub matches subtract', () => {
      expect(BigNumber.fromNumber(5).sub(BigNumber.fromNumber(3)).valueOf()).toBe(2);
    });
    it('mul matches multiply', () => {
      expect(BigNumber.fromNumber(5).mul(BigNumber.fromNumber(3)).valueOf()).toBe(15);
    });
    it('gt accepts number and string operands', () => {
      expect(BigNumber.fromNumber(5).gt(3)).toBe(true);
      expect(BigNumber.fromNumber(5).gt('9')).toBe(false);
    });
    it('toSignificantDigits rounds, and is a no-op when undefined', () => {
      expect(BigNumber.parse('123.456').toSignificantDigits(4).toString()).toBe('123.5');
      expect(BigNumber.parse('123.456').toSignificantDigits().toString()).toBe('123.456');
    });
  });

  describe('ensureBigNumber via mixed-type operands', () => {
    it('accepts number, string, and Scalar valueOf operands', () => {
      expect(BigNumber.fromNumber(1).add(2).valueOf()).toBe(3);
      expect(BigNumber.fromNumber(1).add('4').valueOf()).toBe(5);
      const scalar = { valueOf: () => 10 } as unknown as number;
      expect(BigNumber.fromNumber(1).add(scalar).valueOf()).toBe(11);
    });
  });

  describe('negate / abs / pow / sqrt special cases', () => {
    it('negate of NaN and zero return self-equivalent', () => {
      expect(NAN.negate().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(0).negate().isZero()).toBe(true);
    });
    it('abs of NaN and zero', () => {
      expect(NAN.abs().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(0).abs().isZero()).toBe(true);
      expect(BigNumber.fromNumber(-7).abs().valueOf()).toBe(7);
    });
    it('pow special cases', () => {
      expect(NAN.pow(2).isNaN()).toBe(true);
      expect(BigNumber.fromNumber(5).pow(0).valueOf()).toBe(1);
      expect(BigNumber.fromNumber(0).pow(3).isZero()).toBe(true);
      expect(BigNumber.fromNumber(0).pow(-2).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(2).pow(-2).valueOf()).toBeCloseTo(0.25);
      expect(BigNumber.fromNumber(2).pow(10n).valueOf()).toBe(1024);
    });
    it('sqrt special cases', () => {
      expect(NAN.sqrt().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(-4).sqrt().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(0).sqrt().isZero()).toBe(true);
      expect(POS_INF.sqrt().isInfinite()).toBe(true);
    });
  });

  describe('comparison alias methods', () => {
    const a = BigNumber.fromNumber(2);
    const b = BigNumber.fromNumber(3);
    it('lessThanOrEqual / greaterThanOrEqual / compare', () => {
      expect(a.lessThanOrEqual(b)).toBe(true);
      expect(b.greaterThanOrEqual(a)).toBe(true);
      expect(a.compare(b)).toBe(-1);
      expect(a.compareTo(a)).toBe(0);
    });
  });

  describe('round special-value short circuit', () => {
    it('NaN/Infinity/zero round to themselves', () => {
      expect(NAN.round(2).isNaN()).toBe(true);
      expect(POS_INF.round(2).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(0).round(2).isZero()).toBe(true);
    });
    it('value already at or coarser than target exponent is unchanged', () => {
      expect(BigNumber.parse('12').round(2).toString()).toBe('12');
    });
  });

  describe('.e exponent getter', () => {
    it('matches Decimal.js semantics', () => {
      expect(BigNumber.parse('12345').e).toBe(4);
      expect(BigNumber.parse('0.0123').e).toBe(-2);
      expect(BigNumber.parse('100').e).toBe(2);
      expect(BigNumber.parse('0.01').e).toBe(-2);
      expect(BigNumber.fromNumber(0).e).toBe(0);
      expect(NAN.e).toBe(0);
      expect(POS_INF.e).toBe(0);
    });
  });

  describe('mod special-value branches', () => {
    it('NaN, zero divisor, and infinities', () => {
      expect(NAN.mod(BigNumber.fromNumber(2)).isNaN()).toBe(true);
      expect(BigNumber.fromNumber(5).mod(BigNumber.fromNumber(0)).isNaN()).toBe(true);
      expect(POS_INF.mod(BigNumber.fromNumber(2)).isNaN()).toBe(true);
      // finite mod infinity returns the finite value unchanged
      expect(BigNumber.fromNumber(5).mod(POS_INF).valueOf()).toBe(5);
      expect(BigNumber.fromNumber(0).mod(BigNumber.fromNumber(2)).isZero()).toBe(true);
    });
  });

  describe('transcendental/hyperbolic special-value branches', () => {
    it('sinh/cosh/tanh on infinities and zero', () => {
      expect(POS_INF.sinh().isInfinite()).toBe(true);
      expect(POS_INF.cosh().isInfinite()).toBe(true);
      expect(POS_INF.tanh().valueOf()).toBe(1);
      expect(NEG_INF.tanh().valueOf()).toBe(-1);
      expect(BigNumber.fromNumber(0).sinh().isZero()).toBe(true);
    });
    it('asinh/acosh/atanh special-value branches', () => {
      expect(NAN.asinh().isNaN()).toBe(true);
      expect(POS_INF.asinh().isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(0).asinh().isZero()).toBe(true);
      expect(POS_INF.acosh().isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(-1).atanh().isInfinite()).toBe(true);
    });
    it('exp/expm1 on infinities', () => {
      expect(POS_INF.exp().isInfinite()).toBe(true);
      expect(NEG_INF.exp().isZero()).toBe(true);
      expect(POS_INF.expm1().isInfinite()).toBe(true);
      expect(NEG_INF.expm1().valueOf()).toBe(-1);
    });
    it('ln of Infinity', () => {
      expect(POS_INF.ln().isInfinite()).toBe(true);
    });
    it('cbrt special values', () => {
      expect(NAN.cbrt().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(0).cbrt().isZero()).toBe(true);
      expect(POS_INF.cbrt().isInfinite()).toBe(true);
    });
    it('hypot/log1p special branches', () => {
      expect(NAN.hypot(BigNumber.fromNumber(1)).isNaN()).toBe(true);
      expect(POS_INF.hypot(BigNumber.fromNumber(1)).isInfinite()).toBe(true);
      expect(NAN.log1p().isNaN()).toBe(true);
    });
    it('trig of infinity returns NaN', () => {
      expect(POS_INF.sin().isNaN()).toBe(true);
      expect(POS_INF.cos().isNaN()).toBe(true);
      expect(POS_INF.tan().isNaN()).toBe(true);
    });
    it('atan of infinity returns +-PI/2', () => {
      expect(POS_INF.atan().valueOf()).toBeCloseTo(Math.PI / 2);
      expect(NEG_INF.atan().valueOf()).toBeCloseTo(-Math.PI / 2);
    });
    it('atan2 special branches', () => {
      expect(NAN.atan2(BigNumber.fromNumber(1)).isNaN()).toBe(true);
      expect(BigNumber.fromNumber(0).atan2(BigNumber.fromNumber(0)).isZero()).toBe(true);
      expect(BigNumber.fromNumber(1).atan2(BigNumber.fromNumber(0)).valueOf()).toBeCloseTo(
        Math.PI / 2
      );
      // x negative, y negative -> angle - PI
      expect(BigNumber.fromNumber(-1).atan2(BigNumber.fromNumber(-1)).valueOf()).toBeCloseTo(
        (-3 * Math.PI) / 4
      );
    });
    it('asin/acos out-of-domain and exact-boundary branches', () => {
      expect(BigNumber.fromNumber(2).asin().isNaN()).toBe(true);
      expect(BigNumber.fromNumber(1).asin().valueOf()).toBeCloseTo(Math.PI / 2);
      expect(BigNumber.fromNumber(-1).asin().valueOf()).toBeCloseTo(-Math.PI / 2);
      expect(BigNumber.fromNumber(2).acos().isNaN()).toBe(true);
    });
  });

  describe('_reduceAngle large-argument path', () => {
    it('reduces angles outside [-PI, PI] before the Taylor series', () => {
      // sin(10) via BigNumber should match Math.sin(10) after range reduction.
      expect(BigNumber.fromNumber(10).sin().valueOf()).toBeCloseTo(Math.sin(10), 8);
      expect(BigNumber.fromNumber(-10).cos().valueOf()).toBeCloseTo(Math.cos(-10), 8);
    });
  });

  describe('static compare both-zero branch', () => {
    it('returns 0 when comparing two zeros', () => {
      expect(BigNumber.compare(BigNumber.fromNumber(0), BigNumber.fromNumber(0))).toBe(0);
    });
  });

  describe('rounding modes halfCeil / halfFloor / default', () => {
    it('halfCeil rounds positive ties up and negative ties toward zero', () => {
      expect(BigNumber.parse('2.5').round(0, 'halfCeil').toString()).toBe('3');
      expect(BigNumber.parse('-2.5').round(0, 'halfCeil').toString()).toBe('-2');
    });
    it('halfFloor rounds negative ties away and positive ties toward zero', () => {
      expect(BigNumber.parse('-2.5').round(0, 'halfFloor').toString()).toBe('-3');
      expect(BigNumber.parse('2.5').round(0, 'halfFloor').toString()).toBe('2');
    });
  });

  describe('roundToPrecision special-value short circuit', () => {
    it('NaN/Infinity/zero are returned unchanged', () => {
      expect(NAN.toSignificantDigits(3).isNaN()).toBe(true);
      expect(POS_INF.toSignificantDigits(3).isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(0).toSignificantDigits(3).isZero()).toBe(true);
    });
  });

  describe('inverse-trig NaN inputs and large-argument atan', () => {
    it('asin/acos/atan return NaN for NaN input', () => {
      expect(NAN.asin().isNaN()).toBe(true);
      expect(NAN.acos().isNaN()).toBe(true);
      expect(NAN.atan().isNaN()).toBe(true);
    });
    it('atan reduces |x| > 1 via the reciprocal identity', () => {
      expect(BigNumber.fromNumber(2).atan().valueOf()).toBeCloseTo(Math.atan(2), 8);
      expect(BigNumber.fromNumber(-2).atan().valueOf()).toBeCloseTo(Math.atan(-2), 8);
    });
  });

  describe('atan2 x-negative, y-positive branch', () => {
    it('returns angle + PI in the second quadrant', () => {
      expect(BigNumber.fromNumber(1).atan2(BigNumber.fromNumber(-1)).valueOf()).toBeCloseTo(
        (3 * Math.PI) / 4,
        8
      );
    });
  });

  describe('hyperbolic / transcendental NaN inputs', () => {
    it('sinh/cosh/tanh/asinh/acosh/atanh/expm1 return NaN for NaN input', () => {
      expect(NAN.sinh().isNaN()).toBe(true);
      expect(NAN.cosh().isNaN()).toBe(true);
      expect(NAN.tanh().isNaN()).toBe(true);
      expect(NAN.asinh().isNaN()).toBe(true);
      expect(NAN.acosh().isNaN()).toBe(true);
      expect(NAN.atanh().isNaN()).toBe(true);
      expect(NAN.expm1().isNaN()).toBe(true);
    });
  });

  describe('expm1 small-argument Taylor branch', () => {
    it('uses the direct series for |x| <= 0.5', () => {
      expect(BigNumber.fromNumber(0.25).expm1().valueOf()).toBeCloseTo(Math.expm1(0.25), 10);
      expect(BigNumber.fromNumber(-0.25).expm1().valueOf()).toBeCloseTo(Math.expm1(-0.25), 10);
    });
    it('zero returns zero', () => {
      expect(BigNumber.fromNumber(0).expm1().isZero()).toBe(true);
    });
  });

  describe('toFixed small-decimal padding branch', () => {
    it('pads a sub-1 magnitude to the requested width', () => {
      // exponent makes -exponent > digit length -> the leading-zeros branch.
      expect(BigNumber.parse('0.007').toFixed(5)).toBe('0.00700');
    });
    it('pads a mid-decimal value when requested width exceeds existing places', () => {
      // -exponent <= digit length -> the middle-decimal padding branch.
      expect(BigNumber.parse('1.5').toFixed(4)).toBe('1.5000');
      expect(BigNumber.parse('12.34').toFixed(5)).toBe('12.34000');
    });
  });

  describe('isInteger on special values', () => {
    it('returns false for signed Infinity, true for zero-signed values (NaN/zero)', () => {
      // Implementation short-circuits on NaN/Infinity/zero by returning
      // `_sign === 0`. NaN and zero both carry sign 0; Infinity carries a
      // nonzero sign and is therefore reported non-integer.
      expect(POS_INF.isInteger()).toBe(false);
      expect(NEG_INF.isInteger()).toBe(false);
      expect(NAN.isInteger()).toBe(true);
      expect(BigNumber.fromNumber(0).isInteger()).toBe(true);
      expect(BigNumber.fromNumber(5).isInteger()).toBe(true);
      expect(BigNumber.parse('1.5').isInteger()).toBe(false);
    });
  });
});
