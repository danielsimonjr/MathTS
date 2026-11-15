import { describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

/**
 * #1042: the number-only statistics read a Complex as its magnitude and a Fraction or a
 * BigNumber as a double, and returned a wrong number. Each function must reject data that is
 * not number data with a TypeError, and must keep its result for number data.
 */
type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];

const exact: Record<string, unknown[]> = {
  Complex: [new Complex(3, 4), new Complex(6, 8), new Complex(1, 1)],
  Fraction: [new Fraction(1, 2), new Fraction(3, 2), new Fraction(5, 2)],
  BigNumber: [new BigNumber(1), new BigNumber(3), new BigNumber(4)],
};

// One-vector functions (the 12 of the issue, and the rest of the class in the same files).
const ONE_VECTOR = [
  'cumprod',
  'fsum',
  'ptp',
  'gmean',
  'hmean',
  'sem',
  'kurtosis',
  'skewness',
  'trapz',
  'rankdata',
  'moment',
  'zscore',
  'variation',
  'describe',
  'histogram',
  'logsumexp',
  'softmax',
  'cummax',
  'cummin',
  'cumtrapz',
];
// Two-vector functions.
const TWO_VECTOR = [
  'spearman',
  'pearsonr',
  'spearmanr',
  'kendallTau',
  'kendalltau',
  'kendallTauTest',
  'linregress',
  'cov',
];

const extraArgs: Record<string, unknown[]> = { moment: [2], trimmedMean: [0.1] };

describe('#1042 number-only statistics reject exact scalar data', () => {
  for (const name of [...ONE_VECTOR, 'trimmedMean']) {
    for (const [type, data] of Object.entries(exact)) {
      it(`${name}(${type}[]) throws a TypeError`, () => {
        expect(() => fn(name)(data, ...(extraArgs[name] ?? []))).toThrow(TypeError);
      });
    }
  }

  for (const name of TWO_VECTOR) {
    for (const [type, data] of Object.entries(exact)) {
      it(`${name}(${type}[], number[]) and (number[], ${type}[]) throw a TypeError`, () => {
        expect(() => fn(name)(data, [1, 2, 4])).toThrow(TypeError);
        expect(() => fn(name)([1, 2, 4], data)).toThrow(TypeError);
      });
    }
  }

  it('the matrix form of cov rejects an exact entry', () => {
    expect(() =>
      f.cov([
        [1, 2],
        [3, new Fraction(1, 2) as unknown as number],
        [5, 7],
      ])
    ).toThrow(TypeError);
  });

  it('trapz rejects an exact abscissa', () => {
    expect(() => f.trapz([1, 2, 3], exact.Fraction as unknown as number[])).toThrow(TypeError);
  });

  it('clamp and sigmoid reject an exact scalar and an exact array', () => {
    const c = new Complex(3, 4) as unknown as number;
    expect(() => f.clamp(c, 0, 1)).toThrow(TypeError);
    expect(() => f.clamp([c], 0, 1)).toThrow(TypeError);
    expect(() => f.sigmoid(c)).toThrow(TypeError);
    expect(() => f.sigmoid([c])).toThrow(TypeError);
  });

  it('the error names the function and the element', () => {
    expect(() => f.cumprod(exact.Complex as unknown as number[])).toThrow(
      /cumprod: expects number data, got a Complex at index 0/
    );
  });
});

describe('#1042 the same check covers the other number-only files', () => {
  const C = exact.Complex;
  const cases: [string, unknown[]][] = [
    ['wilcoxon', [C, [1, 2, 4]]],
    ['weightedMean', [C, [1, 1, 1]]],
    ['linearRegression', [C, [1, 2, 4]]],
    ['dtw', [C, [1, 2, 4]]],
    ['lombScargle', [[0, 1, 2], C, [0.1, 0.2]]],
    ['movingAverage', [C, 2]],
    ['pmean', [C, 2]],
    ['cohensD', [C, [1, 2, 4]]],
    ['wassersteinDistance', [C, [1, 2, 4]]],
    ['ewma', [C, 0.5]],
    ['acf', [C, 1]],
    ['theilSen', [C, [1, 2, 4]]],
    ['detrend', [C]],
  ];
  for (const [name, args] of cases) {
    it(`${name} with Complex data throws a TypeError that names ${name}`, () => {
      expect(() => fn(name)(...args)).toThrow(new RegExp(`^${name}: expects number data`));
    });
  }
});

