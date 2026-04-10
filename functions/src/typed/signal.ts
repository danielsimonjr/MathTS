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

import { mathTyped, Complex } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

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
    return parallelFFTMagnitude(spectrum.real, spectrum.imag) as Promise<Float64Array>;
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
    return parallelFFTPower(spectrum.real, spectrum.imag) as Promise<Float64Array>;
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
    return parallelConv(new Float64Array(x), new Float64Array(h)) as Promise<Float64Array>;
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
    return parallelConv(x, hReversed) as Promise<Float64Array>;
  },

  'Array, Array': async (x: number[], h: number[]): Promise<Float64Array> => {
    return parallelXCorr(new Float64Array(x), new Float64Array(h)) as Promise<Float64Array>;
  },
});

/**
 * Parallel auto-correlation
 */
export const parallelAutoCorr = mathTyped('parallelAutoCorr', {
  'Float64Array': async (x: Float64Array): Promise<Float64Array> => {
    return parallelXCorr(x, x) as Promise<Float64Array>;
  },

  'Array': async (x: number[]): Promise<Float64Array> => {
    return parallelAutoCorr(new Float64Array(x)) as Promise<Float64Array>;
  },
});

// =============================================================================
// Cross-Correlation (sequential, pure function)
// =============================================================================

/**
 * Cross-correlation of two real signals via sliding dot product.
 * Returns array of length (a.length + b.length - 1).
 *
 * @param a - First signal
 * @param b - Second signal
 * @returns Cross-correlation array
 */
export function crossCorrelation(a: number[], b: number[]): number[] {
  const na: i32 = a.length;
  const nb: i32 = b.length;
  if (na === 0 || nb === 0) return [];
  const len: i32 = na + nb - 1;
  const result: number[] = new Array(len).fill(0);
  // Output index k corresponds to lag = k - (nb - 1)
  // R[k] = sum_j a[j] * b[j - lag] = sum_j a[j] * b[j - k + nb - 1]
  for (let k: i32 = 0; k < len; k++) {
    let sum: f64 = 0;
    const lag: i32 = k - (nb - 1);
    for (let j: i32 = 0; j < na; j++) {
      const bi: i32 = j - lag;
      if (bi >= 0 && bi < nb) {
        sum += a[j] * b[bi];
      }
    }
    result[k] = sum;
  }
  return result;
}

/**
 * Auto-correlation of a signal (cross-correlation with itself).
 *
 * @param a - Input signal
 * @returns Auto-correlation array
 */
export function autoCorrelation(a: number[]): number[] {
  return crossCorrelation(a, a);
}

// =============================================================================
// Group Delay
// =============================================================================

/**
 * Compute the group delay of a digital filter defined by numerator and
 * denominator polynomial coefficients.
 *
 * Group delay is the negative derivative of the phase response with
 * respect to angular frequency.
 *
 * @param b - Numerator coefficients (FIR for IIR: b/a)
 * @param a - Denominator coefficients (use [1] for FIR)
 * @param w - Optional array of angular frequencies; defaults to 512 points in [0, pi]
 * @returns Object with { w: number[], delay: number[] }
 */
