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

import { Complex } from '@danielsimonjr/mathts-core';
import { polynomialRoot } from '../src/factories/index.js';

describe('variadic add/multiply over non-number types (mathjs parity)', () => {
  // Regression: add/multiply used to declare only 'number, number, ...number',
  // so 3+ args of Complex (or mixed) threw "Too many arguments (expected 2)".
  // This broke polynomialRoot's cubic branch, which does add(b, C, …) with a
  // complex cube root C. The variadic is now 'any, any, ...any'.
  it('add folds 3 complex arguments', () => {
    const r = add(new Complex(1, 1), new Complex(2, 2), new Complex(3, 3)) as Complex;
    expect(r.re).toBe(6);
    expect(r.im).toBe(6);
  });

  it('add folds mixed number + complex arguments', () => {
    const r = add(1, new Complex(2, 3), new Complex(4, 5)) as Complex;
    expect(r.re).toBe(7);
    expect(r.im).toBe(8);
  });

  it('multiply folds mixed number + complex arguments', () => {
    const r = multiply(1, new Complex(2, 3), new Complex(4, 5)) as Complex;
    // (2+3i)(4+5i) = 8 + 10i + 12i + 15i^2 = -7 + 22i
    expect(r.re).toBe(-7);
    expect(r.im).toBe(22);
  });

  it('add/multiply still fold plain numbers', () => {
    expect(add(1, 2, 3, 4)).toBe(10);
    expect(multiply(2, 3, 4)).toBe(24);
  });

  it('polynomialRoot cubic with three real roots now works (was blocked by the above)', () => {
    // x^3 - 6x^2 + 11x - 6 = (x-1)(x-2)(x-3)
    const roots = polynomialRoot(-6, 11, -6, 1).map((r) =>
      typeof r === 'object' && r !== null && 'im' in r ? Math.round((r as Complex).re) : Math.round(r as number)
    );
    for (const want of [1, 2, 3]) expect(roots).toContain(want);
  });

  it('polynomialRoot cubic with complex roots works (x^3 - 8)', () => {
    const roots = polynomialRoot(-8, 0, 0, 1);
    expect(roots.length).toBe(3);
    // The real root may come back as a Complex with negligible imaginary part.
    const reOf = (r: unknown): number => (typeof r === 'number' ? r : (r as Complex).re);
    const imOf = (r: unknown): number => (typeof r === 'number' ? 0 : (r as Complex).im);
    expect(roots.some((r) => Math.abs(reOf(r) - 2) < 1e-6 && Math.abs(imOf(r)) < 1e-6)).toBe(true);
    // Two genuine complex roots: -1 ± i√3.
    expect(roots.filter((r) => Math.abs(imOf(r)) > 1e-6).length).toBe(2);
  });
});
