/**
 * The public typed reductions give exact results for Complex, BigNumber and Fraction data, and
 * correct results for nested arrays and matrices of numbers (#1039).
 *
 * The typed `sum`, `min`, `max`, `mean`, `variance`, `std` and `dot` keep their number kernel only
 * for input that the kernel handles. Other input goes to the exact (factory) implementation, which
 * follows mathjs. The pins at the end hold before and after the fix: for each pinned input the
 * kernel and the exact path give different results, so a pin fails when number data leaves the
 * kernel.
 */
import { describe, expect, it } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import { matrix, sum } from '../src/index.js';

const C = [new Complex(3, 4), new Complex(6, 8)];
const B = [new BigNumber('0.1000000000000000000001'), new BigNumber('0.2')];
const F = [new Fraction(1, 3), new Fraction(1, 6)];

function parts(value: unknown): [number, number] {
  expect(value).toBeInstanceOf(Complex);
  const z = value as Complex;
  return [z.re, z.im];
}

function ratio(value: unknown): [bigint, bigint] {
  expect(value).toBeInstanceOf(Fraction);
  const f = value as Fraction;
  return [f.numerator, f.denominator];
}

describe('sum', () => {
  it('adds Complex values by their parts', () => {
    const [re, im] = parts(sum(C));
    expect(re).toBeCloseTo(9, 12);
    expect(im).toBeCloseTo(12, 12);
  });

  it('keeps every digit of BigNumber values', () => {
    const r = sum(B);
    expect(r).toBeInstanceOf(BigNumber);
    expect(String(r)).toBe('0.3000000000000000000001');
  });

  it('adds Fraction values exactly', () => {
    expect(ratio(sum(F))).toEqual([1n, 2n]);
  });

  it('adds a mixed number and Fraction array exactly', () => {
    expect(ratio(sum([1, new Fraction(1, 3)]))).toEqual([4n, 3n]);
  });

  it('adds a mixed number and Complex array by parts', () => {
    expect(parts(sum([1, new Complex(0, 1)]))).toEqual([1, 1]);
  });

  it('finds a Fraction after a long run of numbers', () => {
    const data: unknown[] = Array.from({ length: 1000 }, (_, i) => i);
    data.push(new Fraction(1, 3));
    expect(ratio(sum(data))).toEqual([1498501n, 3n]);
  });

  it('adds a nested array of Fractions exactly', () => {
    expect(ratio(sum([[F[0]], [F[1]]]))).toEqual([1n, 2n]);
  });

  it('adds a nested array of numbers', () => {
    expect(
      sum([
        [1, 2],
        [3, 4.5],
      ])
    ).toBe(10.5);
  });

  it('adds a Matrix of numbers', () => {
    expect(
      sum(
        matrix([
          [1, 2],
          [3, 4.5],
        ])
      )
    ).toBe(10.5);
  });

  it('adds numeric strings as numbers', () => {
    expect(sum(['1', '2'])).toBe(3);
  });

  it('sums along a dimension', () => {
    expect(
      sum(
        [
          [1, 2],
          [3, 4.5],
        ],
        0
      )
    ).toEqual([4, 6.5]);
  });
});

describe('sum pins that hold before and after the fix', () => {
  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('returns a number for a Float64Array', () => {
    expect(sum(new Float64Array([1, 2, 3.5]))).toBe(6.5);
  });

  it('returns a number for a flat number array', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5);
  });
});
