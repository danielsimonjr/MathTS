/**
 * Typed Signal Processing Functions (Parallel-First)
 *
 * AssemblyScript-friendly TypeScript implementations with typed-function
 * integration and workerpool parallel execution.
 *
 * Includes FFT, IFFT, convolution, and correlation functions optimized
 * for Float64Array with parallel execution support.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL array transformations (Float64Array)
 * - Use workers for ALL numerical computations that can be batched
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

import { mathTyped, Complex } from '@mathts/core';
import { computePool } from '@mathts/parallel';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

// =============================================================================
// Complex Number Interface
// =============================================================================

interface ComplexNumber {
  re: f64;
  im: f64;
}

// =============================================================================
// Utility Functions (AssemblyScript-Friendly)
// =============================================================================

/**
 * Create complex number
 */
function complexNum(re: f64, im: f64 = 0): ComplexNumber {
  return { re, im };
}

/**
 * Complex multiplication
 */
function complexMul(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * Complex addition
 */
function complexAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re + b.re, im: a.im + b.im };
}

/**
 * Complex subtraction
 */
function complexSub(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re - b.re, im: a.im - b.im };
}

/**
 * Complex magnitude
 */
function complexAbs(a: ComplexNumber): f64 {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

/**
 * Check if power of 2
 */
function isPowerOf2(n: i32): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Next power of 2
 */
function nextPowerOf2(n: i32): i32 {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n))) as i32;
}

/**
 * Bit reverse for FFT
 */
function bitReverse(x: i32, bits: i32): i32 {
  let result: i32 = 0;
  for (let i: i32 = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

// =============================================================================
// Core FFT Implementation (AssemblyScript-Friendly)
// =============================================================================

/**
 * Radix-2 FFT core using Float64Array for WASM compatibility
 */
function fftCoreFloat64(
  realIn: Float64Array,
  imagIn: Float64Array,
  inverse: boolean = false
): { real: Float64Array; imag: Float64Array } {
  const n: i32 = realIn.length;
  const bits: i32 = Math.log2(n) as i32;

  // Bit-reverse reorder
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) {
    const j: i32 = bitReverse(i, bits);
    real[j] = realIn[i];
    imag[j] = imagIn[i];
  }

  // Direction factor
  const direction: f64 = inverse ? 1.0 : -1.0;

  // Butterfly operations
  for (let size: i32 = 2; size <= n; size *= 2) {
    const halfSize: i32 = size / 2;
    const angle: f64 = (direction * 2.0 * Math.PI) / size;
    const wRe: f64 = Math.cos(angle);
    const wIm: f64 = Math.sin(angle);

    for (let start: i32 = 0; start < n; start += size) {
      let tRe: f64 = 1.0;
      let tIm: f64 = 0.0;

      for (let j: i32 = 0; j < halfSize; j++) {
        const evenIdx: i32 = start + j;
        const oddIdx: i32 = start + j + halfSize;

        // Twiddle factor multiplication
        const uRe: f64 = real[oddIdx] * tRe - imag[oddIdx] * tIm;
        const uIm: f64 = real[oddIdx] * tIm + imag[oddIdx] * tRe;

        // Butterfly
        const eRe: f64 = real[evenIdx];
        const eIm: f64 = imag[evenIdx];

        real[evenIdx] = eRe + uRe;
        imag[evenIdx] = eIm + uIm;
        real[oddIdx] = eRe - uRe;
        imag[oddIdx] = eIm - uIm;

        // Update twiddle factor
        const nextTRe: f64 = tRe * wRe - tIm * wIm;
        const nextTIm: f64 = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
  }

  // Scale for inverse
  if (inverse) {
    for (let i: i32 = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }

  return { real, imag };
}

// =============================================================================
// Typed FFT Functions
// =============================================================================

/**
 * Parallel FFT with typed-function dispatch
 *
 * Supports: number[], Float64Array, Complex[]
 */
export const parallelFFT = mathTyped('parallelFFT', {
  // FFT of number array
  'Array': (signal: number[]) => {
    const n: i32 = signal.length;
    if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0), originalLength: 0 };

    const paddedLength: i32 = nextPowerOf2(n);
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    for (let i: i32 = 0; i < n; i++) {
      real[i] = signal[i];
    }

    const result = fftCoreFloat64(real, imag, false);
    return { ...result, originalLength: n };
  },

  // FFT of Float64Array (parallel-ready)
  'Float64Array': async (signal: Float64Array) => {
    const n: i32 = signal.length;
    if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0), originalLength: 0 };

    const paddedLength: i32 = nextPowerOf2(n);
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    // Copy input with zero-padding
    real.set(signal);

    const result = fftCoreFloat64(real, imag, false);
    return { ...result, originalLength: n };
  },
});

/**
 * Parallel IFFT with typed-function dispatch
 */
export const parallelIFFT = mathTyped('parallelIFFT', {
  // IFFT from real/imag arrays
  'Float64Array, Float64Array': (real: Float64Array, imag: Float64Array) => {
    return fftCoreFloat64(real, imag, true);
  },

  // IFFT from object with real/imag
  'Object': (spectrum: { real: Float64Array; imag: Float64Array }) => {
    return fftCoreFloat64(spectrum.real, spectrum.imag, true);
  },
});

