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
import { BigNumber, Complex, Fraction, pairwiseDot, pairwiseSum } from '@danielsimonjr/mathts-core';
import { dot, matrix, max, mean, min, sparse, std, sum, variance } from '../src/index.js';

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

const B1 = B[1];

// `matrix` returns a BridgeMatrix, which the typed statistics overloads take.
const dense = (data: unknown[]) => matrix(data);

describe('mean, variance and std keep exact types', () => {
  it('mean of Complex, BigNumber and Fraction values', () => {
    const [re, im] = parts(mean(C));
    expect(re).toBeCloseTo(4.5, 12);
    expect(im).toBeCloseTo(6, 12);
    expect(String(mean(B))).toBe('0.15000000000000000000005');
    expect(ratio(mean(F))).toEqual([1n, 4n]);
  });

  it('variance of BigNumber and Fraction values', () => {
    const v = variance(B);
    expect(v).toBeInstanceOf(BigNumber);
    expect(String(v)).toBe('0.004999999999999999999990000000000000000000005');
    expect(ratio(variance(F))).toEqual([1n, 72n]);
  });

  it('variance of Complex values is the mean squared modulus of the deviations (a real number)', () => {
    // Mean i; deviations 1 - i, 0, -1 + i; |d|^2 = 2, 0, 2; unbiased: 4 / (3 - 1) = 2. The values
    // are not on one line through 0, so the variance of their magnitudes (1, 1, sqrt 5) differs.
    const Z = [new Complex(1, 0), new Complex(0, 1), new Complex(-1, 2)];
    expect(variance(Z)).toBeCloseTo(2, 12);
    expect(std(Z)).toBeCloseTo(Math.SQRT2, 12);
  });

  it('std of Fraction values is a number, std of BigNumber values a BigNumber', () => {
    const sf = std(F);
    expect(typeof sf).toBe('number');
    expect(sf as number).toBeCloseTo(Math.sqrt(1 / 72), 15);
    const sb = std(B);
    expect(sb).toBeInstanceOf(BigNumber);
    const sq = (sb as BigNumber).times(sb as BigNumber);
    expect(
      sq
        .sub(variance(B) as BigNumber)
        .abs()
        .lessThan(new BigNumber('1e-40'))
    ).toBe(true);
  });

  it('mixed arrays, Matrix and nested exact data', () => {
    expect(String(mean([1, B1]))).toBe('0.6');
    expect(ratio(mean(dense([[F0, F1]])))).toEqual([1n, 4n]);
    const along = variance(
      [
        [F0, F1],
        [F1, F0],
      ],
      0
    ) as unknown[];
    expect(along.map(ratio)).toEqual([
      [1n, 72n],
      [1n, 72n],
    ]);
  });

  it('a normalization string with exact data', () => {
    expect(ratio(variance(F, 'uncorrected'))).toEqual([1n, 144n]);
  });

  it('an options object with exact data gives the exact result (#1050)', () => {
    expect(String(mean(F, { skipNaN: true }))).toBe(String(mean(F)));
    expect(String(variance(B, { ddof: 0 }))).toBe(String(variance(B, 'uncorrected')));
    expect(String(std(F, 'uncorrected', { skipNaN: true }))).toBe(String(std(F, 'uncorrected')));
  });

  it('numeric strings and bigints follow mathjs', () => {
    expect(mean(['1', '2'])).toBe(1.5);
    expect(variance(['1', '2'])).toBe(0.5);
    expect(std(['1', '2'])).toBe(Math.SQRT1_2);
    expect(mean([1, '2'])).toBe(1.5);
    expect(
      mean(
        [
          ['1', '2'],
          ['3', '4'],
        ],
        0
      )
    ).toEqual([2, 3]);
    expect(mean([1n, 2n, 3n])).toBe(2);
  });

  it('an exact sparse matrix along a dimension keeps its values', () => {
    const f = (n: number): Fraction => new Fraction(n);
    const m = sparse([
      [f(1), f(2)],
      [f(3), f(4)],
    ]);
    for (const [fn, want] of [
      [mean, [2, 3]],
      [variance, [2, 2]],
    ] as const) {
      // The public matrix types hold numbers only. A matrix of Fractions has no public type.
      // An exact array has element-typed overloads (#1049).
      const r = fn(m, 0) as unknown as Fraction[];
      expect(Array.isArray(r)).toBe(true);
      expect(r.map((x) => x.valueOf())).toEqual(want);
    }
  });

  it('along a dimension, exact data comes back in the container of the number path', () => {
    const f = (n: number): Fraction => new Fraction(n);
    const numbers = mean(
      dense([
        [1, 2],
        [3, 4],
      ]),
      0
    );
    const exact = mean(
      dense([
        [f(1), f(2)],
        [f(3), f(4)],
      ]),
      0
    ) as unknown as Fraction[];
    expect(Array.isArray(numbers)).toBe(true);
    expect(Array.isArray(exact)).toBe(true);
    expect(exact.map((x) => x.valueOf())).toEqual(numbers);
  });

  it('3-D number data reduces along a dimension, as in mathjs', () => {
    const a = [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ];
    expect(mean(a, 0)).toEqual([
      [3, 4],
      [5, 6],
    ]);
    expect(variance(a, 0)).toEqual([
      [8, 8],
      [8, 8],
    ]);
  });

  it('a 1-D sparse matrix is a column vector, as in mathjs', () => {
    const v = sparse([1, 2, 4]) as { size(): number[] };
    expect(v.size()).toEqual([3, 1]);
    expect(mean(v as never)).toBeCloseTo(7 / 3, 15);
  });

  it('a Matrix of numbers gives the same bits as the array', () => {
    expect(variance(dense([1, 2, 3.5]))).toBe(variance([1, 2, 3.5]));
  });
});

