import { describe, it, expect } from 'vitest';
import { quantileSeq, bignumber, matrix, fraction, unit } from '../src/factories/index.js';
import {
  quantileOfSorted,
  type NumpyQuantileMethod,
} from '../src/statistics/quantile-numpy-methods.js';
import { evaluate } from '../src/factories/evaluate.js';

const q = quantileSeq as (...a: unknown[]) => unknown;
const B = bignumber as (x: unknown) => unknown;
const isBig = (v: unknown): boolean => !!v && (v as { isBigNumber?: boolean }).isBigNumber === true;
const str = (v: unknown): string => String(v);

const METHODS: NumpyQuantileMethod[] = [
  'linear',
  'lower',
  'higher',
  'nearest',
  'midpoint',
  'inverted_cdf',
  'averaged_inverted_cdf',
  'closest_observation',
  'interpolated_inverted_cdf',
  'hazen',
  'weibull',
  'median_unbiased',
  'normal_unbiased',
];

// Expected values are NumPy 2.3.5 `np.quantile(a, p, method=...)` results.
describe('quantileSeq applies the NumPy method to BigNumber, Fraction and Unit input (#1130)', () => {
  it('uses the method for a BigNumber probability', () => {
    const r = q([1, 2, 3, 4], B(0.1), 'inverted_cdf');
    expect(isBig(r)).toBe(true);
    expect(str(r)).toBe('1');
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const c = q(ten, B(0.25), 'closest_observation');
    expect(isBig(c)).toBe(true);
    expect(str(c)).toBe('2');
  });

  it('uses the method for BigNumber data', () => {
    const r = q([1, 2, 3, 4].map(B), 0.1, 'inverted_cdf');
    expect(isBig(r)).toBe(true);
    expect(str(r)).toBe('1');
    expect(str(q([1, 2, 3, 4].map(B), 0.1, { method: 'inverted_cdf' }))).toBe('1');
  });

  it('uses the method for Fraction and Unit data', () => {
    expect(
      String(
        q(
          [1, 2, 3, 4].map((v) => fraction(v)),
          0.1,
          'inverted_cdf'
        )
      )
    ).toBe('1');
    const u = q(
      [1, 2, 3, 4].map((v) => unit(v, 'm')),
      0.1,
      'inverted_cdf'
    );
    expect(String(u)).toBe('1 m');
  });

  it('gives the number result for every method and every probability', () => {
    const P = [0, 0.1, 0.25, 0.3, 0.5, 0.625, 0.75, 0.9, 1];
    const samples: number[][] = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [3, -1, 5, 7],
    ];
    for (const data of samples) {
      for (const m of METHODS) {
        for (const p of P) {
          const expected = q(data, p, m) as number;
          const viaBigProb = Number(q(data, B(p), m));
          const viaBigData = Number(q(data.map(B), p, m));
          const viaBoth = Number(q(data.map(B), B(p), m));
          for (const got of [viaBigProb, viaBigData, viaBoth]) {
            expect(Math.abs(got - expected), `${m} p=${p} [${data}]`).toBeLessThan(1e-12);
          }
        }
      }
    }
  });

  it('keeps a BigNumber probability exact where the float index is not', () => {
    // 100 * 0.07 is 7.000000000000001 in float, so the index 6.000000000000001 selects
    // the next order statistic (NumPy 2.3.5 gives 8). The BigNumber product is exactly 7.
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(q(data, 0.07, 'inverted_cdf')).toBe(8);
    expect(str(q(data, B('0.07'), 'inverted_cdf'))).toBe('7');
  });

  it('does not round an index that lies within relTol of a whole number', () => {
    // The `compare` function treats values within the config `relTol` (1e-12) as equal, so a
    // plan that read it would take 6.000000000001 for the whole number 6. The exact index is
    // above 6, so the next order statistic is selected, as for the number probability.
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    for (const p of ['0.07000000000001', '0.0700000000001', '0.07000000000000001']) {
      expect(q(data, Number(p), 'inverted_cdf'), `number ${p}`).toBe(8);
      expect(str(q(data, B(p), 'inverted_cdf')), `bignumber ${p}`).toBe('8');
      expect(str(q(data.map(B), B(p), 'inverted_cdf')), `bignumber data ${p}`).toBe('8');
    }
    // 99 * 0.0707070707070708 = 7.0000000000000092: `higher` takes index 8.
    expect(str(q(data, B('0.0707070707070708'), 'higher'))).toBe('9');
    expect(q(data, 0.0707070707070708, 'higher')).toBe(9);
  });

  it('blends BigNumber values that differ below the relTol', () => {
    // The ends differ in the 21st digit: the blend is exact, not the left end.
    const two = [B('1'), B('1.000000000000000000002')];
    expect(str(q(two, B('0.5'), true))).toBe('1.000000000000000000001');
    expect(str(q(two, 0.5, true))).toBe('1.000000000000000000001');
    const near = [B('1'), B('1.0000000000001'), B('1.0000000000002'), B('2')];
    expect(str(q(near, B('0.5'), true))).toBe('1.00000000000015');
    // Number ends with a BigNumber weight: the same rule (the number weight gives the same value).
    expect(str(q([1, 1.0000000000001], B('0.5')))).toBe('1.00000000000005');
    expect(q([1, 1.0000000000001], 0.5)).toBe(1.00000000000005);
    expect(str(q([1, B('1.0000000000001')], B('0.5'), true))).toBe('1.00000000000005');
    expect(str(q([B('1'), 1.0000000000001], B('0.5'), true))).toBe('1.00000000000005');
    // Equal ends give that value without a rounding step.
    expect(str(q([3, 3], B('0.3')))).toBe('3');
    expect(str(q([B('2'), B('2')], B('0.3'), true))).toBe('2');
    expect(str(q([unit(3, 'm'), unit(3, 'm')], 0.3))).toBe('3 m');
  });

  it('rejects a BigNumber probability outside 0 to 1, as the number probability does', () => {
    expect(() => q([1, 2, 3], 1.0000000000001)).toThrow('N/prob');
    expect(() => q([1, 2, 3], B('1.0000000000001'))).toThrow('N/prob');
    expect(() => q([1, 2, 3], [B('-1e-30')])).toThrow('N/prob');
  });

  it('accepts a method or an options object with a dimension', () => {
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0,
        'hazen',
        1
      )
    ).toEqual([2, 1]);
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0,
        'hazen',
        0
      )
    ).toEqual([5, 1]);
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0,
        { method: 'hazen' },
        1
      )
    ).toEqual([2, 1]);
    expect(
      q(
        [
          [5, NaN],
          [9, 1],
        ],
        0.5,
        { skipNaN: true },
        1
      )
    ).toEqual([5, 5]);
    expect(
      q(
        [
          [5, NaN],
          [9, 1],
        ],
        0.5,
        1
      )
    ).toEqual([NaN, 5]);
    expect(q([[1, 2, 3, 4]], [0.25, 0.75], 'lower', 1)).toEqual([[1, 3]]);
    expect(q([[1, 2, 3, 4]], [0.25, 0.75], { method: 'higher' }, 1)).toEqual([[2, 4]]);
    expect(
      q(
        matrix([
          [5, 2],
          [9, 1],
        ]),
        0,
        'hazen',
        1
      )
    ).toEqual(matrix([2, 1]));
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        B(0),
        'hazen',
        1
      )
    ).toEqual([B(2), B(1)]);
  });

  it('accepts sorted, a method and a dimension together', () => {
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0,
        false,
        'hazen',
        1
      )
    ).toEqual([2, 1]);
    expect(
      q(
        [
          [2, 5],
          [1, 9],
        ],
        0,
        true,
        'hazen',
        1
      )
    ).toEqual([2, 1]);
    expect(q([[1, 2, 3, 4]], [0.25, 0.75], false, 'lower', 1)).toEqual([[1, 3]]);
  });

  it('keeps the dimension forms without a method', () => {
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0.5,
        1
      )
    ).toEqual([3.5, 5]);
    expect(
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0.5,
        false,
        1
      )
    ).toEqual([3.5, 5]);
    expect(() =>
      q(
        [
          [5, 2],
          [9, 1],
        ],
        0.5,
        'nope',
        1
      )
    ).toThrow(/Unknown quantile/);
  });

  it('gives NaN for a NaN probability', () => {
    expect(q([1, 2, 3], NaN)).toBeNaN();
    const b = q([1, 2, 3], B(NaN));
    expect(isBig(b)).toBe(true);
    expect((b as { isNaN(): boolean }).isNaN()).toBe(true);
    expect(q([1, 2, 3], [0.5, NaN])).toEqual([2, NaN]);
    expect(q([1, 2, 3], NaN, 'lower')).toBeNaN();
    expect(q([1, 2, 3].map(B), NaN)).toBeNaN();
    // A NaN in the data still wins, and an empty sequence still throws.
    expect(q([1, NaN, 3], NaN)).toBeNaN();
    expect(() => q([], NaN)).toThrow(/empty/);
  });

  it('still rejects a probability outside [0, 1]', () => {
    expect(() => q([1, 2, 3], -0.5)).toThrow(/non-negative/);
    expect(() => q([1, 2, 3], [0.5, 1.5])).toThrow();
    expect(() => q([1, 2, 3].map(B), [0.5, -1])).toThrow();
  });
});

