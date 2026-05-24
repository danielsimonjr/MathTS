import { describe, it, expect } from 'vitest';

// bitNot/not moved from factories/ to typed/ — import them from the typed layer
import { bitNot } from '../src/typed/bitwise.js';
import { not } from '../src/typed/logical.js';

// arg/conj/im/re moved from factories/ to typed/ — import from the typed layer
import { arg, conj, im, re } from '../src/typed/complex.js';

// equalScalar moved from factories/ to typed/ — import from the typed layer
import { equalScalar } from '../src/typed/relational.js';

// format/print moved from factories/ to typed/ — import from the typed layer
import { format } from '../src/typed/string.js';

// Import non-conflicting exports directly
import {
  addScalar,
  multiplyScalar,
  subtractScalar,
  flatten,
  size,
  squeeze,
  combinations,
  combinationsWithRep,
  erf,
  clone,
  isNaN as mathIsNaN,
  isNegative,
  isPositive,
  isNumeric,
  isPrime,
  typeOf,
} from '../src/factories/index.js';

// Import factory-prefixed versions of functions that conflict with typed/
import {
  factory_abs,
  factory_cube,
  factory_sqrt,
  factory_square,
  factory_exp,
  factory_expm1,
  factory_log10,
  factory_log2,
  factory_unaryMinus,
  factory_sign,
  factory_sin,
  factory_cos,
  factory_tan,
  factory_asin,
  factory_acos,
  factory_atan,
  factory_sinh,
  factory_cosh,
  factory_tanh,
  factory_cot,
  factory_sec,
  factory_csc,
} from '../src/factories/index.js';

import { Complex } from '@danielsimonjr/mathts-core';

