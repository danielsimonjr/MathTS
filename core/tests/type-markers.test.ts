/**
 * Type tests for Complex, Fraction, BigNumber and Dual work across copies of core (#1033).
 *
 * A second copy of the core package has its own classes, so `instanceof` fails for its values.
 * Each class carries a brand on its prototype, a `Symbol.for` symbol that every copy shares, and
 * the type tests read the brand. The tests build a foreign class that carries only the brand.
 * `functions/tests/cross-copy-core.test.ts` runs values of a real second copy through typed
 * dispatch.
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

/** The registry keys are part of the contract between copies of core: a copy reads the other's brand. */
const BRANDS = {
  Complex: Symbol.for('mathts.core.Complex'),
  Fraction: Symbol.for('mathts.core.Fraction'),
  BigNumber: Symbol.for('mathts.core.BigNumber'),
  Dual: Symbol.for('mathts.core.Dual'),
};

/** A class of a second copy: unrelated to the class of this copy, with the same brand. */
function foreignClass(brand: symbol, mathjsMarker?: string): new () => object {
  class Foreign {}
  Object.defineProperty(Foreign.prototype, brand, { value: true });
  if (mathjsMarker !== undefined)
    Object.defineProperty(Foreign.prototype, mathjsMarker, { value: true });
  return Foreign;
}

/** A class of another library (mathjs): the mathjs marker, and no brand. */
function mathjsClass(mathjsMarker: string): new () => object {
  class MathjsLike {}
  Object.defineProperty(MathjsLike.prototype, mathjsMarker, { value: true });
  return MathjsLike;
}

const ForeignComplex = foreignClass(BRANDS.Complex, 'isComplex');
const ForeignFraction = foreignClass(BRANDS.Fraction, 'isFraction');
const ForeignBigNumber = foreignClass(BRANDS.BigNumber, 'isBigNumber');
const ForeignDual = foreignClass(BRANDS.Dual);

describe('prototype brand and marker', () => {
  const cases: [string, object, symbol, string | undefined][] = [
    ['Complex', Complex.prototype, BRANDS.Complex, 'isComplex'],
    ['Fraction', Fraction.prototype, BRANDS.Fraction, 'isFraction'],
    ['BigNumber', BigNumber.prototype, BRANDS.BigNumber, 'isBigNumber'],
    ['Dual', Dual.prototype, BRANDS.Dual, undefined],
  ];

  for (const [name, proto, brand, mathjsMarker] of cases) {
    it(`${name}.prototype carries a read-only, non-enumerable brand`, () => {
      const desc = Object.getOwnPropertyDescriptor(proto, brand);
      expect(desc).toEqual({
        value: true,
        enumerable: false,
        writable: false,
        configurable: false,
      });
    });

    if (mathjsMarker !== undefined) {
      it(`${name}.prototype carries the read-only, non-enumerable mathjs marker ${mathjsMarker}`, () => {
        const desc = Object.getOwnPropertyDescriptor(proto, mathjsMarker);
        expect(desc).toEqual({
          value: true,
          enumerable: false,
          writable: false,
          configurable: false,
        });
      });
    }
  }

  it('adds no own key or own symbol to an instance', () => {
    for (const value of [new Complex(1, 2), new Fraction(1, 2), new Dual(1, 0)]) {
      expect(Object.getOwnPropertySymbols(value)).toEqual([]);
      expect(Object.keys(value)).not.toContain('isComplex');
      expect(Object.keys(value)).not.toContain('isFraction');
    }
    expect(JSON.stringify(new Complex(1, 2))).toBe('{"mathjs":"Complex","re":1,"im":2}');
  });
});

describe('type tests accept a value of a second copy', () => {
  it('Complex', () => {
    expect(isComplex(new ForeignComplex())).toBe(true);
    expect(typedIsComplex(new ForeignComplex())).toBe(true);
    expect(isComplex(new Complex(1, 2))).toBe(true);
  });

  it('Fraction', () => {
    expect(isFraction(new ForeignFraction())).toBe(true);
    expect(typedIsFraction(new ForeignFraction())).toBe(true);
    expect(isFraction(new Fraction(1, 2))).toBe(true);
  });

  it('BigNumber', () => {
    expect(isBigNumber(new ForeignBigNumber())).toBe(true);
    expect(typedIsBigNumber(new ForeignBigNumber())).toBe(true);
    expect(isBigNumber(new BigNumber('1.5'))).toBe(true);
  });

  it('Dual', () => {
    expect(isDual(new ForeignDual())).toBe(true);
    expect(isDual(new Dual(1, 0))).toBe(true);
  });

  it('a subclass of a foreign class passes', () => {
    class Sub extends ForeignComplex {}
    expect(isComplex(new Sub())).toBe(true);
  });
});

describe('type tests reject what is not a core value', () => {
  it('plain objects and null-prototype objects', () => {
    expect(isComplex({ re: 1, im: 2 })).toBe(false);
    expect(isFraction({ numerator: 1n, denominator: 2n })).toBe(false);
    expect(isBigNumber({ isBigNumber: true })).toBe(false);
    expect(isDual({ value: 1, deriv: 0 })).toBe(false);
    for (const test of [isComplex, isFraction, isBigNumber, isDual]) {
      expect(test(Object.create(null))).toBe(false);
      expect(test(null)).toBe(false);
      expect(test(undefined)).toBe(false);
      expect(test(1)).toBe(false);
    }
  });

  it('an object that carries only the mathjs marker', () => {
    // A mathjs Fraction has `isFraction` on its prototype and the fields `s`, `n` and `d`; a mathjs
    // BigNumber is a decimal.js value. Core reads other fields, so these are not core values.
    expect(isComplex(new (mathjsClass('isComplex'))())).toBe(false);
    expect(isFraction(new (mathjsClass('isFraction'))())).toBe(false);
    expect(isBigNumber(new (mathjsClass('isBigNumber'))())).toBe(false);
    expect(typedIsFraction(new (mathjsClass('isFraction'))())).toBe(false);
  });

  it('a value of another core type', () => {
    expect(isComplex(new Fraction(1, 2))).toBe(false);
    expect(isFraction(new BigNumber('1.5'))).toBe(false);
    expect(isBigNumber(new Complex(1, 2))).toBe(false);
    expect(isDual(new Complex(1, 2))).toBe(false);
  });
});

describe('core/src/is.ts follows the mathjs duck-typing convention', () => {
  it('accepts a core value, the value of a second copy and a mathjs object', () => {
    expect(is.isComplex(new Complex(1, 2))).toBe(true);
    expect(is.isFraction(new Fraction(1, 2))).toBe(true);
    expect(is.isBigNumber(new BigNumber('1.5'))).toBe(true);
    expect(is.isComplex(new ForeignComplex())).toBe(true);
    expect(is.isFraction(new ForeignFraction())).toBe(true);
    expect(is.isBigNumber(new ForeignBigNumber())).toBe(true);
    expect(is.isComplex(new (mathjsClass('isComplex'))())).toBe(true);
    expect(is.isFraction(new (mathjsClass('isFraction'))())).toBe(true);
  });

  it('rejects plain objects', () => {
    expect(is.isComplex({ re: 1, im: 2 })).toBe(false);
    expect(is.isFraction({ n: 1n, d: 2n })).toBe(false);
    expect(is.isBigNumber({ isBigNumber: true })).toBe(false);
  });
});
