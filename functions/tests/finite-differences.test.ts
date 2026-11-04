import { describe, it, expect } from 'vitest';
import {
  finiteDifferenceCoefficients,
  ridders,
  fixedPoint,
} from '../src/numeric/finite-differences.js';

describe('finiteDifferenceCoefficients', () => {
  it('second derivative on [-1, 0, 1]', () => {
    expect(finiteDifferenceCoefficients(2, [-1, 0, 1])).toEqual([1, -2, 1]);
  });

  it('first derivative on [-1, 0, 1] (central difference)', () => {
    const c = finiteDifferenceCoefficients(1, [-1, 0, 1]);
    [-0.5, 0, 0.5].forEach((v, i) => expect(c[i]).toBeCloseTo(v, 12));
  });

  it('first derivative, 5-point stencil', () => {
    const c = finiteDifferenceCoefficients(1, [-2, -1, 0, 1, 2]);
    [1 / 12, -2 / 3, 0, 2 / 3, -1 / 12].forEach((v, i) => expect(c[i]).toBeCloseTo(v, 12));
  });

  it('rejects repeated offsets and too few points', () => {
    expect(() => finiteDifferenceCoefficients(1, [0, 0, 1])).toThrow(RangeError);
    expect(() => finiteDifferenceCoefficients(2, [0, 1])).toThrow(RangeError);
  });
});

describe('ridders', () => {
  it('root of cos(x) - x in [0, 1]', () => {
    expect(ridders((x) => Math.cos(x) - x, 0, 1)).toBeCloseTo(0.7390851332151607, 12);
  });

  it('rejects a bracket without a sign change', () => {
    expect(() => ridders((x) => x * x + 1, -1, 1)).toThrow(RangeError);
  });
});

describe('fixedPoint', () => {
  it('cos fixed point by plain iteration', () => {
    expect(fixedPoint(Math.cos, 1)).toBeCloseTo(0.7390851332151607, 10);
  });

  it('Aitken acceleration reaches the same point', () => {
    expect(fixedPoint(Math.cos, 1, { aitken: true })).toBeCloseTo(0.7390851332151607, 10);
  });
});