describe('Leaf factories', () => {
  describe('arithmetic (non-conflicting)', () => {
    it('addScalar(2, 3) = 5', () => expect(addScalar(2, 3)).toBe(5));
    it('multiplyScalar(3, 4) = 12', () => expect(multiplyScalar(3, 4)).toBe(12));
    it('subtractScalar(10, 3) = 7', () => expect(subtractScalar(10, 3)).toBe(7));
  });

  describe('arithmetic (factory-prefixed)', () => {
    it('factory_abs(-5) = 5', () => expect(factory_abs(-5)).toBe(5));
    it('factory_abs(3) = 3', () => expect(factory_abs(3)).toBe(3));
    it('factory_cube(3) = 27', () => expect(factory_cube(3)).toBe(27));
    it('factory_sqrt(16) = 4', () => expect(factory_sqrt(16)).toBe(4));
    it('factory_sqrt(0) = 0', () => expect(factory_sqrt(0)).toBe(0));
    it('factory_square(5) = 25', () => expect(factory_square(5)).toBe(25));
    it('factory_exp(0) = 1', () => expect(factory_exp(0)).toBe(1));
    it('factory_exp(1) ~ e', () => expect(factory_exp(1)).toBeCloseTo(Math.E));
    it('factory_expm1(0) = 0', () => expect(factory_expm1(0)).toBe(0));
    it('factory_log10(1000) = 3', () => expect(factory_log10(1000)).toBeCloseTo(3));
    it('factory_log2(8) = 3', () => expect(factory_log2(8)).toBeCloseTo(3));
    it('factory_unaryMinus(5) = -5', () => expect(factory_unaryMinus(5)).toBe(-5));
    it('factory_sign(-3) = -1', () => expect(factory_sign(-3)).toBe(-1));
    it('factory_sign(0) = 0', () => expect(factory_sign(0)).toBe(0));
    it('factory_sign(7) = 1', () => expect(factory_sign(7)).toBe(1));
  });

  describe('bitwise', () => {
    it('bitNot(0) = -1', () => expect(bitNot(0)).toBe(-1));
    it('bitNot(-1) = 0', () => expect(bitNot(-1)).toBe(0));
  });

  describe('complex', () => {
    it('re extracts real part', () => {
      const c = new Complex(3, 4);
      expect(re(c)).toBe(3);
    });

    it('im extracts imaginary part', () => {
      const c = new Complex(3, 4);
      expect(im(c)).toBe(4);
    });

    it('conj conjugates', () => {
      const c = new Complex(3, 4);
      const result = conj(c);
      expect(result.re).toBe(3);
      expect(result.im).toBe(-4);
    });

    it('arg computes angle', () => {
      const c = new Complex(1, 1);
      expect(arg(c)).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('logical', () => {
    it('not(false) = true', () => expect(not(false)).toBe(true));
    it('not(true) = false', () => expect(not(true)).toBe(false));
    it('not(0) = true', () => expect(not(0)).toBe(true));
    it('not(1) = false', () => expect(not(1)).toBe(false));
  });

  describe('matrix', () => {
    it('flatten([[1,2],[3,4]]) = [1,2,3,4]', () => {
      expect(
        flatten([
          [1, 2],
          [3, 4],
        ])
      ).toEqual([1, 2, 3, 4]);
    });

    it('size([1,2,3]) = [3]', () => {
      expect(size([1, 2, 3])).toEqual([3]);
    });

    it('squeeze removes singleton dimensions', () => {
      expect(squeeze([[[1, 2, 3]]])).toEqual([1, 2, 3]);
    });
  });

  describe('probability', () => {
    it('combinations(5,2) = 10', () => expect(combinations(5, 2)).toBe(10));
    it('combinations(6,3) = 20', () => expect(combinations(6, 3)).toBe(20));
    it('combinationsWithRep(3,2) = 6', () => expect(combinationsWithRep(3, 2)).toBe(6));
  });

  describe('relational', () => {
    it('equalScalar(1, 1) = true', () => expect(equalScalar(1, 1)).toBe(true));
    it('equalScalar(1, 2) = false', () => expect(equalScalar(1, 2)).toBe(false));
  });

  describe('special', () => {
    it('erf(0) = 0', () => expect(erf(0)).toBeCloseTo(0));
    it('erf(Infinity) = 1', () => expect(erf(Infinity)).toBe(1));
  });

  describe('string', () => {
    it('format(3.14159, 3) formats number', () => {
      const result = format(3.14159, 3);
      expect(typeof result).toBe('string');
    });
  });

  describe('trigonometry (factory-prefixed)', () => {
    it('sin(0) = 0', () => expect(factory_sin(0)).toBeCloseTo(0));
    it('sin(pi/2) = 1', () => expect(factory_sin(Math.PI / 2)).toBeCloseTo(1));
    it('cos(0) = 1', () => expect(factory_cos(0)).toBeCloseTo(1));
    it('cos(pi) = -1', () => expect(factory_cos(Math.PI)).toBeCloseTo(-1));
    it('tan(0) = 0', () => expect(factory_tan(0)).toBeCloseTo(0));
    it('asin(0) = 0', () => expect(factory_asin(0)).toBeCloseTo(0));
    it('acos(1) = 0', () => expect(factory_acos(1)).toBeCloseTo(0));
    it('atan(0) = 0', () => expect(factory_atan(0)).toBeCloseTo(0));
    it('sinh(0) = 0', () => expect(factory_sinh(0)).toBeCloseTo(0));
    it('cosh(0) = 1', () => expect(factory_cosh(0)).toBeCloseTo(1));
    it('tanh(0) = 0', () => expect(factory_tanh(0)).toBeCloseTo(0));
    it('cot(pi/4) ~ 1', () => expect(factory_cot(Math.PI / 4)).toBeCloseTo(1));
    it('sec(0) = 1', () => expect(factory_sec(0)).toBeCloseTo(1));
    it('csc(pi/2) = 1', () => expect(factory_csc(Math.PI / 2)).toBeCloseTo(1));
  });

  describe('utils', () => {
    it('clone(42) = 42', () => expect(clone(42)).toBe(42));
    it('clone deep copies array', () => {
      const arr = [1, 2, 3];
      const cloned = clone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });
    it('mathIsNaN(NaN) = true', () => expect(mathIsNaN(NaN)).toBe(true));
    it('mathIsNaN(1) = false', () => expect(mathIsNaN(1)).toBe(false));
    it('isNegative(-1) = true', () => expect(isNegative(-1)).toBe(true));
    it('isNegative(1) = false', () => expect(isNegative(1)).toBe(false));
    it('isPositive(1) = true', () => expect(isPositive(1)).toBe(true));
    it('isPositive(-1) = false', () => expect(isPositive(-1)).toBe(false));
    it('isNumeric(5) = true', () => expect(isNumeric(5)).toBe(true));
    it('isPrime(7) = true', () => expect(isPrime(7)).toBe(true));
    it('isPrime(4) = false', () => expect(isPrime(4)).toBe(false));
    it('typeOf(5) = "number"', () => expect(typeOf(5)).toBe('number'));
    it('typeOf("hi") = "string"', () => expect(typeOf('hi')).toBe('string'));
  });
});