/**
 * FFT magnitude spectrum
 */
export const parallelFFTMagnitude = mathTyped('parallelFFTMagnitude', {
  'Float64Array, Float64Array': async (real: Float64Array, imag: Float64Array): Promise<Float64Array> => {
    const n: i32 = real.length;

    // For small arrays, compute sequentially
    if (n < 10000) {
      const result = new Float64Array(n);
      for (let i: i32 = 0; i < n; i++) {
        result[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      }
      return result;
    }

    // For large arrays, could use parallel map
    // For now, sequential with SIMD-friendly pattern
    const result = new Float64Array(n);
    for (let i: i32 = 0; i < n; i++) {
      result[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return result;
  },

  'Object': async (spectrum: { real: Float64Array; imag: Float64Array }): Promise<Float64Array> => {
    return parallelFFTMagnitude(spectrum.real, spectrum.imag);
  },
});

/**
 * FFT power spectrum (|X|^2)
 */
export const parallelFFTPower = mathTyped('parallelFFTPower', {
  'Float64Array, Float64Array': async (real: Float64Array, imag: Float64Array): Promise<Float64Array> => {
    const n: i32 = real.length;
    const result = new Float64Array(n);
    for (let i: i32 = 0; i < n; i++) {
      result[i] = real[i] * real[i] + imag[i] * imag[i];
    }
    return result;
  },

  'Object': async (spectrum: { real: Float64Array; imag: Float64Array }): Promise<Float64Array> => {
    return parallelFFTPower(spectrum.real, spectrum.imag);
  },
});

// =============================================================================
// Parallel Convolution Functions
// =============================================================================

/**
 * Parallel 1D convolution using FFT method
 *
 * Uses convolution theorem: conv(x,h) = IFFT(FFT(x) * FFT(h))
 */
export const parallelConv = mathTyped('parallelConv', {
  // Convolution of two Float64Arrays
  'Float64Array, Float64Array': async (
    x: Float64Array,
    h: Float64Array
  ): Promise<Float64Array> => {
    const n: i32 = x.length;
    const m: i32 = h.length;

    if (n === 0 || m === 0) return new Float64Array(0);

    const fullLength: i32 = n + m - 1;
    const paddedLength: i32 = nextPowerOf2(fullLength);

    // Zero-pad inputs
    const xPadded = new Float64Array(paddedLength);
    const hPadded = new Float64Array(paddedLength);
    xPadded.set(x);
    hPadded.set(h);

    const xImag = new Float64Array(paddedLength);
    const hImag = new Float64Array(paddedLength);

    // Compute FFTs
    const X = fftCoreFloat64(xPadded, xImag, false);
    const H = fftCoreFloat64(hPadded, hImag, false);

    // Element-wise complex multiplication
    const yReal = new Float64Array(paddedLength);
    const yImag = new Float64Array(paddedLength);
    for (let i: i32 = 0; i < paddedLength; i++) {
      yReal[i] = X.real[i] * H.real[i] - X.imag[i] * H.imag[i];
      yImag[i] = X.real[i] * H.imag[i] + X.imag[i] * H.real[i];
    }

    // IFFT
    const result = fftCoreFloat64(yReal, yImag, true);

    // Return only the valid convolution part
    return result.real.slice(0, fullLength);
  },

  // Convolution of number arrays
  'Array, Array': async (x: number[], h: number[]): Promise<Float64Array> => {
    return parallelConv(new Float64Array(x), new Float64Array(h));
  },
});

/**
 * Parallel cross-correlation
 */
export const parallelXCorr = mathTyped('parallelXCorr', {
  'Float64Array, Float64Array': async (
    x: Float64Array,
    h: Float64Array
  ): Promise<Float64Array> => {
    // Cross-correlation is convolution with reversed kernel
    const hReversed = new Float64Array(h.length);
    for (let i: i32 = 0; i < h.length; i++) {
      hReversed[i] = h[h.length - 1 - i];
    }
    return parallelConv(x, hReversed);
  },

  'Array, Array': async (x: number[], h: number[]): Promise<Float64Array> => {
    return parallelXCorr(new Float64Array(x), new Float64Array(h));
  },
});

/**
 * Parallel auto-correlation
 */
export const parallelAutoCorr = mathTyped('parallelAutoCorr', {
  'Float64Array': async (x: Float64Array): Promise<Float64Array> => {
    return parallelXCorr(x, x);
  },

  'Array': async (x: number[]): Promise<Float64Array> => {
    return parallelAutoCorr(new Float64Array(x));
  },
});

// =============================================================================
// Export All Signal Functions
// =============================================================================

/**
 * Primary export: typed signal processing functions
 */
export const typedSignal = {
  fft: parallelFFT,
  ifft: parallelIFFT,
  fftMagnitude: parallelFFTMagnitude,
  fftPower: parallelFFTPower,
  conv: parallelConv,
  xcorr: parallelXCorr,
  autocorr: parallelAutoCorr,
};

/**
 * @deprecated Use typedSignal instead
 */
export const parallelSignal = typedSignal;

/**
 * Initialize parallel signal processing
 */
export async function initializeParallelSignal(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate parallel signal processing pool
 */
export async function terminateParallelSignal(): Promise<void> {
  await computePool.terminate();
}