export function groupDelay(
  b: number[],
  a: number[],
  w?: number[]
): { w: number[]; delay: number[] } {
  const nFreqs: i32 = w ? w.length : 512;
  const freqs: number[] = w
    ? w
    : Array.from({ length: nFreqs }, (_, i) => (i * Math.PI) / (nFreqs - 1));

  const delay: number[] = new Array(nFreqs);

  for (let fi: i32 = 0; fi < nFreqs; fi++) {
    const omega: f64 = freqs[fi];

    // Evaluate B(e^jw) and its derivative
    let bRe: f64 = 0,
      bIm: f64 = 0,
      dbRe: f64 = 0,
      dbIm: f64 = 0;
    for (let k: i32 = 0; k < b.length; k++) {
      const c: f64 = Math.cos(k * omega);
      const s: f64 = Math.sin(k * omega);
      bRe += b[k] * c;
      bIm -= b[k] * s;
      dbRe -= k * b[k] * s;
      dbIm -= k * b[k] * c;
    }

    // Evaluate A(e^jw) and its derivative
    let aRe: f64 = 0,
      aIm: f64 = 0,
      daRe: f64 = 0,
      daIm: f64 = 0;
    for (let k: i32 = 0; k < a.length; k++) {
      const c: f64 = Math.cos(k * omega);
      const s: f64 = Math.sin(k * omega);
      aRe += a[k] * c;
      aIm -= a[k] * s;
      daRe -= k * a[k] * s;
      daIm -= k * a[k] * c;
    }

    // H = B/A, group delay = -d(angle(H))/dw
    // Using: gd = Re{ (B'*A - B*A') / (B*A) } where ' = d/dw (complex)
    // Simplification: gd = Re{B'/B} - Re{A'/A}
    const bMagSq: f64 = bRe * bRe + bIm * bIm;
    const aMagSq: f64 = aRe * aRe + aIm * aIm;

    if (bMagSq < 1e-30 || aMagSq < 1e-30) {
      delay[fi] = 0;
    } else {
      // gd = -Im{H'/H} = Im{A'/A} - Im{B'/B}
      // Im{X'/X} = (X'_im * X_re - X'_re * X_im) / |X|^2
      const imBB: f64 = (dbIm * bRe - dbRe * bIm) / bMagSq;
      const imAA: f64 = (daIm * aRe - daRe * aIm) / aMagSq;
      delay[fi] = imAA - imBB;
    }
  }

  return { w: freqs, delay };
}

// =============================================================================
// Unwrap Phase
// =============================================================================

/**
 * Unwrap phase angles by adding +/-2*pi to remove discontinuities.
 *
 * @param phase - Array of phase values in radians
 * @returns Unwrapped phase array
 */
export function unwrapPhase(phase: number[]): number[] {
  if (phase.length === 0) return [];
  const result = [...phase];
  for (let i: i32 = 1; i < result.length; i++) {
    let diff: f64 = result[i] - result[i - 1];
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    result[i] = result[i - 1] + diff;
  }
  return result;
}

// =============================================================================
// Export All Signal Functions
// =============================================================================

// =============================================================================
// Discrete Cosine Transform (DCT-II / DCT-III)
// =============================================================================

/**
 * Discrete Cosine Transform (Type II).
 *
 * @param x - Input signal
 * @returns DCT coefficients
 *
 * @example
 * dct([1, 2, 3, 4]) // DCT-II coefficients
 */