describe('mean, variance and std pins that hold before and after the fix', () => {
  it('empty input gives NaN', () => {
    expect(mean([])).toBeNaN();
    expect(variance([])).toBeNaN();
    expect(std([])).toBeNaN();
  });

  it('typed arrays stay on the number kernel', () => {
    expect(typeof mean(new Float64Array([1, 2, 3.5]))).toBe('number');
  });

  it('options objects with number data', () => {
    expect(mean([Number.NaN, 1, 3], { skipNaN: true })).toBe(2);
    expect(variance([1, 2, 3.5], { ddof: 0 })).toBe(1.0555555555555556);
    expect(
      variance(
        [
          [1, 2],
          [3, Number.NaN],
        ],
        0,
        { skipNaN: true }
      )
    ).toEqual([2, 0]);
  });

  it('a dimension on a number Matrix gives a plain array', () => {
    expect(
      mean(
        dense([
          [1, 2],
          [3, 4.5],
        ]),
        0
      )
    ).toEqual([2, 3.25]);
  });

  it('kernel values', () => {
    expect(variance([1, 2, 3.5])).toBe(1.5833333333333335);
    expect(std([1, 2, 3.5])).toBe(1.2583057392117918);
  });
});

describe('dot keeps exact types and follows mathjs', () => {
  const C = [new Complex(3, 4), new Complex(6, 8)];

  it('conjugates the first Complex argument, as mathjs does', () => {
    const a = dot(C as never, [1, 1]) as unknown as Complex;
    expect(a).toBeInstanceOf(Complex);
    expect([a.re, a.im]).toEqual([9, -12]);
    const b = dot([1, 1], C as never) as unknown as Complex;
    expect([b.re, b.im]).toEqual([9, 12]);
  });

  it('keeps a Fraction exact', () => {
    const r = dot(
      [new Fraction(1, 3), new Fraction(1, 6)] as never,
      [new Fraction(1, 2), 3] as never
    ) as unknown as Fraction;
    expect(r).toBeInstanceOf(Fraction);
    expect(r.equals(new Fraction(2, 3))).toBe(true);
  });

  it('keeps a BigNumber exact', () => {
    const r = dot(
      [new BigNumber('0.1'), new BigNumber('0.2')] as never,
      [new BigNumber(1), new BigNumber(1)] as never
    ) as unknown as BigNumber;
    expect(r).toBeInstanceOf(BigNumber);
    expect(r.toString()).toBe('0.3');
  });

  it('takes bigints, as mathjs does', () => {
    expect(Number(dot([1n, 2n] as never, [3n, 4n] as never))).toBe(11);
  });

  it('takes two Matrix vectors', () => {
    expect(dot(dense([1, 2, 3]) as never, dense([4, 5, 6]) as never)).toBe(32);
  });
});

