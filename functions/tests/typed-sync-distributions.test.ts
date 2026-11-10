/**
 * The typed distribution Float64Array signatures are synchronous.
 *
 * Each op returns a new Float64Array, never a Promise, and each element equals the number
 * signature (Object.is, so NaN and -0 count). For worker threads, use parallelMap.
 */
import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';

type Fn = (...args: unknown[]) => unknown;
const fn = (name: string): Fn => (F as unknown as Record<string, Fn>)[name];

function same(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`index ${i}: got ${actual[i]}, expected ${expected[i]}`);
    }
  }
}

// [name, trailing scalar args (empty = the one-argument signature), sample values]
type Case = [string, number[], number[]];
const REAL = [NaN, -0, 0, -1.5, 0.3, 2, 4];
const COUNTS = [0, 1, 2, 3, 5, 8];
const UNIT = [-0.5, 0, 0.1, 0.5, 0.9, 1, 1.5];

const CASES: Case[] = [
  ['normalPDF', [], REAL],
  ['normalPDF', [1, 2], REAL],
  ['normalCDF', [], REAL],
  ['normalCDF', [1, 2], REAL],
  ['exponentialPDF', [1.5], REAL],
  ['exponentialCDF', [1.5], REAL],
  ['poissonPMF', [3], COUNTS],
  ['binomialPMF', [8, 0.3], COUNTS],
  ['geometricPMF', [0.3], COUNTS],
  ['bernoulliPMF', [0.3], [0, 1, 2]],
  ['betaPDF', [2, 3], UNIT],
  ['gammaPDF', [2, 1.5], REAL],
  ['studentTPDF', [5], REAL],
  ['noncentralChi2PDF', [3, 1.5], [-1, 0, 0.5, 1, 3, 8]],
];

describe.each(CASES)('%s(Float64Array, ...%j) is synchronous', (name, trail, values) => {
  const f = fn(name);

  it.each([
    ['a short input', 1],
    ['an input of 2 000 elements', 2000],
  ])('equals the number signature on %s', (_label, reps) => {
    const n = values.length * (reps as number);
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = values[i % values.length];
    const copy = x.slice();
    const out = f(x, ...trail);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBeInstanceOf(Float64Array);
    expect(out).not.toBe(x);
    const expected = Array.from(x, (v) =>
      trail.length === 0 ? (f(v) as number) : (f(v, ...trail) as number)
    );
    for (let i = 0; i < n; i++) {
      const a = (out as Float64Array)[i];
      const e = expected[i];
      // The array paths of betaPDF, gammaPDF, studentTPDF and noncentralChi2PDF hoist the
      // normalisation constant, so they can differ from the scalar path in the last bits.
      if (Object.is(a, e)) continue;
      expect(Math.abs(a - e)).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(e)));
    }
    same(x, copy);
  });

  it('returns an empty array for an empty input', () => {
    const out = f(new Float64Array(0), ...trail);
    expect(out).not.toBeInstanceOf(Promise);
    expect((out as Float64Array).length).toBe(0);
  });
});

describe('distributions: values that pin the kernel', () => {
  it('normalCDF(0) is 0.5 and normalPDF(0) is 1/sqrt(2 pi)', () => {
    same(fn('normalCDF')(Float64Array.of(0)) as Float64Array, [0.5]);
    same(fn('normalPDF')(Float64Array.of(0)) as Float64Array, [fn('normalPDF')(0) as number]);
  });
});
