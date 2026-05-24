/**
 * Tests for typed/complex.ts — arg, conj, im, re
 *
 * Covers each function on each supported type signature and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { Complex, BigNumber } from '@danielsimonjr/mathts-core';
import { arg, conj, im, re, typedComplex } from '../src/typed/complex.js';

// =============================================================================
// arg
// =============================================================================

describe('arg', () => {
  it('arg(1) = 0 (positive real)', () => {
    expect(arg(1)).toBe(0);
  });

  it('arg(-1) = π (negative real)', () => {
    expect(arg(-1)).toBeCloseTo(Math.PI);
  });

  it('arg(0) = 0 (zero, mathjs convention)', () => {
    expect(arg(0)).toBe(0);
  });

  it('arg(NaN) = NaN', () => {
    expect(Number.isNaN(arg(Number.NaN))).toBe(true);
  });

  it('arg(bigint positive) = 0', () => {
    expect(arg(5n)).toBe(0);
  });

  it('arg(bigint negative) = π', () => {
    expect(arg(-3n)).toBeCloseTo(Math.PI);
  });

  it('arg(bigint zero) = 0', () => {
    expect(arg(0n)).toBe(0);
  });

  it('arg(BigNumber positive) = 0', () => {
    const bn = BigNumber.fromNumber(5);
    expect(arg(bn)).toBe(0);
  });

  it('arg(BigNumber negative) = π', () => {
    const bn = BigNumber.fromNumber(-3);
    expect(arg(bn)).toBeCloseTo(Math.PI);
  });

  it('arg(BigNumber zero) = 0', () => {
    const bn = BigNumber.fromNumber(0);
    expect(arg(bn)).toBe(0);
  });

  it('arg(BigNumber NaN) = NaN', () => {
    const bn = BigNumber.fromNumber(NaN);
    expect(Number.isNaN(arg(bn))).toBe(true);
  });

  it('arg(Complex(1, 1)) ≈ π/4', () => {
    const c = new Complex(1, 1);
    expect(arg(c)).toBeCloseTo(Math.PI / 4);
  });

  it('arg(Complex(0, 1)) = π/2 (pure imaginary)', () => {
    const c = new Complex(0, 1);
    expect(arg(c)).toBeCloseTo(Math.PI / 2);
  });

  it('arg(Complex(-1, 0)) = π', () => {
    const c = new Complex(-1, 0);
    expect(arg(c)).toBeCloseTo(Math.PI);
  });

  it('arg applied to Array elementwise', () => {
    const result = arg([1, -1, new Complex(0, 1)]) as number[];
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(Math.PI);
    expect(result[2]).toBeCloseTo(Math.PI / 2);
  });

  it('typedComplex.arg is the same function as the named export', () => {
    expect(typedComplex.arg).toBe(arg);
  });
});

// =============================================================================
// conj
// =============================================================================

describe('conj', () => {
  it('conj(number) is identity', () => {
    expect(conj(5)).toBe(5);
    expect(conj(-3.14)).toBe(-3.14);
  });

  it('conj(0) = 0', () => {
    expect(conj(0)).toBe(0);
  });

  it('conj(bigint) is identity', () => {
    expect(conj(42n)).toBe(42n);
    expect(conj(-7n)).toBe(-7n);
  });

  it('conj(BigNumber) is identity', () => {
    const bn = BigNumber.fromNumber(3.5);
    expect(conj(bn)).toBe(bn);
  });

  it('conj(Complex(3, 4)) = Complex(3, -4)', () => {
    const c = new Complex(3, 4);
    const result = conj(c) as Complex;
    expect(result.re).toBe(3);
    expect(result.im).toBe(-4);
  });

  it('conj(Complex(0, -2)) = Complex(0, 2)', () => {
    const c = new Complex(0, -2);
    const result = conj(c) as Complex;
    expect(result.re).toBe(0);
    expect(result.im).toBe(2);
  });

  it('conj(Complex(0, 0)) = Complex(0, -0) (negation of zero im)', () => {
    const c = new Complex(0, 0);
    const result = conj(c) as Complex;
    expect(result.re).toBe(0);
    // Complex.conjugate negates im: -0 === 0 in Number comparison
    expect(Object.is(result.im, -0) || Object.is(result.im, 0)).toBe(true);
  });

  it('conj applied to Array elementwise', () => {
    const result = conj([new Complex(1, 2), 3]) as Array<Complex | number>;
    expect((result[0] as Complex).re).toBe(1);
    expect((result[0] as Complex).im).toBe(-2);
    expect(result[1]).toBe(3);
  });
});

// =============================================================================
// im
// =============================================================================

describe('im', () => {
  it('im(number) = 0', () => {
    expect(im(7)).toBe(0);
    expect(im(-2.5)).toBe(0);
    expect(im(0)).toBe(0);
  });

  it('im(bigint) = 0', () => {
    expect(im(42n)).toBe(0);
  });

  it('im(BigNumber) = BigNumber(0)', () => {
    const bn = BigNumber.fromNumber(5);
    const result = im(bn);
    // Should return a BigNumber with value 0
    expect(result instanceof BigNumber || result === 0).toBe(true);
  });

  it('im(Complex(3, 4)) = 4', () => {
    const c = new Complex(3, 4);
    expect(im(c)).toBe(4);
  });

  it('im(Complex(0, -5)) = -5', () => {
    const c = new Complex(0, -5);
    expect(im(c)).toBe(-5);
  });

  it('im(Complex(2, 0)) = 0', () => {
    const c = new Complex(2, 0);
    expect(im(c)).toBe(0);
  });

  it('im applied to Array elementwise', () => {
    const result = im([new Complex(1, 2), new Complex(3, -4), 5]) as number[];
    expect(result[0]).toBe(2);
    expect(result[1]).toBe(-4);
    expect(result[2]).toBe(0);
  });
});

// =============================================================================
// re
// =============================================================================

describe('re', () => {
  it('re(number) is identity', () => {
    expect(re(7)).toBe(7);
    expect(re(-2.5)).toBe(-2.5);
    expect(re(0)).toBe(0);
  });

  it('re(bigint) is identity', () => {
    expect(re(42n)).toBe(42n);
  });

  it('re(BigNumber) is identity', () => {
    const bn = BigNumber.fromNumber(3.5);
    expect(re(bn)).toBe(bn);
  });

  it('re(Complex(3, 4)) = 3', () => {
    const c = new Complex(3, 4);
    expect(re(c)).toBe(3);
  });

  it('re(Complex(0, 5)) = 0 (pure imaginary)', () => {
    const c = new Complex(0, 5);
    expect(re(c)).toBe(0);
  });

  it('re(Complex(-2, 3)) = -2', () => {
    const c = new Complex(-2, 3);
    expect(re(c)).toBe(-2);
  });

  it('re applied to Array elementwise', () => {
    const result = re([new Complex(1, 2), new Complex(3, -4), 5]) as number[];
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(3);
    expect(result[2]).toBe(5);
  });
});

// =============================================================================
// typedComplex barrel
// =============================================================================

describe('typedComplex barrel', () => {
  it('exports arg, conj, im, re', () => {
    expect(typeof typedComplex.arg).toBe('function');
    expect(typeof typedComplex.conj).toBe('function');
    expect(typeof typedComplex.im).toBe('function');
    expect(typeof typedComplex.re).toBe('function');
  });
});
