/**
 * Tests for fft-core.ts — pure radix-2 FFT helper functions.
 *
 * fftBitReverse and fftFrameInPlace are pure (no I/O, no workers),
 * so they are fully unit-testable here.
 */

import { describe, it, expect } from 'vitest';
import { fftBitReverse, fftFrameInPlace } from '../src/fft-core.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-9;

function nearlyEqual(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) < eps;
}

function makeFrames(size: number): { real: Float64Array; imag: Float64Array } {
  return {
    real: new Float64Array(size),
    imag: new Float64Array(size),
  };
}

// Compute a reference DFT (O(n²)) for small n to validate the FFT.
function referenceDFT(
  real: number[],
  imag: number[]
): { real: number[]; imag: number[] } {
  const n = real.length;
  const outRe: number[] = new Array(n).fill(0);
  const outIm: number[] = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const angle = (-2 * Math.PI * k * j) / n;
      outRe[k] += real[j] * Math.cos(angle) - imag[j] * Math.sin(angle);
      outIm[k] += real[j] * Math.sin(angle) + imag[j] * Math.cos(angle);
    }
  }
  return { real: outRe, imag: outIm };
}

// ---------------------------------------------------------------------------
// fftBitReverse
// ---------------------------------------------------------------------------

describe('fftBitReverse', () => {
  it('reverses 0 to 0 for any bit-width', () => {
    expect(fftBitReverse(0, 1)).toBe(0);
    expect(fftBitReverse(0, 3)).toBe(0);
    expect(fftBitReverse(0, 8)).toBe(0);
  });

  it('reverses a single-bit value with 1 bit', () => {
    expect(fftBitReverse(1, 1)).toBe(1);
  });

  it('reverses 2-bit indices correctly (n=4 FFT)', () => {
    // 2-bit reversal: 00→00, 01→10, 10→01, 11→11
    expect(fftBitReverse(0, 2)).toBe(0); // 00 → 00
    expect(fftBitReverse(1, 2)).toBe(2); // 01 → 10
    expect(fftBitReverse(2, 2)).toBe(1); // 10 → 01
    expect(fftBitReverse(3, 2)).toBe(3); // 11 → 11
  });

  it('reverses 3-bit indices correctly (n=8 FFT)', () => {
    // 3-bit reversal: 000→000,001→100,010→010,011→110,100→001,101→101,110→011,111→111
    expect(fftBitReverse(0, 3)).toBe(0); // 000 → 000
    expect(fftBitReverse(1, 3)).toBe(4); // 001 → 100
    expect(fftBitReverse(2, 3)).toBe(2); // 010 → 010
    expect(fftBitReverse(3, 3)).toBe(6); // 011 → 110
    expect(fftBitReverse(4, 3)).toBe(1); // 100 → 001
    expect(fftBitReverse(5, 3)).toBe(5); // 101 → 101
    expect(fftBitReverse(6, 3)).toBe(3); // 110 → 011
    expect(fftBitReverse(7, 3)).toBe(7); // 111 → 111
  });

  it('is its own inverse (applying twice returns original)', () => {
    for (const bits of [1, 2, 3, 4]) {
      const n = 1 << bits;
      for (let i = 0; i < n; i++) {
        expect(fftBitReverse(fftBitReverse(i, bits), bits)).toBe(i);
      }
    }
  });

  it('produces a permutation (all output values are distinct)', () => {
    for (const bits of [2, 3, 4]) {
      const n = 1 << bits;
      const seen = new Set<number>();
      for (let i = 0; i < n; i++) {
        seen.add(fftBitReverse(i, bits));
      }
      expect(seen.size).toBe(n);
    }
  });
});

// ---------------------------------------------------------------------------
// fftFrameInPlace — forward FFT
// ---------------------------------------------------------------------------

