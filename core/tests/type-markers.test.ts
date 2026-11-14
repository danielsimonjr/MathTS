/**
 * Type tests for Complex, Fraction, BigNumber and Dual are marker-based, not instanceof-based.
 *
 * A second copy of the core package has its own classes. Its values must pass the same type
 * tests, so the tests build a structurally foreign class that carries only the prototype marker.
 */

import { describe, it, expect } from 'vitest';
import { Complex, isComplex } from '../src/types/complex.js';
import { Fraction, isFraction } from '../src/types/fraction.js';
import { BigNumber, isBigNumber } from '../src/types/bignumber.js';
import { Dual, isDual } from '../src/types/dual.js';
import * as is from '../src/is.js';
import {
  isComplex as typedIsComplex,
  isFraction as typedIsFraction,
  isBigNumber as typedIsBigNumber,
} from '../src/typed/mathts-typed.js';

// Foreign copies: same marker, unrelated class, so instanceof would reject them.
class Complex2 {}
Object.defineProperty(Complex2.prototype, 'isComplex', { value: true });
class Fraction2 {}
Object.defineProperty(Fraction2.prototype, 'isFraction', { value: true });
class BigNumber2 {}
Object.defineProperty(BigNumber2.prototype, 'isBigNumber', { value: true });
class Dual2 {}
Object.defineProperty(Dual2.prototype, 'isDual', { value: true });

describe('prototype markers', () => {
  const cases: [string, object, string][] = [
    ['isComplex', Complex.prototype, 'Complex'],
    ['isFraction', Fraction.prototype, 'Fraction'],
    ['isBigNumber', BigNumber.prototype, 'BigNumber'],
    ['isDual', Dual.prototype, 'Dual'],
  ];

  for (const [marker, proto, name] of cases) {
    it(`${name}.prototype.${marker} is true, read-only and non-enumerable`, () => {
      const desc = Object.getOwnPropertyDescriptor(proto, marker);
      expect(desc).toBeDefined();
      expect(desc?.value).toBe(true);
      expect(desc?.enumerable).toBe(false);
      expect(desc?.writable).toBe(false);
    });
  }

  it('adds no enumerable own key to instances', () => {
    expect(Object.keys(new Complex(1, 2))).not.toContain('isComplex');
    expect(Object.keys(new Fraction(1, 2))).not.toContain('isFraction');
    expect(Object.keys(new Dual(1, 0))).not.toContain('isDual');
    expect(JSON.stringify(new Complex(1, 2))).not.toContain('isComplex');
  });
});

describe('type tests accept a foreign copy and reject plain objects', () => {
  it('Complex', () => {
    expect(isComplex(new Complex2())).toBe(true);
    expect(typedIsComplex(new Complex2())).toBe(true);
    expect(isComplex(new Complex(1, 2))).toBe(true);
    expect(isComplex({ re: 1, im: 2 })).toBe(false);
    expect(isComplex(Object.create(null))).toBe(false);
  });

  it('Fraction', () => {
    expect(isFraction(new Fraction2())).toBe(true);
    expect(typedIsFraction(new Fraction2())).toBe(true);
    expect(isFraction(new Fraction(1, 2))).toBe(true);
    expect(isFraction({ n: 1n, d: 2n })).toBe(false);
    expect(isFraction(Object.create(null))).toBe(false);
  });

  it('BigNumber', () => {
    expect(isBigNumber(new BigNumber2())).toBe(true);
    expect(typedIsBigNumber(new BigNumber2())).toBe(true);
    expect(isBigNumber(new BigNumber('1.5'))).toBe(true);
    expect(isBigNumber({ isBigNumber: true })).toBe(false);
    expect(isBigNumber(Object.create(null))).toBe(false);
  });

  it('Dual', () => {
    expect(isDual(new Dual2())).toBe(true);
    expect(isDual(new Dual(1, 0))).toBe(true);
    expect(isDual({ value: 1, deriv: 0 })).toBe(false);
    expect(isDual(Object.create(null))).toBe(false);
  });
});

describe('core/src/is.ts delegates to the class type tests', () => {
  it('accepts real MathTS instances', () => {
    expect(is.isComplex(new Complex(1, 2))).toBe(true);
    expect(is.isFraction(new Fraction(1, 2))).toBe(true);
    expect(is.isBigNumber(new BigNumber('1.5'))).toBe(true);
  });

  it('accepts a foreign copy and rejects plain objects', () => {
    expect(is.isComplex(new Complex2())).toBe(true);
    expect(is.isFraction(new Fraction2())).toBe(true);
    expect(is.isBigNumber(new BigNumber2())).toBe(true);
    expect(is.isComplex({ re: 1, im: 2 })).toBe(false);
    expect(is.isFraction({ n: 1n, d: 2n })).toBe(false);
    expect(is.isBigNumber({ isBigNumber: true })).toBe(false);
  });
});