describe('quantileSeq has one rule for infinite ends and an overflowing difference (#1131)', () => {
  it('returns the lower end at weight 0 and an infinite end otherwise', () => {
    expect(q([1, Infinity], 0)).toBe(1);
    expect(q([1, Infinity], 0.1)).toBe(Infinity);
    expect(q([1, Infinity], 0.5)).toBe(Infinity);
    expect(q([1, Infinity], 1)).toBe(Infinity);
    expect(q([-Infinity, 1, 2], 0, 'hazen')).toBe(-Infinity);
    expect(q([-Infinity, 1], 0.25, 'weibull')).toBe(-Infinity);
  });

  it('gives a finite result when the difference overflows', () => {
    expect(q([-1.7e308, 1.7e308], 0)).toBe(-1.7e308);
    expect(q([-1.7e308, 1.7e308], 0.5)).toBe(0);
    expect(q([-1.7e308, 1.7e308], 1)).toBe(1.7e308);
    expect(q([-1.7e308, 1.7e308], 0.75, 'averaged_inverted_cdf')).toBe(1.7e308);
    const quarter = q([-1.7e308, 1.7e308], 0.25) as number;
    expect(Math.abs(quarter - -8.5e307) < 1e300).toBe(true);
  });

  it('is monotone in p, never NaN, and ends at the minimum and the maximum', () => {
    const data = [-Infinity, -1.7e308, 0, 1.7e308, Infinity];
    for (const m of METHODS) {
      let previous = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const p = i / 100;
        const v = q(data, p, m) as number;
        expect(Number.isNaN(v), `${m} p=${p}`).toBe(false);
        expect(v >= previous, `${m} p=${p}`).toBe(true);
        previous = v;
      }
      expect(q(data, 0, m)).toBe(-Infinity);
      expect(q(data, 1, m)).toBe(Infinity);
    }
  });

  it('gives the same results for BigNumber data', () => {
    expect(Number(q([1, Infinity].map(B), 0))).toBe(1);
    expect(Number(q([1, Infinity].map(B), 0.5))).toBe(Infinity);
  });
});

