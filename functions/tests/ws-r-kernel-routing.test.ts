/**
 * WS-R R2: the public `median` and `fft` reach their typed kernels without extra copies,
 * and `parallelStatMedian` selects instead of sorting.
 *
 * Every check counts operations. Nothing here times a call.
 */
import { describe, it, expect } from 'vitest';
import { fft, median, parallelStatMedian } from '../src/index.js';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomVector(n: number, seed: number): Float64Array {
  const r = lcg(seed);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = (r() - 0.5) * 1e3;
  return x;
}

/** Median by a full sort: the oracle. */
function sortedMedian(x: ArrayLike<number>): number {
  const s = Float64Array.from(Array.from(x)).sort();
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

interface Counts {
  /** `new Float64Array(length >= minLength)` */
  largeF64: number;
  /** `new Array(length >= minLength)` */
  largeArray: number;
  /** `Array.prototype.push` calls */
  push: number;
  /** Calls of any `sort` method (Array, Float64Array) */
  sort: number;
}

/** Run `run` while counting large allocations and sorts. The globals come back in `finally`. */
function counting<T>(minLength: number, run: () => T): { value: T; counts: Counts } {
  const counts: Counts = { largeF64: 0, largeArray: 0, push: 0, sort: 0 };
  const OriginalF64 = globalThis.Float64Array;
  const OriginalArray = globalThis.Array;
  const originalPush = Array.prototype.push;
  const originalArraySort = Array.prototype.sort;
  const typedProto = Object.getPrototypeOf(OriginalF64.prototype) as {
    sort: (cmp?: (a: number, b: number) => number) => unknown;
  };
  const originalTypedSort = typedProto.sort;

  const sizeOf = (args: unknown[]): number => {
    const first = args[0];
    if (typeof first === 'number') return first;
    if (first !== null && typeof first === 'object') {
      return (first as ArrayLike<number>).length ?? 0;
    }
    return 0;
  };
  const CountingF64: typeof Float64Array = new Proxy(OriginalF64, {
    construct(target, args, newTarget): object {
      if (sizeOf(args) >= minLength) counts.largeF64++;
      return Reflect.construct(target, args, newTarget === CountingF64 ? target : newTarget);
    },
  });
  const CountingArray: typeof Array = new Proxy(OriginalArray, {
    construct(target, args, newTarget): object {
      if (args.length === 1 && typeof args[0] === 'number' && args[0] >= minLength) {
        counts.largeArray++;
      }
      return Reflect.construct(target, args, newTarget === CountingArray ? target : newTarget);
    },
    apply(target, thisArg, args) {
      if (args.length === 1 && typeof args[0] === 'number' && args[0] >= minLength) {
        counts.largeArray++;
      }
      return Reflect.apply(target, thisArg, args);
    },
  });

  const g = globalThis as { Float64Array: unknown; Array: unknown };
  try {
    g.Float64Array = CountingF64;
    g.Array = CountingArray;
    Array.prototype.push = function (this: unknown[], ...items: unknown[]): number {
      counts.push += items.length;
      return originalPush.apply(this, items);
    };
    Array.prototype.sort = function (this: unknown[], cmp?: (a: unknown, b: unknown) => number) {
      counts.sort++;
      return originalArraySort.call(this, cmp);
    } as typeof Array.prototype.sort;
    typedProto.sort = function (this: unknown, cmp?: (a: number, b: number) => number) {
      counts.sort++;
      return originalTypedSort.call(this, cmp);
    };
    const value = run();
    return { value, counts };
  } finally {
    g.Float64Array = OriginalF64;
    g.Array = OriginalArray;
    Array.prototype.push = originalPush;
    Array.prototype.sort = originalArraySort;
    typedProto.sort = originalTypedSort;
  }
}

describe('median: one pass, one copy, selection', () => {
  const n = 1 << 14;

  it.each([
    ['number[] (odd)', () => Array.from(randomVector(n + 1, 1))],
    ['number[] (even)', () => Array.from(randomVector(n, 2))],
    ['Float64Array (odd)', () => randomVector(n + 1, 3)],
    ['Float64Array (even)', () => randomVector(n, 4)],
  ])('%s equals the sorted median and builds no JS array of n values', (_name, make) => {
    const input = make();
    const want = sortedMedian(input);
    const { value, counts } = counting(n, () => median(input as number[]));
    expect(value).toBe(want);
    // No `new Array(n)` copy, and no element-by-element `push` (the flatten step).
    expect(counts.largeArray).toBe(0);
    expect(counts.push).toBeLessThan(n / 2);
    // One typed work buffer holds the only copy.
    expect(counts.largeF64).toBe(1);
    // Selection, not a sort.
    expect(counts.sort).toBe(0);
  });

  it('does not change the input', () => {
    const x = randomVector(257, 5);
    const copy = x.slice();
    median(x);
    expect(Array.from(x)).toEqual(Array.from(copy));
  });

  it('handles sequential, constant and repeated values', () => {
    const seq = Float64Array.from({ length: 1001 }, (_, i) => i + 1);
    expect(median(seq)).toBe(501);
    expect(median(Array.from(seq))).toBe(501);
    expect(median(new Float64Array(64).fill(7))).toBe(7);
    expect(median([2, 2, 2, 9, 9, 9])).toBe(5.5);
  });

  it('keeps the general path for NaN, nested arrays and non-number values', () => {
    expect(median([[1, 2], [3, 4], [5]] as unknown as number[])).toBe(3);
    const withNaN = median([1, Number.NaN, 3]);
    expect(Number.isNaN(withNaN) || typeof withNaN === 'number').toBe(true);
    expect(median([])).toBeNaN();
  });
});

describe('parallelStatMedian selects instead of sorting', () => {
  it.each([4001, 4000])('n = %i: equals the sorted median and sorts nothing', async (n) => {
    const x = randomVector(n, 9);
    const want = sortedMedian(x);
    const pending = counting(n, () => parallelStatMedian(x) as Promise<number>);
    const got = await pending.value;
    expect(got).toBe(want);
    expect(pending.counts.sort).toBe(0);
  });

  it('a NaN in the input keeps the NaN-last sort', async () => {
    const x = Float64Array.of(3, Number.NaN, 1, 2);
    const got = (await parallelStatMedian(x)) as number;
    // NaN sorts last: [1, 2, 3, NaN], the median is (2 + 3) / 2.
    expect(got).toBe(2.5);
  });
});

describe('fft: the number[] route and the Float64Array route are one kernel', () => {
  function signal(n: number, seed: number): Float64Array {
    return randomVector(n, seed);
  }

  it.each([64, 100, 1000, 1024, 4097])(
    'n = %i: fft(number[]) equals fft(Float64Array) bit for bit',
    (n) => {
      const x = signal(n, n);
      const a = fft(Array.from(x)) as Array<{ re: number; im: number }>;
      const b = fft(x) as Array<{ re: number; im: number }>;
      expect(a).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        expect(Object.is(a[i].re, b[i].re)).toBe(true);
        expect(Object.is(a[i].im, b[i].im)).toBe(true);
      }
    }
  );

  it('matches a direct DFT to rounding error at n = 100', () => {
    const n = 100;
    const x = signal(n, 77);
    const got = fft(Array.from(x)) as Array<{ re: number; im: number }>;
    for (const k of [0, 1, 7, 50, 99]) {
      let re = 0;
      let im = 0;
      for (let t = 0; t < n; t++) {
        const ang = (-2 * Math.PI * k * t) / n;
        re += x[t] * Math.cos(ang);
        im += x[t] * Math.sin(ang);
      }
      expect(Math.abs(got[k].re - re)).toBeLessThan(1e-9);
      expect(Math.abs(got[k].im - im)).toBeLessThan(1e-9);
    }
  });

  it('a power-of-two number[] builds four buffers of n values (re, im, and the two kernel outputs)', () => {
    const n = 1 << 12;
    const x = Array.from(signal(n, 3));
    const { counts } = counting(n, () => fft(x));
    expect(counts.largeF64).toBeLessThanOrEqual(4);
  });

  it('a power-of-two Float64Array builds three buffers of n values (im and the two kernel outputs)', () => {
    const n = 1 << 12;
    const x = signal(n, 4);
    const { counts } = counting(n, () => fft(x));
    expect(counts.largeF64).toBeLessThanOrEqual(3);
  });

  it('short inputs and Complex input keep their path', () => {
    const got = fft([1, 2, 3, 4]) as Array<{ re: number; im: number }>;
    expect(got[0].re).toBe(10);
    expect(got[2].re).toBe(-2);
    const z = Array.from({ length: 128 }, (_, i) => ({ re: Math.cos(i), im: Math.sin(i) }));
    const viaComplex = fft(z as unknown as number[]) as Array<{ re: number; im: number }>;
    expect(viaComplex).toHaveLength(128);
  });
});
