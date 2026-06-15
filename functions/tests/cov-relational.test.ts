/**
 * Coverage supplement for functions/src/typed/relational.ts.
 *
 * Targets the branches the existing relational tests miss: equalScalar's
 * any/any JSON fallback and null/undefined handling, compareNatural's
 * Complex / boolean / Object / null / mixed-type / NaN paths, compareObjects,
 * and compareUnits duck-typing + error paths.
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
} from '../src/typed/relational.js';

const F = (n: number, d: number) => new Fraction(BigInt(n), BigInt(d));

describe('relational — equalScalar typed branches', () => {
  it('boolean / bigint / string / Fraction / Complex / BigNumber', () => {
    expect(equalScalar(true, true)).toBe(true);
    expect(equalScalar(true, false)).toBe(false);
    expect(equalScalar(3n, 3n)).toBe(true);
    expect(equalScalar('a', 'a')).toBe(true);
    expect(equalScalar(F(1, 3), F(1, 3))).toBe(true);
    expect(equalScalar(new Complex(1, 2), new Complex(1, 2 + 1e-16))).toBe(true);
    expect(equalScalar(BigNumber.fromNumber(1), BigNumber.fromNumber(1))).toBe(true);
    expect(equalScalar(BigNumber.fromNumber(1), BigNumber.fromNumber(2))).toBe(false);
    expect(equalScalar(1, 1 + 1e-16)).toBe(true);
  });

  it('null / undefined strict identity and JSON fallback', () => {
    expect(equalScalar(null, null)).toBe(true);
    expect(equalScalar(null, 0)).toBe(false);
    expect(equalScalar(undefined, undefined)).toBe(true);
    expect(equalScalar(undefined, 1)).toBe(false);
    // any/any structural fallback for unrecognised object types
    expect(equalScalar({ a: 1 }, { a: 1 })).toBe(true);
    expect(equalScalar({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('relational — unequal null/undefined handling', () => {
  it('strict null/undefined', () => {
    expect(unequal(4, 3)).toBe(true);
    expect(unequal(4, 4)).toBe(false);
    expect(unequal(0, null)).toBe(true);
    expect(unequal(null, 0)).toBe(true);
    expect(unequal(null, null)).toBe(false);
    expect(unequal(undefined, 1)).toBe(true);
    expect(unequal(1, undefined)).toBe(true);
    expect(unequal(undefined, undefined)).toBe(false);
  });
});

describe('relational — deepEqual', () => {
  it('scalars, nested arrays, length + type mismatch', () => {
    expect(deepEqual(2, 2)).toBe(true);
    expect(deepEqual(2, 4)).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
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
    expect(deepEqual([1, 2], 2)).toBe(false);
    expect(deepEqual(2, [2])).toBe(false);
  });
});

describe('relational — compareText / equalText', () => {
  it('string + any/any coercion', () => {
    expect(compareText('B', 'A')).toBe(1);
    expect(compareText('A', 'B')).toBe(-1);
    expect(compareText('a', 'a')).toBe(0);
    expect(compareText('2', '10')).toBe(1);
    // any/any: coerce non-strings via String()
    expect(compareText(2, 10)).toBe(1); // '2' > '10' lexically
    expect(compareText(10, 2)).toBe(-1);
    expect(equalText('Hello', 'Hello')).toBe(true);
    expect(equalText('a', 'A')).toBe(false);
  });
});

describe('relational — compareNatural across type branches', () => {
  it('numeric (number/BigNumber/Fraction/bigint) with tolerance', () => {
    expect(compareNatural(6, 1)).toBe(1);
    expect(compareNatural(1, 6)).toBe(-1);
    expect(compareNatural(BigNumber.fromNumber(2), BigNumber.fromNumber(3))).toBe(-1);
    expect(compareNatural(F(1, 2), F(3, 4))).toBe(-1);
    expect(compareNatural(5n, 2n)).toBe(1);
    // mixed numeric equal values -> tiebreak by type name
    expect(compareNatural(2, BigNumber.fromNumber(2))).not.toBe(0);
  });

  it('NaN handling in numeric compare', () => {
    expect(compareNatural(NaN, NaN)).toBe(0);
    expect(compareNatural(NaN, 1)).toBe(1);
    expect(compareNatural(1, NaN)).toBe(-1);
  });

  it('arrays element-by-element then length', () => {
    expect(compareNatural([1, 2, 4], [1, 2, 3])).toBe(1);
    expect(compareNatural([1, 2], [1, 2, 3])).toBe(-1);
    expect(compareNatural([1, 2, 3], [1, 2, 3])).toBe(0);
    // scalar vs array: the scalar is wrapped as a 1-element array; equal prefix
    // falls through to a type-name tiebreak (number vs Array), so it is non-zero.
    expect(compareNatural(1, [1])).not.toBe(0);
  });

  it('strings via natural sort', () => {
    expect(compareNatural('10', '2')).toBe(1);
    expect(compareNatural('a', 'b')).toBe(-1);
  });

  it('Complex compares re then im', () => {
    expect(compareNatural(new Complex(2, 0), new Complex(1, 0))).toBe(1);
    expect(compareNatural(new Complex(1, 0), new Complex(2, 0))).toBe(-1);
    expect(compareNatural(new Complex(1, 2), new Complex(1, 1))).toBe(1);
    expect(compareNatural(new Complex(1, 1), new Complex(1, 2))).toBe(-1);
    expect(compareNatural(new Complex(1, 1), new Complex(1, 1))).toBe(0);
  });

  it('boolean ordering', () => {
    expect(compareNatural(true, false)).toBe(1);
    expect(compareNatural(false, true)).toBe(-1);
    expect(compareNatural(true, true)).toBe(0);
  });

  it('objects by sorted keys then values', () => {
    expect(compareNatural({ a: 2 }, { a: 4 })).toBe(-1);
    expect(compareNatural({ a: 4 }, { a: 2 })).toBe(1);
    expect(compareNatural({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(0);
    expect(compareNatural({ a: 1 }, { b: 1 })).not.toBe(0);
  });

  it('different types ordered by type name', () => {
    // number vs string -> ordered by type name
    expect(compareNatural(1, 'x')).not.toBe(0);
  });

  it('null / undefined compare to 0', () => {
    expect(compareNatural(null, null)).toBe(0);
    expect(compareNatural(undefined, undefined)).toBe(0);
  });
});

describe('relational — compareUnits duck-typing', () => {
  function makeUnit(value: number, base: string): {
    equalBase: (o: { base: string }) => boolean;
    valueType: () => string;
    value: number;
    base: string;
  } {
    return {
      base,
      value,
      equalBase(o) {
        return this.base === o.base;
      },
      valueType() {
        return 'number';
      },
    };
  }

  it('compares same-base units by value', () => {
    expect(compareUnits(makeUnit(5, 'length'), makeUnit(4, 'length'))).toBe(1);
    expect(compareUnits(makeUnit(4, 'length'), makeUnit(5, 'length'))).toBe(-1);
    expect(compareUnits(makeUnit(5, 'length'), makeUnit(5, 'length'))).toBe(0);
  });

  it('throws on different bases', () => {
    expect(() => compareUnits(makeUnit(5, 'length'), makeUnit(5, 'mass'))).toThrow(
      /different bases/
    );
  });

  it('throws when arguments are not Unit-like', () => {
    expect(() => compareUnits(5, 4)).toThrow(/must be Unit values/);
  });
});
