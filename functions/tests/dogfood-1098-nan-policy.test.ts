import { describe, it, expect } from 'vitest';
import { quantileSeq } from '../src/factories/index.js';
import { ptp, histogram, iqr } from '../src/descriptive-stats.js';

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
    expect(q([1, NaN, Infinity], 1, { skipNaN: true })).toBe(Infinity);
  });

  it('rejects bad skip options', () => {
    expect(() => q([1, 2], 0.5, { skipNaN: 1 })).toThrow(TypeError);
    expect(() => q([1, 2], 0.5, { skipNaN: true, skipna: false })).toThrow(TypeError);
  });

  it('matches NumPy with infinite values', () => {
    expect(q([-Infinity, Infinity, 2, 3], 0.25)).toBe(-Infinity);
    expect(q([-Infinity, Infinity, 2, 3], 0.5)).toBe(2.5);
    expect(q([-Infinity, Infinity, 2, 3], 0.75)).toBe(Infinity);
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
