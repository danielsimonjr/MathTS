/**
 * @mathts/compat Tests
 *
 * Tests for the mathjs compatibility layer.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  create,
  all,
  complex,
  fraction,
  bignumber,
  matrix,
  sparse,
  Complex,
  Fraction,
  BigNumber,
  DenseMatrix,
  SparseMatrix,
  transpose,
  det,
  identity,
  zeros,
  ones,
  size,
  conj,
  re,
  im,
  arg,
  isComplex_,
  isFraction_,
  isBigNumber_,
  isNumber_,
  isMatrix,
  i,
  pi,
  e,
  phi,
  tau,
} from '../src/index.js';

describe('@mathts/compat', () => {
  describe('create() factory', () => {
    it('should create a math instance with all functions', () => {
      const math = create(all);

      expect(math).toBeDefined();
      expect(typeof math.add).toBe('function');
      expect(typeof math.complex).toBe('function');
      expect(typeof math.matrix).toBe('function');
    });

    it('should support configuration', () => {
      const math = create(all, { precision: 128, epsilon: 1e-15 });
      const config = math.config();

      expect(config.precision).toBe(128);
      expect(config.epsilon).toBe(1e-15);
    });

    it('should allow config updates', () => {
      const math = create(all);
      math.config({ precision: 256 });

      expect(math.config().precision).toBe(256);
    });
  });

  describe('complex()', () => {
    it('should create complex number from real and imaginary parts', () => {
      const c = complex(3, 4);

      expect(c).toBeInstanceOf(Complex);
      expect(c.re).toBe(3);
      expect(c.im).toBe(4);
    });

    it('should create complex number from real only', () => {
      const c = complex(5);

      expect(c.re).toBe(5);
      expect(c.im).toBe(0);
    });

    it('should return COMPLEX_ZERO for undefined', () => {
      const c = complex();

      expect(c.re).toBe(0);
      expect(c.im).toBe(0);
    });

    it('should pass through Complex instances', () => {
      const original = new Complex(1, 2);
      const c = complex(original);

      expect(c).toBe(original);
    });

    it('should parse complex string', () => {
      const c = complex('3+4i');

      expect(c.re).toBe(3);
      expect(c.im).toBe(4);
    });
  });

  describe('fraction()', () => {
    it('should create fraction from numerator and denominator', () => {
      const f = fraction(1, 2);

      expect(f).toBeInstanceOf(Fraction);
      expect(f.numerator).toBe(1n);
      expect(f.denominator).toBe(2n);
    });

    it('should create fraction from string', () => {
      const f = fraction('3/4');

      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });

    it('should create fraction from number', () => {
      const f = fraction(0.5);

      expect(f.numerator).toBe(1n);
      expect(f.denominator).toBe(2n);
    });

    it('should return zero fraction for undefined', () => {
      const f = fraction();

      expect(f.numerator).toBe(0n);
      expect(f.denominator).toBe(1n);
    });
  });

  describe('bignumber()', () => {
    it('should create BigNumber from string', () => {
      const bn = bignumber('123.456');

      expect(bn).toBeInstanceOf(BigNumber);
      expect(bn.toString()).toBe('123.456');
    });

    it('should create BigNumber from number', () => {
      const bn = bignumber(42);

      expect(bn.valueOf()).toBe(42);
    });

    it('should return zero BigNumber for undefined', () => {
      const bn = bignumber();

      expect(bn.valueOf()).toBe(0);
    });
  });

  describe('matrix()', () => {
    it('should create DenseMatrix from 2D array', () => {
      const m = matrix([
        [1, 2],
        [3, 4],
      ]);

      expect(m).toBeInstanceOf(DenseMatrix);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(4);
    });

    it('should create SparseMatrix when format is sparse', () => {
      const m = matrix(
        [
          [1, 0],
          [0, 4],
        ],
        'sparse'
      );

      expect(m).toBeInstanceOf(SparseMatrix);
    });

    it('should return empty DenseMatrix for undefined', () => {
      const m = matrix();

      expect(m).toBeInstanceOf(DenseMatrix);
      expect(m.rows).toBe(0);
      expect(m.cols).toBe(0);
    });
  });

  describe('sparse()', () => {
    it('should create SparseMatrix from 2D array', () => {
      const m = sparse([
        [1, 0],
        [0, 4],
      ]);

      expect(m).toBeInstanceOf(SparseMatrix);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(4);
    });
  });

  describe('Matrix operations', () => {
    it('transpose() should transpose matrix', () => {
      const m = matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const t = transpose(m);

      expect(t.rows).toBe(3);
      expect(t.cols).toBe(2);
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(0, 1)).toBe(4);
    });

    it('transpose() should work with arrays', () => {
      const t = transpose([
        [1, 2],
        [3, 4],
      ]);

      expect(t.get(0, 1)).toBe(3);
    });

    it('det() should compute determinant', () => {
      const d = det([
        [1, 2],
        [3, 4],
      ]);

      expect(d).toBeCloseTo(-2);
    });

    it('det() should handle 3x3 matrix', () => {
      const d = det([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 10],
      ]);

      expect(d).toBeCloseTo(-3);
    });

    it('identity() should create identity matrix', () => {
      const I = identity(3);

      expect(I.get(0, 0)).toBe(1);
      expect(I.get(1, 1)).toBe(1);
      expect(I.get(2, 2)).toBe(1);
      expect(I.get(0, 1)).toBe(0);
    });

    it('zeros() should create zero matrix', () => {
      const z = zeros(2, 3);

      expect(z.rows).toBe(2);
      expect(z.cols).toBe(3);
      expect(z.get(0, 0)).toBe(0);
    });

    it('ones() should create ones matrix', () => {
      const o = ones(2, 2);

      expect(o.get(0, 0)).toBe(1);
      expect(o.get(1, 1)).toBe(1);
    });

    it('size() should return matrix dimensions', () => {
      const s = size([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      expect(s).toEqual([2, 3]);
    });
  });

  describe('Complex operations', () => {
    it('conj() should return conjugate', () => {
      const c = new Complex(3, 4);
      const cj = conj(c);

      expect(cj.re).toBe(3);
      expect(cj.im).toBe(-4);
    });

    it('re() should return real part', () => {
      const c = new Complex(3, 4);

      expect(re(c)).toBe(3);
      expect(re(5)).toBe(5);
    });

    it('im() should return imaginary part', () => {
      const c = new Complex(3, 4);

      expect(im(c)).toBe(4);
      expect(im(5)).toBe(0);
    });

    it('arg() should return argument', () => {
      const c = new Complex(1, 1);

      expect(arg(c)).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('Type checking', () => {
    it('isComplex_() should detect Complex', () => {
      expect(isComplex_(new Complex(1, 2))).toBe(true);
      expect(isComplex_(5)).toBe(false);
    });

    it('isFraction_() should detect Fraction', () => {
      expect(isFraction_(new Fraction(1, 2))).toBe(true);
      expect(isFraction_(0.5)).toBe(false);
    });

    it('isBigNumber_() should detect BigNumber', () => {
      expect(isBigNumber_(BigNumber.fromNumber(5))).toBe(true);
      expect(isBigNumber_(5)).toBe(false);
    });

    it('isNumber_() should detect numbers', () => {
      expect(isNumber_(5)).toBe(true);
      expect(isNumber_('5')).toBe(false);
    });

    it('isMatrix() should detect matrices', () => {
      expect(isMatrix(DenseMatrix.zeros(2, 2))).toBe(true);
      expect(isMatrix([[1, 2]])).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should export i', () => {
      expect(i).toBeInstanceOf(Complex);
      expect(i.re).toBe(0);
      expect(i.im).toBe(1);
    });

    it('should export pi', () => {
      expect(pi).toBeCloseTo(Math.PI);
    });

    it('should export e', () => {
      expect(e).toBeCloseTo(Math.E);
    });

    it('should export phi (golden ratio)', () => {
      expect(phi).toBeCloseTo((1 + Math.sqrt(5)) / 2);
    });

    it('should export tau', () => {
      expect(tau).toBeCloseTo(2 * Math.PI);
    });
  });

  describe('MathInstance API', () => {
    const math = create(all);

    it('should have arithmetic functions', () => {
      expect(math.add(1, 2)).toBe(3);
      expect(math.subtract(5, 3)).toBe(2);
      expect(math.multiply(3, 4)).toBe(12);
      expect(math.divide(10, 2)).toBe(5);
    });

    it('should have trigonometric functions', () => {
      expect(math.sin(0)).toBe(0);
      expect(math.cos(0)).toBe(1);
      expect(math.tan(0)).toBe(0);
    });

    it('should have type creation functions', () => {
      const c = math.complex(1, 2);
      expect(c.re).toBe(1);
      expect(c.im).toBe(2);
    });

    it('should have constants', () => {
      expect(math.pi).toBe(Math.PI);
      expect(math.e).toBe(Math.E);
    });
  });
});
