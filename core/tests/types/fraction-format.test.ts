/**
 * Fraction output: `toString` gives the decimal form, `format()` gives the ratio (mathjs).
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '../../src/index.js';
import { formatGeneric } from '../../src/internal.js';

describe('Fraction format() and toString()', () => {
  it('format() prints a ratio, a whole value without a denominator', () => {
    expect(formatGeneric(new Fraction(1n, 3n))).toBe('1/3');
    expect(formatGeneric(new Fraction(-1n, 6n))).toBe('-1/6');
    expect(formatGeneric(new Fraction(4n, 2n))).toBe('2');
    expect(formatGeneric(new Fraction(0n, 5n))).toBe('0');
  });

  it('format() with fraction: decimal prints the toString form', () => {
    expect(formatGeneric(new Fraction(1n, 3n), { fraction: 'decimal' })).toBe('0.(3)');
  });

  it('format() of an array puts every Fraction through the ratio form', () => {
    expect(formatGeneric([[new Fraction(1n, 3n), 2]])).toBe('[[1/3, 2]]');
  });

  it('toString() keeps the repeating decimal', () => {
    expect(new Fraction(1n, 3n).toString()).toBe('0.(3)');
  });
});
