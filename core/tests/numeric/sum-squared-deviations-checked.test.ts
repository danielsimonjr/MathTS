/**
 * `sumSquaredDeviationsChecked` is `sumSquaredDeviations` with a number check in its loops (#1039).
 *
 * It returns the exact bits of `sumSquaredDeviations` when every element is a number, and
 * `undefined` when any element is not a number. The check sits inside the loop that tests each
 * element for finiteness, so a caller pays no separate pass over the data.
 */
import { describe, expect, it } from 'vitest';
import { Fraction, sumSquaredDeviations, sumSquaredDeviationsChecked } from '../../src/index.js';

/** A deterministic number array of length n with values of mixed magnitude. */
function data(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 10 ** ((i % 7) - 3));
}

/** The IEEE-754 bits of a double, as 16 hex digits. */
function bits(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

describe('both kernels keep the bits of the kernel before #1039', () => {
  // Literals computed with `sumSquaredDeviations` at commit 77c84ef4, before the kernel was
  // shared. The two functions now share one loop, so comparing the functions with each other cannot see
  // a change to that loop; these literals can.
  const offset = Array.from({ length: 37 }, (_, i) => 1e9 + 0.1 * i);
  const wave = Array.from({ length: 300 }, (_, i) => Math.sin(i) * 1e-3 + 42.5);

  it('a large offset and a long wave give the recorded bits', () => {
    for (const fn of [sumSquaredDeviations, sumSquaredDeviationsChecked]) {
      expect(bits(fn(offset) as number)).toBe('4045170a3cc28f62');
      expect(bits(fn(wave) as number)).toBe('3f2397ed67db9bdc');
    }
  });

  it('an Infinity or a NaN element gives NaN', () => {
    for (const fn of [sumSquaredDeviations, sumSquaredDeviationsChecked]) {
      expect(fn([1, 2, Infinity, 4])).toBeNaN();
      expect(fn([1, NaN, 3])).toBeNaN();
    }
  });
});

describe('sumSquaredDeviationsChecked', () => {
  it('returns the same bits as sumSquaredDeviations for every length from 0 to 300', () => {
    for (let n = 0; n <= 300; n++) {
      const xs = data(n);
      expect(Object.is(sumSquaredDeviationsChecked(xs), sumSquaredDeviations(xs))).toBe(true);
    }
  });

  it('returns the same bits as sumSquaredDeviations for long arrays', () => {
    for (const n of [1023, 1024, 1025, 65537, 1_000_003]) {
      const xs = data(n);
      expect(Object.is(sumSquaredDeviationsChecked(xs), sumSquaredDeviations(xs))).toBe(true);
    }
  });

  it('keeps NaN, infinities and a large pedestal as sumSquaredDeviations does', () => {
    const cases: number[][] = [
      [1, Number.NaN, 2],
      [1, Number.POSITIVE_INFINITY, 2],
      [1e308, 1e308, 1e308],
      [1e9 + 1, 1e9 + 2, 1e9 + 3.5],
    ];
    for (const xs of cases) {
      expect(Object.is(sumSquaredDeviationsChecked(xs), sumSquaredDeviations(xs))).toBe(true);
    }
  });

  it('returns undefined when any element is not a number, at any position', () => {
    for (const n of [2, 7, 8, 9, 300, 5000]) {
      for (const at of [0, n >> 1, n - 1]) {
        const xs: unknown[] = data(n);
        xs[at] = new Fraction(1, 3);
        expect(sumSquaredDeviationsChecked(xs)).toBeUndefined();
      }
    }
  });

  it('returns undefined after a non-finite number when a later element is not a number', () => {
    expect(sumSquaredDeviationsChecked([Number.NaN, 1, '2'])).toBeUndefined();
    expect(sumSquaredDeviationsChecked([Number.POSITIVE_INFINITY, 1, 2n])).toBeUndefined();
  });

  it('returns undefined for a string, a bigint, a boolean, a nested array and a hole', () => {
    expect(sumSquaredDeviationsChecked([1, '2'])).toBeUndefined();
    expect(sumSquaredDeviationsChecked([1, 2n])).toBeUndefined();
    expect(sumSquaredDeviationsChecked([1, true])).toBeUndefined();
    expect(sumSquaredDeviationsChecked([1, [2]])).toBeUndefined();
    // eslint-disable-next-line no-sparse-arrays -- a hole is the input under test
    expect(sumSquaredDeviationsChecked([1, , 3])).toBeUndefined();
  });

  it('returns undefined for one element that is not a number', () => {
    expect(sumSquaredDeviationsChecked([new Fraction(1, 3)])).toBeUndefined();
    expect(sumSquaredDeviationsChecked(['5'])).toBeUndefined();
  });

  it('returns 0 for an empty array and for one number', () => {
    expect(sumSquaredDeviationsChecked([])).toBe(0);
    expect(sumSquaredDeviationsChecked([4.5])).toBe(0);
  });
});
