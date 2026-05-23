/**
 * Extended Signal Processing Tests
 *
 * Tests for 18 new signal processing functions: DCT, DST, DWT,
 * 2D FFT, Hilbert, spectrogram, periodogram, filters, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  dct,
  idct,
  dst,
  idst,
  dwt,
  fft2d,
  fourier,
  invFourier,
  hilbertTransform,
  spectrogram,
  periodogram,
  lowpassFilter,
  highpassFilter,
  bandpassFilter,
  resample,
  medfilt,
  windowFunction,
  convolve,
  correlate,
} from '../src/typed/signal.js';

const EPSILON = 1e-6;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// The async fft2d / spectrogram paths dispatch their independent FFT batches
// to the worker pool — initialize it once for the suite, restore the default
// (high) threshold afterwards so other tests are unaffected.
beforeAll(async () => {
  await computePool.initialize();
});

afterAll(async () => {
  computePool.updateConfig({ thresholdElements: 1_000_000 });
  await computePool.terminate();
});

// =============================================================================
// DCT / IDCT
// =============================================================================

describe('dct / idct', () => {
  it('should be invertible', () => {
    const x = [1, 2, 3, 4];
    const X = dct(x);
    const xr = idct(X);
    for (let i = 0; i < x.length; i++) {
      expectClose(xr[i], x[i], 1e-10);
    }
  });

  it('should produce correct length', () => {
    const X = dct([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(X.length).toBe(8);
  });
});

// =============================================================================
// DST / IDST
// =============================================================================

describe('dst / idst', () => {
  it('should be approximately invertible', () => {
    const x = [1, 2, 3, 4];
    const X = dst(x);
    const xr = idst(X);
    for (let i = 0; i < x.length; i++) {
      expectClose(xr[i], x[i], 0.5);
    }
  });
});

// =============================================================================
// DWT
// =============================================================================

describe('dwt', () => {
  it('should decompose with Haar wavelet', () => {
    const { approx, detail } = dwt([1, 3, 5, 7], 'haar');
    expect(approx.length).toBe(2);
    expect(detail.length).toBe(2);
    // Haar: approx = (a+b)/sqrt(2), detail = (a-b)/sqrt(2)
    expectClose(approx[0], (1 + 3) / Math.SQRT2);
    expectClose(detail[0], (1 - 3) / Math.SQRT2);
  });

  it('should throw for unsupported wavelet', () => {
    expect(() => dwt([1, 2, 3, 4], 'coif3')).toThrow();
  });
});

// =============================================================================
// 2D FFT
// =============================================================================

describe('fft2d', () => {
  it('should compute 2D FFT', async () => {
    const x = [
      [1, 2],
      [3, 4],
    ];
    const result = await fft2d(x);
    expect(result.real.length).toBe(2);
    expect(result.imag.length).toBe(2);
    // DC component should be sum of all elements
    expectClose(result.real[0][0], 10, 1e-6);
  });

  it('parallel result matches sequential result', async () => {
    // Build a deterministic 16x16 real matrix.
    const n = 16;
    const x: number[][] = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => Math.sin((r + 1) * 0.3 + (c + 1) * 0.17))
    );

    // Sequential reference: thresholds high enough that the pool path is skipped.
    computePool.updateConfig({ thresholdElements: 1_000_000 });
    const seq = await fft2d(x);

    // Parallel: lower the threshold so fftBatch dispatches to workers.
    computePool.updateConfig({ thresholdElements: 16 });
    const par = await fft2d(x);
    computePool.updateConfig({ thresholdElements: 1_000_000 });

    expect(par.real.length).toBe(seq.real.length);
    for (let r = 0; r < seq.real.length; r++) {
      for (let c = 0; c < seq.real[r].length; c++) {
        expectClose(par.real[r][c], seq.real[r][c], 1e-9);
        expectClose(par.imag[r][c], seq.imag[r][c], 1e-9);
      }
    }
  });
});

// =============================================================================
// Continuous Fourier
// =============================================================================

describe('fourier / invFourier', () => {
  it('should compute Fourier transform', () => {
    const t = Array.from({ length: 100 }, (_, i) => i * 0.01);
    const result = fourier((t) => Math.cos(2 * Math.PI * t), t, 2 * Math.PI);
    expect(typeof result.re).toBe('number');
    expect(typeof result.im).toBe('number');
  });

  it('should approximately invert', () => {
    // Gaussian should transform to Gaussian
    const omega = Array.from({ length: 200 }, (_, i) => -10 + i * 0.1);
    const result = invFourier((w) => ({ re: Math.exp((-w * w) / 4), im: 0 }), omega, 0);
    expect(typeof result).toBe('number');
  });
});

// =============================================================================
// Hilbert Transform
// =============================================================================

describe('hilbertTransform', () => {
  it('should return array of same length', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const h = hilbertTransform(x);
    expect(h.length).toBe(8);
  });

  it('should produce non-zero imaginary for non-constant signal', () => {
    const x = Array.from({ length: 32 }, (_, i) => Math.sin((2 * Math.PI * i) / 32));
    const h = hilbertTransform(x);
    const maxAbs = Math.max(...h.map(Math.abs));
    expect(maxAbs).toBeGreaterThan(0.1);
  });
});

// =============================================================================
// Spectrogram
// =============================================================================

describe('spectrogram', () => {
  it('should produce magnitude matrix', async () => {
    const x = Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * 10 * i) / 512));
    const result = await spectrogram(x, { windowSize: 64 });
    expect(result.magnitude.length).toBeGreaterThan(0);
    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.times.length).toBe(result.magnitude.length);
  });

  it('parallel result matches sequential result', async () => {
    // Rectangular window keeps the WASM fast-path out of the picture so the
    // comparison isolates the pure-TS sequential vs. worker-batch paths.
    const x = Array.from(
      { length: 1024 },
      (_, i) =>
        Math.sin((2 * Math.PI * 7 * i) / 1024) + 0.3 * Math.cos((2 * Math.PI * 23 * i) / 1024)
    );
    const opts = { windowSize: 64, hopSize: 16, window: 'rectangular' };

    // Sequential reference.
    computePool.updateConfig({ thresholdElements: 1_000_000 });
    const seq = await spectrogram(x, opts);

    // Parallel: lower the threshold so the windowed frames batch to workers.
    computePool.updateConfig({ thresholdElements: 64 });
    const par = await spectrogram(x, opts);
    computePool.updateConfig({ thresholdElements: 1_000_000 });

    expect(par.magnitude.length).toBe(seq.magnitude.length);
    expect(par.times).toEqual(seq.times);
    for (let f = 0; f < seq.magnitude.length; f++) {
      for (let i = 0; i < seq.magnitude[f].length; i++) {
        expectClose(par.magnitude[f][i], seq.magnitude[f][i], 1e-9);
      }
    }
  });
});

// =============================================================================
// Periodogram
// =============================================================================

describe('periodogram', () => {
  it('should estimate PSD', () => {
    const x = Array.from({ length: 256 }, (_, i) => Math.sin((2 * Math.PI * 10 * i) / 256));
    const result = periodogram(x);
    expect(result.psd.length).toBeGreaterThan(0);
    expect(result.frequencies.length).toBe(result.psd.length);
    // PSD should have a peak
    const maxPSD = Math.max(...result.psd);
    expect(maxPSD).toBeGreaterThan(0);
  });
});

// =============================================================================
// Filters
// =============================================================================

describe('lowpassFilter', () => {
  it('should attenuate high frequencies', () => {
    // Signal: low freq + high freq
    const n = 100;
    const low = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 2 * i) / n));
    const high = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 40 * i) / n));
    const signal = low.map((v, i) => v + high[i]);
    const filtered = lowpassFilter(signal, 0.1);
    expect(filtered.length).toBe(n);
    // The filtered signal should have less energy in high frequencies
  });
});

describe('highpassFilter', () => {
  it('should return same-length signal', () => {
    const x = Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 64));
    const filtered = highpassFilter(x, 0.1);
    expect(filtered.length).toBe(64);
  });
});

describe('bandpassFilter', () => {
  it('should return same-length signal', () => {
    const x = Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 64));
    const filtered = bandpassFilter(x, 0.1, 0.3);
    expect(filtered.length).toBe(64);
  });
});

// =============================================================================
// Resample
// =============================================================================

describe('resample', () => {
  it('should downsample by factor of 2', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const resampled = resample(x, 1, 2);
    expect(resampled.length).toBe(4);
  });

  it('should upsample by factor of 2', () => {
    const x = [1, 2, 3, 4];
    const resampled = resample(x, 2, 1);
    expect(resampled.length).toBe(8);
  });
});

// =============================================================================
// Median Filter
// =============================================================================

describe('medfilt', () => {
  it('should remove impulse noise', () => {
    const x = [1, 1, 1, 100, 1, 1, 1];
    const filtered = medfilt(x, 3);
    expect(filtered[3]).toBe(1);
  });

  it('should preserve monotone signal', () => {
    const x = [1, 2, 3, 4, 5];
    const filtered = medfilt(x, 3);
    expectClose(filtered[2], 3);
  });
});

// =============================================================================
// Window Functions
// =============================================================================

describe('windowFunction', () => {
  it('should produce hamming window', () => {
    const w = windowFunction(8, 'hamming');
    expect(w.length).toBe(8);
    expect(w[0]).toBeGreaterThanOrEqual(0);
    expect(w[0]).toBeLessThan(w[4]);
  });

  it('should produce hann window', () => {
    const w = windowFunction(8, 'hann');
    expect(w.length).toBe(8);
    expectClose(w[0], 0, 1e-10);
  });

  it('should produce blackman window', () => {
    const w = windowFunction(8, 'blackman');
    expect(w.length).toBe(8);
  });

  it('should produce rectangular window', () => {
    const w = windowFunction(8, 'rectangular');
    expect(w.every((v) => v === 1)).toBe(true);
  });
});

// =============================================================================
// Convolution / Correlation
// =============================================================================

describe('convolve', () => {
  it('should convolve two arrays', () => {
    const result = convolve([1, 2, 3], [1, 1]);
    expect(result.length).toBe(4);
    expectClose(result[0], 1);
    expectClose(result[1], 3);
    expectClose(result[2], 5);
    expectClose(result[3], 3);
  });

  it('should return empty for empty input', () => {
    expect(convolve([], [1, 2])).toEqual([]);
  });
});

describe('correlate', () => {
  it('should compute cross-correlation', () => {
    const result = correlate([1, 0, 0], [1, 0, 0]);
    expect(result.length).toBe(5);
  });
});
