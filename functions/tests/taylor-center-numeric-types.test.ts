/**
 * The center of `taylor` and `seriesCoefficient` as a BigNumber, a Fraction or a Complex.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction, Complex } from '@danielsimonjr/mathts-core';
import { taylor, seriesCoefficient } from '../src/typed/cas.js';

const center = (v: unknown): number => v as number;

describe('taylor: a center that is not a plain number', () => {
  it('a Fraction center is its value (it threw c.toPrecision is not a function)', () => {
    expect(taylor('exp(x)', 'x', center(new Fraction(1, 2)), 2)).toBe(
      taylor('exp(x)', 'x', 0.5, 2)
    );
  });

  it('a BigNumber center is its value', () => {
    expect(seriesCoefficient('x^3', 'x', center(new BigNumber(2)), 1)).toBe(12);
  });

  it('a Complex center with a zero imaginary part is its real part', () => {
    expect(taylor('x^2', 'x', center(new Complex(3, 0)), 2)).toBe(taylor('x^2', 'x', 3, 2));
  });

  it('a Complex center off the real line throws a TypeError (it expanded about 1)', () => {
    expect(() => taylor('exp(x)', 'x', center(new Complex(0, 1)), 2)).toThrow(TypeError);
  });
});
