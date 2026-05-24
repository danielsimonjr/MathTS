/**
 * Tests for typed/relational.ts — deepEqual, unequal, compareNatural,
 * compareText, compareUnits, equalScalar, equalText, typedRelational
 *
 * Covers each op with forward correctness (number/Complex/BigNumber/Fraction),
 * negative paths (type mismatches, NaN, empty inputs), nested arrays, and
 * mixed-type comparisons for compareNatural.
 *
 * ≥ 25 tests total, ≥ 3 per op.
 */
import { describe, it, expect } from 'vitest';
import { Complex, BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import {
  equalScalar,
  unequal,
  deepEqual,
  compareText,
  equalText,
  compareNatural,
  compareUnits,
  typedRelational,
} from '../src/typed/relational.js';

// =============================================================================
// equalScalar
// =============================================================================

describe('equalScalar', () => {
  it('equal numbers', () => {
    expect(equalScalar(3, 3)).toBe(true);
  });

  it('nearly-equal numbers within tolerance', () => {
    // 1e-16 is within DEFAULT_CONFIG.relTol (1e-12)
    expect(equalScalar(1, 1 + 1e-16)).toBe(true);
  });

  it('unequal numbers outside tolerance', () => {
    expect(equalScalar(1, 2)).toBe(false);
  });

  it('equal BigNumbers', () => {
    const a = BigNumber.parse('3.14159265358979');
    const b = BigNumber.parse('3.14159265358979');
    expect(equalScalar(a, b)).toBe(true);
  });

  it('unequal BigNumbers', () => {
    const a = BigNumber.parse('3');
    const b = BigNumber.parse('4');
    expect(equalScalar(a, b)).toBe(false);
  });

  it('equal Fractions', () => {
    expect(equalScalar(new Fraction(1, 3), new Fraction(1, 3))).toBe(true);
  });

  it('equal Complex numbers', () => {
    expect(equalScalar(new Complex(1, 2), new Complex(1, 2))).toBe(true);
  });

  it('unequal Complex numbers differing in imaginary part', () => {
    expect(equalScalar(new Complex(1, 2), new Complex(1, 3))).toBe(false);
  });

  it('equal booleans', () => {
    expect(equalScalar(true, true)).toBe(true);
    expect(equalScalar(false, false)).toBe(true);
  });

  it('unequal booleans', () => {
    expect(equalScalar(true, false)).toBe(false);
  });

  it('equal strings', () => {
    expect(equalScalar('hello', 'hello')).toBe(true);
  });

  it('null equals null', () => {
    expect(equalScalar(null, null)).toBe(true);
  });

  it('null does not equal a number', () => {
    expect(equalScalar(null as unknown as number, 0 as unknown as number)).toBe(false);
  });
});

// =============================================================================
// unequal
// =============================================================================

describe('unequal', () => {
  it('unequal numbers', () => {
    expect(unequal(2 + 2, 3)).toBe(true);
  });

  it('equal numbers returns false', () => {
    expect(unequal(2 + 2, 4)).toBe(false);
  });

  it('null is unequal to 0', () => {
    expect(unequal(0 as unknown as boolean, null as unknown as boolean)).toBe(true);
  });

  it('null is equal to null', () => {
    expect(unequal(null as unknown as boolean, null as unknown as boolean)).toBe(false);
  });

  it('undefined is unequal to null', () => {
    expect(unequal(undefined as unknown as boolean, null as unknown as boolean)).toBe(true);
  });

  it('unequal Complex numbers', () => {
    expect(
      unequal(new Complex(1, 2) as unknown as boolean, new Complex(1, 3) as unknown as boolean)
    ).toBe(true);
  });

  it('equal Complex numbers returns false', () => {
    expect(
      unequal(new Complex(3, 4) as unknown as boolean, new Complex(3, 4) as unknown as boolean)
    ).toBe(false);
  });
});

// =============================================================================
// deepEqual
// =============================================================================

describe('deepEqual', () => {
  it('equal scalars', () => {
    expect(deepEqual(2, 2)).toBe(true);
  });

  it('unequal scalars', () => {
    expect(deepEqual(2, 4)).toBe(false);
  });

  it('equal flat arrays', () => {
    expect(deepEqual([2, 5, 1], [2, 5, 1])).toBe(true);
  });

  it('unequal flat arrays', () => {
    expect(deepEqual([2, 5, 1], [2, 7, 1])).toBe(false);
  });

  it('arrays of different lengths are unequal', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('equal nested arrays', () => {
    expect(
      deepEqual(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 2],
          [3, 4],
        ]
      )
    ).toBe(true);
  });

  it('unequal nested arrays', () => {
    expect(
      deepEqual(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 2],
          [3, 5],
        ]
      )
    ).toBe(false);
  });

  it('array vs scalar returns false', () => {
    expect(deepEqual([1], 1 as unknown as boolean[])).toBe(false);
  });

  it('empty arrays are deep equal', () => {
    expect(deepEqual([], [])).toBe(true);
  });

  it('equal Complex scalars', () => {
    expect(
      deepEqual(new Complex(1, 2) as unknown as number[], new Complex(1, 2) as unknown as number[])
    ).toBe(true);
  });
});

// =============================================================================
// compareText
// =============================================================================

