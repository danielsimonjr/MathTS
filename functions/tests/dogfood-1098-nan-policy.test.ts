import { describe, it, expect } from 'vitest';
import { quantileSeq } from '../src/factories/index.js';
import { bignumber } from '../src/factories/index.js';
import { ptp, histogram, iqr, describe as describeStats } from '../src/descriptive-stats.js';

const B = bignumber as (x: number) => unknown;
const num = (v: unknown): unknown => (Array.isArray(v) ? v.map(num) : Number(v));

const q = quantileSeq as (...a: unknown[]) => unknown;

describe('quantileSeq NaN and Infinity policy (#1098)', () => {
  it('propagates NaN wherever it sits', () => {
    expect(q([1, NaN, 2, 3], 0.75)).toBeNaN();
    expect(q([NaN, 1, 2, 3], 0.75)).toBeNaN();
    expect(q([1, 2, 3, NaN], 0.25)).toBeNaN();
    expect(q([1, NaN, 2, 3], 0.5, 'nearest')).toBeNaN();
    expect(q([1, NaN, 2, 3], 0.5, { method: 'lower' })).toBeNaN();
    expect(q([1, NaN, 2, 3], 1)).toBeNaN();
    expect(q(new Float64Array([1, NaN, 2, 3]), 0.75)).toBeNaN();
  });

  it('propagates NaN in the array-of-probabilities and N forms', () => {
    expect(q([1, NaN, 2, 3], [0.25, 0.75])).toEqual([NaN, NaN]);
    expect(q([1, NaN, 2, 3], 3)).toEqual([NaN, NaN, NaN]);
  });

  it('skips NaN with skipNaN or skipna and keeps Infinity', () => {
    expect(q([1, NaN, 2, 3], 0.75, { skipNaN: true })).toBe(2.5);
    expect(q([1, NaN, 2, 3], 0.75, { skipna: true })).toBe(2.5);
    expect(q([NaN, 1, 2, 3], [0.25, 0.75], { skipNaN: true })).toEqual([1.5, 2.5]);
    expect(q([1, NaN, 2, 3], 0.5, { skipNaN: true, method: 'lower' })).toBe(2);
    expect(q([NaN, NaN], 0.5, { skipNaN: true })).toBeNaN();
    expect(q([NaN, -Infinity, 1], 0.5, { skipNaN: true })).toBe(-Infinity);
  });

  it('rejects bad skip options', () => {
    expect(() => q([1, 2], 0.5, { skipNaN: 1 })).toThrow(TypeError);
    expect(() => q([1, 2], 0.5, { skipNaN: true, skipna: false })).toThrow(TypeError);
  });

  it('matches NumPy with infinite values, and keeps an infinite end (#1131)', () => {
    expect(q([-Infinity, Infinity, 2, 3], 0.25)).toBe(-Infinity);
    expect(q([-Infinity, Infinity, 2, 3], 0.5)).toBe(2.5);
    expect(q([-Infinity, Infinity, 2, 3], 0.75)).toBe(Infinity);
    // NumPy gives NaN for these three (inf - inf); #1131 returns the end itself.
    expect(q([1, Infinity], 0)).toBe(1);
    expect(q([Infinity, Infinity, 2, 3], 0.75)).toBe(Infinity);
    expect(q([-Infinity, -Infinity], 0.5)).toBe(-Infinity);
  });

  it('keeps finite results', () => {
    expect(q([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(q([3, -1, 5, 7], 0.5)).toBe(4);
  });
});

describe('ptp NaN policy (#1098)', () => {
  it('does not depend on where the NaN is', () => {
    expect(ptp([1, NaN, 2, 3])).toBeNaN();
    expect(ptp([NaN, 1, 2, 3])).toBeNaN();
    expect(ptp([1, 2, 3, NaN])).toBeNaN();
    expect(ptp(new Float64Array([1, NaN, 2]))).toBeNaN();
  });
  it('skips NaN with skipNaN or skipna', () => {
    expect(ptp([1, NaN, 2, 3], { skipNaN: true })).toBe(2);
    expect(ptp([NaN, 1, 2, 3], { skipna: true })).toBe(2);
    expect(ptp([NaN, NaN], { skipNaN: true })).toBeNaN();
    expect(ptp([1, NaN, Infinity], { skipNaN: true })).toBe(Infinity);
  });
  it('handles Infinity as NumPy does', () => {
    expect(ptp([-Infinity, Infinity])).toBe(Infinity);
    expect(ptp([Infinity, Infinity])).toBeNaN();
  });
  it('rejects bad options', () => {
    expect(() => ptp([1, 2], { skipNaN: 'yes' } as never)).toThrow(TypeError);
    expect(() => ptp([1, 2], { skipNaN: true, skipna: false })).toThrow(TypeError);
  });
});

describe('histogram NaN policy (#1098)', () => {
  it('throws on NaN, as np.histogram', () => {
    expect(() => histogram([1, NaN, 2, 3], 3)).toThrow(/NaN/);
    expect(() => histogram([NaN, 1], 2)).toThrow(/NaN/);
  });
  it('skips NaN with skipNaN or skipna', () => {
    for (const o of [{ skipNaN: true }, { skipna: true }]) {
      const r = histogram([1, NaN, 2, 3], 3, o);
      expect(r.counts).toEqual([1, 1, 1]);
      expect(r.edges[0]).toBe(1);
      expect(r.edges[3]).toBe(3);
    }
    expect(() => histogram([NaN], 3, { skipNaN: true })).toThrow(/non-empty/);
  });
  it('throws on Infinity, as np.histogram', () => {
    expect(() => histogram([1, Infinity, 2], 3)).toThrow(/finite/);
    expect(() => histogram([1, -Infinity, 2], 3, { skipNaN: true })).toThrow(/finite/);
  });
  it('keeps the finite result', () => {
    expect(histogram([1, 2, 3], 3).counts).toEqual([1, 1, 1]);
  });
});

describe('iqr NaN policy (#1098, shares quantileSeq)', () => {
  it('propagates and skips NaN', () => {
    expect(iqr([1, NaN, 2, 3])).toBeNaN();
    expect(iqr([1, NaN, 2, 3], { skipNaN: true })).toBe(1);
    expect(iqr([1, NaN, 2, 3], { skipna: true })).toBe(1);
    expect(iqr([1, 2, 3, 4])).toBe(1.5);
  });
});

describe('quantileSeq interpolation edges (#1098)', () => {
  it('keeps signed zero and the fallback for one infinite end', () => {
    expect(Object.is(q([-0, 0], 0.5), 0)).toBe(true);
    expect(q([1, Infinity], 0.5)).toBe(Infinity);
    expect(q([-Infinity, Infinity, 2, 3], 0.75, 'midpoint')).toBe(Infinity);
  });
  it('honours sorted with NaN', () => {
    expect(q([1, 2, 3, NaN], 0.5, true)).toBeNaN();
    expect(q([1, 2, 3, NaN], 0.5, { sorted: true, skipNaN: true })).toBe(2);
  });
  it('gives -Infinity for each method as NumPy', () => {
    const a = [-Infinity, Infinity, 2, 3];
    for (const m of ['lower', 'higher', 'nearest', 'inverted_cdf', 'closest_observation']) {
      expect(q(a, 0, m)).toBe(-Infinity);
    }
    expect(q(a, 0.1, 'midpoint')).toBe(-Infinity);
    expect(q(a, 0.25, 'averaged_inverted_cdf')).toBe(-Infinity);
    expect(q(a, 0.25, 'hazen')).toBe(-Infinity);
    expect(q([-Infinity, 1], 0.75, 'interpolated_inverted_cdf')).toBe(-Infinity);
    for (const m of ['weibull', 'median_unbiased', 'normal_unbiased']) {
      expect(q([-Infinity, 1], 0.5, m)).toBe(-Infinity);
    }
  });
  it('describe q25 agrees', () => {
    expect(describeStats([-Infinity, Infinity, 2, 3]).q25).toBe(-Infinity);
  });
});

describe('quantileSeq NaN policy with BigNumber (#1098)', () => {
  it('honours skipNaN', () => {
    expect(Number(q([1, NaN, 3], B(0.5), { skipNaN: true }))).toBe(2);
    expect(Number(q([B(1), B(NaN), B(3)], 0.5, { skipNaN: true }))).toBe(2);
    expect(q([1, NaN, 2, 3], 3, { skipNaN: true })).toEqual([1.5, 2, 2.5]); // np.nanquantile([1,nan,2,3],[.25,.5,.75])
    expect(num(q([1, NaN, 3], [B(0.5)], { skipNaN: true }))).toEqual([2]);
  });
  it('propagates NaN', () => {
    expect(Number(q([1, 2, 3, NaN], B(0.5), true))).toBeNaN();
    expect(Number(q([B(1), B(2), B(3), B(NaN)], 0.5, { sorted: true }))).toBeNaN();
  });
});

describe('a last argument that is not an object is ignored (#1098)', () => {
  it('keeps the old results', () => {
    expect(
      [
        [1, 2],
        [3, 5],
      ].map(ptp as (x: number[]) => number)
    ).toEqual([1, 2]);
    expect(
      [
        [1, 2],
        [3, 5],
      ].map(iqr as (x: number[]) => number)
    ).toEqual([0.5, 1]);
    expect(ptp([1, 2], null as never)).toBe(1);
    expect(iqr([1, 2, 3, 4], 1 as never)).toBe(1.5);
    expect(histogram([1, 2, 3], 3, null as never).counts).toEqual([1, 1, 1]);
  });
});

describe('ptp and histogram edges (#1098)', () => {
  it('ptp', () => {
    expect(ptp([5])).toBe(0);
    expect(ptp([NaN, 5], { skipNaN: true })).toBe(0);
    expect(ptp([1, NaN, Infinity])).toBeNaN();
  });
  it('histogram with a Float64Array', () => {
    expect(() => histogram(new Float64Array([1, NaN, 2, 3]), 3)).toThrow();
    expect(histogram(new Float64Array([1, NaN, 2, 3]), 3, { skipNaN: true }).counts).toEqual([
      1, 1, 1,
    ]);
  });
});
