/**
 * Tests for Parallel FFT operations
 *
 * Tests the sequential fallback path since parallel execution requires
 * a worker pool. Validates FFT correctness, auto-padding, and convolution.
 */

import { describe, it, expect } from 'vitest';
import {
  parallelFFT,
  parallelIFFT,
  parallelFFTAuto,
  parallelConvolve,
} from '../../src/operations/fft.js';

// =============================================================================
// parallelFFT (sequential fallback)
// =============================================================================

describe('parallelFFT', () => {
  it('computes FFT of DC signal', async () => {
    const n = 16;
    const real = new Float64Array(n).fill(1.0);
    const imag = new Float64Array(n).fill(0.0);

    const { result, parallelized } = await parallelFFT(real, imag, {
      forceSequential: true,
    });

    expect(parallelized).toBe(false);
    expect(result.real[0]).toBeCloseTo(n);
    expect(result.imag[0]).toBeCloseTo(0.0);
    for (let i = 1; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(0.0, 10);
      expect(result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('computes FFT of impulse', async () => {
    const n = 8;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    real[0] = 1.0;

    const { result } = await parallelFFT(real, imag, { forceSequential: true });

    for (let i = 0; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(1.0, 10);
      expect(result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('detects sine wave peak frequency', async () => {
    const n = 256;
    const freq = 15;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * freq * i) / n);
    }

    const { result } = await parallelFFT(real, imag, { forceSequential: true });

    // Find peak in first half
    let maxIdx = 0;
    let maxVal = 0;
    for (let i = 1; i < n / 2; i++) {
      const mag = Math.sqrt(
        result.real[i] * result.real[i] + result.imag[i] * result.imag[i]
      );
      if (mag > maxVal) {
        maxVal = mag;
        maxIdx = i;
      }
    }

    expect(maxIdx).toBe(freq);
  });

  it('throws for non-power-of-2 length', async () => {
    await expect(
      parallelFFT(new Float64Array(7), new Float64Array(7))
    ).rejects.toThrow('power of 2');
  });

  it('returns parallelized: false when below threshold', async () => {
    const n = 32;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    const { parallelized, chunks } = await parallelFFT(real, imag);
    expect(parallelized).toBe(false);
    expect(chunks).toBe(1);
  });
});

// =============================================================================
// parallelIFFT
// =============================================================================

describe('parallelIFFT', () => {
  it('roundtrips through FFT -> IFFT', async () => {
    const n = 64;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      real[i] =
        Math.sin((2 * Math.PI * 3 * i) / n) +
        0.5 * Math.cos((2 * Math.PI * 11 * i) / n);
    }

    const spectrum = await parallelFFT(real, imag, { forceSequential: true });
    const reconstructed = await parallelIFFT(
      spectrum.result.real,
      spectrum.result.imag,
      { forceSequential: true }
    );

    for (let i = 0; i < n; i++) {
      expect(reconstructed.result.real[i]).toBeCloseTo(real[i], 10);
      expect(reconstructed.result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });
});

// =============================================================================
// parallelFFTAuto (auto-padding)
// =============================================================================

describe('parallelFFTAuto', () => {
  it('handles non-power-of-2 input with zero padding', async () => {
    const data = new Float64Array([1, 2, 3, 4, 5]); // length 5 -> padded to 8

    const { result } = await parallelFFTAuto(data);

    expect(result.originalLength).toBe(5);
    expect(result.real.length).toBe(8); // padded to next power of 2
    expect(result.imag.length).toBe(8);
  });

  it('preserves power-of-2 input unchanged', async () => {
    const data = new Float64Array([1, 2, 3, 4]); // length 4 is power of 2

    const { result } = await parallelFFTAuto(data);

    expect(result.originalLength).toBe(4);
    expect(result.real.length).toBe(4);
  });

  it('handles empty input', async () => {
    const { result } = await parallelFFTAuto(new Float64Array(0));
    expect(result.originalLength).toBe(0);
    expect(result.real.length).toBe(0);
  });

  it('DC signal produces correct spectrum', async () => {
    const n = 10;
    const data = new Float64Array(n).fill(2.0);
    const paddedN = 16; // next power of 2

    const { result } = await parallelFFTAuto(data);

    // DC component = sum of all values (including zero-padded)
    expect(result.real[0]).toBeCloseTo(n * 2.0);
  });
});

// =============================================================================
// parallelConvolve
// =============================================================================

describe('parallelConvolve', () => {
  it('convolves two simple signals', async () => {
    const signal = new Float64Array([1, 2, 3]);
    const kernel = new Float64Array([1, 1]);

    const { result } = await parallelConvolve(signal, kernel, {
      forceSequential: true,
    });

    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(3);
    expect(result[2]).toBeCloseTo(5);
    expect(result[3]).toBeCloseTo(3);
  });

  it('identity convolution with impulse', async () => {
    const signal = new Float64Array([1, 2, 3, 4, 5]);
    const impulse = new Float64Array([1]);

    const { result } = await parallelConvolve(signal, impulse, {
      forceSequential: true,
    });

    expect(result.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(result[i]).toBeCloseTo(signal[i]);
    }
  });

  it('handles empty inputs', async () => {
    const empty = new Float64Array(0);
    const signal = new Float64Array([1, 2, 3]);

    const r1 = await parallelConvolve(empty, signal);
    const r2 = await parallelConvolve(signal, empty);

    expect(r1.result.length).toBe(0);
    expect(r2.result.length).toBe(0);
  });

  it('returns correct metadata', async () => {
    const signal = new Float64Array([1, 2, 3, 4]);
    const kernel = new Float64Array([0.5, 0.5]);

    const { duration, chunks, parallelized } = await parallelConvolve(
      signal,
      kernel,
      { forceSequential: true }
    );

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(chunks).toBeGreaterThanOrEqual(1);
    expect(parallelized).toBe(false);
  });
});
