/**
 * The twiddle table of the radix-2 cores (#947).
 *
 * Two copies of the core exist: `functions/src/signal/fft-core-f64.ts` and
 * `packages/workerpool/src/fft-core.ts`. The workerpool package is published without the
 * functions package, so the two cannot share code. These tests pin the copies to the same
 * bits, and pin the per-size cache so that the order of earlier calls changes no result.
 */
import { describe, expect, it } from 'vitest';
import { fftCoreFloat64 } from '../src/signal/fft-core-f64.js';
import { fftFrameInPlace } from '../../packages/workerpool/src/fft-core.js';

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

function run(n: number, inverse: boolean): { real: Float64Array; imag: Float64Array } {
  return fftCoreFloat64(series(n, 7), series(n, 11), inverse);
}

describe('twiddle table cache (#947)', () => {
  it('gives the same bits for a size whatever sizes ran before it', () => {
    const target = 256;
    const first = run(target, false);
    // 10 other sizes pass the cache limit of 8, so the size 256 table is evicted and rebuilt.
    for (const n of [2, 4, 8, 16, 32, 64, 128, 512, 1024, 2048]) run(n, false);
    const rebuilt = run(target, false);
    for (const n of [2048, 1024, 512]) run(n, true);
    const again = run(target, false);
    expect(bitsOf(rebuilt.real)).toBe(bitsOf(first.real));
    expect(bitsOf(rebuilt.imag)).toBe(bitsOf(first.imag));
    expect(bitsOf(again.real)).toBe(bitsOf(first.real));
    expect(bitsOf(again.imag)).toBe(bitsOf(first.imag));
  });
});

describe('functions core and workerpool copy are bit-equal (#947)', () => {
  for (const n of [2, 8, 1024, 4096]) {
    for (const inverse of [false, true]) {
      it(`n = ${n}, inverse = ${inverse}`, () => {
        const re = series(n, 7);
        const im = series(n, 11);
        const fromFunctions = fftCoreFloat64(re, im, inverse);
        const real = Float64Array.from(re);
        const imag = Float64Array.from(im);
        fftFrameInPlace(real, imag, 0, n, inverse);
        expect(bitsOf(real)).toBe(bitsOf(fromFunctions.real));
        expect(bitsOf(imag)).toBe(bitsOf(fromFunctions.imag));
      });
    }
  }
});
