/**
 * Convolution Tests
 *
 * Tests for convolution and cross-correlation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  conv,
  convDirect,
  convFFT,
  conv2,
  conv2Direct,
  conv2FFT,
  xcorr,
  autocorr,
} from '../../src/signal/conv.js';

describe('Convolution', () => {
  describe('1D Convolution (conv)', () => {
    describe('Full mode', () => {
      it('should convolve two simple arrays', () => {
        const x = [1, 2, 3];
        const h = [1, 1];

        const result = conv(x, h, 'full');

        // [1,2,3] * [1,1] = [1, 3, 5, 3]
        expect(result).toEqual([1, 3, 5, 3]);
      });

      it('should handle single element kernel', () => {
        const x = [1, 2, 3, 4];
        const h = [2];

        const result = conv(x, h, 'full');

        expect(result).toEqual([2, 4, 6, 8]);
      });

      it('should handle empty arrays', () => {
        expect(conv([], [1, 2], 'full')).toEqual([]);
        expect(conv([1, 2], [], 'full')).toEqual([]);
      });

      it('should produce correct output length', () => {
        const x = [1, 2, 3, 4, 5]; // length 5
        const h = [1, 1, 1]; // length 3

        const result = conv(x, h, 'full');

        expect(result.length).toBe(5 + 3 - 1); // 7
      });

      it('should convolve impulse with signal', () => {
        // Convolution with impulse [1, 0, 0, ...] is identity
        const x = [1, 2, 3, 4];
        const impulse = [1, 0, 0, 0];

        const result = conv(x, impulse, 'full');

        // Result starts with x
        expect(result.slice(0, 4)).toEqual(x);
      });
    });

    describe('Same mode', () => {
      it('should return same size as input', () => {
        const x = [1, 2, 3, 4, 5];
        const h = [1, 1, 1];

        const result = conv(x, h, 'same');

        expect(result.length).toBe(x.length);
      });

      it('should center the result', () => {
        const x = [0, 0, 1, 0, 0];
        const h = [1, 2, 1];

        const result = conv(x, h, 'same');

        // Impulse at center should produce [0, 1, 2, 1, 0]
        expect(result.length).toBe(5);
        expect(result[2]).toBeCloseTo(2);
      });
    });

    describe('Valid mode', () => {
      it('should only include full overlap regions', () => {
        const x = [1, 2, 3, 4, 5];
        const h = [1, 1, 1];

        const result = conv(x, h, 'valid');

        // Valid length = max(M,N) - min(M,N) + 1 = 5 - 3 + 1 = 3
        expect(result.length).toBe(3);
      });

      it('should return empty if kernel larger than signal', () => {
        const x = [1, 2];
        const h = [1, 1, 1, 1];

        const result = conv(x, h, 'valid');

        expect(result).toEqual([]);
      });
    });

    describe('Direct vs FFT consistency', () => {
      it('should produce same results with both methods', () => {
        const x = [1, 2, 3, 4, 5, 6, 7, 8];
        const h = [1, 2, 1];

        const directResult = convDirect(x, h, 'full');
        const fftResult = convFFT(x, h, 'full');

        expect(directResult.length).toBe(fftResult.length);
        for (let i = 0; i < directResult.length; i++) {
          expect(fftResult[i]).toBeCloseTo(directResult[i], 8);
        }
      });
    });

    describe('Float64Array input', () => {
      it('should accept Float64Array', () => {
        const x = new Float64Array([1, 2, 3, 4]);
        const h = new Float64Array([1, 1]);

        const result = conv(x, h, 'full');

        expect(result.length).toBe(5);
        expect(result).toEqual([1, 3, 5, 7, 4]);
      });
    });

    describe('Edge detection kernel', () => {
      it('should work with edge detection kernel', () => {
        const signal = [1, 2, 3, 4, 5, 4, 3, 2, 1];
        const edgeKernel = [1, 0, -1]; // Simple derivative

        const result = conv(signal, edgeKernel, 'same');

        // Should detect edges (changes in signal)
        expect(result.length).toBe(signal.length);
      });
    });
  });

  describe('Cross-correlation (xcorr)', () => {
    it('should compute cross-correlation', () => {
      const x = [1, 2, 3];
      const h = [0, 1, 0.5];

      const result = xcorr(x, h, 'full');

      // xcorr(x,h) = conv(x, reverse(h))
      expect(result.length).toBe(5);
    });

    it('should peak at zero lag for identical signals', () => {
      const x = [1, 2, 3, 2, 1];

      const result = xcorr(x, x, 'full');

      // Peak should be at center
      const center = Math.floor(result.length / 2);
      for (let i = 0; i < result.length; i++) {
        expect(result[center]).toBeGreaterThanOrEqual(result[i] - 1e-10);
      }
    });
  });

  describe('Auto-correlation (autocorr)', () => {
    it('should compute autocorrelation', () => {
      const x = [1, 2, 3, 2, 1];

      const result = autocorr(x, 'full');

      // Autocorrelation is symmetric
      const n = result.length;
      for (let i = 0; i < Math.floor(n / 2); i++) {
        expect(result[i]).toBeCloseTo(result[n - 1 - i], 8);
      }
    });

    it('should have maximum at zero lag', () => {
      const x = [1, -2, 3, -4, 5];

      const result = autocorr(x, 'full');
      const center = Math.floor(result.length / 2);

      // Zero-lag (center) should be maximum
      for (let i = 0; i < result.length; i++) {
        expect(result[center]).toBeGreaterThanOrEqual(result[i] - 1e-10);
      }
    });
  });

  describe('2D Convolution (conv2)', () => {
    describe('Full mode', () => {
      it('should convolve 2D arrays', () => {
        const image = [
          [1, 2],
          [3, 4],
        ];
        const kernel = [
          [1, 0],
          [0, -1],
        ];

        const result = conv2(image, kernel, 'full');

        // Full output size: (2+2-1) x (2+2-1) = 3x3
        expect(result.length).toBe(3);
        expect(result[0].length).toBe(3);
      });

      it('should produce correct values', () => {
        const image = [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ];
        const kernel = [[1]]; // Identity

        const result = conv2(image, kernel, 'full');

        expect(result).toEqual(image);
      });
    });

    describe('Same mode', () => {
      it('should return same size as input', () => {
        const image = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const kernel = [
          [1, 1],
          [1, 1],
        ];

        const result = conv2(image, kernel, 'same');

        expect(result.length).toBe(2);
        expect(result[0].length).toBe(3);
      });
    });

    describe('Valid mode', () => {
      it('should only include full overlap', () => {
        const image = [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
        ];
        const kernel = [
          [1, 1],
          [1, 1],
        ];

        const result = conv2(image, kernel, 'valid');

        // Valid size: (3-2+1) x (4-2+1) = 2x3
        expect(result.length).toBe(2);
        expect(result[0].length).toBe(3);
      });

      it('should return empty if kernel larger than image', () => {
        const image = [[1, 2], [3, 4]];
        const kernel = [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ];

        const result = conv2(image, kernel, 'valid');

        expect(result).toEqual([]);
      });
    });

    describe('Direct vs FFT consistency', () => {
      it('should produce same results with both methods', () => {
        const image = [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
          [13, 14, 15, 16],
        ];
        const kernel = [
          [1, 2],
          [3, 4],
        ];

        const directResult = conv2Direct(image, kernel, 'full');
        const fftResult = conv2FFT(image, kernel, 'full');

        expect(directResult.length).toBe(fftResult.length);
        for (let i = 0; i < directResult.length; i++) {
          expect(directResult[i].length).toBe(fftResult[i].length);
          for (let j = 0; j < directResult[i].length; j++) {
            expect(fftResult[i][j]).toBeCloseTo(directResult[i][j], 6);
          }
        }
      });
    });

    describe('Image processing kernels', () => {
      it('should work with box blur kernel', () => {
        const image = [
          [0, 0, 0, 0, 0],
          [0, 1, 1, 1, 0],
          [0, 1, 1, 1, 0],
          [0, 1, 1, 1, 0],
          [0, 0, 0, 0, 0],
        ];
        const boxBlur = [
          [1/9, 1/9, 1/9],
          [1/9, 1/9, 1/9],
          [1/9, 1/9, 1/9],
        ];

        const result = conv2(image, boxBlur, 'same');

        // Result should be smoothed
        expect(result.length).toBe(5);
        expect(result[2][2]).toBeCloseTo(1); // Center should be ~1
      });

      it('should work with Sobel edge detection', () => {
        const image = [
          [0, 0, 0],
          [1, 1, 1],
          [2, 2, 2],
        ];
        const sobelY = [
          [-1, -2, -1],
          [0, 0, 0],
          [1, 2, 1],
        ];

        const result = conv2(image, sobelY, 'valid');

        // Should detect vertical gradient
        expect(result.length).toBe(1);
      });
    });
  });
});
