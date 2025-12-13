/**
 * Tests for parallel-first typed signal processing functions
 *
 * Tests both Float64Array operations and number array operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@mathts/parallel';
import {
  parallelFFT,
  parallelIFFT,
  parallelFFTMagnitude,
  parallelFFTPower,
  parallelConv,
  parallelXCorr,
  parallelAutoCorr,
} from '../src/index.js';

describe('Parallel Signal Processing Functions', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  describe('FFT', () => {
    it('should compute FFT of number array', () => {
      const signal = [1, 0, -1, 0];
      const result = parallelFFT(signal);
      expect(result.real).toBeInstanceOf(Float64Array);
      expect(result.imag).toBeInstanceOf(Float64Array);
      expect(result.originalLength).toBe(4);
      // DC component should be sum of signal
      expect(result.real[0]).toBeCloseTo(0, 10);
    });

    it('should compute FFT of Float64Array', async () => {
      const signal = new Float64Array([1, 2, 3, 4]);
      const result = await parallelFFT(signal);
      expect(result.real).toBeInstanceOf(Float64Array);
      expect(result.imag).toBeInstanceOf(Float64Array);
      expect(result.originalLength).toBe(4);
      // DC component should be sum of signal = 10
      expect(result.real[0]).toBeCloseTo(10, 10);
    });

    it('should handle power-of-2 input', () => {
      const signal = [1, 1, 1, 1, 1, 1, 1, 1]; // 8 elements
      const result = parallelFFT(signal);
      expect(result.real.length).toBe(8);
    });

    it('should zero-pad non-power-of-2 input', () => {
      const signal = [1, 2, 3]; // 3 elements -> pads to 4
      const result = parallelFFT(signal);
      expect(result.real.length).toBe(4);
      expect(result.originalLength).toBe(3);
    });

    it('should handle empty input', () => {
      const signal: number[] = [];
      const result = parallelFFT(signal);
      expect(result.real.length).toBe(0);
    });

    it('should produce correct DC component', () => {
      const signal = [1, 2, 3, 4];
      const result = parallelFFT(signal);
      // DC = sum of all values = 10
      expect(result.real[0]).toBeCloseTo(10, 10);
    });
  });

  describe('IFFT', () => {
    it('should recover original signal', () => {
      const signal = [1, 2, 3, 4];
      const fftResult = parallelFFT(signal);
      const recovered = parallelIFFT(fftResult.real, fftResult.imag);

      for (let i = 0; i < signal.length; i++) {
        expect(recovered.real[i]).toBeCloseTo(signal[i], 10);
      }
    });

    it('should work with object input', () => {
      const signal = [1, 2, 3, 4];
      const fftResult = parallelFFT(signal);
      const recovered = parallelIFFT({ real: fftResult.real, imag: fftResult.imag });

      for (let i = 0; i < signal.length; i++) {
        expect(recovered.real[i]).toBeCloseTo(signal[i], 10);
      }
    });

    it('should round-trip a cosine wave', () => {
      const n = 8;
      const signal = new Array(n);
      for (let i = 0; i < n; i++) {
        signal[i] = Math.cos((2 * Math.PI * i) / n);
      }

      const fftResult = parallelFFT(signal);
      const recovered = parallelIFFT(fftResult.real, fftResult.imag);

      for (let i = 0; i < n; i++) {
        expect(recovered.real[i]).toBeCloseTo(signal[i], 10);
      }
    });
  });

  describe('FFT Magnitude', () => {
    it('should compute magnitude spectrum', async () => {
      const signal = [1, 0, 1, 0];
      const fftResult = parallelFFT(signal);
      const magnitude = await parallelFFTMagnitude(fftResult.real, fftResult.imag);

      expect(magnitude).toBeInstanceOf(Float64Array);
      expect(magnitude.length).toBe(fftResult.real.length);
      // DC magnitude should be |sum| = 2
      expect(magnitude[0]).toBeCloseTo(2, 10);
    });

    it('should work with object input', async () => {
      const signal = [1, 2, 3, 4];
      const fftResult = parallelFFT(signal);
      const magnitude = await parallelFFTMagnitude({ real: fftResult.real, imag: fftResult.imag });

      expect(magnitude).toBeInstanceOf(Float64Array);
    });
  });

  describe('FFT Power', () => {
    it('should compute power spectrum', async () => {
      const signal = [1, 0, 1, 0];
      const fftResult = parallelFFT(signal);
      const power = await parallelFFTPower(fftResult.real, fftResult.imag);

      expect(power).toBeInstanceOf(Float64Array);
      // DC power should be |sum|^2 = 4
      expect(power[0]).toBeCloseTo(4, 10);
    });
  });

  describe('Convolution', () => {
    it('should convolve two Float64Arrays', async () => {
      const x = new Float64Array([1, 2, 3]);
      const h = new Float64Array([1, 1]);
      const result = await parallelConv(x, h);

      // conv([1,2,3], [1,1]) = [1, 3, 5, 3]
      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(1, 10);
      expect(result[1]).toBeCloseTo(3, 10);
      expect(result[2]).toBeCloseTo(5, 10);
      expect(result[3]).toBeCloseTo(3, 10);
    });

    it('should convolve two number arrays', async () => {
      const x = [1, 2, 3];
      const h = [1, 1];
      const result = await parallelConv(x, h);

      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(1, 10);
      expect(result[1]).toBeCloseTo(3, 10);
    });

    it('should handle convolution with impulse', async () => {
      const x = new Float64Array([1, 2, 3, 4]);
      const impulse = new Float64Array([1]); // Delta function
      const result = await parallelConv(x, impulse);

      // Convolution with impulse should return original signal
      for (let i = 0; i < x.length; i++) {
        expect(result[i]).toBeCloseTo(x[i], 10);
      }
    });

    it('should handle empty inputs', async () => {
      const x = new Float64Array([1, 2, 3]);
      const h = new Float64Array([]);
      const result = await parallelConv(x, h);
      expect(result.length).toBe(0);
    });

    it('should produce correct output length', async () => {
      const x = new Float64Array([1, 2, 3, 4, 5]); // length 5
      const h = new Float64Array([1, 1, 1]); // length 3
      const result = await parallelConv(x, h);

      // Full convolution length = 5 + 3 - 1 = 7
      expect(result.length).toBe(7);
    });
  });

  describe('Cross-correlation', () => {
    it('should compute cross-correlation', async () => {
      const x = new Float64Array([1, 2, 3]);
      const h = new Float64Array([1, 2]);
      const result = await parallelXCorr(x, h);

      // xcorr(x, h) = conv(x, reverse(h))
      // reverse([1,2]) = [2,1]
      // conv([1,2,3], [2,1]) = [2, 5, 8, 3]
      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(2, 10);
      expect(result[1]).toBeCloseTo(5, 10);
      expect(result[2]).toBeCloseTo(8, 10);
      expect(result[3]).toBeCloseTo(3, 10);
    });

    it('should work with number arrays', async () => {
      const x = [1, 2, 3];
      const h = [1, 1];
      const result = await parallelXCorr(x, h);
      expect(result).toBeInstanceOf(Float64Array);
    });
  });

  describe('Auto-correlation', () => {
    it('should compute auto-correlation', async () => {
      const x = new Float64Array([1, 2, 1]);
      const result = await parallelAutoCorr(x);

      // Auto-correlation is symmetric
      expect(result.length).toBe(5);
      // Peak at center (index 2)
      const center = 2;
      // Auto-correlation at lag 0 = sum of x[i]^2 = 1 + 4 + 1 = 6
      expect(result[center]).toBeCloseTo(6, 10);
    });

    it('should have peak at zero lag', async () => {
      const x = new Float64Array([1, 2, 3, 2, 1]);
      const result = await parallelAutoCorr(x);

      // Find maximum
      let maxVal = result[0];
      let maxIdx = 0;
      for (let i = 1; i < result.length; i++) {
        if (result[i] > maxVal) {
          maxVal = result[i];
          maxIdx = i;
        }
      }

      // Peak should be at center (zero lag)
      const center = x.length - 1;
      expect(maxIdx).toBe(center);
    });

    it('should work with number array', async () => {
      const x = [1, 2, 1];
      const result = await parallelAutoCorr(x);
      expect(result).toBeInstanceOf(Float64Array);
    });
  });

  describe('Performance with larger arrays', () => {
    it('should handle medium-sized FFT', async () => {
      const size = 256;
      const signal = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        signal[i] = Math.sin((2 * Math.PI * 10 * i) / size);
      }

      const result = await parallelFFT(signal);
      expect(result.real.length).toBe(size);
    });

    it('should handle medium-sized convolution', async () => {
      const x = new Float64Array(128).fill(1);
      const h = new Float64Array(32).fill(0.5);
      const result = await parallelConv(x, h);

      expect(result.length).toBe(128 + 32 - 1);
    });
  });
});