describe('fftFrameInPlace (forward)', () => {
  it('transforms a DC impulse (x[0]=1, rest 0) to a flat spectrum', () => {
    const n = 8;
    const { real, imag } = makeFrames(n);
    real[0] = 1;
    fftFrameInPlace(real, imag, 0, n, false);
    // All bins should be 1+0j
    for (let k = 0; k < n; k++) {
      expect(nearlyEqual(real[k], 1)).toBe(true);
      expect(nearlyEqual(imag[k], 0)).toBe(true);
    }
  });

  it('transforms all-zeros to all-zeros', () => {
    const n = 4;
    const { real, imag } = makeFrames(n);
    fftFrameInPlace(real, imag, 0, n, false);
    for (let k = 0; k < n; k++) {
      expect(real[k]).toBe(0);
      expect(imag[k]).toBe(0);
    }
  });

  it('matches reference DFT for n=4 with arbitrary real input', () => {
    const input = [1, 2, 3, 4];
    const ref = referenceDFT(input, [0, 0, 0, 0]);
    const n = 4;
    const { real, imag } = makeFrames(n);
    real.set(input);
    fftFrameInPlace(real, imag, 0, n, false);
    for (let k = 0; k < n; k++) {
      expect(nearlyEqual(real[k], ref.real[k], 1e-9)).toBe(true);
      expect(nearlyEqual(imag[k], ref.imag[k], 1e-9)).toBe(true);
    }
  });

  it('matches reference DFT for n=8 with arbitrary real input', () => {
    const input = [1, -1, 2, 0, 3, -2, 1, 0];
    const ref = referenceDFT(input, new Array(8).fill(0));
    const n = 8;
    const { real, imag } = makeFrames(n);
    real.set(input);
    fftFrameInPlace(real, imag, 0, n, false);
    for (let k = 0; k < n; k++) {
      expect(nearlyEqual(real[k], ref.real[k], 1e-9)).toBe(true);
      expect(nearlyEqual(imag[k], ref.imag[k], 1e-9)).toBe(true);
    }
  });

  it('places a pure cosine (bin 1 of n=8) energy in bin 1 and n-1', () => {
    // x[j] = cos(2π*1*j/8); energy should appear at bins 1 and 7 (n-1)
    const n = 8;
    const { real, imag } = makeFrames(n);
    for (let j = 0; j < n; j++) {
      real[j] = Math.cos((2 * Math.PI * j) / n);
    }
    fftFrameInPlace(real, imag, 0, n, false);
    // Bins 1 and 7 should have magnitude n/2 = 4; all others near 0
    const mag = (k: number) => Math.sqrt(real[k] ** 2 + imag[k] ** 2);
    expect(nearlyEqual(mag(1), n / 2, 1e-9)).toBe(true);
    expect(nearlyEqual(mag(n - 1), n / 2, 1e-9)).toBe(true);
    for (const k of [0, 2, 3, 4, 5, 6]) {
      expect(mag(k)).toBeLessThan(1e-9);
    }
  });

  it('operates on a sub-frame when offset > 0', () => {
    // Place the impulse at index 4 (offset=4, n=4)
    const total = 8;
    const real = new Float64Array(total);
    const imag = new Float64Array(total);
    real[4] = 1; // index 0 within the sub-frame
    fftFrameInPlace(real, imag, 4, 4, false);
    // The first 4 elements should be untouched
    for (let i = 0; i < 4; i++) {
      expect(real[i]).toBe(i === 0 ? 0 : 0);
      expect(imag[i]).toBe(0);
    }
    // The sub-frame bins should all be 1+0j (impulse)
    for (let k = 4; k < 8; k++) {
      expect(nearlyEqual(real[k], 1)).toBe(true);
      expect(nearlyEqual(imag[k], 0)).toBe(true);
    }
  });

  it('handles n=2 (single butterfly)', () => {
    const { real, imag } = makeFrames(2);
    real[0] = 3;
    real[1] = 1;
    // DFT of [3, 1]: X[0] = 4, X[1] = 2
    fftFrameInPlace(real, imag, 0, 2, false);
    expect(nearlyEqual(real[0], 4)).toBe(true);
    expect(nearlyEqual(real[1], 2)).toBe(true);
    expect(nearlyEqual(imag[0], 0)).toBe(true);
    expect(nearlyEqual(imag[1], 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fftFrameInPlace — inverse FFT
// ---------------------------------------------------------------------------

describe('fftFrameInPlace (inverse)', () => {
  it('round-trips: IFFT(FFT(x)) ≈ x', () => {
    const input = [1.0, -2.0, 3.5, 0.5, -1.0, 2.0, 0.0, 4.0];
    const n = input.length;
    const real = new Float64Array(input);
    const imag = new Float64Array(n);

    fftFrameInPlace(real, imag, 0, n, false); // forward
    fftFrameInPlace(real, imag, 0, n, true);  // inverse

    for (let i = 0; i < n; i++) {
      expect(nearlyEqual(real[i], input[i], 1e-9)).toBe(true);
      expect(nearlyEqual(imag[i], 0, 1e-9)).toBe(true);
    }
  });

  it('IFFT of flat spectrum produces a DC impulse', () => {
    // Flat spectrum: X[k] = 1 for all k. IFFT → x[0]=1, rest 0.
    const n = 8;
    const real = new Float64Array(n).fill(1);
    const imag = new Float64Array(n);
    fftFrameInPlace(real, imag, 0, n, true);
    expect(nearlyEqual(real[0], 1)).toBe(true);
    for (let i = 1; i < n; i++) {
      expect(Math.abs(real[i])).toBeLessThan(1e-9);
    }
  });

  it('inverse divides by n (normalization)', () => {
    // IFFT([4,4,4,4]) = [4,0,0,0]:
    // The sum of n equal values (amplitude A) IFFT-normalizes to x[0]=A, rest 0.
    // Normalization divides the butterfly result by n, giving:
    // x[0] = (1/n) * n * A = A = 4.
    const n = 4;
    const real = new Float64Array([4, 4, 4, 4]);
    const imag = new Float64Array(n);
    fftFrameInPlace(real, imag, 0, n, true);
    // After normalization x[0] equals the original amplitude (4), not 1.
    expect(nearlyEqual(real[0], 4)).toBe(true);
    for (let i = 1; i < n; i++) {
      expect(Math.abs(real[i])).toBeLessThan(1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge / property tests
// ---------------------------------------------------------------------------

describe('fftFrameInPlace — Parseval / energy conservation', () => {
  it('preserves signal energy (Parseval): sum|x|² = (1/n)*sum|X|²', () => {
    const n = 8;
    const inputReal = [1, 2, -1, 3, 0, -2, 1, 0];
    const real = new Float64Array(inputReal);
    const imag = new Float64Array(n);

    const timeEnergy = inputReal.reduce((s, x) => s + x * x, 0);

    fftFrameInPlace(real, imag, 0, n, false);

    const freqEnergy =
      Array.from(real).reduce((s, x) => s + x * x, 0) +
      Array.from(imag).reduce((s, x) => s + x * x, 0);

    expect(nearlyEqual(timeEnergy, freqEnergy / n, 1e-9)).toBe(true);
  });
});
