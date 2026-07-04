/**
 * Regression guard for Duplication Audit Cluster I (core type guards).
 *
 * Verifies the *canonical, exported* type guards have a single, well-defined
 * semantics, and that the structural variants in `core/src/utils.ts` are
 * disambiguated by name so no two same-named guards with different predicates
 * coexist.
 *
 * Canonical surface (from the package entry):
 *   - isComplex / isFraction / isBigNumber  -> `instanceof` checks (types/*.ts)
 *   - isMatrix                              -> duck-types a Matrix object
 *                                              (rows/cols/get/type), NOT number[][]
 */
import { describe, it, expect } from 'vitest';
import {
  Complex,
  Fraction,
  BigNumber,
  isComplex,
  isFraction,
  isBigNumber,
  isMatrix,
} from '../src/index.js';
import { typeOf } from '../src/is.js';
import { isComplexLike, isMatrixArray } from '../src/utils.js';

describe('typeOf — canonical names for core numeric types (bundler-mangling proof)', () => {
  it('returns the merge/dispatch names, not the (possibly mangled) constructor name', () => {
    // The Unit keys its value-type converters on exactly these strings; a bundler
    // may rename the class (e.g. `Fraction` → `_Fraction`), so typeOf must not lean
    // on `constructor.name` for core's own types.
    expect(typeOf(new Complex(1, 2))).toBe('Complex');
    expect(typeOf(new Fraction(1, 2))).toBe('Fraction');
    expect(typeOf(BigNumber.fromNumber(1))).toBe('BigNumber');
    expect(typeOf(5)).toBe('number');
    expect(typeOf('x')).toBe('string');
  });
});

describe('canonical isComplex (instanceof)', () => {
  it('accepts a real Complex instance', () => {
    expect(isComplex(new Complex(1, 2))).toBe(true);
  });

  it('rejects a plain {re, im} object (instanceof, not structural)', () => {
    expect(isComplex({ re: 1, im: 2 })).toBe(false);
  });

  it('rejects unrelated values', () => {
    expect(isComplex(42)).toBe(false);
    expect(isComplex(null)).toBe(false);
    expect(isComplex(new Fraction(1n, 2n))).toBe(false);
  });
});

describe('canonical isFraction (instanceof)', () => {
  it('accepts a real Fraction instance', () => {
    expect(isFraction(new Fraction(1n, 2n))).toBe(true);
  });

  it('rejects a plain {n, d} / {numerator, denominator} object', () => {
    expect(isFraction({ n: 1, d: 2 })).toBe(false);
    expect(isFraction({ numerator: 1n, denominator: 2n })).toBe(false);
  });

  it('rejects unrelated values', () => {
    expect(isFraction(0.5)).toBe(false);
    expect(isFraction(new Complex(1, 2))).toBe(false);
  });
});

describe('canonical isBigNumber (instanceof)', () => {
  it('accepts a real BigNumber instance', () => {
    expect(isBigNumber(BigNumber.fromNumber(3))).toBe(true);
  });

  it('rejects look-alike objects and unrelated values', () => {
    expect(isBigNumber({ isBigNumber: true })).toBe(false);
    expect(isBigNumber(3)).toBe(false);
    expect(isBigNumber(3n)).toBe(false);
  });
});

describe('canonical isMatrix (duck-types a Matrix object, not number[][])', () => {
  it('accepts a Matrix-shaped object', () => {
    const m = { rows: 2, cols: 2, type: 'DenseMatrix', get: () => 0 };
    expect(isMatrix(m)).toBe(true);
  });

  it('rejects a nested number[][] array', () => {
    expect(
      isMatrix([
        [1, 2],
        [3, 4],
      ])
    ).toBe(false);
  });

  it('rejects unrelated values', () => {
    expect(isMatrix(null)).toBe(false);
    expect(isMatrix(42)).toBe(false);
  });
});

describe('disambiguation invariant: utils structural variants do NOT shadow canonical names', () => {
  it('isComplexLike is structural where canonical isComplex is instanceof', () => {
    const plain = { re: 1, im: 2 };
    // The two guards intentionally DISAGREE on a plain object; distinct names
    // make that explicit at the call site.
    expect(isComplexLike(plain)).toBe(true);
    expect(isComplex(plain)).toBe(false);
  });

  it('isMatrixArray detects number[][] where canonical isMatrix does not', () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    expect(isMatrixArray(grid)).toBe(true);
    expect(isMatrix(grid)).toBe(false);
  });
});
