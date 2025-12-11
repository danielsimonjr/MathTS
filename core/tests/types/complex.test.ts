/**
 * Complex number tests
 * @module @mathts/core/tests/types/complex
 */

import { describe, it, expect } from 'vitest';
import { Complex, I, isComplex, COMPLEX_ZERO, COMPLEX_ONE } from '../../src/types/complex';

describe('Complex', () => {
  describe('constructor and factory methods', () => {
    it('should create complex number with real and imaginary parts', () => {
      const c = new Complex(3, 4);
      expect(c.re).toBe(3);
      expect(c.im).toBe(4);
      expect(c.type).toBe('Complex');
    });

    it('should default imaginary part to 0', () => {
      const c = new Complex(5);
      expect(c.re).toBe(5);
      expect(c.im).toBe(0);
    });

    it('should create from polar coordinates', () => {
      const c = Complex.fromPolar(1, Math.PI / 2);
      expect(c.re).toBeCloseTo(0);
      expect(c.im).toBeCloseTo(1);
    });

    it('should create from number', () => {
      const c = Complex.fromNumber(42);
      expect(c.re).toBe(42);
      expect(c.im).toBe(0);
    });

    it('should parse from string', () => {
      expect(Complex.parse('3+4i').equals(new Complex(3, 4))).toBe(true);
      expect(Complex.parse('3-4i').equals(new Complex(3, -4))).toBe(true);
      expect(Complex.parse('5').equals(new Complex(5, 0))).toBe(true);
      expect(Complex.parse('4i').equals(new Complex(0, 4))).toBe(true);
      expect(Complex.parse('-4i').equals(new Complex(0, -4))).toBe(true);
      expect(Complex.parse('i').equals(new Complex(0, 1))).toBe(true);
      expect(Complex.parse('-i').equals(new Complex(0, -1))).toBe(true);
    });

    it('should create from JSON', () => {
      const c = Complex.fromJSON({ re: 3, im: 4 });
      expect(c.re).toBe(3);
      expect(c.im).toBe(4);
    });
  });

  describe('type checking', () => {
    it('should identify Complex instances', () => {
      expect(isComplex(new Complex(1, 2))).toBe(true);
      expect(isComplex(I)).toBe(true);
      expect(isComplex(5)).toBe(false);
      expect(isComplex({})).toBe(false);
    });
  });

  describe('conversion methods', () => {
    it('should convert to string', () => {
      expect(new Complex(3, 4).toString()).toBe('3 + 4i');
      expect(new Complex(3, -4).toString()).toBe('3 - 4i');
      expect(new Complex(3, 0).toString()).toBe('3');
      expect(new Complex(0, 4).toString()).toBe('4i');
      expect(new Complex(0, 1).toString()).toBe('i');
      expect(new Complex(0, -1).toString()).toBe('-i');
      expect(new Complex(3, 1).toString()).toBe('3 + i');
    });

    it('should convert to JSON', () => {
      const json = new Complex(3, 4).toJSON();
      expect(json.mathjs).toBe('Complex');
      expect(json.re).toBe(3);
      expect(json.im).toBe(4);
    });

    it('should convert to polar', () => {
      const c = new Complex(3, 4);
      const polar = c.toPolar();
      expect(polar.r).toBeCloseTo(5);
      expect(polar.phi).toBeCloseTo(Math.atan2(4, 3));
    });

    it('should valueOf return magnitude', () => {
      const c = new Complex(3, 4);
      expect(c.valueOf()).toBe(5);
    });
  });

  describe('basic properties', () => {
    it('should compute conjugate', () => {
      const c = new Complex(3, 4);
      const conj = c.conjugate();
      expect(conj.re).toBe(3);
      expect(conj.im).toBe(-4);
    });

    it('should compute absolute value', () => {
      expect(new Complex(3, 4).abs()).toBe(5);
      expect(new Complex(0, 1).abs()).toBe(1);
      expect(new Complex(1, 0).abs()).toBe(1);
    });

    it('should compute squared magnitude', () => {
      expect(new Complex(3, 4).abs2()).toBe(25);
    });

    it('should compute argument', () => {
      expect(new Complex(1, 0).arg()).toBe(0);
      expect(new Complex(0, 1).arg()).toBeCloseTo(Math.PI / 2);
      expect(new Complex(-1, 0).arg()).toBeCloseTo(Math.PI);
      expect(new Complex(0, -1).arg()).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('arithmetic operations', () => {
    it('should add complex numbers', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      const result = a.add(b);
      expect(result.re).toBe(4);
      expect(result.im).toBe(6);
    });

    it('should subtract complex numbers', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      const result = a.subtract(b);
      expect(result.re).toBe(2);
      expect(result.im).toBe(2);
    });

    it('should multiply complex numbers', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      // (3+4i)(1+2i) = 3 + 6i + 4i + 8i² = 3 + 10i - 8 = -5 + 10i
      const result = a.multiply(b);
      expect(result.re).toBe(-5);
      expect(result.im).toBe(10);
    });

    it('should divide complex numbers', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      // (3+4i)/(1+2i) = (3+4i)(1-2i)/(1+4) = (3-6i+4i+8)/(5) = (11-2i)/5
      const result = a.divide(b);
      expect(result.re).toBeCloseTo(2.2);
      expect(result.im).toBeCloseTo(-.4);
    });

    it('should negate complex numbers', () => {
      const c = new Complex(3, 4);
      const neg = c.negate();
      expect(neg.re).toBe(-3);
      expect(neg.im).toBe(-4);
    });

    it('should compute inverse', () => {
      const c = new Complex(3, 4);
      const inv = c.inverse();
      const product = c.multiply(inv);
      expect(product.re).toBeCloseTo(1);
      expect(product.im).toBeCloseTo(0);
    });

    it('should handle division by zero', () => {
      const c = new Complex(3, 4);
      const result = c.divide(COMPLEX_ZERO);
      expect(result.re).toBe(Infinity);
      expect(result.im).toBe(Infinity);
    });
  });

  describe('transcendental functions', () => {
    it('should compute square root', () => {
      const c = new Complex(-1, 0);
      const sqrt = c.sqrt();
      expect(sqrt.re).toBeCloseTo(0);
      expect(sqrt.im).toBeCloseTo(1);
    });

    it('should compute n-th root', () => {
      const c = new Complex(8, 0);
      const cubeRoot = c.nthRoot(3);
      expect(cubeRoot.re).toBeCloseTo(2);
      expect(cubeRoot.im).toBeCloseTo(0);
    });

    it('should compute all n-th roots', () => {
      const c = new Complex(1, 0);
      const roots = c.nthRoots(4); // 4th roots of unity
      expect(roots.length).toBe(4);
      expect(roots[0].equals(new Complex(1, 0))).toBe(true);
      expect(roots[1].re).toBeCloseTo(0);
      expect(roots[1].im).toBeCloseTo(1);
    });

    it('should compute exponential', () => {
      // e^(i*pi) = -1
      const c = new Complex(0, Math.PI);
      const exp = c.exp();
      expect(exp.re).toBeCloseTo(-1);
      expect(exp.im).toBeCloseTo(0);
    });

    it('should compute natural logarithm', () => {
      const c = new Complex(Math.E, 0);
      const log = c.log();
      expect(log.re).toBeCloseTo(1);
      expect(log.im).toBeCloseTo(0);

      // ln(i) = i*pi/2
      const logI = I.log();
      expect(logI.re).toBeCloseTo(0);
      expect(logI.im).toBeCloseTo(Math.PI / 2);
    });

    it('should compute power', () => {
      const c = new Complex(2, 0);
      const pow = c.pow(3);
      expect(pow.re).toBeCloseTo(8);
      expect(pow.im).toBeCloseTo(0);

      // i^2 = -1
      const iSquared = I.pow(2);
      expect(iSquared.re).toBeCloseTo(-1);
      expect(iSquared.im).toBeCloseTo(0);
    });
  });

  describe('trigonometric functions', () => {
    it('should compute sin', () => {
      const c = new Complex(0, 0);
      const sin = c.sin();
      expect(sin.re).toBeCloseTo(0);
      expect(sin.im).toBeCloseTo(0);

      const sinPi2 = new Complex(Math.PI / 2, 0).sin();
      expect(sinPi2.re).toBeCloseTo(1);
      expect(sinPi2.im).toBeCloseTo(0);
    });

    it('should compute cos', () => {
      const c = new Complex(0, 0);
      const cos = c.cos();
      expect(cos.re).toBeCloseTo(1);
      expect(cos.im).toBeCloseTo(0);

      const cosPi = new Complex(Math.PI, 0).cos();
      expect(cosPi.re).toBeCloseTo(-1);
      expect(cosPi.im).toBeCloseTo(0);
    });

    it('should compute tan', () => {
      const tan = new Complex(Math.PI / 4, 0).tan();
      expect(tan.re).toBeCloseTo(1);
      expect(tan.im).toBeCloseTo(0);
    });
  });

  describe('hyperbolic functions', () => {
    it('should compute sinh', () => {
      const sinh0 = new Complex(0, 0).sinh();
      expect(sinh0.re).toBeCloseTo(0);
      expect(sinh0.im).toBeCloseTo(0);
    });

    it('should compute cosh', () => {
      const cosh0 = new Complex(0, 0).cosh();
      expect(cosh0.re).toBeCloseTo(1);
      expect(cosh0.im).toBeCloseTo(0);
    });

    it('should compute tanh', () => {
      const tanh0 = new Complex(0, 0).tanh();
      expect(tanh0.re).toBeCloseTo(0);
      expect(tanh0.im).toBeCloseTo(0);
    });
  });

  describe('inverse trigonometric functions', () => {
    it('should compute asin', () => {
      const asin = new Complex(0, 0).asin();
      expect(asin.re).toBeCloseTo(0);
      expect(asin.im).toBeCloseTo(0);
    });

    it('should compute acos', () => {
      const acos = new Complex(1, 0).acos();
      expect(acos.re).toBeCloseTo(0);
      expect(acos.im).toBeCloseTo(0);
    });

    it('should compute atan', () => {
      const atan = new Complex(1, 0).atan();
      expect(atan.re).toBeCloseTo(Math.PI / 4);
      expect(atan.im).toBeCloseTo(0);
    });
  });

  describe('utility methods', () => {
    it('should check equality', () => {
      expect(new Complex(3, 4).equals(new Complex(3, 4))).toBe(true);
      expect(new Complex(3, 4).equals(new Complex(3, 5))).toBe(false);
    });

    it('should check if real', () => {
      expect(new Complex(3, 0).isReal()).toBe(true);
      expect(new Complex(3, 4).isReal()).toBe(false);
    });

    it('should check if imaginary', () => {
      expect(new Complex(0, 4).isImaginary()).toBe(true);
      expect(new Complex(3, 4).isImaginary()).toBe(false);
      expect(new Complex(0, 0).isImaginary()).toBe(false);
    });

    it('should check if zero', () => {
      expect(COMPLEX_ZERO.isZero()).toBe(true);
      expect(new Complex(0.001, 0).isZero()).toBe(false);
      expect(new Complex(0.001, 0).isZero(0.01)).toBe(true);
    });

    it('should check NaN', () => {
      expect(new Complex(NaN, 0).isNaN()).toBe(true);
      expect(new Complex(0, NaN).isNaN()).toBe(true);
      expect(new Complex(3, 4).isNaN()).toBe(false);
    });

    it('should check infinite', () => {
      expect(new Complex(Infinity, 0).isInfinite()).toBe(true);
      expect(new Complex(0, -Infinity).isInfinite()).toBe(true);
      expect(new Complex(3, 4).isInfinite()).toBe(false);
    });

    it('should clone', () => {
      const c = new Complex(3, 4);
      const clone = c.clone();
      expect(clone.re).toBe(3);
      expect(clone.im).toBe(4);
      expect(clone).not.toBe(c);
    });

    it('should round', () => {
      const c = new Complex(3.456, 4.567);
      const rounded = c.round(2);
      expect(rounded.re).toBe(3.46);
      expect(rounded.im).toBe(4.57);
    });

    it('should floor', () => {
      const c = new Complex(3.7, -4.3);
      const floored = c.floor();
      expect(floored.re).toBe(3);
      expect(floored.im).toBe(-5);
    });

    it('should ceil', () => {
      const c = new Complex(3.3, -4.7);
      const ceiled = c.ceil();
      expect(ceiled.re).toBe(4);
      expect(ceiled.im).toBe(-4);
    });

    it('should compute sign (unit complex)', () => {
      const c = new Complex(3, 4);
      const sign = c.sign();
      expect(sign.abs()).toBeCloseTo(1);
      expect(sign.arg()).toBeCloseTo(c.arg());
    });

    it('should compare complex numbers', () => {
      expect(Complex.compare(new Complex(1, 0), new Complex(2, 0))).toBe(-1);
      expect(Complex.compare(new Complex(2, 0), new Complex(1, 0))).toBe(1);
      expect(Complex.compare(new Complex(1, 1), new Complex(1, 1))).toBe(0);
      expect(Complex.compare(new Complex(1, 1), new Complex(1, 2))).toBe(-1);
    });
  });

  describe('constants', () => {
    it('should have correct imaginary unit', () => {
      expect(I.re).toBe(0);
      expect(I.im).toBe(1);
    });

    it('should have correct zero', () => {
      expect(COMPLEX_ZERO.re).toBe(0);
      expect(COMPLEX_ZERO.im).toBe(0);
    });

    it('should have correct one', () => {
      expect(COMPLEX_ONE.re).toBe(1);
      expect(COMPLEX_ONE.im).toBe(0);
    });
  });
});
