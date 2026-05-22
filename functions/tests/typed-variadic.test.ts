/**
 * Regression tests for variadic typed-function signatures.
 *
 * History: this repo's typed-function fork delivers a `...T` rest arg as a
 * single packed array argument (`fn(a, b, [...rest])`), not as individual
 * spread args. Implementations originally declared with JS `(a, b, ...rest)`
 * got `rest = [[c, d]]` and produced wrong results — e.g. `add(1, 2, 3)`
 * returned the string `'33'` (number + array stringification). The fixed
 * signatures use a plain array parameter `(a, b, rest)` so `rest` is the
 * flat array directly.
 */
import { describe, it, expect } from 'vitest';
import { add, multiply, min, max } from '../src/typed/arithmetic.js';
import { hypot } from '../src/typed/trigonometry.js';

describe('variadic add', () => {
  it('add(1, 2) returns the number 3', () => {
    expect(add(1, 2)).toBe(3);
  });
  it('add(1, 2, 3) returns the number 6 (not the string "33")', () => {
    expect(add(1, 2, 3)).toBe(6);
    expect(typeof add(1, 2, 3)).toBe('number');
  });
  it('add over 4–6 numbers reduces correctly', () => {
    expect(add(1, 2, 3, 4)).toBe(10);
    expect(add(1, 2, 3, 4, 5)).toBe(15);
    expect(add(1, 2, 3, 4, 5, 6)).toBe(21);
  });
  it('add with negative numbers in the rest tail', () => {
    expect(add(10, 1, -2, -3)).toBe(6);
  });
});

describe('variadic multiply', () => {
  it('multiply(2, 3) returns 6', () => {
    expect(multiply(2, 3)).toBe(6);
  });
  it('multiply(2, 3, 4) returns 24 (rest path)', () => {
    expect(multiply(2, 3, 4)).toBe(24);
    expect(typeof multiply(2, 3, 4)).toBe('number');
  });
  it('multiply over 4+ numbers reduces correctly', () => {
    expect(multiply(2, 3, 4, 5)).toBe(120);
    expect(multiply(1, 2, 3, 4, 5)).toBe(120);
  });
  it('multiply by zero in the rest tail short-circuits to zero', () => {
    expect(multiply(2, 3, 0, 7)).toBe(0);
  });
});

describe('variadic min', () => {
  it('min(5, 3) returns 3', () => {
    expect(min(5, 3)).toBe(3);
  });
  it('min(5, 3, 7, 1) returns 1', () => {
    expect(min(5, 3, 7, 1)).toBe(1);
  });
  it('min picks negatives correctly', () => {
    expect(min(0, -5, -2, -10, -1)).toBe(-10);
  });
});

describe('variadic max', () => {
  it('max(5, 3) returns 5', () => {
    expect(max(5, 3)).toBe(5);
  });
  it('max(5, 3, 7, 1) returns 7', () => {
    expect(max(5, 3, 7, 1)).toBe(7);
  });
  it('max with mixed signs', () => {
    expect(max(-1, -5, 2, -2, 1)).toBe(2);
  });
});

describe('variadic hypot', () => {
  it('hypot(3, 4) returns 5', () => {
    expect(hypot(3, 4)).toBe(5);
  });
  it('hypot(3, 4, 12) returns 13 (3,4,12,13 Pythagorean quadruple)', () => {
    expect(hypot(3, 4, 12)).toBe(13);
  });
  it('hypot(1, 2, 2) returns 3', () => {
    expect(hypot(1, 2, 2)).toBe(3);
  });
});
