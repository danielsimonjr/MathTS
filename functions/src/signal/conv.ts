/**
 * Convolution Operations
 *
 * Implements 1D and 2D convolution using both direct and FFT methods.
 *
 * @packageDocumentation
 */

import {
  fft,
  ifft,
  fft2,
  ifft2,
  complex,
  type ComplexNumber,
} from './fft.js';

/**
 * Convolution mode - determines output size
 */
export type ConvMode = 'full' | 'same' | 'valid';

/**
 * Multiply two complex numbers
 */
function complexMul(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * Direct 1D convolution (for small inputs)
 *
 * @param x - Input signal
 * @param h - Convolution kernel
 * @param mode - Output mode: 'full', 'same', or 'valid'
 * @returns Convolution result
 */
export function convDirect(
  x: number[] | Float64Array,
  h: number[] | Float64Array,
  mode: ConvMode = 'full'
): number[] {
  const xArr = Array.isArray(x) ? x : Array.from(x);
  const hArr = Array.isArray(h) ? h : Array.from(h);

  const n = xArr.length;
  const m = hArr.length;

  if (n === 0 || m === 0) {
    return [];
  }

  // Full convolution length
  const fullLength = n + m - 1;
  const result = new Array(fullLength).fill(0);

  // Direct convolution
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      result[i + j] += xArr[i] * hArr[j];
    }
  }

  // Trim based on mode
  switch (mode) {
    case 'full':
      return result;

    case 'same':
      // Output same size as first input
      const startSame = Math.floor((m - 1) / 2);
      return result.slice(startSame, startSame + n);

    case 'valid':
      // Only where inputs completely overlap
      if (m > n) {
        return [];
      }
      const startValid = m - 1;
      const validLength = Math.max(0, n - m + 1);
      return result.slice(startValid, startValid + validLength);

    default:
      return result;
  }
}

/**
 * FFT-based 1D convolution (efficient for large inputs)
 *
 * Uses the convolution theorem: conv(x,h) = IFFT(FFT(x) * FFT(h))
 *
 * @param x - Input signal
 * @param h - Convolution kernel
 * @param mode - Output mode: 'full', 'same', or 'valid'
 * @returns Convolution result
 */
export function convFFT(
  x: number[] | Float64Array,
  h: number[] | Float64Array,
  mode: ConvMode = 'full'
): number[] {
  const xArr = Array.isArray(x) ? x : Array.from(x);
  const hArr = Array.isArray(h) ? h : Array.from(h);

  const n = xArr.length;
  const m = hArr.length;

  if (n === 0 || m === 0) {
    return [];
  }

  // FFT length should be at least n + m - 1 (full convolution)
  const fullLength = n + m - 1;

  // Zero-pad both signals to same length (FFT will pad to power of 2)
  const xPadded = [...xArr, ...new Array(fullLength - n).fill(0)];
  const hPadded = [...hArr, ...new Array(fullLength - m).fill(0)];

  // Compute FFTs
  const X = fft(xPadded);
  const H = fft(hPadded);

  // Element-wise multiplication in frequency domain
  const Y: ComplexNumber[] = [];
  for (let i = 0; i < X.spectrum.length; i++) {
    Y.push(complexMul(X.spectrum[i], H.spectrum[i]));
  }

  // Inverse FFT
  const result = ifft(Y, fullLength);
  const realResult = result.map((c) => c.re);

  // Trim based on mode
  switch (mode) {
    case 'full':
      return realResult;

    case 'same':
      const startSame = Math.floor((m - 1) / 2);
      return realResult.slice(startSame, startSame + n);

    case 'valid':
      if (m > n) {
        return [];
      }
      const startValid = m - 1;
      const validLength = Math.max(0, n - m + 1);
      return realResult.slice(startValid, startValid + validLength);

    default:
      return realResult;
  }
}

/**
 * Threshold for switching from direct to FFT convolution
 */
const FFT_THRESHOLD = 64;

