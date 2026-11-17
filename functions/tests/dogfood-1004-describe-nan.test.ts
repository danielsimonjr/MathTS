import { describe as suite, it, expect } from 'vitest';
import { describe } from '../src/descriptive-stats.js';

const KEYS = [
  'min',
  'max',
  'mean',
  'variance',
  'std',
  'q25',
  'q50',
  'q75',
  'skewness',
  'kurtosis',
] as const;

function expectNaNFields(r: Record<string, number>, nobs: number) {
  expect(r.nobs).toBe(nobs);
  for (const k of KEYS) expect(r[k], k).toBeNaN();
}

suite('describe NaN policy (#1004)', () => {
  it('propagates NaN to every field and keeps nobs', () => {
    expectNaNFields(describe([1, NaN, 2, 3]) as never, 4);
    expectNaNFields(describe([NaN, 1, 2, 3]) as never, 4);
    expectNaNFields(describe([1, 2, 3, NaN]) as never, 4);
    expectNaNFields(describe(new Float64Array([1, NaN, 2, 3])) as never, 4);
    expectNaNFields(describe([NaN, NaN]) as never, 2);
  });

  it('skips NaN with skipNaN or skipna', () => {
    for (const o of [{ skipNaN: true }, { skipna: true }]) {
      const r = describe([1, NaN, 2, 3], o);
      expect(r.nobs).toBe(3);
      expect(r.min).toBe(1);
      expect(r.max).toBe(3);
      expect(r.mean).toBe(2);
      expect(r.variance).toBe(1);
      expect(r.std).toBe(1);
      expect(r.q25).toBe(1.5);
      expect(r.q50).toBe(2);
      expect(r.q75).toBe(2.5);
      expect(r.skewness).toBeCloseTo(0, 12);
      expect(r.kurtosis).toBeCloseTo(-1.5, 12);
    }
    expectNaNFields(describe([NaN, NaN], { skipNaN: true }) as never, 0);
  });

  it('keeps Infinity', () => {
    for (const o of [undefined, { skipNaN: true }]) {
      const r = describe([1, Infinity, 2, 3], o);
      expect(r.nobs).toBe(4);
      expect(r.min).toBe(1);
      expect(r.max).toBe(Infinity);
      expect(r.mean).toBe(Infinity);
      expect(r.variance).toBeNaN();
      expect(r.std).toBeNaN();
      expect(r.q25).toBe(1.75);
      expect(r.q50).toBe(2.5);
      expect(r.q75).toBe(Infinity);
      expect(r.skewness).toBeNaN();
      expect(r.kurtosis).toBeNaN();
    }
    const r = describe([-Infinity, Infinity, 2, 3]);
    expect(r.min).toBe(-Infinity);
    expect(r.max).toBe(Infinity);
    expect(r.mean).toBeNaN();
    expect(r.q50).toBe(2.5);
    expect(r.q75).toBe(Infinity);
  });

  it('leaves NaN-free input unchanged', () => {
    const base = describe([1, 2, 3]);
    expect(describe([1, 2, 3], { skipNaN: true })).toEqual(base);
    expect(describe([1, 2, 3], {})).toEqual(base);
  });

  it('throws on empty input', () => {
    expect(() => describe([])).toThrow('describe: input must be non-empty');
    expect(() => describe([], { skipNaN: true })).toThrow('describe: input must be non-empty');
  });

  it('validates options', () => {
    expect(() => describe([1, 2], { skipna: 1 } as never)).toThrow(TypeError);
    expect(() => describe([1, 2], { skipna: 1 } as never)).toThrow('skipna must be a boolean');
    expect(() => describe([1, 2], { skipNaN: true, skipna: false })).toThrow(
      'skipNaN and skipna disagree'
    );
    expect(() => describe([1, 2], { ddof: 1 } as never)).toThrow(TypeError);
    expect(() => describe([1, 2], { ddof: 1 } as never)).toThrow('unknown option "ddof"');
    expect(() => describe([1, 2], null as never)).toThrow('options must be an object');
    expect(() => describe([1, 2], true as never)).toThrow(TypeError);
    expect(() =>
      describe([
        [1, 2],
        [3, 4],
      ] as never)
    ).toThrow(TypeError);
  });
});
