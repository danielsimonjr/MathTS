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
import { BigNumber, Complex, Fraction, pairwiseSum } from '@danielsimonjr/mathts-core';
import { matrix, max, min, sparse, sum } from '../src/index.js';

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

/** A number array whose naive left-to-right sum and pairwise sum differ in their bits. */
function mixed(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 10 ** ((i % 7) - 3));
}

function naive(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** Split a flat array into rows of the given width. */
function rows(xs: number[], width: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < xs.length; i += width) out.push(xs.slice(i, i + width));
  return out;
}

describe('sum uses the pairwise kernel for number data', () => {
  const xs = mixed(2048);

  it('the pinned input tells the two summation orders apart', () => {
    expect(pairwiseSum(xs)).not.toBe(naive(xs));
  });

  it('a flat array gives the pairwise bits', () => {
    expect(sum(xs)).toBe(pairwiseSum(xs));
  });

  it('a 1-d Matrix gives the pairwise bits', () => {
    expect(sum(matrix(xs))).toBe(pairwiseSum(xs));
  });

  it('a nested array gives the same bits as the flat array', () => {
    expect(sum(rows(xs, 64))).toBe(pairwiseSum(xs));
  });

  it('a 2-d Matrix gives the same bits as the flat array', () => {
    expect(sum(matrix(rows(xs, 64)))).toBe(pairwiseSum(xs));
  });
});

describe('sum edge cases follow mathjs', () => {
  it('sums a sparse matrix', () => {
    expect(
      sum(
        sparse([
          [1, 0],
          [0, 2.5],
        ])
      )
    ).toBe(3.5);
  });

  it('returns 0 for an empty Matrix', () => {
    expect(sum(matrix([]))).toBe(0);
  });

  it('throws a TypeError for a null or undefined element', () => {
    expect(() => sum([1, null])).toThrow(TypeError);
    expect(() => sum([1, undefined])).toThrow(TypeError);
    expect(() => sum([[1], [null]])).toThrow(TypeError);
  });
});

const F0 = F[0];
const F1 = F[1];
const B0 = B[0];

describe('min and max', () => {
  it('throw for Complex values, which have no ordering', () => {
    expect(() => min(C)).toThrow(/no ordering relation/);
    expect(() => max(C)).toThrow(/no ordering relation/);
  });

  it('keep every digit of BigNumber values', () => {
    const lo = min(B);
    expect(lo).toBeInstanceOf(BigNumber);
    expect(String(lo)).toBe('0.1000000000000000000001');
    expect(String(max(B))).toBe('0.2');
  });

  it('return the exact Fraction', () => {
    expect(ratio(min(F))).toEqual([1n, 6n]);
    expect(ratio(max(F))).toEqual([1n, 3n]);
  });

  it('find a Fraction in a mixed array', () => {
    expect(ratio(min([1, F0]))).toEqual([1n, 3n]);
  });

  it('read a nested number array and a Matrix', () => {
    const grid = [
      [1, 2],
      [3, 4.5],
    ];
    expect(min(grid)).toBe(1);
    expect(max(grid)).toBe(4.5);
    expect(min(matrix(grid))).toBe(1);
    expect(max(matrix(grid))).toBe(4.5);
    expect(min(matrix([1, 2, 3.5]))).toBe(1);
  });

  it('reduce along a dimension', () => {
    const grid = [
      [1, 2],
      [3, 0.5],
    ];
    expect(min(grid, 0)).toEqual([1, 0.5]);
    expect(max(grid, 1)).toEqual([2, 3]);
  });

  it('return a Fraction or a BigNumber scalar unchanged', () => {
    expect(min(F0)).toBe(F0);
    expect(max(F0)).toBe(F0);
    expect(min(B0)).toBe(B0);
  });

  it('keep exact values in a list of arguments', () => {
    expect(ratio(min(F0, F1, F0))).toEqual([1n, 6n]);
    expect(ratio(max(F0, F1, F0))).toEqual([1n, 3n]);
    expect(ratio(min(F0, 1, 2))).toEqual([1n, 3n]);
    expect(min(1, B0, 2)).toBe(B0);
    expect(max(F0, 0, 0.1)).toBe(F0);
    expect(min(1n, 2n, 3n)).toBe(1n);
  });

  it('compare booleans and numeric strings as mathjs does', () => {
    expect(min([true, false])).toBe(false);
    expect(min(['3', '2'])).toBe(2);
  });
});

describe('min and max pins that hold before and after the fix', () => {
  it('give Infinity and -Infinity for an empty array', () => {
    expect(min([])).toBe(Infinity);
    expect(max([])).toBe(-Infinity);
  });

  it('give NaN for an array that holds NaN', () => {
    expect(min([1, Number.NaN, 0])).toBeNaN();
  });

  it('give Infinity and -Infinity for an empty Matrix and empty nested arrays', () => {
    expect(min(matrix([]))).toBe(Infinity);
    expect(max(matrix([]))).toBe(-Infinity);
    expect(min([[]])).toBe(Infinity);
    expect(max([[], []])).toBe(-Infinity);
  });

  it('keep the bigint and typed-array paths', () => {
    expect(min(1n, 2n)).toBe(1n);
    expect(max(new Float64Array([1, 2, 3.5]))).toBe(3.5);
  });
});

describe('min and max follow mathjs on equal values, NaN and mixed types', () => {
  it('keep the first of equal zeros', () => {
    expect(Object.is(min([0, -0]), 0)).toBe(true);
    expect(Object.is(max([-0, 0]), -0)).toBe(true);
    expect(Object.is(min(0, -0), 0)).toBe(true);
    expect(Object.is(max(-0, 0), -0)).toBe(true);
    expect(Object.is(min(0, -0, 1), 0)).toBe(true);
    expect(Object.is(min([[0], [-0]]), 0)).toBe(true);
  });

  it('return NaN once any value is NaN', () => {
    expect(min([Number.NaN, 1])).toBeNaN();
    expect(max([1, Number.NaN, 5])).toBeNaN();
    expect(min(F0, Number.NaN)).toBeNaN();
    expect(min([0.5, Number.NaN, F0])).toBeNaN();
    expect(min(1, Number.NaN, 0)).toBeNaN();
  });

  it('keep the first of equal zeros in a Float64Array', () => {
    expect(Object.is(min(new Float64Array([0, -0])), 0)).toBe(true);
    expect(Object.is(max(new Float64Array([-0, 0])), -0)).toBe(true);
  });

  it('return the winning argument itself for two arguments of mixed types', () => {
    expect(max(1, F0)).toBe(1);
    expect(min(F0, 1)).toBe(F0);
    expect(min(1n, 2)).toBe(1n);
    expect(max(3n, 2)).toBe(3n);
    expect(max(2, B0)).toBe(2);
  });
});
