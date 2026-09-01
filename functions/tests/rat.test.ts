import { describe, it, expect } from 'vitest';
import {
  ratNormalize,
  ratAdd,
  ratSub,
  ratMul,
  ratDiv,
  ratFromBigint,
  RAT_ZERO,
} from '../src/cas/rat.js';

describe('Rat exact arithmetic', () => {
  it('normalizes sign onto the numerator', () => {
    expect(ratNormalize(2n, -4n)).toEqual({ num: -1n, den: 2n });
    expect(ratNormalize(-6n, -9n)).toEqual({ num: 2n, den: 3n });
  });

  it('collapses zero to 0/1', () => {
    expect(ratNormalize(0n, 5n)).toEqual(RAT_ZERO);
  });

  it('rejects a zero denominator', () => {
    expect(() => ratNormalize(1n, 0n)).toThrow(/zero denominator/);
  });

  it('adds, subtracts, multiplies, divides in lowest terms', () => {
    const a = { num: 1n, den: 2n };
    const b = { num: 1n, den: 3n };
    expect(ratAdd(a, b)).toEqual({ num: 5n, den: 6n });
    expect(ratSub(a, b)).toEqual({ num: 1n, den: 6n });
    expect(ratMul(a, b)).toEqual({ num: 1n, den: 6n });
    expect(ratDiv(a, b)).toEqual({ num: 3n, den: 2n });
  });

  it('rejects division by zero', () => {
    expect(() => ratDiv(ratFromBigint(1n), RAT_ZERO)).toThrow(/division by zero/);
  });

  it('lifts a bigint', () => {
    expect(ratFromBigint(-7n)).toEqual({ num: -7n, den: 1n });
  });
});
