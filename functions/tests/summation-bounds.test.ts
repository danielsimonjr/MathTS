import { describe, it, expect } from 'vitest';
import { summation, symbolicProduct } from '../src/index.js';

describe('summation — non-integer bounds are rejected (#1000)', () => {
  it('throws RangeError for a non-integer lower bound (no silent 1.5 + 2.5)', () => {
    expect(() => summation('i', 'i', 1.5, 3)).toThrow(RangeError);
    expect(() => summation('i', 'i', 1.5, 3)).toThrow(/bounds must be integers/);
  });

  it('throws RangeError for a non-integer upper bound', () => {
    expect(() => summation('i', 'i', 1, 3.5)).toThrow(RangeError);
  });

  it('throws RangeError for a non-integer bound even when a > b', () => {
    expect(() => summation('i', 'i', 3.5, 1)).toThrow(RangeError);
  });

  it('control: integer bounds 1..3 sum to 6', () => {
    expect(summation('i', 'i', 1, 3)).toBe(6);
  });

  it('control: integer bounds 2..3 sum to 5', () => {
    expect(summation('i', 'i', 2, 3)).toBe(5);
  });
});

describe('symbolicProduct — non-integer bounds are rejected (#1000)', () => {
  it('throws RangeError for a non-integer lower bound', () => {
    expect(() => symbolicProduct('i', 'i', 1.5, 3)).toThrow(RangeError);
    expect(() => symbolicProduct('i', 'i', 1.5, 3)).toThrow(/bounds must be integers/);
  });

  it('throws RangeError for a non-integer upper bound', () => {
    expect(() => symbolicProduct('i', 'i', 1, 3.5)).toThrow(RangeError);
  });

  it('control: integer bounds 1..3 multiply to 6', () => {
    expect(symbolicProduct('i', 'i', 1, 3)).toBe(6);
  });

  it('throws RangeError for a non-integer bound even when a > b', () => {
    expect(() => symbolicProduct('i', 'i', 3.5, 1)).toThrow(RangeError);
  });
});

describe('bounds beyond the safe-integer range are rejected (#1000)', () => {
  // Above 2^53 - 1 the index cannot step, so these calls never returned before.
  it('throws RangeError instead of an endless loop', () => {
    expect(() => summation('i', 'i', 1e300, 1e300)).toThrow(RangeError);
    expect(() => summation('i', 'i', 2 ** 53, 2 ** 53 + 2)).toThrow(RangeError);
    expect(() => summation('i', 'i', 1e300, 5)).toThrow(RangeError);
    expect(() => symbolicProduct('i', 'i', -(2 ** 53), 0)).toThrow(RangeError);
  });

  it('control: the largest safe integer is a valid bound', () => {
    expect(summation('1', 'i', 2 ** 53 - 1, 2 ** 53 - 1)).toBe(1);
  });
});
