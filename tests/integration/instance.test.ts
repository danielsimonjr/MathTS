/**
 * Integration tests for MathTS instance creation and configuration
 * Sprint 25: Main Package Assembly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mathTyped,
  createMathTSTyped,
  Complex,
  Fraction,
  BigNumber,
  isComplex,
  isFraction,
  isBigNumber,
  isNumber,
  isMatrix,
  FunctionRegistry,
  createFactory,
  registry,
  math,
  DEFAULT_CONFIG,
  VERSION,
  I,
  COMPLEX_ZERO,
  COMPLEX_ONE,
  FRACTION_ZERO,
  FRACTION_ONE,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_PI,
  BIGNUMBER_E,
} from '@danielsimonjr/mathts-core';

describe('MathTS Instance Creation', () => {
  describe('Core Exports', () => {
    it('should export VERSION', () => {
      expect(VERSION).toBeDefined();
      expect(typeof VERSION).toBe('string');
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should export DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(typeof DEFAULT_CONFIG).toBe('object');
    });

    it('should export mathTyped instance', () => {
      expect(mathTyped).toBeDefined();
      expect(typeof mathTyped).toBe('function');
    });

    it('should export createMathTSTyped factory', () => {
      expect(createMathTSTyped).toBeDefined();
      expect(typeof createMathTSTyped).toBe('function');
    });

    it('should export FunctionRegistry', () => {
      expect(FunctionRegistry).toBeDefined();
    });

    it('should export createFactory', () => {
      expect(createFactory).toBeDefined();
      expect(typeof createFactory).toBe('function');
    });

    it('should export registry singleton', () => {
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(FunctionRegistry);
    });

    it('should export math instance', () => {
      expect(math).toBeDefined();
    });
  });

  describe('Type System', () => {
    describe('Complex Numbers', () => {
      it('should create complex numbers', () => {
        const c = new Complex(3, 4);
        expect(c.re).toBe(3);
        expect(c.im).toBe(4);
      });

      it('should export complex constants', () => {
        expect(I).toBeDefined();
        expect(I.re).toBe(0);
        expect(I.im).toBe(1);

        expect(COMPLEX_ZERO).toBeDefined();
        expect(COMPLEX_ZERO.re).toBe(0);
        expect(COMPLEX_ZERO.im).toBe(0);

        expect(COMPLEX_ONE).toBeDefined();
        expect(COMPLEX_ONE.re).toBe(1);
        expect(COMPLEX_ONE.im).toBe(0);
      });

      it('should perform complex arithmetic', () => {
        const a = new Complex(1, 2);
        const b = new Complex(3, 4);

        const sum = a.add(b);
        expect(sum.re).toBe(4);
        expect(sum.im).toBe(6);

        const diff = a.subtract(b);
        expect(diff.re).toBe(-2);
        expect(diff.im).toBe(-2);

        const product = a.multiply(b);
        expect(product.re).toBe(-5); // (1*3 - 2*4) = -5
        expect(product.im).toBe(10); // (1*4 + 2*3) = 10
      });

      it('should compute magnitude and phase', () => {
        const c = new Complex(3, 4);
        expect(c.abs()).toBe(5);
        expect(c.arg()).toBeCloseTo(Math.atan2(4, 3));
      });
    });

    describe('Fractions', () => {
      it('should create fractions', () => {
        const f = new Fraction(3, 4);
        expect(f.numerator).toBe(3n);
        expect(f.denominator).toBe(4n);
      });

      it('should export fraction constants', () => {
        expect(FRACTION_ZERO).toBeDefined();
        expect(FRACTION_ZERO.numerator).toBe(0n);

        expect(FRACTION_ONE).toBeDefined();
        expect(FRACTION_ONE.numerator).toBe(1n);
        expect(FRACTION_ONE.denominator).toBe(1n);
      });

      it('should perform fraction arithmetic', () => {
        const a = new Fraction(1, 2);
        const b = new Fraction(1, 4);

        const sum = a.add(b);
        expect(sum.numerator).toBe(3n);
        expect(sum.denominator).toBe(4n);

        const diff = a.subtract(b);
        expect(diff.numerator).toBe(1n);
        expect(diff.denominator).toBe(4n);

        const product = a.multiply(b);
        expect(product.numerator).toBe(1n);
        expect(product.denominator).toBe(8n);
      });

      it('should reduce fractions automatically', () => {
        const f = new Fraction(4, 8);
        expect(f.numerator).toBe(1n);
        expect(f.denominator).toBe(2n);
      });
    });

    describe('BigNumber', () => {
      it('should create BigNumber', () => {
        const bn = BigNumber.parse('123.456');
        expect(bn.toString()).toBe('123.456');
      });

      it('should export BigNumber constants', () => {
        expect(BIGNUMBER_ZERO).toBeDefined();
        expect(BIGNUMBER_ZERO.valueOf()).toBe(0);

        expect(BIGNUMBER_ONE).toBeDefined();
        expect(BIGNUMBER_ONE.valueOf()).toBe(1);

        expect(BIGNUMBER_PI).toBeDefined();
        expect(BIGNUMBER_PI.valueOf()).toBeCloseTo(Math.PI, 10);

        expect(BIGNUMBER_E).toBeDefined();
        expect(BIGNUMBER_E.valueOf()).toBeCloseTo(Math.E, 10);
      });

      it('should perform BigNumber arithmetic', () => {
        const a = BigNumber.parse('0.1');
        const b = BigNumber.parse('0.2');

        const sum = a.add(b);
        expect(sum.toString()).toBe('0.3');
      });

      it('should handle arbitrary precision', () => {
        const a = BigNumber.fromNumber(1);
        const b = BigNumber.fromNumber(3);
        const result = a.divide(b);

        // Should have many decimal places
        expect(result.toString().length).toBeGreaterThan(10);
      });
    });
  });

  describe('Type Checking Functions', () => {
    it('should check number type', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber('42')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });

    it('should check complex type', () => {
      expect(isComplex(new Complex(1, 2))).toBe(true);
      expect(isComplex(I)).toBe(true);
      expect(isComplex(42)).toBe(false);
      expect(isComplex({ re: 1, im: 2 })).toBe(false);
    });

    it('should check fraction type', () => {
      expect(isFraction(new Fraction(1, 2))).toBe(true);
      expect(isFraction(FRACTION_ONE)).toBe(true);
      expect(isFraction(0.5)).toBe(false);
      expect(isFraction({ numerator: 1n, denominator: 2n })).toBe(false);
    });

    it('should check bignumber type', () => {
      expect(isBigNumber(BigNumber.parse('123'))).toBe(true);
      expect(isBigNumber(BIGNUMBER_PI)).toBe(true);
      expect(isBigNumber(123)).toBe(false);
      expect(isBigNumber('123')).toBe(false);
    });
  });

  describe('typed-function Integration', () => {
    it('should create typed functions', () => {
      const add = mathTyped('add', {
        'number, number': (a: number, b: number) => a + b,
        'Complex, Complex': (a: Complex, b: Complex) => a.add(b),
      });

      expect(add(2, 3)).toBe(5);

      const c1 = new Complex(1, 2);
      const c2 = new Complex(3, 4);
      const result = add(c1, c2);
      expect(isComplex(result)).toBe(true);
      expect(result.re).toBe(4);
      expect(result.im).toBe(6);
    });

    it('should handle type conversions', () => {
      // Create a typed function that only handles Complex
      const complexOp = mathTyped('complexOp', {
        Complex: (c: Complex) => c.abs(),
      });

      // If automatic conversion is set up, this should work
      const c = new Complex(3, 4);
      expect(complexOp(c)).toBe(5);
    });

    it('should create new typed instance', () => {
      const customTyped = createMathTSTyped();
      expect(customTyped).toBeDefined();
      expect(typeof customTyped).toBe('function');
    });
  });

  describe('Factory Pattern', () => {
    it('should create functions via factory', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) => {
        return typed('add', {
          'number, number': (a: number, b: number) => a + b,
        });
      });

      expect(addFactory).toBeDefined();
      // createFactory returns a FactoryFunction object with { name, dependencies, factory }
      expect(typeof addFactory).toBe('object');
      expect(addFactory.name).toBe('add');
      expect(addFactory.dependencies).toContain('typed');
      expect(typeof addFactory.factory).toBe('function');
    });

    it('should register functions in registry', () => {
      const testRegistry = new FunctionRegistry();

      const myFunc = createFactory('myTestFunc', [], () => {
        return (x: number) => x * 2;
      });

      testRegistry.register(myFunc);
      expect(testRegistry.has('myTestFunc')).toBe(true);
    });
  });
});

describe('Cross-Package Integration', () => {
  it('should work with numeric types across operations', () => {
    // Test that different numeric types can coexist
    const num = 42;
    const complex = new Complex(3, 4);
    const fraction = new Fraction(1, 2);
    const bignum = BigNumber.parse('123.456');

    expect(isNumber(num)).toBe(true);
    expect(isComplex(complex)).toBe(true);
    expect(isFraction(fraction)).toBe(true);
    expect(isBigNumber(bignum)).toBe(true);
  });

  it('should support chained operations', () => {
    const c = new Complex(1, 0).add(new Complex(0, 1)).multiply(new Complex(2, 0));

    expect(c.re).toBe(2);
    expect(c.im).toBe(2);
  });

  it('should maintain precision in BigNumber calculations', () => {
    // Classic floating point issue: 0.1 + 0.2 !== 0.3
    const a = BigNumber.parse('0.1');
    const b = BigNumber.parse('0.2');
    const c = BigNumber.parse('0.3');

    expect(a.add(b).equals(c)).toBe(true);
  });

  it('should handle exact arithmetic with Fractions', () => {
    // 1/3 + 1/3 + 1/3 = 1 (exactly, unlike floating point)
    const third = new Fraction(1, 3);
    const result = third.add(third).add(third);

    expect(result.numerator).toBe(1n);
    expect(result.denominator).toBe(1n);
  });
});
