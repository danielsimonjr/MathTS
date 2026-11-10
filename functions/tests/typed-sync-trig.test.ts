/**
 * The typed trigonometry Float64Array signatures are synchronous.
 *
 * Each op returns a new Float64Array, never a Promise. The tests compare each element with
 * Object.is, so NaN and -0 count. For worker threads, use parallelMap.
 */
import { describe, it, expect } from 'vitest';
import {
  sin,
  cos,
  tan,
  csc,
  sec,
  cot,
  asin,
  acos,
  atan,
  asinh,
  acosh,
  atanh,
} from '../src/index.js';

type U = (a: Float64Array) => unknown;

function same(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`index ${i}: got ${actual[i]}, expected ${expected[i]}`);
    }
  }
}

// NaN, -0, 0, a large value, values outside the real domain of asin/acos/acosh/atanh.
const INPUT = Float64Array.of(NaN, -0, 0, 0.5, -0.75, 1, -1, 2, -3, 1e300, -1e300, Infinity);

const TRIG: Array<[string, U, (x: number) => number]> = [
  ['sin', sin as U, Math.sin],
  ['cos', cos as U, Math.cos],
  ['tan', tan as U, Math.tan],
  ['csc', csc as U, (x) => 1 / Math.sin(x)],
  ['sec', sec as U, (x) => 1 / Math.cos(x)],
  ['cot', cot as U, (x) => 1 / Math.tan(x)],
  ['asin', asin as U, Math.asin],
  ['acos', acos as U, Math.acos],
  ['atan', atan as U, Math.atan],
  ['asinh', asinh as U, Math.asinh],
  ['acosh', acosh as U, Math.acosh],
  ['atanh', atanh as U, Math.atanh],
];

describe.each(TRIG)('%s(Float64Array) is synchronous', (_name, f, js) => {
  it('returns a fresh Float64Array equal to Math.* element by element', () => {
    const a = INPUT.slice();
    const out = f(a);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBeInstanceOf(Float64Array);
    expect(out).not.toBe(a);
    same(out as Float64Array, Array.from(INPUT, js));
    same(a, INPUT);
  });

  it('returns an empty array for an empty input', () => {
    const out = f(new Float64Array(0));
    expect(out).toBeInstanceOf(Float64Array);
    expect((out as Float64Array).length).toBe(0);
  });
});

describe('trigonometry: one value per op', () => {
  it('sin(0) is 0 and cos(0) is 1 (a sin/cos swap fails here)', () => {
    same(sin(Float64Array.of(0, -0)) as Float64Array, [0, -0]);
    same(cos(Float64Array.of(0, -0)) as Float64Array, [1, 1]);
  });

  it('asin(2) and acosh(0.5) are NaN in the Float64Array path (no Complex)', () => {
    expect(Object.is((asin(Float64Array.of(2)) as Float64Array)[0], NaN)).toBe(true);
    expect(Object.is((acosh(Float64Array.of(0.5)) as Float64Array)[0], NaN)).toBe(true);
  });

  it('gives Math.* values above the old worker threshold (60 000 elements)', () => {
    const n = 60_000;
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = ((i % 199) - 99) / 100;
    for (const [, f, js] of TRIG) {
      const out = f(a);
      expect(out).not.toBeInstanceOf(Promise);
      same(out as Float64Array, Array.from(a, js));
    }
  });
});