describe('#1042 error messages name the public function', () => {
  const C = exact.Complex;
  for (const name of [
    'spearman',
    'spearmanr',
    'kendallTau',
    'kendalltau',
    'kendallTauTest',
    'pearsonr',
    'jarqueBera',
  ]) {
    it(name, () => {
      const args = name === 'jarqueBera' ? [C] : [C, [1, 2, 4]];
      expect(() => fn(name)(...args)).toThrow(new RegExp(`^${name}: expects number data`));
    });
  }
  it('corrcoef and the matrix form of cov name the row', () => {
    const m = [
      [1, 2],
      [3, new Fraction(1, 2) as unknown as number],
      [5, 7],
    ];
    expect(() => f.corrcoef(m)).toThrow(
      /^corrcoef row 1: expects number data, got a Fraction at index 1/
    );
    expect(() => f.cov(m)).toThrow(/^cov row 1: expects number data/);
  });
});

describe('#1042 edge inputs', () => {
  it('clamp rejects exact bounds', () => {
    const c = new Complex(3, 4) as unknown as number;
    expect(() => f.clamp(1, c, 10)).toThrow(TypeError);
    expect(() => f.clamp([0, 1, 2], 0, c)).toThrow(TypeError);
  });

  it('a BigInt typed array is not number data', () => {
    expect(() => f.ptp(new BigInt64Array([1n, 5n]) as unknown as number[])).toThrow(
      /^ptp: expects number data, got a BigInt64Array/
    );
    expect(() => f.cumprod(new BigUint64Array([1n]) as unknown as number[])).toThrow(TypeError);
  });

  it('iqr keeps the exact path of quantileSeq and its nested input', () => {
    expect(
      f.iqr([
        [1, 2],
        [3, 4],
      ] as unknown as number[])
    ).toBe(f.iqr([1, 2, 3, 4]));
    expect(f.iqr(exact.BigNumber as unknown as number[])).toBe(f.iqr([1, 3, 4]));
  });

  it('the check does not change the input array', () => {
    const x = [3, 1, 2];
    f.trimmedMean(x, 0.1);
    f.ptp(x);
    f.describe(x);
    expect(x).toEqual([3, 1, 2]);
  });
});

describe('#1042 number data keeps its result', () => {
  it('number arrays and Float64Array give the same values as before', () => {
    expect(f.cumprod([1, 2, 3])).toEqual([1, 2, 6]);
    expect(f.cumprod(new Float64Array([1, 2, 3]))).toEqual([1, 2, 6]);
    expect(f.fsum([1e16, 1, -1e16])).toBe(1);
    expect(f.ptp([3, -1, 4])).toBe(5);
    expect(f.gmean([1, 4])).toBeCloseTo(2, 14);
    expect(f.hmean([1, 4])).toBeCloseTo(1.6, 14);
    expect(f.trapz([1, 2, 3])).toBe(4);
    expect(f.trapz([1, 2, 3], [0, 1, 2])).toBe(4);
    expect(f.clamp(5, 0, 1)).toBe(1);
    expect(f.clamp([5, -5], 0, 1)).toEqual([1, 0]);
    expect(f.sigmoid(0)).toBe(0.5);
    expect(f.spearman([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 14);
    expect(f.cov([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it('NaN is number data', () => {
    expect(f.cumprod([NaN])).toEqual([NaN]);
  });
});
