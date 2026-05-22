/**
 * FFT Tests
 *
 * Tests for Fast Fourier Transform and related functions.
 */

import { describe, it, expect } from 'vitest';
import {
  fft,
  ifft,
  ifftReal,
  fftMagnitude,
  fftPower,
  fftPhase,
  fftFrequencies,
  fft2,
  ifft2,
  fftshift,
  ifftshift,
  complex,
  complexAbs,
  complexArg,
  type ComplexNumber,
} from '../../src/signal/fft.js';

describe('FFT', () => {
  describe('Basic FFT', () => {
    it('should handle empty input', () => {
      const result = fft([]);
      expect(result.spectrum).toEqual([]);
      expect(result.originalLength).toBe(0);
    });

    it('should handle single element', () => {
      const result = fft([5]);
      expect(result.spectrum.length).toBe(1);
      expect(result.spectrum[0].re).toBeCloseTo(5);
      expect(result.spectrum[0].im).toBeCloseTo(0);
    });

    it('should compute FFT of DC signal', () => {
      // DC signal (all 1s) should have energy only at k=0
      const signal = [1, 1, 1, 1];
      const result = fft(signal);

      expect(result.spectrum[0].re).toBeCloseTo(4); // Sum of all values
      expect(result.spectrum[0].im).toBeCloseTo(0);

      // Other frequencies should be zero
      for (let k = 1; k < result.paddedLength; k++) {
        expect(complexAbs(result.spectrum[k])).toBeCloseTo(0);
      }
    });

    it('should compute FFT of simple sinusoid', () => {
      // Cosine at frequency 1: cos(2π·1·n/4) for n=0,1,2,3
      const n = 4;
      const signal = Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 1 * i) / n));
      const result = fft(signal);

      // Should have peaks at k=1 and k=n-1 (symmetric)
      const magnitude = fftMagnitude(result.spectrum);
      expect(magnitude[0]).toBeCloseTo(0); // DC
      expect(magnitude[1]).toBeGreaterThan(1); // Fundamental
    });

    it('should handle non-power-of-2 length', () => {
      const signal = [1, 2, 3, 4, 5]; // Length 5
      const result = fft(signal);

      expect(result.originalLength).toBe(5);
      expect(result.paddedLength).toBe(8); // Next power of 2
    });

    it('should accept Float64Array input', () => {
      const signal = new Float64Array([1, 2, 3, 4]);
      const result = fft(signal);

      expect(result.spectrum.length).toBe(4);
      expect(result.spectrum[0].re).toBeCloseTo(10); // Sum
    });

    it('should accept complex input', () => {
      const signal: ComplexNumber[] = [
        complex(1, 0),
        complex(0, 1),
        complex(-1, 0),
        complex(0, -1),
      ];
      const result = fft(signal);

      expect(result.spectrum.length).toBe(4);
    });
  });

  describe('IFFT', () => {
    it('should handle empty input', () => {
      const result = ifft([]);
      expect(result).toEqual([]);
    });

    it('should invert FFT (roundtrip)', () => {
      const original = [1, 2, 3, 4];
      const fftResult = fft(original);
      const recovered = ifft(fftResult.spectrum, fftResult.originalLength);

      for (let i = 0; i < original.length; i++) {
        expect(recovered[i].re).toBeCloseTo(original[i], 10);
        expect(recovered[i].im).toBeCloseTo(0, 10);
      }
    });

    it('should recover signal with non-power-of-2 length', () => {
      const original = [1, 2, 3, 4, 5];
      const fftResult = fft(original);
      const recovered = ifft(fftResult.spectrum, fftResult.originalLength);

      for (let i = 0; i < original.length; i++) {
        expect(recovered[i].re).toBeCloseTo(original[i], 10);
      }
    });

    it('should work with ifftReal', () => {
      const original = [1, 2, 3, 4];
      const fftResult = fft(original);
      const recovered = ifftReal(fftResult.spectrum, fftResult.originalLength);

      expect(recovered.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 10);
      }
    });
  });

  describe("Parseval's theorem", () => {
    it('should preserve energy: sum(|x|²) = sum(|X|²)/N', () => {
      const signal = [1, 2, 3, 4, 5, 6, 7, 8];
      const fftResult = fft(signal);

      // Time domain energy
      const timeEnergy = signal.reduce((sum, x) => sum + x * x, 0);

      // Frequency domain energy (scaled by 1/N)
      const freqEnergy =
        fftPower(fftResult.spectrum).reduce((sum, p) => sum + p, 0) / fftResult.paddedLength;

      expect(freqEnergy).toBeCloseTo(timeEnergy, 8);
    });
  });

  describe('FFT utility functions', () => {
    describe('fftMagnitude', () => {
      it('should compute magnitude spectrum', () => {
        const spectrum: ComplexNumber[] = [
          complex(3, 4), // |z| = 5
          complex(0, 1), // |z| = 1
        ];

        const mag = fftMagnitude(spectrum);

        expect(mag[0]).toBeCloseTo(5);
        expect(mag[1]).toBeCloseTo(1);
      });
    });

    describe('fftPower', () => {
      it('should compute power spectrum', () => {
        const spectrum: ComplexNumber[] = [
          complex(3, 4), // |z|² = 25
          complex(1, 1), // |z|² = 2
        ];

        const power = fftPower(spectrum);

        expect(power[0]).toBeCloseTo(25);
        expect(power[1]).toBeCloseTo(2);
      });
    });

    describe('fftPhase', () => {
      it('should compute phase spectrum', () => {
        const spectrum: ComplexNumber[] = [
          complex(1, 0), // phase = 0
          complex(0, 1), // phase = π/2
          complex(-1, 0), // phase = π
          complex(0, -1), // phase = -π/2
        ];

        const phase = fftPhase(spectrum);

        expect(phase[0]).toBeCloseTo(0);
        expect(phase[1]).toBeCloseTo(Math.PI / 2);
        expect(phase[2]).toBeCloseTo(Math.PI);
        expect(phase[3]).toBeCloseTo(-Math.PI / 2);
      });
    });

    describe('fftFrequencies', () => {
      it('should return correct frequency bins', () => {
        const n = 8;
        const sampleRate = 100;
        const freqs = fftFrequencies(n, sampleRate);

        // First half: 0, fs/n, 2fs/n, ...
        expect(freqs[0]).toBe(0);
        expect(freqs[1]).toBe(100 / 8);
        expect(freqs[4]).toBe(50);

        // Second half: negative frequencies
        expect(freqs[5]).toBe((-3 * 100) / 8);
      });

      it('should default to unit sample rate', () => {
        const freqs = fftFrequencies(4);

        expect(freqs[0]).toBe(0);
        expect(freqs[1]).toBe(0.25);
        expect(freqs[2]).toBe(0.5);
      });
    });

    describe('fftshift / ifftshift', () => {
      it('should shift zero-frequency to center', () => {
        const data = [0, 1, 2, 3, 4, 5, 6, 7];
        const shifted = fftshift(data);

        expect(shifted).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
      });

      it('should invert fftshift', () => {
        const data = [0, 1, 2, 3, 4, 5, 6, 7];
        const shifted = fftshift(data);
        const unshifted = ifftshift(shifted);

        expect(unshifted).toEqual(data);
      });

      it('should handle odd-length arrays', () => {
        const data = [0, 1, 2, 3, 4];
        const shifted = fftshift(data);
        const unshifted = ifftshift(shifted);

        expect(unshifted).toEqual(data);
      });
    });
  });

  describe('2D FFT', () => {
    it('should compute 2D FFT of constant matrix', () => {
      const matrix = [
        [1, 1],
        [1, 1],
      ];

      const result = fft2(matrix);

      // DC component should be sum = 4
      expect(result[0][0].re).toBeCloseTo(4);
    });

    it('should be invertible', () => {
      const original = [
        [1, 2],
        [3, 4],
      ];

      const fft2Result = fft2(original);
      const recovered = ifft2(fft2Result);

      for (let i = 0; i < original.length; i++) {
        for (let j = 0; j < original[i].length; j++) {
          expect(recovered[i][j].re).toBeCloseTo(original[i][j], 8);
          expect(recovered[i][j].im).toBeCloseTo(0, 8);
        }
      }
    });

    it('should handle non-square matrices', () => {
      const matrix = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const result = fft2(matrix);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Complex number helpers', () => {
    it('should create complex numbers', () => {
      const c = complex(3, 4);
      expect(c.re).toBe(3);
      expect(c.im).toBe(4);
    });

    it('should default imaginary to 0', () => {
      const c = complex(5);
      expect(c.re).toBe(5);
      expect(c.im).toBe(0);
    });

    it('should compute absolute value', () => {
      expect(complexAbs(complex(3, 4))).toBeCloseTo(5);
      expect(complexAbs(complex(0, 1))).toBeCloseTo(1);
      expect(complexAbs(complex(1, 0))).toBeCloseTo(1);
    });

    it('should compute argument', () => {
      expect(complexArg(complex(1, 0))).toBeCloseTo(0);
      expect(complexArg(complex(0, 1))).toBeCloseTo(Math.PI / 2);
      expect(complexArg(complex(-1, 0))).toBeCloseTo(Math.PI);
    });
  });

  describe('Known signal tests', () => {
    it('should correctly transform impulse signal', () => {
      // Impulse [1, 0, 0, 0] should have flat spectrum
      const impulse = [1, 0, 0, 0];
      const result = fft(impulse);
      const mag = fftMagnitude(result.spectrum);

      // All magnitudes should be 1
      for (const m of mag) {
        expect(m).toBeCloseTo(1, 8);
      }
    });

    it('should correctly transform alternating signal', () => {
      // [1, -1, 1, -1] is at Nyquist frequency
      const alternating = [1, -1, 1, -1];
      const result = fft(alternating);

      // Energy should be at k = N/2 = 2
      expect(complexAbs(result.spectrum[0])).toBeCloseTo(0);
      expect(complexAbs(result.spectrum[2])).toBeCloseTo(4);
    });
  });
});
