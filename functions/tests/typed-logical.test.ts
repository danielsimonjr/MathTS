/**
 * Tests for typed logical functions
 *
 * Covers and, or, xor, not, nullish with all supported numeric types.
 */

import { describe, it, expect } from 'vitest';
import { Complex, BigNumber } from '@danielsimonjr/mathts-core';
import { and, or, xor, not, nullish, typedLogical } from '../src/typed/logical.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a non-zero BigNumber */
function bn(n: number): BigNumber {
  return BigNumber.fromNumber(n);
}

/** Create a zero BigNumber */
const BN_ZERO = BigNumber.fromNumber(0);
/** Create a BigNumber for 1 */
const BN_ONE = BigNumber.fromNumber(1);
/** Create a BigNumber for NaN */
const BN_NAN = BigNumber.fromNumber(NaN);

// =============================================================================
// not
// =============================================================================

describe('not', () => {
  describe('any signature', () => {
    it('returns true for null', () => {
      expect(not(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(not(undefined)).toBe(true);
    });

    it('returns true for false boolean', () => {
      expect(not(false)).toBe(true);
    });

    it('returns false for true boolean', () => {
      expect(not(true)).toBe(false);
    });
  });

  describe('number signature', () => {
    it('returns true for 0', () => {
      expect(not(0)).toBe(true);
    });

    it('returns true for NaN', () => {
      expect(not(NaN)).toBe(true);
    });

    it('returns false for 1', () => {
      expect(not(1)).toBe(false);
    });

    it('returns false for -1', () => {
      expect(not(-1)).toBe(false);
    });

    it('returns false for positive non-zero', () => {
      expect(not(42)).toBe(false);
    });
  });

  describe('bigint signature', () => {
    it('returns true for 0n', () => {
      expect(not(0n)).toBe(true);
    });

    it('returns false for 1n', () => {
      expect(not(1n)).toBe(false);
    });

    it('returns false for -1n', () => {
      expect(not(-1n)).toBe(false);
    });
  });

  describe('BigNumber signature', () => {
    it('returns true for zero BigNumber', () => {
      expect(not(BN_ZERO)).toBe(true);
    });

    it('returns true for NaN BigNumber', () => {
      expect(not(BN_NAN)).toBe(true);
    });

    it('returns false for non-zero BigNumber', () => {
      expect(not(BN_ONE)).toBe(false);
    });

    it('returns false for negative BigNumber', () => {
      expect(not(bn(-5))).toBe(false);
    });
  });

  describe('Complex signature', () => {
    it('returns true for zero Complex (0+0i)', () => {
      expect(not(new Complex(0, 0))).toBe(true);
    });

    it('returns false for real-only non-zero Complex', () => {
      expect(not(new Complex(1, 0))).toBe(false);
    });

    it('returns false for imaginary-only non-zero Complex', () => {
      expect(not(new Complex(0, 1))).toBe(false);
    });

    it('returns false for Complex with both parts non-zero', () => {
      expect(not(new Complex(3, 4))).toBe(false);
    });
  });
});

// =============================================================================
// and
// =============================================================================

describe('and', () => {
  describe('truth table — boolean coercion (any, any)', () => {
    it('true && true => true', () => {
      expect(and(true, true)).toBe(true);
    });

    it('true && false => false', () => {
      expect(and(true, false)).toBe(false);
    });

    it('false && true => false', () => {
      expect(and(false, true)).toBe(false);
    });

    it('false && false => false', () => {
      expect(and(false, false)).toBe(false);
    });
  });

  describe('any signature — falsy values', () => {
    it('null && 1 => false', () => {
      expect(and(null, 1)).toBe(false);
    });

    it('1 && undefined => false', () => {
      expect(and(1, undefined)).toBe(false);
    });

    it('null && undefined => false', () => {
      expect(and(null, undefined)).toBe(false);
    });

    it('false && true => false', () => {
      expect(and(false, true)).toBe(false);
    });
  });

  describe('number, number', () => {
    it('1 && 2 => true', () => {
      expect(and(1, 2)).toBe(true);
    });

    it('0 && 2 => false', () => {
      expect(and(0, 2)).toBe(false);
    });

    it('1 && 0 => false', () => {
      expect(and(1, 0)).toBe(false);
    });

    it('0 && 0 => false', () => {
      expect(and(0, 0)).toBe(false);
    });

    it('NaN && 1 => false', () => {
      expect(and(NaN, 1)).toBe(false);
    });

    it('1 && NaN => false', () => {
      expect(and(1, NaN)).toBe(false);
    });

    it('-5 && 3 => true', () => {
      expect(and(-5, 3)).toBe(true);
    });
  });

  describe('bigint, bigint', () => {
    it('1n && 2n => true', () => {
      expect(and(1n, 2n)).toBe(true);
    });

    it('0n && 2n => false', () => {
      expect(and(0n, 2n)).toBe(false);
    });

    it('1n && 0n => false', () => {
      expect(and(1n, 0n)).toBe(false);
    });

    it('0n && 0n => false', () => {
      expect(and(0n, 0n)).toBe(false);
    });
  });

  describe('BigNumber, BigNumber', () => {
    it('1 && 2 => true', () => {
      expect(and(BN_ONE, bn(2))).toBe(true);
    });

    it('zero && 2 => false', () => {
      expect(and(BN_ZERO, bn(2))).toBe(false);
    });

    it('1 && zero => false', () => {
      expect(and(BN_ONE, BN_ZERO)).toBe(false);
    });

    it('zero && zero => false', () => {
      expect(and(BN_ZERO, BN_ZERO)).toBe(false);
    });

    it('NaN BigNumber => false', () => {
      expect(and(BN_NAN, BN_ONE)).toBe(false);
    });
  });

  describe('Complex, Complex', () => {
    const zero = new Complex(0, 0);
    const one = new Complex(1, 0);
    const imagOne = new Complex(0, 1);

    it('(1+0i) && (0+1i) => true', () => {
      expect(and(one, imagOne)).toBe(true);
    });

    it('(0+0i) && (1+0i) => false', () => {
      expect(and(zero, one)).toBe(false);
    });

    it('(1+0i) && (0+0i) => false', () => {
      expect(and(one, zero)).toBe(false);
    });

    it('(0+0i) && (0+0i) => false', () => {
      expect(and(zero, zero)).toBe(false);
    });
  });

  describe('variadic (any, any, ...any)', () => {
    it('and(1, 2, 3) => true', () => {
      expect(and(1, 2, 3)).toBe(true);
    });

    it('and(1, 0, 3) => false', () => {
      expect(and(1, 0, 3)).toBe(false);
    });

    it('and(1, 2, null) => false', () => {
      expect(and(1, 2, null)).toBe(false);
    });

    it('and(true, true, true, true) => true', () => {
      expect(and(true, true, true, true)).toBe(true);
    });

    it('and(true, true, false, true) => false', () => {
      expect(and(true, true, false, true)).toBe(false);
    });
  });
});

// =============================================================================
// or
// =============================================================================

describe('or', () => {
  describe('truth table — boolean coercion (any, any)', () => {
    it('true || true => true', () => {
      expect(or(true, true)).toBe(true);
    });

    it('true || false => true', () => {
      expect(or(true, false)).toBe(true);
    });

    it('false || true => true', () => {
      expect(or(false, true)).toBe(true);
    });

    it('false || false => false', () => {
      expect(or(false, false)).toBe(false);
    });
  });

  describe('number, number', () => {
    it('1 || 2 => true', () => {
      expect(or(1, 2)).toBe(true);
    });

    it('0 || 2 => true', () => {
      expect(or(0, 2)).toBe(true);
    });

    it('1 || 0 => true', () => {
      expect(or(1, 0)).toBe(true);
    });

    it('0 || 0 => false', () => {
      expect(or(0, 0)).toBe(false);
    });

    it('NaN || NaN => false', () => {
      expect(or(NaN, NaN)).toBe(false);
    });

    it('0 || NaN => false', () => {
      expect(or(0, NaN)).toBe(false);
    });

    it('1 || NaN => true', () => {
      expect(or(1, NaN)).toBe(true);
    });
  });

  describe('bigint, bigint', () => {
    it('0n || 0n => false', () => {
      expect(or(0n, 0n)).toBe(false);
    });

    it('0n || 1n => true', () => {
      expect(or(0n, 1n)).toBe(true);
    });

    it('1n || 0n => true', () => {
      expect(or(1n, 0n)).toBe(true);
    });

    it('1n || 2n => true', () => {
      expect(or(1n, 2n)).toBe(true);
    });
  });

  describe('BigNumber, BigNumber', () => {
    it('zero || zero => false', () => {
      expect(or(BN_ZERO, BN_ZERO)).toBe(false);
    });

    it('zero || 1 => true', () => {
      expect(or(BN_ZERO, BN_ONE)).toBe(true);
    });

    it('1 || zero => true', () => {
      expect(or(BN_ONE, BN_ZERO)).toBe(true);
    });

    it('NaN || zero => false', () => {
      expect(or(BN_NAN, BN_ZERO)).toBe(false);
    });

    it('NaN || 1 => true', () => {
      expect(or(BN_NAN, BN_ONE)).toBe(true);
    });
  });

  describe('Complex, Complex', () => {
    const zero = new Complex(0, 0);
    const one = new Complex(1, 0);

    it('(0+0i) || (0+0i) => false', () => {
      expect(or(zero, zero)).toBe(false);
    });

    it('(0+0i) || (1+0i) => true', () => {
      expect(or(zero, one)).toBe(true);
    });

    it('(1+0i) || (0+0i) => true', () => {
      expect(or(one, zero)).toBe(true);
    });

    it('(1+0i) || (0+1i) => true', () => {
      expect(or(one, new Complex(0, 1))).toBe(true);
    });
  });

  describe('variadic (any, any, ...any)', () => {
    it('or(0, 0, 0) => false', () => {
      expect(or(0, 0, 0)).toBe(false);
    });

    it('or(0, 0, 1) => true', () => {
      expect(or(0, 0, 1)).toBe(true);
    });

    it('or(false, false, false, true) => true', () => {
      expect(or(false, false, false, true)).toBe(true);
    });

    it('or(null, undefined, false) => false', () => {
      expect(or(null, undefined, false)).toBe(false);
    });
  });
});

// =============================================================================
// xor
// =============================================================================

describe('xor', () => {
  describe('truth table — boolean coercion (any, any)', () => {
    it('true XOR true => false', () => {
      expect(xor(true, true)).toBe(false);
    });

    it('true XOR false => true', () => {
      expect(xor(true, false)).toBe(true);
    });

    it('false XOR true => true', () => {
      expect(xor(false, true)).toBe(true);
    });

    it('false XOR false => false', () => {
      expect(xor(false, false)).toBe(false);
    });
  });

  describe('number, number', () => {
    it('1 XOR 2 => false (both truthy)', () => {
      expect(xor(1, 2)).toBe(false);
    });

    it('1 XOR 0 => true', () => {
      expect(xor(1, 0)).toBe(true);
    });

    it('0 XOR 1 => true', () => {
      expect(xor(0, 1)).toBe(true);
    });

    it('0 XOR 0 => false', () => {
      expect(xor(0, 0)).toBe(false);
    });

    it('NaN XOR NaN => false (both falsy)', () => {
      expect(xor(NaN, NaN)).toBe(false);
    });

    it('NaN XOR 1 => true (NaN is falsy, 1 is truthy)', () => {
      expect(xor(NaN, 1)).toBe(true);
    });
  });

  describe('bigint, bigint', () => {
    it('1n XOR 2n => false', () => {
      expect(xor(1n, 2n)).toBe(false);
    });

    it('1n XOR 0n => true', () => {
      expect(xor(1n, 0n)).toBe(true);
    });

    it('0n XOR 1n => true', () => {
      expect(xor(0n, 1n)).toBe(true);
    });

    it('0n XOR 0n => false', () => {
      expect(xor(0n, 0n)).toBe(false);
    });
  });

  describe('BigNumber, BigNumber', () => {
    it('1 XOR 2 => false', () => {
      expect(xor(BN_ONE, bn(2))).toBe(false);
    });

    it('zero XOR 1 => true', () => {
      expect(xor(BN_ZERO, BN_ONE)).toBe(true);
    });

    it('1 XOR zero => true', () => {
      expect(xor(BN_ONE, BN_ZERO)).toBe(true);
    });

    it('zero XOR zero => false', () => {
      expect(xor(BN_ZERO, BN_ZERO)).toBe(false);
    });

    it('NaN XOR 1 => true (NaN is falsy)', () => {
      expect(xor(BN_NAN, BN_ONE)).toBe(true);
    });

    it('NaN XOR zero => false (both falsy)', () => {
      expect(xor(BN_NAN, BN_ZERO)).toBe(false);
    });
  });

  describe('Complex, Complex', () => {
    const zero = new Complex(0, 0);
    const one = new Complex(1, 0);
    const two = new Complex(2, 0);

    it('(1+0i) XOR (2+0i) => false', () => {
      expect(xor(one, two)).toBe(false);
    });

    it('(0+0i) XOR (1+0i) => true', () => {
      expect(xor(zero, one)).toBe(true);
    });

    it('(1+0i) XOR (0+0i) => true', () => {
      expect(xor(one, zero)).toBe(true);
    });

    it('(0+0i) XOR (0+0i) => false', () => {
      expect(xor(zero, zero)).toBe(false);
    });
  });

  describe('variadic (any, any, ...any) — odd count of truthy values', () => {
    it('xor(1, 0, 0) => true (1 truthy value)', () => {
      expect(xor(1, 0, 0)).toBe(true);
    });

    it('xor(1, 1, 0) => false (2 truthy values)', () => {
      expect(xor(1, 1, 0)).toBe(false);
    });

    it('xor(1, 1, 1) => true (3 truthy values)', () => {
      expect(xor(1, 1, 1)).toBe(true);
    });

    it('xor(1, 1, 1, 1) => false (4 truthy values)', () => {
      expect(xor(1, 1, 1, 1)).toBe(false);
    });

    it('xor(0, 0, 0) => false', () => {
      expect(xor(0, 0, 0)).toBe(false);
    });

    it('xor(true, false, true, false, true) => true (3 truthy)', () => {
      expect(xor(true, false, true, false, true)).toBe(true);
    });
  });
});

// =============================================================================
// nullish
// =============================================================================

describe('nullish', () => {
  describe('any, any — core semantics', () => {
    it('nullish(null, 5) === 5', () => {
      expect(nullish(null, 5)).toBe(5);
    });

    it('nullish(undefined, 5) === 5', () => {
      expect(nullish(undefined, 5)).toBe(5);
    });

    it('nullish(0, 5) === 0  (zero is NOT nullish)', () => {
      expect(nullish(0, 5)).toBe(0);
    });

    it('nullish(false, 5) === false  (false is NOT nullish)', () => {
      expect(nullish(false, 5)).toBe(false);
    });

    it('nullish("", 5) === ""  (empty string is NOT nullish)', () => {
      expect(nullish('', 5)).toBe('');
    });

    it('nullish(NaN, 5) === NaN  (NaN is NOT nullish)', () => {
      expect(nullish(NaN, 5)).toBeNaN();
    });

    it('nullish("hello", "world") === "hello"', () => {
      expect(nullish('hello', 'world')).toBe('hello');
    });

    it('nullish(null, null) === null', () => {
      expect(nullish(null, null)).toBe(null);
    });
  });

  describe('number, number', () => {
    it('nullish(1, 99) === 1', () => {
      expect(nullish(1, 99)).toBe(1);
    });

    it('nullish(0, 99) === 0', () => {
      expect(nullish(0, 99)).toBe(0);
    });

    it('nullish(-1, 99) === -1', () => {
      expect(nullish(-1, 99)).toBe(-1);
    });
  });

  describe('bigint, bigint', () => {
    it('nullish(1n, 99n) === 1n', () => {
      expect(nullish(1n, 99n)).toBe(1n);
    });

    it('nullish(0n, 99n) === 0n  (zero bigint is NOT nullish)', () => {
      expect(nullish(0n, 99n)).toBe(0n);
    });
  });

  describe('BigNumber, BigNumber', () => {
    it('nullish(BN_ONE, bn(99)) returns BN_ONE', () => {
      const result = nullish(BN_ONE, bn(99)) as BigNumber;
      expect(result.valueOf()).toBe(1);
    });

    it('nullish(BN_ZERO, bn(99)) returns BN_ZERO (zero is NOT nullish)', () => {
      const result = nullish(BN_ZERO, bn(99)) as BigNumber;
      expect(result.valueOf()).toBe(0);
    });
  });

  describe('Complex, Complex', () => {
    it('nullish(Complex(1,0), Complex(99,0)) returns Complex(1,0)', () => {
      const result = nullish(new Complex(1, 0), new Complex(99, 0)) as Complex;
      expect(result.re).toBe(1);
      expect(result.im).toBe(0);
    });

    it('nullish(Complex(0,0), Complex(99,0)) returns Complex(0,0) (not nullish)', () => {
      const result = nullish(new Complex(0, 0), new Complex(99, 0)) as Complex;
      expect(result.re).toBe(0);
      expect(result.im).toBe(0);
    });
  });
});

// =============================================================================
// typedLogical barrel
// =============================================================================

describe('typedLogical barrel export', () => {
  it('contains all logical functions', () => {
    expect(typedLogical).toHaveProperty('and');
    expect(typedLogical).toHaveProperty('or');
    expect(typedLogical).toHaveProperty('xor');
    expect(typedLogical).toHaveProperty('not');
    expect(typedLogical).toHaveProperty('nullish');
  });

  it('barrel functions work correctly', () => {
    expect(typedLogical.and(1, 1)).toBe(true);
    expect(typedLogical.or(0, 1)).toBe(true);
    expect(typedLogical.xor(1, 0)).toBe(true);
    expect(typedLogical.not(0)).toBe(true);
    expect(typedLogical.nullish(null, 42)).toBe(42);
  });
});