export function dct(x: number[]): number[] {
  const N: i32 = x.length;
  const result = new Array(N);
  for (let k: i32 = 0; k < N; k++) {
    let sum: f64 = 0;
    for (let n: i32 = 0; n < N; n++) {
      sum += x[n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
    result[k] = sum * (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N));
  }
  return result;
}

/**
 * Inverse Discrete Cosine Transform (Type III).
 *
 * @param X - DCT coefficients
 * @returns Reconstructed signal
 */
export function idct(X: number[]): number[] {
  const N: i32 = X.length;
  const result = new Array(N);
  for (let n: i32 = 0; n < N; n++) {
    let sum: f64 = X[0] * Math.sqrt(1 / N);
    for (let k: i32 = 1; k < N; k++) {
      sum += X[k] * Math.sqrt(2 / N) * Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
    result[n] = sum;
  }
  return result;
}

// =============================================================================
// Discrete Sine Transform (DST-II / DST-III)
// =============================================================================

/**
 * Discrete Sine Transform (Type II).
 *
 * @param x - Input signal
 * @returns DST coefficients
 */
export function dst(x: number[]): number[] {
  const N: i32 = x.length;
  const result = new Array(N);
  for (let k: i32 = 0; k < N; k++) {
    let sum: f64 = 0;
    for (let n: i32 = 0; n < N; n++) {
      sum += x[n] * Math.sin((Math.PI / N) * (n + 0.5) * (k + 1));
    }
    result[k] = sum * Math.sqrt(2 / N);
  }
  return result;
}

/**
 * Inverse Discrete Sine Transform (Type III).
 *
 * @param X - DST coefficients
 * @returns Reconstructed signal
 */
export function idst(X: number[]): number[] {
  const N: i32 = X.length;
  const result = new Array(N);
  for (let n: i32 = 0; n < N; n++) {
    let sum: f64 = 0;
    for (let k: i32 = 0; k < N; k++) {
      const factor = k === N - 1 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      sum += X[k] * factor * Math.sin((Math.PI / N) * (n + 0.5) * (k + 1));
    }
    result[n] = sum;
  }
  return result;
}

// =============================================================================
// Discrete Wavelet Transform (Haar)
// =============================================================================

/**
 * Discrete wavelet transform using Haar wavelet.
 *
 * @param x - Input signal (length must be power of 2)
 * @param wavelet - Wavelet name (currently only 'haar')
 * @returns { approx: number[], detail: number[] }
 */
export function dwt(
  x: number[],
  wavelet: string = 'haar',
): { approx: number[]; detail: number[] } {
  const n: i32 = x.length;
  if (n < 2) throw new Error('dwt: signal must have at least 2 samples');

  const half: i32 = Math.floor(n / 2);
  const approx = new Array(half);
  const detail = new Array(half);

  if (wavelet === 'haar' || wavelet === 'db1') {
    const s: f64 = 1 / Math.SQRT2;
    for (let i: i32 = 0; i < half; i++) {
      approx[i] = s * (x[2 * i] + x[2 * i + 1]);
      detail[i] = s * (x[2 * i] - x[2 * i + 1]);
    }
  } else {
    throw new Error(`dwt: unsupported wavelet "${wavelet}"`);
  }

  return { approx, detail };
}

// =============================================================================
// 2D FFT
// =============================================================================

/**
 * 2D FFT of a matrix (array of arrays).
 *
 * @param x - 2D input (rows x cols), each value is real
 * @returns { real: number[][], imag: number[][] }
 */
export function fft2d(
  x: number[][],
): { real: number[][]; imag: number[][] } {
  const rows: i32 = x.length;
  const cols: i32 = x[0].length;
  const paddedCols: i32 = nextPowerOf2(cols);
  const paddedRows: i32 = nextPowerOf2(rows);

  // FFT each row
  let realData: number[][] = [];
  let imagData: number[][] = [];

  for (let r: i32 = 0; r < paddedRows; r++) {
    const rowReal = new Float64Array(paddedCols);
    const rowImag = new Float64Array(paddedCols);
    if (r < rows) {
      for (let c: i32 = 0; c < Math.min(cols, paddedCols); c++) {
        rowReal[c] = x[r][c];
      }
    }
    const result = fftCoreFloat64(rowReal, rowImag, false);
    realData.push(Array.from(result.real));
    imagData.push(Array.from(result.imag));
  }

  // FFT each column
  const outReal: number[][] = Array.from({ length: paddedRows }, () => new Array(paddedCols));
  const outImag: number[][] = Array.from({ length: paddedRows }, () => new Array(paddedCols));

  for (let c: i32 = 0; c < paddedCols; c++) {
    const colReal = new Float64Array(paddedRows);
    const colImag = new Float64Array(paddedRows);
    for (let r: i32 = 0; r < paddedRows; r++) {
      colReal[r] = realData[r][c];
      colImag[r] = imagData[r][c];
    }
    const result = fftCoreFloat64(colReal, colImag, false);
    for (let r: i32 = 0; r < paddedRows; r++) {
      outReal[r][c] = result.real[r];
      outImag[r][c] = result.imag[r];
    }
  }

  return { real: outReal, imag: outImag };
}

// =============================================================================
// Continuous Fourier Transform (numerical approximation)
// =============================================================================

/**
 * Numerical continuous Fourier transform.
 * F(omega) = integral f(t) * exp(-j*omega*t) dt
 *
 * @param f - Time-domain function
 * @param t - Time sample points
 * @param omega - Frequency to evaluate at
 * @returns { re: number, im: number }
 */
export function fourier(
  f: (t: f64) => f64,
  t: number[],
  omega: f64,
): { re: f64; im: f64 } {
  let re: f64 = 0;
  let im: f64 = 0;
  for (let i: i32 = 1; i < t.length; i++) {
    const dt: f64 = t[i] - t[i - 1];
    const tmid: f64 = (t[i] + t[i - 1]) / 2;
    const fv: f64 = f(tmid);
    re += fv * Math.cos(-omega * tmid) * dt;
    im += fv * Math.sin(-omega * tmid) * dt;
  }
  return { re, im };
}

/**
 * Numerical inverse Fourier transform.
 * f(t) = (1/2pi) integral F(omega) * exp(j*omega*t) domega
 *
 * @param F - Frequency-domain function returning {re, im}
 * @param omega - Frequency sample points
 * @param t - Time point to evaluate at
 * @returns Reconstructed value at t
 */
export function invFourier(
  F: (omega: f64) => { re: f64; im: f64 },
  omega: number[],
  t: f64,
): f64 {
  let result: f64 = 0;
  for (let i: i32 = 1; i < omega.length; i++) {
    const dw: f64 = omega[i] - omega[i - 1];
    const wmid: f64 = (omega[i] + omega[i - 1]) / 2;
    const fv = F(wmid);
    // Re{ F(w) * exp(j*w*t) } = F_re * cos(wt) - F_im * sin(wt)
    result += (fv.re * Math.cos(wmid * t) - fv.im * Math.sin(wmid * t)) * dw;
  }
  return result / (2 * Math.PI);
}

// =============================================================================
// Hilbert Transform
// =============================================================================

/**
 * Hilbert transform of a real signal via FFT.
 *
 * @param x - Real input signal
 * @returns Imaginary part of the analytic signal
 */
export function hilbertTransform(x: number[]): number[] {
  const n: i32 = x.length;
  const N: i32 = nextPowerOf2(n);
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i: i32 = 0; i < n; i++) real[i] = x[i];

  const spectrum = fftCoreFloat64(real, imag, false);

  // Create analytic signal: multiply positive frequencies by 2, zero negative
  const hReal = new Float64Array(N);
  const hImag = new Float64Array(N);
  hReal[0] = spectrum.real[0];
  hImag[0] = spectrum.imag[0];
  if (N > 1) {
    const half: i32 = N / 2;
    for (let i: i32 = 1; i < half; i++) {
      hReal[i] = 2 * spectrum.real[i];
      hImag[i] = 2 * spectrum.imag[i];
    }
    hReal[half] = spectrum.real[half];
    hImag[half] = spectrum.imag[half];
    // Negative frequencies are zero
  }

  const analytic = fftCoreFloat64(hReal, hImag, true);

  // Return imaginary part (the Hilbert transform)
  return Array.from(analytic.imag.slice(0, n));
}

// =============================================================================
// Spectrogram (STFT)
// =============================================================================

/**
 * Compute spectrogram using Short-Time Fourier Transform.
 *
 * @param x - Input signal
 * @param opts - { windowSize, hopSize, window }
 * @returns { magnitude: number[][], frequencies: number[], times: number[] }
 */
export function spectrogram(
  x: number[],
  opts?: { windowSize?: i32; hopSize?: i32; window?: string },
): { magnitude: number[][]; frequencies: number[]; times: number[] } {
  const windowSize: i32 = opts?.windowSize ?? 256;
  const hopSize: i32 = opts?.hopSize ?? Math.floor(windowSize / 2);
  const winType = opts?.window ?? 'hann';

  const win = windowFunction(windowSize, winType);
  const nfft: i32 = nextPowerOf2(windowSize);
  const nFreqs: i32 = nfft / 2 + 1;

  const magnitude: number[][] = [];
  const times: number[] = [];
  const frequencies: number[] = Array.from({ length: nFreqs }, (_, i) => i / nfft);

  for (let start: i32 = 0; start + windowSize <= x.length; start += hopSize) {
    const real = new Float64Array(nfft);
    const imag = new Float64Array(nfft);
    for (let i: i32 = 0; i < windowSize; i++) {
      real[i] = x[start + i] * win[i];
    }

    const result = fftCoreFloat64(real, imag, false);

    const mag: number[] = [];
    for (let i: i32 = 0; i < nFreqs; i++) {
      mag.push(Math.sqrt(result.real[i] ** 2 + result.imag[i] ** 2));
    }
    magnitude.push(mag);
    times.push(start + windowSize / 2);
  }

  return { magnitude, frequencies, times };
}

// =============================================================================
// Periodogram (Power Spectral Density)
// =============================================================================

/**
 * Estimate power spectral density using periodogram method.
 *
 * @param x - Input signal
 * @param opts - { nfft, window }
 * @returns { psd: number[], frequencies: number[] }
 */
export function periodogram(
  x: number[],
  opts?: { nfft?: i32; window?: string },
): { psd: number[]; frequencies: number[] } {
  const nfft: i32 = opts?.nfft ?? nextPowerOf2(x.length);
  const winType = opts?.window ?? 'hann';

  const win = windowFunction(x.length, winType);
  let winPower: f64 = 0;
  for (let i: i32 = 0; i < x.length; i++) winPower += win[i] * win[i];
  winPower /= x.length;

  const real = new Float64Array(nfft);
  const imag = new Float64Array(nfft);
  for (let i: i32 = 0; i < x.length; i++) {
    real[i] = x[i] * win[i];
  }

  const result = fftCoreFloat64(real, imag, false);

  const nFreqs: i32 = nfft / 2 + 1;
  const psd: number[] = [];
  const frequencies: number[] = [];

  for (let i: i32 = 0; i < nFreqs; i++) {
    const power: f64 = (result.real[i] ** 2 + result.imag[i] ** 2) / (x.length * winPower);
    psd.push(i > 0 && i < nfft / 2 ? 2 * power : power);
    frequencies.push(i / nfft);
  }

  return { psd, frequencies };
}

// =============================================================================
// FIR Filters
// =============================================================================

/**
 * Apply a lowpass FIR filter using windowed sinc.
 *
 * @param x - Input signal
 * @param cutoff - Normalized cutoff frequency (0 to 0.5)
 * @param order - Filter order (default 31)
 * @returns Filtered signal
 */
export function lowpassFilter(x: number[], cutoff: f64, order: i32 = 31): number[] {
  const h = _sincFilter(order, cutoff, 'lowpass');
  return _convolve(x, h);
}

/**
 * Apply a highpass FIR filter using windowed sinc.
 *
 * @param x - Input signal
 * @param cutoff - Normalized cutoff frequency (0 to 0.5)
 * @param order - Filter order (default 31)
 * @returns Filtered signal
 */
export function highpassFilter(x: number[], cutoff: f64, order: i32 = 31): number[] {
  const h = _sincFilter(order, cutoff, 'highpass');
  return _convolve(x, h);
}

/**
 * Apply a bandpass FIR filter.
 *
 * @param x - Input signal
 * @param low - Low cutoff frequency (normalized, 0 to 0.5)
 * @param high - High cutoff frequency (normalized, 0 to 0.5)
 * @param order - Filter order (default 31)
 * @returns Filtered signal
 */
export function bandpassFilter(x: number[], low: f64, high: f64, order: i32 = 31): number[] {
  const hLow = _sincFilter(order, low, 'highpass');
  const hHigh = _sincFilter(order, high, 'lowpass');
  // Combine: bandpass = lowpass(high) * highpass(low) via convolution
  const mid = _convolve(x, hHigh);
  return _convolve(mid, hLow);
}

/** Create windowed sinc FIR filter coefficients */
function _sincFilter(order: i32, cutoff: f64, type: 'lowpass' | 'highpass'): number[] {
  if (order % 2 === 0) order += 1;
  const mid: i32 = Math.floor(order / 2);
  const h: number[] = new Array(order);
  const omega: f64 = 2 * Math.PI * cutoff;

  for (let i: i32 = 0; i < order; i++) {
    const n: i32 = i - mid;
    if (n === 0) {
      h[i] = 2 * cutoff;
    } else {
      h[i] = Math.sin(omega * n) / (Math.PI * n);
    }
    // Hamming window
    h[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (order - 1));
  }

  if (type === 'highpass') {
    // Spectral inversion
    for (let i: i32 = 0; i < order; i++) h[i] = -h[i];
    h[mid] += 1;
  }

  return h;
}

/** Direct convolution (same length output) */
function _convolve(x: number[], h: number[]): number[] {
  const n: i32 = x.length;
  const m: i32 = h.length;
  const offset: i32 = Math.floor(m / 2);
  const result: number[] = new Array(n).fill(0);

  for (let i: i32 = 0; i < n; i++) {
    let sum: f64 = 0;
    for (let j: i32 = 0; j < m; j++) {
      const idx: i32 = i - offset + j;
      if (idx >= 0 && idx < n) {
        sum += x[idx] * h[j];
      }
    }
    result[i] = sum;
  }

  return result;
}

// =============================================================================
// Resample
// =============================================================================

/**
 * Resample a signal to a new sample rate using linear interpolation.
 *
 * @param x - Input signal
 * @param newRate - Target sample rate
 * @param oldRate - Original sample rate
 * @returns Resampled signal
 */
export function resample(x: number[], newRate: f64, oldRate: f64): number[] {
  const ratio: f64 = oldRate / newRate;
  const newLen: i32 = Math.round(x.length / ratio);
  const result: number[] = new Array(newLen);

  for (let i: i32 = 0; i < newLen; i++) {
    const srcIdx: f64 = i * ratio;
    const lo: i32 = Math.floor(srcIdx);
    const hi: i32 = Math.min(lo + 1, x.length - 1);
    const frac: f64 = srcIdx - lo;
    result[i] = x[lo] * (1 - frac) + x[hi] * frac;
  }

  return result;
}

// =============================================================================
// Median Filter
// =============================================================================

/**
 * Apply a median filter to a signal.
 *
 * @param x - Input signal
 * @param n - Window size (default 3, must be odd)
 * @returns Filtered signal
 */
export function medfilt(x: number[], n: i32 = 3): number[] {
  if (n % 2 === 0) n += 1;
  const half: i32 = Math.floor(n / 2);
  const result: number[] = new Array(x.length);

  for (let i: i32 = 0; i < x.length; i++) {
    const window: number[] = [];
    for (let j: i32 = i - half; j <= i + half; j++) {
      if (j >= 0 && j < x.length) {
        window.push(x[j]);
      }
    }
    window.sort((a, b) => a - b);
    result[i] = window[Math.floor(window.length / 2)];
  }

  return result;
}

// =============================================================================
// Window Functions
// =============================================================================

/**
 * Generate a window function of given type and length.
 *
 * @param n - Window length
 * @param type - Window type: 'hamming' | 'hann' | 'blackman' | 'rectangular' | 'bartlett'
 * @returns Window coefficients
 */
export function windowFunction(n: i32, type: string): number[] {
  const w: number[] = new Array(n);
  const N1: f64 = n - 1;

  switch (type) {
    case 'hamming':
      for (let i: i32 = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / N1);
      break;
    case 'hann':
    case 'hanning':
      for (let i: i32 = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N1));
      break;
    case 'blackman':
      for (let i: i32 = 0; i < n; i++)
        w[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N1) + 0.08 * Math.cos((4 * Math.PI * i) / N1);
      break;
    case 'bartlett':
      for (let i: i32 = 0; i < n; i++) w[i] = 1 - Math.abs((2 * i - N1) / N1);
      break;
    case 'rectangular':
    case 'rect':
    default:
      for (let i: i32 = 0; i < n; i++) w[i] = 1;
      break;
  }

  return w;
}