describe('quantileSeq finds one probability by selection, not by a full sort (#1005)', () => {
  type SortFn = (this: unknown, ...a: unknown[]) => unknown;
  const typedArrayProto = Object.getPrototypeOf(Float64Array.prototype) as { sort: SortFn };

  /** Count calls to Array.prototype.sort and %TypedArray%.prototype.sort while `fn` runs. */
  function countSorts(fn: () => void): number {
    let count = 0;
    const arraySort = Array.prototype.sort;
    const typedSort = typedArrayProto.sort;
    Array.prototype.sort = function (this: unknown[], ...a: unknown[]) {
      count++;
      return (arraySort as SortFn).apply(this, a);
    } as typeof Array.prototype.sort;
    typedArrayProto.sort = function (this: unknown, ...a: unknown[]) {
      count++;
      return typedSort.apply(this, a);
    };
    try {
      fn();
    } finally {
      Array.prototype.sort = arraySort;
      typedArrayProto.sort = typedSort;
    }
    return count;
  }

  const N = 100_000;
  const values = Array.from({ length: N }, (_, i) => Math.sin(i) * 1000);
  const sortedCopy = Float64Array.from(values).sort();

  it('does not sort for a plain array, a Float64Array or a nested array', () => {
    let r1 = NaN;
    let r2 = NaN;
    let r3 = NaN;
    const typed = Float64Array.from(values);
    const nested = [values.slice(0, N / 2), values.slice(N / 2)];
    const sorts = countSorts(() => {
      r1 = q(values, 0.9) as number;
      r2 = q(typed, 0.9) as number;
      r3 = q(nested, 0.9) as number;
    });
    expect(sorts).toBe(0);
    const expected = quantileOfSorted(sortedCopy, 0.9, 'linear');
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
    expect(r3).toBe(expected);
  });

  it('does not change the input', () => {
    const input = values.slice();
    q(input, 0.37);
    q(input, [0.1, 0.9]);
    expect(input).toEqual(values);
    const typed = Float64Array.from(values);
    q(typed, 0.37);
    expect(Array.from(typed)).toEqual(values);
  });

  it('gives the sorted-path result for random data, every method, every probability', () => {
    let seed = 12345;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const mismatches: string[] = [];
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rand() * 50);
      const data: number[] = [];
      for (let i = 0; i < n; i++) {
        const r = rand();
        // Duplicates, negative zero and a wide range of values.
        data.push(
          r < 0.1 ? -0 : r < 0.2 ? 0 : r < 0.4 ? Math.floor(rand() * 5) : (rand() - 0.5) * 1e6
        );
      }
      const sorted = data.slice().sort((a, b) => a - b);
      const probs = [0, rand(), rand(), 0.5, 1, rand()];
      for (const method of METHODS) {
        for (const p of probs) {
          const fast = q(data, p, { method }) as number;
          const ref = q(sorted, p, { method, sorted: true }) as number;
          const oracle = quantileOfSorted(sorted, p, method);
          if (fast !== oracle || ref !== oracle) {
            mismatches.push(`n=${n} ${method} p=${p}: ${fast} ${ref} ${oracle}`);
          }
        }
        const many = q(data, probs, { method }) as number[];
        probs.forEach((p, i) => {
          if (many[i] !== quantileOfSorted(sorted, p, method)) {
            mismatches.push(`list n=${n} ${method} p=${p}: ${many[i]}`);
          }
        });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('gives the single-probability results for a long list and for N (one sort for 24 or more)', () => {
    let seed = 987;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const data = Array.from({ length: 500 }, () =>
      rand() < 0.3 ? -0 : Math.floor(rand() * 40) - 10
    );
    data.splice(7, 0, NaN, NaN);
    const finite = data.filter((v) => !Number.isNaN(v));
    const probs = Array.from({ length: 30 }, (_, i) => (i + 1) / 31);
    const before = data.slice();
    const typed = Float64Array.from(finite);
    const typedBefore = Float64Array.from(typed);
    const nested = [finite.slice(0, 250), finite.slice(250)];
    const nestedBefore = nested.map((row) => row.slice());
    for (const method of METHODS) {
      for (const skipNaN of [false, true]) {
        const many = q(data, probs, { method, skipNaN }) as number[];
        expect(many.length).toBe(30);
        probs.forEach((p, i) => {
          const one = q(skipNaN ? finite : data, p, { method, skipNaN }) as number;
          // Equal values, whatever the sign of a zero.
          expect(
            Number.isNaN(one) ? Number.isNaN(many[i]) : many[i] === one,
            `${method} ${skipNaN} p=${p}`
          ).toBe(true);
        });
      }
    }
    // The N form: N = 30 gives the probabilities 1/31 ... 30/31, and the same values.
    const viaN = q(finite, 30, { method: 'hazen' }) as number[];
    const viaList = q(finite, probs, { method: 'hazen' }) as number[];
    const plain = (xs: number[]): number[] => xs.map((v) => v + 0); // -0 + 0 is 0
    expect(plain(viaN)).toEqual(plain(viaList));
    // The one sort of the long list works on a copy: no input changes, not even a signed zero.
    const same = (x: ArrayLike<number>, y: ArrayLike<number>): boolean =>
      x.length === y.length && Array.from(x).every((v, i) => Object.is(v, y[i]));
    expect(same(data, before)).toBe(true);
    q(typed, probs, { method: 'hazen' });
    expect(same(typed, typedBefore)).toBe(true);
    q(nested, probs, { method: 'hazen' });
    expect(nested.every((row, i) => same(row, nestedBefore[i] as number[]))).toBe(true);
    // A sorted input keeps its order and gives the same values.
    const sortedFinite = finite.slice().sort((a, b) => a - b);
    expect(plain(q(sortedFinite, probs, { method: 'hazen', sorted: true }) as number[])).toEqual(
      plain(viaList)
    );
  });

  it('skips NaN and keeps the NaN policy on the selection path', () => {
    expect(q([3, NaN, 1, 2], 0.5)).toBeNaN();
    expect(q([3, NaN, 1, 2], 0.5, { skipNaN: true })).toBe(2);
    expect(q(Float64Array.of(3, NaN, 1, 2), 0.5, { skipNaN: true })).toBe(2);
    expect(q([NaN, NaN], 0.5, { skipNaN: true })).toBeNaN();
  });
});

describe('quantileSeq in the expression language takes a method and a dimension (#1130)', () => {
  const val = (r: unknown): unknown => {
    const m = r as { toArray?: () => unknown };
    return m && typeof m.toArray === 'function' ? m.toArray() : r;
  };

  it('passes a method string and an options object through', () => {
    expect(evaluate("quantileSeq([1, 2, 3, 4], 0.1, 'inverted_cdf')")).toBe(1);
    expect(evaluate("quantileSeq([1, 2, 3, 4], 0.3, {method: 'lower'})")).toBe(1);
    expect(evaluate("quantileSeq([1, 2, 3, 4], [0.25, 0.75], 'lower')")).toEqual([1, 3]);
    expect(evaluate("quantileSeq([4, 1, 3, 2], 0.5, false, 'lower')")).toBe(2);
  });

  it('counts a dimension from one, with or without a method', () => {
    // Zero-based dim 0 is one-based dim 1 (columns); zero-based dim 1 is one-based dim 2 (rows).
    expect(val(evaluate('quantileSeq([[5, 2], [9, 1]], 0.5, 1)'))).toEqual([7, 1.5]);
    expect(val(evaluate("quantileSeq([[5, 2], [9, 1]], 0, 'hazen', 1)"))).toEqual([5, 1]);
    expect(val(evaluate("quantileSeq([[5, 2], [9, 1]], 0, 'hazen', 2)"))).toEqual([2, 1]);
    expect(val(evaluate("quantileSeq([[5, 2], [9, 1]], 0, {method: 'hazen'}, 2)"))).toEqual([2, 1]);
    expect(val(evaluate("quantileSeq([[5, 2], [9, 1]], 0, false, 'hazen', 2)"))).toEqual([2, 1]);
    expect(val(evaluate("quantileSeq([[1, 2, 3, 4]], [0.25, 0.75], 'lower', 2)"))).toEqual([
      [1, 3],
    ]);
  });
});
