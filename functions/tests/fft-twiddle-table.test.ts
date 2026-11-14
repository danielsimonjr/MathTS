/**
 * The twiddle table of the radix-2 cores.
 *
 * Two copies of the core exist: `functions/src/signal/fft-core-f64.ts` and
 * `packages/workerpool/src/fft-core.ts`. The workerpool package is published without the
 * functions package, so the two cannot share code. These tests pin the copies to the same
 * bits, bound the round-trip error of each copy, and pin the cache rules of each copy.
 */
import { describe, expect, it } from 'vitest';
import {
  TWIDDLE_CACHE_DEFAULT_MAX_BYTES,
  fftCoreFloat64,
  setTwiddleCacheMaxBytes,
  twiddleCacheState,
} from '../src/signal/fft-core-f64.js';
import {
  TWIDDLE_CACHE_DEFAULT_MAX_BYTES as POOL_DEFAULT_MAX_BYTES,
  fftFrameInPlace,
  setTwiddleCacheMaxBytes as setPoolTwiddleCacheMaxBytes,
  twiddleCacheState as poolTwiddleCacheState,
} from '../../packages/workerpool/src/fft-core.js';

function series(n: number, seed: number): Float64Array {
  let s = seed;
  return Float64Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s / 4294967296) * 2 - 1;
  });
}

function bitsOf(a: Float64Array): string {
  return Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).join(',');
}

/** One unit in the last place of `x`. */
function ulp(x: number): number {
  const magnitude = Math.abs(x);
  return magnitude === 0 ? Number.MIN_VALUE : 2 ** (Math.floor(Math.log2(magnitude)) - 52);
}

/** The seeded series of the g18 round-trip test: 10 times a congruential stream in [-1, 1). */
function g18Series(n: number): Float64Array {
  let seed = 12345;
  return Float64Array.from({ length: n }, () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return ((seed / 4294967296) * 2 - 1) * 10;
  });
}

/** Largest round-trip error over the samples, in ULP of the largest sample. */
function roundTripUlp(x: Float64Array, back: Float64Array): number {
  let worst = 0;
  let largest = 0;
  for (let i = 0; i < x.length; i++) {
    largest = Math.max(largest, Math.abs(x[i]!));
    worst = Math.max(worst, Math.abs(back[i]! - x[i]!));
  }
  return worst / ulp(largest);
}

describe('functions core and workerpool copy are bit-equal', () => {
  // Every power of two from 1 to 2^20. A size above 2^14 takes about a second, so each is a test.
  for (let k = 0; k <= 20; k++) {
    const n = 1 << k;
    it(`n = 2^${k}, both directions`, { timeout: 60_000 }, () => {
      for (const inverse of [false, true]) {
        const re = series(n, 7);
        const im = series(n, 11);
        const fromFunctions = fftCoreFloat64(re, im, inverse);
        const real = Float64Array.from(re);
        const imag = Float64Array.from(im);
        fftFrameInPlace(real, imag, 0, n, inverse);
        expect(bitsOf(real)).toBe(bitsOf(fromFunctions.real));
        expect(bitsOf(imag)).toBe(bitsOf(fromFunctions.imag));
      }
    });
  }
});

describe('round trip stays within 2 log2(n) ULP of the largest sample', () => {
  for (const n of [1024, 4096, 65536]) {
    it(`functions core, n = ${n}`, () => {
      const x = g18Series(n);
      const F = fftCoreFloat64(x, new Float64Array(n), false);
      const back = fftCoreFloat64(F.real, F.imag, true);
      expect(roundTripUlp(x, back.real)).toBeLessThanOrEqual(2 * Math.log2(n));
    });
    it(`workerpool copy, called directly, n = ${n}`, () => {
      const x = g18Series(n);
      const real = Float64Array.from(x);
      const imag = new Float64Array(n);
      fftFrameInPlace(real, imag, 0, n, false);
      fftFrameInPlace(real, imag, 0, n, true);
      expect(roundTripUlp(x, real)).toBeLessThanOrEqual(2 * Math.log2(n));
    });
  }
});

describe('twiddle cache keeps the least recently used tables within a byte cap', () => {
  const copies = [
    {
      name: 'functions core',
      run: (n: number): Float64Array => fftCoreFloat64(series(n, 7), series(n, 11), false).real,
      set: setTwiddleCacheMaxBytes,
      state: twiddleCacheState,
      defaultBytes: TWIDDLE_CACHE_DEFAULT_MAX_BYTES,
    },
    {
      name: 'workerpool copy',
      run: (n: number): Float64Array => {
        const real = series(n, 7);
        fftFrameInPlace(real, series(n, 11), 0, n, false);
        return real;
      },
      set: setPoolTwiddleCacheMaxBytes,
      state: poolTwiddleCacheState,
      defaultBytes: POOL_DEFAULT_MAX_BYTES,
    },
  ];
  for (const c of copies) {
    it(`${c.name}: a hit refreshes the table, and eviction takes the oldest`, () => {
      try {
        c.set(0);
        // A table of n points takes 8n bytes: 8192, 16384 and 4096 fill the cap of 28672.
        c.set(28672);
        for (const n of [1024, 2048, 512]) c.run(n);
        expect(c.state().sizes).toEqual([1024, 2048, 512]);
        c.run(1024);
        expect(c.state().sizes).toEqual([2048, 512, 1024]);
        c.run(256);
        // 2048 is the oldest and frees 16384 bytes. Without the refresh, 1024 would go first.
        expect(c.state().sizes).toEqual([512, 1024, 256]);
        expect(c.state().bytes).toBe(8 * (512 + 1024 + 256));
      } finally {
        c.set(c.defaultBytes);
      }
    });
    it(`${c.name}: a table above the cap is not kept`, () => {
      try {
        c.set(0);
        c.set(8 * 1024);
        c.run(2048);
        expect(c.state()).toEqual({ sizes: [], bytes: 0 });
        c.run(1024);
        expect(c.state()).toEqual({ sizes: [1024], bytes: 8192 });
      } finally {
        c.set(c.defaultBytes);
      }
    });
    it(`${c.name}: a rebuilt table gives the bits of the first build`, () => {
      try {
        c.set(c.defaultBytes);
        const first = c.run(4096);
        for (const n of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) c.run(n);
        c.set(0);
        const rebuilt = c.run(4096);
        expect(bitsOf(rebuilt)).toBe(bitsOf(first));
      } finally {
        c.set(c.defaultBytes);
      }
    });
  }
});
