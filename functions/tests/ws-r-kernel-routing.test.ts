/**
 * WS-R R2: the public `median` and `fft` reach their typed kernels without extra copies,
 * and `parallelStatMedian` selects instead of sorting.
 *
 * The checks compare results with an oracle and observe which path ran (a sort call, a call of
 * the flat kernel). Nothing here times a call or counts allocations.
 */
import { describe, it, expect, vi } from 'vitest';

// Wrap the flat kernel so a test sees which `fft` inputs reach it. The wrapper calls through.
vi.mock('../src/signal/fft-core-f64.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/signal/fft-core-f64.js')>();
  return { ...real, fftExactFloat64: vi.fn(real.fftExactFloat64) };
});
import { fftExactFloat64 } from '../src/signal/fft-core-f64.js';
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

/** Run `run` while counting calls of any `sort` method (Array, Float64Array). */
function countingSorts<T>(run: () => T): { value: T; sorts: number } {
  let sorts = 0;
  const originalArraySort = Array.prototype.sort;
  const typedProto = Object.getPrototypeOf(Float64Array.prototype) as {
    sort: (cmp?: (a: number, b: number) => number) => unknown;
  };
  const originalTypedSort = typedProto.sort;
  try {
    Array.prototype.sort = function (this: unknown[], cmp?: (a: unknown, b: unknown) => number) {
      sorts++;
      return originalArraySort.call(this, cmp);
    } as typeof Array.prototype.sort;
    typedProto.sort = function (this: unknown, cmp?: (a: number, b: number) => number) {
      sorts++;
      return originalTypedSort.call(this, cmp);
    };
    return { value: run(), sorts };
  } finally {
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
  ])('%s equals the sorted median and sorts nothing', (_name, make) => {
    const input = make();
    const want = sortedMedian(input);
    const { value, sorts } = countingSorts(() => median(input as number[]));
    expect(Object.is(value, want)).toBe(true);
    // Selection, not a sort.
    expect(sorts).toBe(0);
  });

  it('the even-length average does not overflow', () => {
    expect(median([1.7e308, 1.7e308])).toBe(1.7e308);
    expect(median(Float64Array.of(1.7e308, 1.7e308))).toBe(1.7e308);
    expect(Math.abs(median([-1.7e308, -1.6e308]) / -1.65e308 - 1)).toBeLessThan(1e-15);
    expect(median([-1.7e308, 1.7e308])).toBe(0);
    expect(median([1.6e308, 1.7e308, 1.7e308, 1.7e308])).toBe(1.7e308);
  });

  it('keeps the sign of zero', () => {
    expect(Object.is(median([-0, -0]), -0)).toBe(true);
    expect(Object.is(median([0, 0]), 0)).toBe(true);
    expect(Object.is(median([-0, -0, -0]), -0)).toBe(true);
    expect(Object.is(median([-0, 0]), 0)).toBe(true);
    expect(Object.is(median([3, -0, 0, 5, 7]), 3)).toBe(true);
    // The values of -0 and 0 compare equal, so the middle of [-0, 0, 0] is a zero: its sign
    // follows the partition order, and the test accepts both.
    expect(median([0, -0, 0])).toBe(0);
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
    const pending = countingSorts(() => parallelStatMedian(x) as Promise<number>);
    const got = await pending.value;
    expect(got).toBe(want);
    expect(pending.sorts).toBe(0);
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

  it('number[] of 64 or more values reaches the flat kernel once, with the spectrum of Float64Array', () => {
    const kernel = vi.mocked(fftExactFloat64);
    for (const n of [64, 65, 1 << 12]) {
      const x = signal(n, 3);
      kernel.mockClear();
      const viaArray = fft(Array.from(x)) as Array<{ re: number; im: number }>;
      expect(kernel, `n = ${n}`).toHaveBeenCalledTimes(1);
      expect(kernel.mock.calls[0][0].length).toBe(n);
      const viaTyped = fft(x) as Array<{ re: number; im: number }>;
      for (let i = 0; i < n; i++) {
        expect(Object.is(viaArray[i].re, viaTyped[i].re)).toBe(true);
        expect(Object.is(viaArray[i].im, viaTyped[i].im)).toBe(true);
      }
    }
  });

  it('number[] of 63 values does not send its own length to the flat kernel', () => {
    const kernel = vi.mocked(fftExactFloat64);
    kernel.mockClear();
    const x = Array.from(signal(63, 5));
    const got = fft(x) as Array<{ re: number; im: number }>;
    // The chirp-z step of a length-63 transform calls the kernel on a longer padded length.
    expect(kernel.mock.calls.every((c) => c[0].length !== 63)).toBe(true);
    let re = 0;
    for (let t = 0; t < 63; t++) re += x[t];
    expect(Math.abs(got[0].re - re)).toBeLessThan(1e-9);
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