/**
 * 1D Convolution with automatic method selection
 *
 * Automatically selects direct or FFT method based on input sizes.
 *
 * @param x - Input signal
 * @param h - Convolution kernel
 * @param mode - Output mode: 'full' (default), 'same', or 'valid'
 * @returns Convolution result
 *
 * @example
 * ```typescript
 * // Simple convolution
 * const signal = [1, 2, 3, 4, 5];
 * const kernel = [1, 0, -1]; // Edge detection
 * const result = conv(signal, kernel, 'same');
 * ```
 */
export function conv(
  x: number[] | Float64Array,
  h: number[] | Float64Array,
  mode: ConvMode = 'full'
): number[] {
  const n = x.length;
  const m = h.length;

  // Use direct method for small inputs
  if (n * m < FFT_THRESHOLD * FFT_THRESHOLD) {
    return convDirect(x, h, mode);
  }

  // Use FFT for larger inputs
  return convFFT(x, h, mode);
}

/**
 * Cross-correlation of two signals
 *
 * Cross-correlation is convolution with the kernel reversed.
 *
 * @param x - First signal
 * @param h - Second signal
 * @param mode - Output mode
 * @returns Cross-correlation result
 */
export function xcorr(
  x: number[] | Float64Array,
  h: number[] | Float64Array,
  mode: ConvMode = 'full'
): number[] {
  const hArr = Array.isArray(h) ? h : Array.from(h);
  // Reverse h for cross-correlation
  const hReversed = hArr.slice().reverse();
  return conv(x, hReversed, mode);
}

/**
 * Auto-correlation of a signal
 *
 * @param x - Input signal
 * @param mode - Output mode
 * @returns Auto-correlation result
 */
export function autocorr(
  x: number[] | Float64Array,
  mode: ConvMode = 'full'
): number[] {
  return xcorr(x, x, mode);
}

/**
 * Direct 2D convolution
 *
 * @param image - 2D input array
 * @param kernel - 2D convolution kernel
 * @param mode - Output mode
 * @returns 2D convolution result
 */
export function conv2Direct(
  image: number[][],
  kernel: number[][],
  mode: ConvMode = 'full'
): number[][] {
  const imageRows = image.length;
  if (imageRows === 0) return [];

  const imageCols = image[0].length;
  const kernelRows = kernel.length;
  if (kernelRows === 0) return image.map(row => [...row]);

  const kernelCols = kernel[0].length;

  // Full convolution dimensions
  const fullRows = imageRows + kernelRows - 1;
  const fullCols = imageCols + kernelCols - 1;

  // Initialize result
  const result: number[][] = [];
  for (let i = 0; i < fullRows; i++) {
    result.push(new Array(fullCols).fill(0));
  }

  // Direct 2D convolution
  for (let i = 0; i < imageRows; i++) {
    for (let j = 0; j < imageCols; j++) {
      for (let ki = 0; ki < kernelRows; ki++) {
        for (let kj = 0; kj < kernelCols; kj++) {
          result[i + ki][j + kj] += image[i][j] * kernel[ki][kj];
        }
      }
    }
  }

  // Trim based on mode
  switch (mode) {
    case 'full':
      return result;

    case 'same': {
      const rowStart = Math.floor((kernelRows - 1) / 2);
      const colStart = Math.floor((kernelCols - 1) / 2);
      const output: number[][] = [];
      for (let i = 0; i < imageRows; i++) {
        output.push(result[rowStart + i].slice(colStart, colStart + imageCols));
      }
      return output;
    }

    case 'valid': {
      if (kernelRows > imageRows || kernelCols > imageCols) {
        return [];
      }
      const validRows = imageRows - kernelRows + 1;
      const validCols = imageCols - kernelCols + 1;
      const output: number[][] = [];
      for (let i = 0; i < validRows; i++) {
        output.push(
          result[kernelRows - 1 + i].slice(kernelCols - 1, kernelCols - 1 + validCols)
        );
      }
      return output;
    }

    default:
      return result;
  }
}

/**
 * FFT-based 2D convolution
 *
 * @param image - 2D input array
 * @param kernel - 2D convolution kernel
 * @param mode - Output mode
 * @returns 2D convolution result
 */