// =============================================================================
// Convolution / Correlation Aliases (if not already exported as plain functions)
// =============================================================================

/**
 * Direct convolution of two signals (alias for sequential use).
 *
 * @param a - First signal
 * @param b - Second signal
 * @returns Convolution result (length a.length + b.length - 1)
 */
export function convolve(a: number[], b: number[]): number[] {
  const na: i32 = a.length;
  const nb: i32 = b.length;
  if (na === 0 || nb === 0) return [];
  const len: i32 = na + nb - 1;
  const result: number[] = new Array(len).fill(0);
  for (let i: i32 = 0; i < na; i++) {
    for (let j: i32 = 0; j < nb; j++) {
      result[i + j] += a[i] * b[j];
    }
  }
  return result;
}

/**
 * Cross-correlation of two signals (alias).
 *
 * @param a - First signal
 * @param b - Second signal
 * @returns Cross-correlation result
 */
export function correlate(a: number[], b: number[]): number[] {
  return crossCorrelation(a, b);
}

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
  crossCorrelation,
  autoCorrelation,
  groupDelay,
  unwrapPhase,
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
};

/**
 * Initialize signal processing pool
 */
export async function initializeSignal(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate signal processing pool
 */
export async function terminateSignal(): Promise<void> {
  await computePool.terminate();
}
