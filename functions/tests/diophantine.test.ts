import { describe, it, expect } from 'vitest';
import {
  linearDiophantine,
  pellSolve,
  frobeniusNumber,
  zeckendorf,
  sumOfTwoSquares,
  egyptianFraction,
  fareySequence,
} from '../src/numbertheory/diophantine.js';

describe('linearDiophantine', () => {
  it('finds a particular solution and the step vector', () => {
    const s = linearDiophantine(3, 5, 1);
    expect(s).toEqual({ x: 2, y: -1, stepX: 5, stepY: -3 });
    if (!s) throw new Error('expected a solution');
    expect(3 * s.x + 5 * s.y).toBe(1);
    const t = 4;
    expect(3 * (s.x + s.stepX * t) + 5 * (s.y + s.stepY * t)).toBe(1);
  });
  it('handles negative and zero coefficients', () => {
    const s = linearDiophantine(-4, 6, 2);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(-4 * s.x + 6 * s.y).toBe(2);
    expect(linearDiophantine(0, 5, 10)).toEqual({ x: 0, y: 2, stepX: 1, stepY: 0 });
  });
  it('returns null when gcd does not divide c', () => {
    expect(linearDiophantine(4, 6, 3)).toBeNull();
  });
});

describe('pellSolve', () => {
  it('fundamental solutions', () => {
    expect(pellSolve(2)).toEqual({ x: 3n, y: 2n });
    expect(pellSolve(3)).toEqual({ x: 2n, y: 1n });
    expect(pellSolve(61)).toEqual({ x: 1766319049n, y: 226153980n });
  });
  it('null for perfect squares and non-positive d', () => {
    expect(pellSolve(4)).toBeNull();
    expect(pellSolve(0)).toBeNull();
  });
});

describe('frobeniusNumber', () => {
  it('classic coin sets', () => {
    expect(frobeniusNumber([3, 5])).toBe(7);
    expect(frobeniusNumber([6, 9, 20])).toBe(43);
  });
  it('rejects gcd != 1', () => {
    expect(() => frobeniusNumber([4, 6])).toThrow(RangeError);
  });
});

describe('zeckendorf', () => {
  it('decomposes into non-consecutive Fibonacci parts', () => {
    expect(zeckendorf(100)).toEqual([89, 8, 3]);
    expect(zeckendorf(0)).toEqual([]);
  });
});

describe('sumOfTwoSquares', () => {
  it('lists representations a <= b', () => {
    expect(sumOfTwoSquares(25)).toEqual([
      [0, 5],
      [3, 4],
    ]);
    expect(sumOfTwoSquares(3)).toEqual([]);
  });
});

describe('egyptianFraction', () => {
  it('greedy decomposition of 4/5', () => {
    expect(egyptianFraction(4, 5)).toEqual([2, 4, 20]);
  });
  it('sums back to p/q', () => {
    const dens = egyptianFraction(7, 15);
    const total = dens.reduce((acc, d) => acc + 1 / d, 0);
    expect(total).toBeCloseTo(7 / 15, 12);
  });
});

describe('fareySequence', () => {
  it('F_3', () => {
    expect(fareySequence(3)).toEqual([
      [0, 1],
      [1, 3],
      [1, 2],
      [2, 3],
      [1, 1],
    ]);
  });
});