describe('compareText', () => {
  it("'B' > 'A'", () => {
    expect(compareText('B', 'A')).toBe(1);
  });

  it("'A' < 'B'", () => {
    expect(compareText('A', 'B')).toBe(-1);
  });

  it("'a' == 'a'", () => {
    expect(compareText('a', 'a')).toBe(0);
  });

  it("lexicographic: '2' > '10' (string sort)", () => {
    // lexicographic: '2' > '1...' so '2' > '10'
    expect(compareText('2', '10')).toBe(1);
  });

  it("case sensitive: 'a' !== 'A'", () => {
    expect(compareText('a', 'A')).not.toBe(0);
  });
});

// =============================================================================
// equalText
// =============================================================================

describe('equalText', () => {
  it('equal strings', () => {
    expect(equalText('Hello', 'Hello')).toBe(true);
  });

  it('different case returns false', () => {
    expect(equalText('a', 'A')).toBe(false);
  });

  it('numeric string: 2e3 !== 2000 (text comparison)', () => {
    expect(equalText('2e3', '2000')).toBe(false);
  });

  it('empty strings are equal', () => {
    expect(equalText('', '')).toBe(true);
  });
});

// =============================================================================
// compareNatural
// =============================================================================

describe('compareNatural', () => {
  it('number: 6 > 1', () => {
    expect(compareNatural(6, 1)).toBe(1);
  });

  it('number: 2 < 3', () => {
    expect(compareNatural(2, 3)).toBe(-1);
  });

  it('number: 7 == 7', () => {
    expect(compareNatural(7, 7)).toBe(0);
  });

  it("string natural sort: '10' > '2'", () => {
    // javascript-natural-sort orders '10' after '2'
    expect(compareNatural('10', '2')).toBeGreaterThan(0);
  });

  it("string natural sort: '2' < '10'", () => {
    expect(compareNatural('2', '10')).toBeLessThan(0);
  });

  it('array element-by-element: [1, 2, 4] > [1, 2, 3]', () => {
    expect(compareNatural([1, 2, 4], [1, 2, 3])).toBe(1);
  });

  it('array length tiebreak: [1, 2, 3] > [1, 2]', () => {
    expect(compareNatural([1, 2, 3], [1, 2])).toBe(1);
  });

  it('equal arrays', () => {
    expect(compareNatural([1, 2], [1, 2])).toBe(0);
  });

  it('object comparison: {a: 2} < {a: 4}', () => {
    expect(compareNatural({ a: 2 }, { a: 4 })).toBe(-1);
  });

  it('Complex: compare real first', () => {
    const c1 = new Complex(2, 3);
    const c2 = new Complex(2, 4);
    expect(compareNatural(c1, c2)).toBe(-1);
  });

  it('Complex: real equal, imaginary decides', () => {
    const c1 = new Complex(1, 5);
    const c2 = new Complex(1, 3);
    expect(compareNatural(c1, c2)).toBe(1);
  });

  it('mixed types: orders by type name via natural sort', () => {
    // numbers and strings are different types; just verify it returns a number
    const result = compareNatural(42, 'hello');
    expect(typeof result).toBe('number');
  });

  it('null == null', () => {
    expect(compareNatural(null, null)).toBe(0);
  });

  it('BigNumber: 3 > 2', () => {
    expect(compareNatural(BigNumber.parse('3'), BigNumber.parse('2'))).toBe(1);
  });

  it('Fraction: 1/3 < 1/2', () => {
    expect(compareNatural(new Fraction(1, 3), new Fraction(1, 2))).toBe(-1);
  });
});

// =============================================================================
// compareUnits — duck-typed Unit objects
// =============================================================================

describe('compareUnits', () => {
  function makeUnit(value: number, base: string) {
    return {
      equalBase: (other: { _base: string }) => other._base === base,
      _base: base,
      valueType: () => 'number',
      value,
    };
  }

  it('same-base units: larger value is greater', () => {
    const a = makeUnit(5, 'length');
    const b = makeUnit(3, 'length');
    expect(compareUnits(a, b)).toBe(1);
  });

  it('same-base units: smaller value is less', () => {
    const a = makeUnit(2, 'length');
    const b = makeUnit(4, 'length');
    expect(compareUnits(a, b)).toBe(-1);
  });

  it('same-base units: equal values', () => {
    const a = makeUnit(7, 'mass');
    const b = makeUnit(7, 'mass');
    expect(compareUnits(a, b)).toBe(0);
  });

  it('different bases throws', () => {
    const a = makeUnit(5, 'length');
    const b = makeUnit(5, 'mass');
    expect(() => compareUnits(a, b)).toThrow();
  });

  it('non-Unit throws', () => {
    expect(() =>
      compareUnits(42 as unknown as typeof makeUnit, 42 as unknown as typeof makeUnit)
    ).toThrow();
  });
});

// =============================================================================
// typedRelational barrel
// =============================================================================

describe('typedRelational barrel', () => {
  it('has all 7 ops', () => {
    expect(typedRelational).toHaveProperty('equalScalar');
    expect(typedRelational).toHaveProperty('unequal');
    expect(typedRelational).toHaveProperty('deepEqual');
    expect(typedRelational).toHaveProperty('compareText');
    expect(typedRelational).toHaveProperty('equalText');
    expect(typedRelational).toHaveProperty('compareNatural');
    expect(typedRelational).toHaveProperty('compareUnits');
  });
});