describe('dot pins that hold before and after the fix', () => {
  it('number vectors keep the bits of the pairwise kernel', () => {
    const a = Array.from({ length: 101 }, (_, i) => Math.sin(i) * 1e3);
    const b = Array.from({ length: 101 }, (_, i) => Math.cos(i * 0.7));
    expect(dot(a, b)).toBe(dot(new Float64Array(a), new Float64Array(b)));
  });

  it('a column matrix and an array give the mathjs result', () => {
    expect(dot(dense([[1], [2]]) as never, [3, 4])).toBe(11);
  });

  it('vectors of different length throw', () => {
    expect(() => dot([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('dot follows mathjs on matrices, sparse input, errors and signed zero', () => {
  const C = (re: number, im: number): Complex => new Complex(re, im);

  it('a Matrix of Complex or Fraction values keeps its type', () => {
    const z = dot(dense([C(3, 4), C(6, 8)]) as never, dense([1, 1]) as never) as unknown as Complex;
    expect([z.re, z.im]).toEqual([9, -12]);
    const q = dot(dense([new Fraction(1, 2), new Fraction(1, 3)]) as never, dense([2, 3]) as never);
    expect(q).toBeInstanceOf(Fraction);
    expect((q as unknown as Fraction).equals(new Fraction(2))).toBe(true);
  });

  it('a sparse vector with a dense one gives the mathjs result in both orders', () => {
    expect(dot(sparse([1, 2, 4]) as never, [1, 2, 4])).toBe(21);
    expect(dot([1, 2, 4], sparse([1, 2, 4]) as never)).toBe(21);
  });

  it('a sparse first argument is conjugated, as in the dense path', () => {
    const v = sparse([C(3, 4), C(6, 8)]);
    for (const r of [dot(v as never, [1, 1]), dot(v as never, sparse([1, 1]) as never)]) {
      const z = r as unknown as Complex;
      expect([z.re, z.im]).toEqual([9, -12]);
    }
    const w = dot([1, 1], v as never) as unknown as Complex;
    expect([w.re, w.im]).toEqual([9, 12]);
  });

  it('vectors of different length and empty vectors throw the mathjs RangeError', () => {
    expect(() => dot([1, 2], [1, 2, 3])).toThrow(
      new RangeError('Vectors must have equal length (2 != 3)')
    );
    expect(() => dot([], [])).toThrow(
      new RangeError('Cannot calculate the dot product of empty vectors')
    );
    expect(() => dot(new Float64Array(0), new Float64Array(0))).toThrow(RangeError);
  });

  it('a sum of -0 terms is -0, as in mathjs', () => {
    expect(Object.is(dot([-0], [1]), -0)).toBe(true);
    expect(Object.is(dot([-0, -0], [1, 2]), -0)).toBe(true);
    expect(Object.is(dot([-0, 0], [1, 1]), 0)).toBe(true);
    expect(Object.is(dot(new Float64Array([-0]), new Float64Array([1])), -0)).toBe(true);
  });

  it('bigints give an exact Fraction, also past 2^53 where mathjs throws', () => {
    const r = dot([9007199254740993n, 1n] as never, [1n, 1n] as never) as unknown as Fraction;
    expect(r).toBeInstanceOf(Fraction);
    expect(r.toString()).toBe('9007199254740994');
  });
});

describe('dot keeps the bits of the core pairwise kernel', () => {
  const vec = (n: number, k: number): number[] =>
    Array.from({ length: n }, (_, i) => Math.sin(i * k) * 10 ** ((i % 5) - 2));

  it('number arrays equal pairwiseDot at every leaf boundary', () => {
    for (const n of [1, 7, 8, 127, 128, 129, 255, 256, 1000, 5000]) {
      const a = vec(n, 1.3);
      const b = vec(n, 0.7);
      expect(Object.is(dot(a, b), pairwiseDot(a, b))).toBe(true);
    }
  });

  it('a column vector takes the naive loop of mathjs, a flat vector the pairwise kernel', () => {
    const a = vec(1000, 1.3);
    const b = vec(1000, 0.7);
    let naive = a[0] * b[0];
    for (let i = 1; i < a.length; i++) naive += a[i] * b[i];
    const column = dot(dense(a.map((x) => [x])) as never, b);
    expect(Object.is(column, naive)).toBe(true);
    expect(Object.is(dot(a, b), pairwiseDot(a, b))).toBe(true);
  });
});

describe('a matrix reports the data type of its elements, as mathjs does', () => {
  it('dense and sparse matrices read the type from their values', () => {
    const t = (m: unknown): string => (m as { getDataType(): string }).getDataType();
    expect(t(matrix([new Complex(1, 2)]))).toBe('Complex');
    expect(t(matrix([1, 'a']))).toBe('mixed');
    expect(t(matrix([1, 2]))).toBe('number');
    expect(t(sparse([1, 2]))).toBe('number');
    expect(t(sparse([new Fraction(1, 2)]))).toBe('Fraction');
  });
});