export function conv2FFT(
  image: number[][],
  kernel: number[][],
  mode: ConvMode = 'full'
): number[][] {
  const imageRows = image.length;
  if (imageRows === 0) return [];

  const imageCols = image[0].length;
  const kernelRows = kernel.length;
  if (kernelRows === 0) return image.map(row => [...row]);

  const kernelCols = kernel[0].length;

  // Full convolution dimensions
  const fullRows = imageRows + kernelRows - 1;
  const fullCols = imageCols + kernelCols - 1;

  // Zero-pad image
  const paddedImage: number[][] = [];
  for (let i = 0; i < fullRows; i++) {
    const row = new Array(fullCols).fill(0);
    if (i < imageRows) {
      for (let j = 0; j < imageCols; j++) {
        row[j] = image[i][j];
      }
    }
    paddedImage.push(row);
  }

  // Zero-pad kernel
  const paddedKernel: number[][] = [];
  for (let i = 0; i < fullRows; i++) {
    const row = new Array(fullCols).fill(0);
    if (i < kernelRows) {
      for (let j = 0; j < kernelCols; j++) {
        row[j] = kernel[i][j];
      }
    }
    paddedKernel.push(row);
  }

  // 2D FFTs
  const imageFFT = fft2(paddedImage);
  const kernelFFT = fft2(paddedKernel);

  // Element-wise multiplication
  const resultFFT: ComplexNumber[][] = [];
  for (let i = 0; i < imageFFT.length; i++) {
    resultFFT.push([]);
    for (let j = 0; j < imageFFT[i].length; j++) {
      resultFFT[i].push(
        complexMul(
          imageFFT[i][j] || complex(0, 0),
          kernelFFT[i]?.[j] || complex(0, 0)
        )
      );
    }
  }

  // Inverse 2D FFT
  const result2D = ifft2(resultFFT);

  // Extract real parts and trim
  const result: number[][] = [];
  for (let i = 0; i < fullRows; i++) {
    const row: number[] = [];
    for (let j = 0; j < fullCols; j++) {
      row.push(result2D[i]?.[j]?.re ?? 0);
    }
    result.push(row);
  }

  // Trim based on mode
  switch (mode) {
    case 'full':
      return result;

    case 'same': {
      const rowStart = Math.floor((kernelRows - 1) / 2);
      const colStart = Math.floor((kernelCols - 1) / 2);
      const output: number[][] = [];
      for (let i = 0; i < imageRows; i++) {
        output.push(result[rowStart + i].slice(colStart, colStart + imageCols));
      }
      return output;
    }

    case 'valid': {
      if (kernelRows > imageRows || kernelCols > imageCols) {
        return [];
      }
      const validRows = imageRows - kernelRows + 1;
      const validCols = imageCols - kernelCols + 1;
      const output: number[][] = [];
      for (let i = 0; i < validRows; i++) {
        output.push(
          result[kernelRows - 1 + i].slice(kernelCols - 1, kernelCols - 1 + validCols)
        );
      }
      return output;
    }

    default:
      return result;
  }
}

/**
 * 2D Convolution with automatic method selection
 *
 * @param image - 2D input array
 * @param kernel - 2D convolution kernel
 * @param mode - Output mode: 'full' (default), 'same', or 'valid'
 * @returns 2D convolution result
 *
 * @example
 * ```typescript
 * // Edge detection with Sobel kernel
 * const image = [
 *   [1, 2, 3],
 *   [4, 5, 6],
 *   [7, 8, 9],
 * ];
 * const sobelX = [
 *   [-1, 0, 1],
 *   [-2, 0, 2],
 *   [-1, 0, 1],
 * ];
 * const edges = conv2(image, sobelX, 'same');
 * ```
 */
export function conv2(
  image: number[][],
  kernel: number[][],
  mode: ConvMode = 'full'
): number[][] {
  const imageRows = image.length;
  const imageCols = image[0]?.length ?? 0;
  const kernelRows = kernel.length;
  const kernelCols = kernel[0]?.length ?? 0;

  // Use direct method for small inputs
  const imageSize = imageRows * imageCols;
  const kernelSize = kernelRows * kernelCols;

  if (imageSize * kernelSize < FFT_THRESHOLD * FFT_THRESHOLD * FFT_THRESHOLD) {
    return conv2Direct(image, kernel, mode);
  }

  // Use FFT for larger inputs
  return conv2FFT(image, kernel, mode);
}
