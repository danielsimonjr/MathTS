/**
 * #1001: multinomial is exact for every result that fits a double, and returns
 * Infinity in bounded time for every result that does not.
 *
 * Expected values come from mathjs 15.2.0 where mathjs is finite, and from a BigInt
 * oracle where mathjs returns NaN. A synchronous hang cannot fail a vitest timeout,
 * so each timed case measures the elapsed time and asserts it is below 100 ms.
 */
import { describe, it, expect } from 'vitest';
import { multinomial } from '../src/typed/probability.js';

const BUDGET_MS = 100;

const timed = (fn: () => unknown): { value: unknown; ms: number } => {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
};

const bigFactorial = (n: number): bigint => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
};

/** Exact multinomial of a small input, via factorials. */
const bigMultinomial = (parts: number[]): bigint => {
  const total = parts.reduce((s, a) => s + a, 0);
  let denom = 1n;
  for (const a of parts) denom *= bigFactorial(a);
  return bigFactorial(total) / denom;
};

describe('multinomial exact values (mathjs 15.2.0 is finite)', () => {
  it('matches mathjs for small and moderate inputs', () => {
    expect(multinomial([2, 3, 4])).toBe(1260);
    expect(multinomial([1, 2, 1])).toBe(12);
    expect(multinomial([20, 20])).toBe(137846528820);
    expect(multinomial([2.0, 3])).toBe(10);
    expect(
      multinomial([
        [1, 2],
        [3, 4],
      ])
    ).toBe(12600);
  });

  it('is 1 for the empty array, as in mathjs', () => {
    expect(multinomial([])).toBe(1);
  });

  it('is exact for [1,1e7] in bounded time', () => {
    const a = timed(() => multinomial([1, 1e7]));
    expect(a.value).toBe(10000001);
    expect(a.ms).toBeLessThan(BUDGET_MS);
  });

  it('is exact for a large sum with a small result (1e9, hangs on main)', () => {
    const b = timed(() => multinomial([1, 1e9]));
    expect(b.value).toBe(1000000001);
    expect(b.ms).toBeLessThan(BUDGET_MS);
  });

  it('is exact for [1e17, 2] in bounded time (hangs on main)', () => {
    const n = 100000000000000002n;
    const oracle = Number((n * (n - 1n)) / 2n);
    const c = timed(() => multinomial([1e17, 2]));
    expect(c.value).toBe(oracle);
    expect(c.ms).toBeLessThan(BUDGET_MS);
  });
});

describe('multinomial BigInt values (mathjs returns NaN above 170!)', () => {
  it('[100,100] is the correctly rounded BigInt value', () => {
    expect(multinomial([100, 100])).toBe(Number(bigMultinomial([100, 100])));
  });

  it('[3,5,7,11] is the correctly rounded BigInt value', () => {
    expect(multinomial([3, 5, 7, 11])).toBe(Number(bigMultinomial([3, 5, 7, 11])));
  });
});

describe('multinomial of one entry of any size', () => {
  it('[1e300] is 1 (the only arrangement), not Infinity (hangs on main)', () => {
    const r = timed(() => multinomial([1e300]));
    expect(r.value).toBe(1);
    expect(r.ms).toBeLessThan(BUDGET_MS);
  });
});

describe('multinomial overflow returns Infinity in bounded time', () => {
  it('[1e7,1e7] is Infinity in bounded time', () => {
    const r = timed(() => multinomial([1e7, 1e7]));
    expect(r.value).toBe(Infinity);
    expect(r.ms).toBeLessThan(BUDGET_MS);
  });

  it('[1e300,1e300] is Infinity in bounded time (hangs on main)', () => {
    const r = timed(() => multinomial([1e300, 1e300]));
    expect(r.value).toBe(Infinity);
    expect(r.ms).toBeLessThan(BUDGET_MS);
  });

  it('[1e308,1e308] is Infinity when the sum overflows a double (hangs on main)', () => {
    const r = timed(() => multinomial([1e308, 1e308]));
    expect(r.value).toBe(Infinity);
    expect(r.ms).toBeLessThan(BUDGET_MS);
  });

  it('[1e9,1e9] is Infinity in bounded time (hangs on main)', () => {
    const r = timed(() => multinomial([1e9, 1e9]));
    expect(r.value).toBe(Infinity);
    expect(r.ms).toBeLessThan(BUDGET_MS);
  });
});

describe('multinomial rejects entries that are not positive integers, as mathjs does', () => {
  const msg = 'Positive integer value expected in function multinomial';

  it('throws for zero, negative, fraction, NaN and Infinity entries', () => {
    expect(() => multinomial([0, 1])).toThrow(TypeError);
    expect(() => multinomial([-1, 2])).toThrow(TypeError);
    expect(() => multinomial([1.5, 1])).toThrow(TypeError);
    expect(() => multinomial([NaN, 1])).toThrow(TypeError);
    expect(() => multinomial([Infinity, 1])).toThrow(TypeError);
  });

  it('throws even when an earlier entry would overflow (hangs on main)', () => {
    expect(() => multinomial([1e9, 0])).toThrow(TypeError);
    expect(() => multinomial([1e9, 1.5])).toThrow(TypeError);
    expect(() => multinomial([1e308, 1e308, 0])).toThrow(TypeError);
  });

  it('uses the mathjs message', () => {
    expect(() => multinomial([0, 1])).toThrow(msg);
  });
});
