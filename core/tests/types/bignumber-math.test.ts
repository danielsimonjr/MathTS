/**
 * BigNumber trigonometric, hyperbolic, and transcendental function tests
 * @module @mathts/core/tests/types/bignumber-math
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BigNumber,
  BIGNUMBER_PI,
  BIGNUMBER_E,
  BIGNUMBER_LN2,
  BIGNUMBER_LN10,
} from '../../src/types/bignumber';

/** Helper: check BigNumber value is close to expected number */
function expectCloseTo(bn: BigNumber, expected: number, digits = 10): void {
  expect(bn.valueOf()).toBeCloseTo(expected, digits);
}

describe('BigNumber math methods', () => {
  beforeEach(() => {
    BigNumber.resetConfig();
  });

  // ==============================================================
  // Trigonometric Functions
  // ==============================================================

  describe('sin()', () => {
    it('sin(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).sin(), 0);
    });

    it('sin(PI/6) = 0.5', () => {
      const piOver6 = BIGNUMBER_PI.divide(6);
      expectCloseTo(piOver6.sin(), 0.5);
    });

    it('sin(PI/2) = 1', () => {
      const piOver2 = BIGNUMBER_PI.divide(2);
      expectCloseTo(piOver2.sin(), 1);
    });

    it('sin(PI) ≈ 0', () => {
      expectCloseTo(BIGNUMBER_PI.sin(), 0, 10);
    });

    it('sin(-PI/6) = -0.5', () => {
      const negPiOver6 = BIGNUMBER_PI.divide(-6);
      expectCloseTo(negPiOver6.sin(), -0.5);
    });
  });

  describe('cos()', () => {
    it('cos(0) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(0).cos(), 1);
    });

    it('cos(PI/3) = 0.5', () => {
      const piOver3 = BIGNUMBER_PI.divide(3);
      expectCloseTo(piOver3.cos(), 0.5);
    });

    it('cos(PI/2) ≈ 0', () => {
      const piOver2 = BIGNUMBER_PI.divide(2);
      expectCloseTo(piOver2.cos(), 0, 10);
    });

    it('cos(PI) = -1', () => {
      expectCloseTo(BIGNUMBER_PI.cos(), -1);
    });
  });

  describe('tan()', () => {
    it('tan(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).tan(), 0);
    });

    it('tan(PI/4) = 1', () => {
      const piOver4 = BIGNUMBER_PI.divide(4);
      expectCloseTo(piOver4.tan(), 1);
    });

    it('tan(-PI/4) = -1', () => {
      const negPiOver4 = BIGNUMBER_PI.divide(-4);
      expectCloseTo(negPiOver4.tan(), -1);
    });
  });

  describe('asin()', () => {
    it('asin(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).asin(), 0);
    });

    it('asin(0.5) = PI/6', () => {
      expectCloseTo(BigNumber.fromNumber(0.5).asin(), Math.PI / 6);
    });

    it('asin(1) = PI/2', () => {
      expectCloseTo(BigNumber.fromNumber(1).asin(), Math.PI / 2);
    });

    it('asin(-1) = -PI/2', () => {
      expectCloseTo(BigNumber.fromNumber(-1).asin(), -Math.PI / 2);
    });

    it('asin(2) returns NaN (out of domain)', () => {
      expect(BigNumber.fromNumber(2).asin().isNaN()).toBe(true);
    });
  });

  describe('acos()', () => {
    it('acos(1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(1).acos(), 0);
    });

    it('acos(0.5) = PI/3', () => {
      expectCloseTo(BigNumber.fromNumber(0.5).acos(), Math.PI / 3);
    });

    it('acos(0) = PI/2', () => {
      expectCloseTo(BigNumber.fromNumber(0).acos(), Math.PI / 2);
    });

    it('acos(-1) = PI', () => {
      expectCloseTo(BigNumber.fromNumber(-1).acos(), Math.PI);
    });

    it('acos(2) returns NaN (out of domain)', () => {
      expect(BigNumber.fromNumber(2).acos().isNaN()).toBe(true);
    });
  });

  describe('atan()', () => {
    it('atan(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).atan(), 0);
    });

    it('atan(1) = PI/4', () => {
      expectCloseTo(BigNumber.fromNumber(1).atan(), Math.PI / 4);
    });

    it('atan(-1) = -PI/4', () => {
      expectCloseTo(BigNumber.fromNumber(-1).atan(), -Math.PI / 4);
    });
  });

  // ==============================================================
  // Hyperbolic Functions
  // ==============================================================

  describe('sinh()', () => {
    it('sinh(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).sinh(), 0);
    });

    it('sinh(1) ≈ 1.17520...', () => {
      expectCloseTo(BigNumber.fromNumber(1).sinh(), Math.sinh(1));
    });

    it('sinh(-1) ≈ -1.17520...', () => {
      expectCloseTo(BigNumber.fromNumber(-1).sinh(), Math.sinh(-1));
    });
  });

  describe('cosh()', () => {
    it('cosh(0) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(0).cosh(), 1);
    });

    it('cosh(1) ≈ 1.54308...', () => {
      expectCloseTo(BigNumber.fromNumber(1).cosh(), Math.cosh(1));
    });

    it('cosh(-1) = cosh(1)', () => {
      expectCloseTo(BigNumber.fromNumber(-1).cosh(), Math.cosh(1));
    });
  });

  describe('tanh()', () => {
    it('tanh(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).tanh(), 0);
    });

    it('tanh(1) ≈ 0.76159...', () => {
      expectCloseTo(BigNumber.fromNumber(1).tanh(), Math.tanh(1));
    });

    it('tanh(-1) ≈ -0.76159...', () => {
      expectCloseTo(BigNumber.fromNumber(-1).tanh(), Math.tanh(-1));
    });
  });

  describe('asinh()', () => {
    it('asinh(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).asinh(), 0);
    });

    it('asinh(1) ≈ 0.88137...', () => {
      expectCloseTo(BigNumber.fromNumber(1).asinh(), Math.asinh(1));
    });

    it('asinh(-1) ≈ -0.88137...', () => {
      expectCloseTo(BigNumber.fromNumber(-1).asinh(), Math.asinh(-1));
    });
  });

  describe('acosh()', () => {
    it('acosh(1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(1).acosh(), 0);
    });

    it('acosh(2) ≈ 1.31696...', () => {
      expectCloseTo(BigNumber.fromNumber(2).acosh(), Math.acosh(2));
    });

    it('acosh(0.5) returns NaN (out of domain)', () => {
      expect(BigNumber.fromNumber(0.5).acosh().isNaN()).toBe(true);
    });
  });

  describe('atanh()', () => {
    it('atanh(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).atanh(), 0);
    });

    it('atanh(0.5) ≈ 0.54930...', () => {
      expectCloseTo(BigNumber.fromNumber(0.5).atanh(), Math.atanh(0.5));
    });

    it('atanh(-0.5) ≈ -0.54930...', () => {
      expectCloseTo(BigNumber.fromNumber(-0.5).atanh(), Math.atanh(-0.5));
    });

    it('atanh(1) returns Infinity', () => {
      expect(BigNumber.fromNumber(1).atanh().isInfinite()).toBe(true);
    });

    it('atanh(2) returns NaN (out of domain)', () => {
      expect(BigNumber.fromNumber(2).atanh().isNaN()).toBe(true);
    });
  });

  // ==============================================================
  // Transcendental Functions
  // ==============================================================

  describe('exp()', () => {
    it('exp(0) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(0).exp(), 1);
    });

    it('exp(1) = e', () => {
      expectCloseTo(BigNumber.fromNumber(1).exp(), Math.E);
    });

    it('exp(-1) = 1/e', () => {
      expectCloseTo(BigNumber.fromNumber(-1).exp(), 1 / Math.E);
    });

    it('exp(2) ≈ 7.38906...', () => {
      expectCloseTo(BigNumber.fromNumber(2).exp(), Math.exp(2));
    });
  });

  describe('ln()', () => {
    it('ln(1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(1).ln(), 0);
    });

    it('ln(e) = 1', () => {
      expectCloseTo(BIGNUMBER_E.ln(), 1);
    });

    it('ln(0) = -Infinity', () => {
      expect(BigNumber.fromNumber(0).ln().isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(0).ln().isNegative()).toBe(true);
    });

    it('ln(-1) = NaN', () => {
      expect(BigNumber.fromNumber(-1).ln().isNaN()).toBe(true);
    });

    it('ln(10) ≈ 2.30258...', () => {
      expectCloseTo(BigNumber.fromNumber(10).ln(), Math.LN10);
    });
  });

  describe('log10()', () => {
    it('log10(1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(1).log10(), 0);
    });

    it('log10(10) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(10).log10(), 1);
    });

    it('log10(100) = 2', () => {
      expectCloseTo(BigNumber.fromNumber(100).log10(), 2);
    });

    it('log10(1000) = 3', () => {
      expectCloseTo(BigNumber.fromNumber(1000).log10(), 3);
    });
  });

  describe('log2()', () => {
    it('log2(1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(1).log2(), 0);
    });

    it('log2(2) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(2).log2(), 1);
    });

    it('log2(8) = 3', () => {
      expectCloseTo(BigNumber.fromNumber(8).log2(), 3);
    });

    it('log2(1024) = 10', () => {
      expectCloseTo(BigNumber.fromNumber(1024).log2(), 10);
    });
  });

  describe('cbrt()', () => {
    it('cbrt(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).cbrt(), 0);
    });

    it('cbrt(1) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(1).cbrt(), 1);
    });

    it('cbrt(8) = 2', () => {
      expectCloseTo(BigNumber.fromNumber(8).cbrt(), 2);
    });

    it('cbrt(27) = 3', () => {
      expectCloseTo(BigNumber.fromNumber(27).cbrt(), 3);
    });

    it('cbrt(-8) = -2', () => {
      expectCloseTo(BigNumber.fromNumber(-8).cbrt(), -2);
    });
  });

  describe('expm1()', () => {
    it('expm1(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).expm1(), 0);
    });

    it('expm1(1) = e - 1', () => {
      expectCloseTo(BigNumber.fromNumber(1).expm1(), Math.E - 1);
    });

    it('expm1(-1) ≈ -0.63212...', () => {
      expectCloseTo(BigNumber.fromNumber(-1).expm1(), Math.expm1(-1));
    });
  });

  // ==============================================================
  // Other Math Functions
  // ==============================================================

  describe('mod()', () => {
    it('7 mod 3 = 1', () => {
      expectCloseTo(BigNumber.fromNumber(7).mod(3), 1);
    });

    it('10 mod 4 = 2', () => {
      expectCloseTo(BigNumber.fromNumber(10).mod(4), 2);
    });

    it('-7 mod 3 = -1', () => {
      expectCloseTo(BigNumber.fromNumber(-7).mod(3), -1);
    });

    it('7.5 mod 2 = 1.5', () => {
      expectCloseTo(BigNumber.fromNumber(7.5).mod(2), 1.5);
    });
  });

  describe('log1p()', () => {
    it('log1p(0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).log1p(), 0);
    });

    it('log1p(e - 1) = 1', () => {
      const eMinusOne = BIGNUMBER_E.subtract(1);
      expectCloseTo(eMinusOne.log1p(), 1);
    });

    it('log1p(-1) = -Infinity', () => {
      expect(BigNumber.fromNumber(-1).log1p().isInfinite()).toBe(true);
    });

    it('log1p(-2) = NaN (out of domain)', () => {
      expect(BigNumber.fromNumber(-2).log1p().isNaN()).toBe(true);
    });
  });

  describe('atan2()', () => {
    it('atan2(0, 1) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).atan2(BigNumber.fromNumber(1)), 0);
    });

    it('atan2(1, 1) = PI/4', () => {
      expectCloseTo(
        BigNumber.fromNumber(1).atan2(BigNumber.fromNumber(1)),
        Math.PI / 4
      );
    });

    it('atan2(1, 0) = PI/2', () => {
      expectCloseTo(
        BigNumber.fromNumber(1).atan2(BigNumber.fromNumber(0)),
        Math.PI / 2
      );
    });

    it('atan2(-1, -1) = -3*PI/4', () => {
      expectCloseTo(
        BigNumber.fromNumber(-1).atan2(BigNumber.fromNumber(-1)),
        -3 * Math.PI / 4
      );
    });
  });

  describe('hypot()', () => {
    it('hypot(3, 4) = 5', () => {
      expectCloseTo(BigNumber.fromNumber(3).hypot(BigNumber.fromNumber(4)), 5);
    });

    it('hypot(5, 12) = 13', () => {
      expectCloseTo(BigNumber.fromNumber(5).hypot(BigNumber.fromNumber(12)), 13);
    });

    it('hypot(0, 0) = 0', () => {
      expectCloseTo(BigNumber.fromNumber(0).hypot(BigNumber.fromNumber(0)), 0);
    });

    it('hypot(1, 0) = 1', () => {
      expectCloseTo(BigNumber.fromNumber(1).hypot(BigNumber.fromNumber(0)), 1);
    });
  });

  // ==============================================================
  // Edge Cases
  // ==============================================================

  describe('edge cases', () => {
    it('NaN input returns NaN for trig functions', () => {
      const nan = BigNumber.fromNumber(NaN);
      expect(nan.sin().isNaN()).toBe(true);
      expect(nan.cos().isNaN()).toBe(true);
      expect(nan.tan().isNaN()).toBe(true);
      expect(nan.exp().isNaN()).toBe(true);
      expect(nan.ln().isNaN()).toBe(true);
    });

    it('Infinity input returns appropriate values', () => {
      const inf = BigNumber.fromNumber(Infinity);
      expect(inf.sin().isNaN()).toBe(true);
      expect(inf.cos().isNaN()).toBe(true);
      expect(inf.exp().isInfinite()).toBe(true);
      expect(inf.ln().isInfinite()).toBe(true);
    });
  });
});
