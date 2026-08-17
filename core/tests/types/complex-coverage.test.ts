/**
 * Supplementary Complex tests targeting previously-uncovered branches:
 * scalar-argument arithmetic, format(), log10/log2, pow edge cases,
 * remaining trig/hyperbolic reciprocals, inverse trig/hyperbolic, sign(0).
 * @module @danielsimonjr/mathts-core/tests/types/complex-coverage
 */

import { describe, it, expect } from 'vitest';
import { Complex, COMPLEX_ZERO } from '../../src/types/complex';

describe('Complex (coverage supplement)', () => {
  describe('static compare equal-re branch', () => {
    it('compares by imaginary part when real parts are equal', () => {
      expect(Complex.compare(new Complex(1, 5), new Complex(1, 2))).toBe(1);
      expect(Complex.compare(new Complex(1, 1), new Complex(1, 1))).toBe(0);
    });
  });

  describe('scalar-argument arithmetic (non-Complex Scalar)', () => {
    // Use a Scalar-like object whose valueOf returns a real number, exercising
    // the non-instanceof branch of add/subtract/multiply/divide.
    const scalar = { valueOf: () => 2 } as unknown as Complex;

    it('adds a real scalar to only the real part', () => {
      const r = new Complex(3, 4).add(scalar);
      expect(r.re).toBe(5);
      expect(r.im).toBe(4);
    });

    it('subtracts a real scalar from only the real part', () => {
      const r = new Complex(3, 4).subtract(scalar);
      expect(r.re).toBe(1);
      expect(r.im).toBe(4);
    });

    it('multiplies both parts by a real scalar', () => {
      const r = new Complex(3, 4).multiply(scalar);
      expect(r.re).toBe(6);
      expect(r.im).toBe(8);
    });

    it('divides both parts by a real scalar', () => {
      const r = new Complex(6, 8).divide(scalar);
      expect(r.re).toBe(3);
      expect(r.im).toBe(4);
    });

    it('returns Infinity/NaN when dividing by real zero scalar', () => {
      const zero = { valueOf: () => 0 } as unknown as Complex;
      const r = new Complex(3, -4).divide(zero);
      expect(r.re).toBe(Infinity);
      expect(r.im).toBe(-Infinity);
      const rz = new Complex(0, 0).divide(zero);
      expect(Number.isNaN(rz.re)).toBe(true);
      expect(Number.isNaN(rz.im)).toBe(true);
    });
  });

  describe('division by complex zero with mixed signs', () => {
    it('produces NaN for a zero part and signed Infinity otherwise', () => {
      const r = new Complex(0, -3).divide(COMPLEX_ZERO);
      expect(Number.isNaN(r.re)).toBe(true);
      expect(r.im).toBe(-Infinity);
    });
  });

  describe('inverse of zero', () => {
    it('returns Infinity + Infinity i', () => {
      const r = COMPLEX_ZERO.inverse();
      expect(r.re).toBe(Infinity);
      expect(r.im).toBe(Infinity);
    });
  });

  describe('format()', () => {
    it('returns plain string when no options provided', () => {
      expect(new Complex(3, 0).format()).toBe('3');
      expect(new Complex(0, 2).format()).toBe('2i');
      expect(new Complex(0, 1).format()).toBe('i');
      expect(new Complex(0, -1).format()).toBe('-i');
      expect(new Complex(3, 4).format()).toBe('3 + 4i');
      expect(new Complex(3, -4).format()).toBe('3 - 4i');
    });

    it('returns plain string when options object omits precision', () => {
      // options present but precision undefined hits the String(n) fallback.
      expect(new Complex(3, 4).format({ notation: 'fixed' })).toBe('3 + 4i');
    });

    it('applies fixed-notation precision', () => {
      expect(new Complex(3.14159, 2.71828).format({ precision: 2, notation: 'fixed' })).toBe(
        '3.14 + 2.72i'
      );
    });

    it('applies exponential-notation precision', () => {
      expect(new Complex(12345, 0).format({ precision: 2, notation: 'exponential' })).toBe(
        '1.23e+4'
      );
    });

    it('applies auto precision via toPrecision', () => {
      expect(new Complex(3.14159, 0).format({ precision: 3 })).toBe('3.14');
    });

    it('rounds tiny imaginary part to zero relative to real part', () => {
      const c = new Complex(100, 1e-10);
      expect(c.format({ precision: 4 })).toBe('100');
    });

    it('rounds tiny real part to zero relative to imaginary part', () => {
      const c = new Complex(1e-10, 100);
      expect(c.format({ precision: 4 })).toBe('100i');
    });

    it('formats unit imaginary magnitude as i with sign', () => {
      expect(new Complex(2, 1).format({ precision: 2, notation: 'fixed' })).toBe('2.00 + i');
      expect(new Complex(2, -1).format({ precision: 2, notation: 'fixed' })).toBe('2.00 - i');
    });
  });

  describe('logarithms base 10 and 2', () => {
    it('computes log10 of a real number', () => {
      const r = new Complex(1000, 0).log10();
      expect(r.re).toBeCloseTo(3);
      expect(r.im).toBeCloseTo(0);
    });

    it('computes log2 of a real number', () => {
      const r = new Complex(8, 0).log2();
      expect(r.re).toBeCloseTo(3);
      expect(r.im).toBeCloseTo(0);
    });
  });

  describe('pow edge cases', () => {
    it('0^0 = 1 with real exponent', () => {
      const r = COMPLEX_ZERO.pow(0);
      expect(r.re).toBe(1);
      expect(r.im).toBe(0);
    });

    it('0^n = 0 for nonzero real exponent', () => {
      const r = COMPLEX_ZERO.pow(3);
      expect(r.re).toBe(0);
      expect(r.im).toBe(0);
    });

    it('0^complex = 0', () => {
      const r = COMPLEX_ZERO.pow(new Complex(2, 1));
      expect(r.re).toBe(0);
      expect(r.im).toBe(0);
    });

    it('computes general complex exponent', () => {
      // e^(i ln(e)) where base = e, exp = i  => e^i = cos1 + i sin1
      const r = new Complex(Math.E, 0).pow(new Complex(0, 1));
      expect(r.re).toBeCloseTo(Math.cos(1));
      expect(r.im).toBeCloseTo(Math.sin(1));
    });
  });

  describe('reciprocal trig functions', () => {
    it('cot(z) = cos/sin', () => {
      const z = new Complex(1, 0.5);
      expect(z.cot().equals(z.cos().divide(z.sin()))).toBe(true);
    });
    it('sec(z) = 1/cos', () => {
      const z = new Complex(0.4, 0.3);
      expect(z.sec().equals(z.cos().inverse())).toBe(true);
    });
    it('csc(z) = 1/sin', () => {
      const z = new Complex(0.4, 0.3);
      expect(z.csc().equals(z.sin().inverse())).toBe(true);
    });
  });

  describe('reciprocal hyperbolic functions', () => {
    it('coth(z) = cosh/sinh', () => {
      const z = new Complex(1, 0.5);
      expect(z.coth().equals(z.cosh().divide(z.sinh()))).toBe(true);
    });
    it('sech(z) = 1/cosh', () => {
      const z = new Complex(0.4, 0.3);
      expect(z.sech().equals(z.cosh().inverse())).toBe(true);
    });
    it('csch(z) = 1/sinh', () => {
      const z = new Complex(0.4, 0.3);
      expect(z.csch().equals(z.sinh().inverse())).toBe(true);
    });
  });

  describe('inverse hyperbolic functions', () => {
    it('asinh is inverse of sinh', () => {
      const z = new Complex(0.6, 0.2);
      const back = z.sinh().asinh();
      expect(back.re).toBeCloseTo(0.6);
      expect(back.im).toBeCloseTo(0.2);
    });

    it('acosh of cosh recovers magnitude', () => {
      const z = new Complex(1.3, 0);
      const r = z.acosh();
      // cosh(acosh(1.3)) == 1.3
      expect(r.cosh().re).toBeCloseTo(1.3);
      expect(r.cosh().im).toBeCloseTo(0);
    });

    it('atanh is inverse of tanh', () => {
      const z = new Complex(0.3, 0.1);
      const back = z.tanh().atanh();
      expect(back.re).toBeCloseTo(0.3);
      expect(back.im).toBeCloseTo(0.1);
    });
  });

  describe('sign of zero', () => {
    it('returns zero for the zero complex number', () => {
      const r = COMPLEX_ZERO.sign();
      expect(r.re).toBe(0);
      expect(r.im).toBe(0);
    });
  });

  describe('sqrt principal branch (algebraic form)', () => {
    it('sqrt(-1) = i and sqrt(-1 - 0i) = −i', () => {
      const pos = new Complex(-1, 0).sqrt();
      expect(pos.re).toBeCloseTo(0);
      expect(pos.im).toBeCloseTo(1);
      const neg = new Complex(-1, -0).sqrt();
      expect(neg.re).toBeCloseTo(0);
      expect(neg.im).toBeCloseTo(-1);
    });

    it('lands in the right half-plane for every quadrant', () => {
      const samples = [
        new Complex(3, 4),
        new Complex(-3, 4),
        new Complex(-3, -4),
        new Complex(3, -4),
      ];
      for (const z of samples) {
        const s = z.sqrt();
        expect(s.re).toBeGreaterThanOrEqual(0);
        const back = s.multiply(s);
        expect(back.re).toBeCloseTo(z.re, 12);
        expect(back.im).toBeCloseTo(z.im, 12);
      }
    });

    it('sqrt of a positive real keeps a signed-zero imaginary part', () => {
      const s = new Complex(9, -0).sqrt();
      expect(s.re).toBe(3);
      expect(Object.is(s.im, -0)).toBe(true);
    });
  });

  describe('abs overflow / underflow window', () => {
    it('matches hypot for ordinary, huge, and tiny magnitudes', () => {
      const ordinary = new Complex(3, 4);
      expect(ordinary.abs()).toBe(5);
      const huge = new Complex(1e200, 1e200);
      expect(huge.abs()).toBeCloseTo(Math.SQRT2 * 1e200, 6);
      const tiny = new Complex(1e-200, 1e-200);
      expect(tiny.abs()).toBeCloseTo(Math.SQRT2 * 1e-200, 6);
    });
  });

  describe('tan / tanh closed forms', () => {
    it('tan(z) matches sin(z)/cos(z) off the real axis', () => {
      const z = new Complex(0.7, 0.4);
      expect(z.tan().equals(z.sin().divide(z.cos()))).toBe(true);
    });
    it('tanh(z) matches sinh(z)/cosh(z) off the real axis', () => {
      const z = new Complex(0.7, 0.4);
      expect(z.tanh().equals(z.sinh().divide(z.cosh()))).toBe(true);
    });
  });
});
