/**
 * Typed Signal Processing Functions (Parallel-First)
 *
 * AssemblyScript-friendly TypeScript implementations with typed-function
 * integration and workerpool parallel execution.
 *
 * Includes FFT, IFFT, convolution, and correlation functions optimized
 * for Float64Array.
 *
 * Parallelism note: the element-wise spectrum operations (magnitude, power)
 * offload large Float64Array inputs to the worker pool. The radix-2 FFT
 * butterfly itself runs on the calling thread — its stages have tight
 * data dependencies that a chunked worker dispatch cannot exploit.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { fftCoreFloat64 } from '../signal/fft-core-f64.js';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { wasmLoader } from '../wasm/WasmLoader.js';
import {
  applyWindowDispatch,
  bartlettPSDDispatch,
  chirpZTransformDispatch,
  goertzelDispatch,
  welchPSDDispatch,
  welchPSDJS,
  WASM_SIGNAL_THRESHOLD,
} from '../wasm/signal/wasm-bridge.js';

// =============================================================================
// WASM dispatch threshold — signals shorter than this use pure-TS fallback
// =============================================================================
const WASM_THRESHOLD = 64;

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

// =============================================================================
// Utility Functions (AssemblyScript-Friendly)
// =============================================================================

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

// =============================================================================
// Core FFT Implementation (AssemblyScript-Friendly)
// =============================================================================

// =============================================================================
// Four-Step (Cooley-Tukey transpose) FFT
// =============================================================================

/**
 * Genuinely parallel single-FFT via the four-step (transpose) algorithm.
 *
 * For an N-point DFT with N = N1 * N2 (both powers of two), the transform
 * decomposes into two batches of independent smaller FFTs which are dispatched
 * to the worker pool via `computePool.fftBatch`:
 *
 *  - Index the input  `n = N2 * n1 + n2`  (n1 in [0,N1), n2 in [0,N2))
 *  - Index the output `k = N1 * k2 + k1`  (k1 in [0,N1), k2 in [0,N2))
 *
 *    X[N1*k2 + k1]
 *      = sum_{n2} [ e^(s*2*pi*i*n2*k1/N)
 *                   * ( sum_{n1} x[N2*n1+n2] * e^(s*2*pi*i*n1*k1/N1) ) ]
 *                 * e^(s*2*pi*i*n2*k2/N2)
 *
 *  with s = -1 for the forward transform and s = +1 for the inverse.
 *
 *  Step A — for each n2, an N1-point DFT over n1  (N2 frames of size N1).
 *  Step B — twiddle: multiply element (k1,n2) by e^(s*2*pi*i*n2*k1/N).
 *  Step C — for each k1, an N2-point DFT over n2  (N1 frames of size N2).
 *  Step D — read step-C output into natural order X[N1*k2 + k1].
 *
 * `fftBatch` already scales the inverse transform by 1/frameLength per frame,
 * so for the inverse path: step A divides by N1 and step C divides by N2,
 * yielding the required total 1/N scaling with no extra work.
 *
 * Falls back to `fftCoreFloat64` when N < 4 (too small to split sensibly).
 *
 * @param real - Real part, length N (power of two)
 * @param imag - Imaginary part, length N
 * @param inverse - Compute the inverse transform when true
 */
async function fourStepFFT(
  real: Float64Array,
  imag: Float64Array,
  inverse: boolean
): Promise<{ real: Float64Array; imag: Float64Array }> {
  const N: i32 = real.length;

  // Degenerate / too-small case — split would be trivial, just go sequential.
  if (N < 4 || !isPowerOf2(N)) {
    return fftCoreFloat64(real, imag, inverse);
  }

  // Factor N = N1 * N2, both powers of two. For a perfect square split N1
  // equals N2; for a non-square power of two (e.g. 2048) N2 = 2 * N1.
  const bits: i32 = Math.round(Math.log2(N));
  const bits1: i32 = bits >> 1;
  const N1: i32 = 1 << bits1;
  const N2: i32 = N / N1;

  const sign: f64 = inverse ? 1.0 : -1.0;

  // ---- Step A: N2 frames, each an N1-point DFT over n1 --------------------
  // Frame n2 holds { x[N2*0 + n2], x[N2*1 + n2], ... , x[N2*(N1-1) + n2] }.
  const aReal = new Float64Array(N2 * N1);
  const aImag = new Float64Array(N2 * N1);
  for (let n2: i32 = 0; n2 < N2; n2++) {
    const base: i32 = n2 * N1;
    for (let n1: i32 = 0; n1 < N1; n1++) {
      const src: i32 = N2 * n1 + n2;
      aReal[base + n1] = real[src];
      aImag[base + n1] = imag[src];
    }
  }

  const stepA = await computePool.fftBatch(aReal, aImag, N2, N1, inverse);
  // stepA.result frame n2 holds A[k1, n2] for k1 in [0,N1).
  const aOutReal = stepA.result.real;
  const aOutImag = stepA.result.imag;

  // ---- Step B + repack into step-C frames ---------------------------------
  // Twiddle element (k1, n2) by e^(sign*2*pi*i*n2*k1/N), then lay out as N1
  // frames of size N2: frame k1 holds B[k1, n2] for n2 in [0,N2).
  const cReal = new Float64Array(N1 * N2);
  const cImag = new Float64Array(N1 * N2);
  const twN: f64 = (sign * 2.0 * Math.PI) / N;
  for (let n2: i32 = 0; n2 < N2; n2++) {
    const aBase: i32 = n2 * N1;
    for (let k1: i32 = 0; k1 < N1; k1++) {
      const ar: f64 = aOutReal[aBase + k1];
      const ai: f64 = aOutImag[aBase + k1];
      const ang: f64 = twN * n2 * k1;
      const wr: f64 = Math.cos(ang);
      const wi: f64 = Math.sin(ang);
      const dst: i32 = k1 * N2 + n2;
      cReal[dst] = ar * wr - ai * wi;
      cImag[dst] = ar * wi + ai * wr;
    }
  }

  // ---- Step C: N1 frames, each an N2-point DFT over n2 --------------------
  const stepC = await computePool.fftBatch(cReal, cImag, N1, N2, inverse);
  const cOutReal = stepC.result.real;
  const cOutImag = stepC.result.imag;

  // ---- Step D: read into natural order X[N1*k2 + k1] ----------------------
  const outReal = new Float64Array(N);
  const outImag = new Float64Array(N);
  for (let k1: i32 = 0; k1 < N1; k1++) {
    const cBase: i32 = k1 * N2;
    for (let k2: i32 = 0; k2 < N2; k2++) {
      const dst: i32 = N1 * k2 + k1;
      outReal[dst] = cOutReal[cBase + k2];
      outImag[dst] = cOutImag[cBase + k2];
    }
  }

  return { real: outReal, imag: outImag };
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
  Array: (signal: number[]) => {
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
  Float64Array: async (signal: Float64Array) => {
    const n: i32 = signal.length;
    if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0), originalLength: 0 };

    const paddedLength: i32 = nextPowerOf2(n);
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    // Copy input with zero-padding
    real.set(signal);

    // Large transforms are parallelized across worker threads via the
    // four-step (transpose) decomposition; small ones run on this thread.
    const result = computePool.shouldParallelize(paddedLength)
      ? await fourStepFFT(real, imag, false)
      : fftCoreFloat64(real, imag, false);
    return { ...result, originalLength: n };
  },
});

/**
 * Parallel IFFT with typed-function dispatch.
 *
 * Async: large inverse transforms are parallelized across worker threads via
 * the four-step (transpose) decomposition; small ones run on this thread.
 */
export const parallelIFFT = mathTyped('parallelIFFT', {
  // IFFT from real/imag arrays
  'Float64Array, Float64Array': async (real: Float64Array, imag: Float64Array) => {
    return computePool.shouldParallelize(real.length)
      ? fourStepFFT(real, imag, true)
      : fftCoreFloat64(real, imag, true);
  },

  // IFFT from object with real/imag
  Object: async (spectrum: { real: Float64Array; imag: Float64Array }) => {
    return computePool.shouldParallelize(spectrum.real.length)
      ? fourStepFFT(spectrum.real, spectrum.imag, true)
      : fftCoreFloat64(spectrum.real, spectrum.imag, true);
  },
});

/**
 * FFT magnitude spectrum
 */
export const parallelFFTMagnitude = mathTyped('parallelFFTMagnitude', {
  'Float64Array, Float64Array': async (
    real: Float64Array,
    imag: Float64Array
  ): Promise<Float64Array> => {
    if (computePool.shouldParallelize(real.length)) {
      const r = await computePool.applyKernel2(
        real,
        imag,
        '(re, im) => Math.sqrt(re * re + im * im)'
      );
      return r.result;
    }

    const result = new Float64Array(real.length);
    for (let i: i32 = 0; i < real.length; i++) {
      result[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return result;
  },

  Object: async (spectrum: { real: Float64Array; imag: Float64Array }): Promise<Float64Array> => {
    return parallelFFTMagnitude(spectrum.real, spectrum.imag) as Promise<Float64Array>;
  },
});

/**
 * FFT power spectrum (|X|^2)
 */
export const parallelFFTPower = mathTyped('parallelFFTPower', {
  'Float64Array, Float64Array': async (
    real: Float64Array,
    imag: Float64Array
  ): Promise<Float64Array> => {
    if (computePool.shouldParallelize(real.length)) {
      const r = await computePool.applyKernel2(real, imag, '(re, im) => re * re + im * im');
      return r.result;
    }

    const result = new Float64Array(real.length);
    for (let i: i32 = 0; i < real.length; i++) {
      result[i] = real[i] * real[i] + imag[i] * imag[i];
    }
    return result;
  },

  Object: async (spectrum: { real: Float64Array; imag: Float64Array }): Promise<Float64Array> => {
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
  'Float64Array, Float64Array': async (x: Float64Array, h: Float64Array): Promise<Float64Array> => {
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

    // Forward FFTs — x and h are independent, so we can run them concurrently.
    let XReal: Float64Array;
    let XImag: Float64Array;
    let HReal: Float64Array;
    let HImag: Float64Array;

    if (computePool.shouldParallelize(2 * paddedLength)) {
      // Pack both zero-padded frames into a single 2-frame batch so the worker
      // pool runs FFT(xPadded) and FFT(hPadded) concurrently on two workers.
      const batchReal = new Float64Array(2 * paddedLength);
      const batchImag = new Float64Array(2 * paddedLength);
      batchReal.set(xPadded, 0);
      batchReal.set(hPadded, paddedLength);

      const batch = await computePool.fftBatch(batchReal, batchImag, 2, paddedLength, false);
      XReal = batch.result.real.subarray(0, paddedLength);
      XImag = batch.result.imag.subarray(0, paddedLength);
      HReal = batch.result.real.subarray(paddedLength);
      HImag = batch.result.imag.subarray(paddedLength);
    } else {
      // Sequential fallback: below threshold or pool not initialized.
      const xImag = new Float64Array(paddedLength);
      const hImag = new Float64Array(paddedLength);
      const X = fftCoreFloat64(xPadded, xImag, false);
      const H = fftCoreFloat64(hPadded, hImag, false);
      XReal = X.real;
      XImag = X.imag;
      HReal = H.real;
      HImag = H.imag;
    }

    // Element-wise complex multiplication (sequential — O(N) scalar ops)
    const yReal = new Float64Array(paddedLength);
    const yImag = new Float64Array(paddedLength);
    for (let i: i32 = 0; i < paddedLength; i++) {
      yReal[i] = XReal[i] * HReal[i] - XImag[i] * HImag[i];
      yImag[i] = XReal[i] * HImag[i] + XImag[i] * HReal[i];
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
  'Float64Array, Float64Array': async (x: Float64Array, h: Float64Array): Promise<Float64Array> => {
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
  Float64Array: async (x: Float64Array): Promise<Float64Array> => {
    return parallelXCorr(x, x) as Promise<Float64Array>;
  },

  Array: async (x: number[]): Promise<Float64Array> => {
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

  // WASM-accelerated path
  if (N >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const inAlloc = wasmLoader.allocateFloat64Array(x);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        try {
          wasm.dct_wasm(inAlloc.ptr, outAlloc.ptr, N);
          return Array.from(outAlloc.array);
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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

  // WASM-accelerated path
  if (N >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const inAlloc = wasmLoader.allocateFloat64Array(X);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        try {
          wasm.idct_wasm(inAlloc.ptr, outAlloc.ptr, N);
          return Array.from(outAlloc.array);
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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

  // WASM-accelerated path
  if (N >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const inAlloc = wasmLoader.allocateFloat64Array(x);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        try {
          wasm.dst_wasm(inAlloc.ptr, outAlloc.ptr, N);
          return Array.from(outAlloc.array);
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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

  // WASM-accelerated path
  if (N >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const inAlloc = wasmLoader.allocateFloat64Array(X);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        try {
          wasm.idst_wasm(inAlloc.ptr, outAlloc.ptr, N);
          return Array.from(outAlloc.array);
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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
export function dwt(x: number[], wavelet: string = 'haar'): { approx: number[]; detail: number[] } {
  const n: i32 = x.length;
  if (n < 2) throw new Error('dwt: signal must have at least 2 samples');

  const half: i32 = Math.floor(n / 2);

  if (wavelet === 'haar' || wavelet === 'db1') {
    // WASM-accelerated path
    if (n >= WASM_THRESHOLD && n % 2 === 0) {
      const wasm = wasmLoader.getModule();
      if (wasm) {
        try {
          const inAlloc = wasmLoader.allocateFloat64Array(x);
          const approxAlloc = wasmLoader.allocateFloat64ArrayEmpty(half);
          const detailAlloc = wasmLoader.allocateFloat64ArrayEmpty(half);
          try {
            wasm.dwt_wasm(inAlloc.ptr, approxAlloc.ptr, detailAlloc.ptr, n);
            return {
              approx: Array.from(approxAlloc.array),
              detail: Array.from(detailAlloc.array),
            };
          } finally {
            wasmLoader.free(inAlloc.ptr);
            wasmLoader.free(approxAlloc.ptr);
            wasmLoader.free(detailAlloc.ptr);
          }
        } catch {
          // Fall through to JS
        }
      }
    }

    const approx = new Array(half);
    const detail = new Array(half);
    const s: f64 = 1 / Math.SQRT2;
    for (let i: i32 = 0; i < half; i++) {
      approx[i] = s * (x[2 * i] + x[2 * i + 1]);
      detail[i] = s * (x[2 * i] - x[2 * i + 1]);
    }
    return { approx, detail };
  } else {
    throw new Error(`dwt: unsupported wavelet "${wavelet}"`);
  }
}

// =============================================================================
// 2D FFT
// =============================================================================

/**
 * 2D FFT of a matrix (array of arrays).
 *
 * The transform is two batches of independent 1D FFTs — every row, then every
 * column — so for large inputs each batch is dispatched to the worker pool via
 * `computePool.fftBatch`. Below the parallel threshold (or when the pool is
 * uninitialized) it falls back to the sequential per-row/per-column loop.
 *
 * @param x - 2D input (rows x cols), each value is real
 * @returns { real: number[][], imag: number[][] }
 */
export async function fft2d(x: number[][]): Promise<{ real: number[][]; imag: number[][] }> {
  const rows: i32 = x.length;
  const cols: i32 = x[0].length;
  const paddedCols: i32 = nextPowerOf2(cols);
  const paddedRows: i32 = nextPowerOf2(rows);

  // ---- Pass 1: FFT every row ----------------------------------------------
  // Pack `paddedRows` zero-padded rows of `paddedCols` into one contiguous
  // batch. After the transform, `rowReal`/`rowImag` hold the row-FFT result
  // laid out as `paddedRows` frames of `paddedCols`.
  const rowReal = new Float64Array(paddedRows * paddedCols);
  const rowImag = new Float64Array(paddedRows * paddedCols);
  for (let r: i32 = 0; r < rows; r++) {
    const base: i32 = r * paddedCols;
    const lim: i32 = Math.min(cols, paddedCols);
    for (let c: i32 = 0; c < lim; c++) {
      rowReal[base + c] = x[r][c];
    }
  }

  let rowFFTReal: Float64Array;
  let rowFFTImag: Float64Array;
  if (computePool.shouldParallelize(paddedRows * paddedCols)) {
    const batch = await computePool.fftBatch(rowReal, rowImag, paddedRows, paddedCols, false);
    rowFFTReal = batch.result.real;
    rowFFTImag = batch.result.imag;
  } else {
    rowFFTReal = rowReal;
    rowFFTImag = rowImag;
    for (let r: i32 = 0; r < paddedRows; r++) {
      const base: i32 = r * paddedCols;
      const slice = fftCoreFloat64(
        rowReal.subarray(base, base + paddedCols),
        rowImag.subarray(base, base + paddedCols),
        false
      );
      rowFFTReal.set(slice.real, base);
      rowFFTImag.set(slice.imag, base);
    }
  }

  // ---- Pass 2: FFT every column -------------------------------------------
  // Transpose the row-FFT result into column-major frames: `paddedCols`
  // frames of `paddedRows`.
  const colReal = new Float64Array(paddedCols * paddedRows);
  const colImag = new Float64Array(paddedCols * paddedRows);
  for (let c: i32 = 0; c < paddedCols; c++) {
    const base: i32 = c * paddedRows;
    for (let r: i32 = 0; r < paddedRows; r++) {
      colReal[base + r] = rowFFTReal[r * paddedCols + c];
      colImag[base + r] = rowFFTImag[r * paddedCols + c];
    }
  }

  let colFFTReal: Float64Array;
  let colFFTImag: Float64Array;
  if (computePool.shouldParallelize(paddedCols * paddedRows)) {
    const batch = await computePool.fftBatch(colReal, colImag, paddedCols, paddedRows, false);
    colFFTReal = batch.result.real;
    colFFTImag = batch.result.imag;
  } else {
    colFFTReal = colReal;
    colFFTImag = colImag;
    for (let c: i32 = 0; c < paddedCols; c++) {
      const base: i32 = c * paddedRows;
      const slice = fftCoreFloat64(
        colReal.subarray(base, base + paddedRows),
        colImag.subarray(base, base + paddedRows),
        false
      );
      colFFTReal.set(slice.real, base);
      colFFTImag.set(slice.imag, base);
    }
  }

  // ---- Reassemble into row-major 2D output --------------------------------
  const outReal: number[][] = Array.from({ length: paddedRows }, () => new Array(paddedCols));
  const outImag: number[][] = Array.from({ length: paddedRows }, () => new Array(paddedCols));
  for (let c: i32 = 0; c < paddedCols; c++) {
    const base: i32 = c * paddedRows;
    for (let r: i32 = 0; r < paddedRows; r++) {
      outReal[r][c] = colFFTReal[base + r];
      outImag[r][c] = colFFTImag[base + r];
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
export function fourier(f: (t: f64) => f64, t: number[], omega: f64): { re: f64; im: f64 } {
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
export function invFourier(F: (omega: f64) => { re: f64; im: f64 }, omega: number[], t: f64): f64 {
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

  // WASM-accelerated path (requires power-of-2 length)
  if (N >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        // Pad input to power of 2
        const paddedInput = new Array(N).fill(0);
        for (let i = 0; i < n; i++) paddedInput[i] = x[i];
        const zeros = new Array(N).fill(0);

        const inReAlloc = wasmLoader.allocateFloat64Array(paddedInput);
        const inImAlloc = wasmLoader.allocateFloat64Array(zeros);
        const outReAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        const outImAlloc = wasmLoader.allocateFloat64ArrayEmpty(N);
        try {
          wasm.hilbert_wasm(inReAlloc.ptr, inImAlloc.ptr, outReAlloc.ptr, outImAlloc.ptr, N);
          // Return imaginary part (the Hilbert transform) trimmed to original length
          return Array.from(outImAlloc.array.slice(0, n));
        } finally {
          wasmLoader.free(inReAlloc.ptr);
          wasmLoader.free(inImAlloc.ptr);
          wasmLoader.free(outReAlloc.ptr);
          wasmLoader.free(outImAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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
 * Each windowed frame is FFT'd independently, so for large inputs the frames
 * are dispatched as a batch to the worker pool via `computePool.fftBatch`.
 * Below the parallel threshold (or when the pool is uninitialized) it falls
 * back to the sequential per-frame loop.
 *
 * @param x - Input signal
 * @param opts - { windowSize, hopSize, window }
 * @returns { magnitude: number[][], frequencies: number[], times: number[] }
 */
export async function spectrogram(
  x: number[],
  opts?: { windowSize?: i32; hopSize?: i32; window?: string }
): Promise<{ magnitude: number[][]; frequencies: number[]; times: number[] }> {
  const windowSize: i32 = opts?.windowSize ?? 256;
  const hopSize: i32 = opts?.hopSize ?? Math.floor(windowSize / 2);
  const winType = opts?.window ?? 'hann';
  const nfft: i32 = nextPowerOf2(windowSize);
  const nFreqs: i32 = nfft / 2 + 1;

  // WASM-accelerated path (uses built-in Hann window)
  if (x.length >= WASM_THRESHOLD && (winType === 'hann' || winType === 'hanning')) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const numFrames = Math.floor((x.length - windowSize) / hopSize) + 1;
        if (numFrames > 0) {
          const inAlloc = wasmLoader.allocateFloat64Array(x);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(numFrames * nFreqs);
          try {
            const frames = wasm.spectrogram_wasm(
              inAlloc.ptr,
              outAlloc.ptr,
              x.length,
              windowSize,
              hopSize
            );
            const magnitude: number[][] = [];
            const times: number[] = [];
            const frequencies: number[] = Array.from({ length: nFreqs }, (_, i) => i / nfft);
            for (let f = 0; f < frames; f++) {
              magnitude.push(Array.from(outAlloc.array.slice(f * nFreqs, (f + 1) * nFreqs)));
              times.push(f * hopSize + windowSize / 2);
            }
            return { magnitude, frequencies, times };
          } finally {
            wasmLoader.free(inAlloc.ptr);
            wasmLoader.free(outAlloc.ptr);
          }
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  const win = windowFunction(windowSize, winType);

  const magnitude: number[][] = [];
  const times: number[] = [];
  const frequencies: number[] = Array.from({ length: nFreqs }, (_, i) => i / nfft);

  // Collect every frame start offset; each frame is an independent FFT.
  const starts: i32[] = [];
  for (let start: i32 = 0; start + windowSize <= x.length; start += hopSize) {
    starts.push(start);
  }
  const frameCount: i32 = starts.length;
  if (frameCount === 0) {
    return { magnitude, frequencies, times };
  }

  for (let f: i32 = 0; f < frameCount; f++) {
    times.push(starts[f] + windowSize / 2);
  }

  // Parallel path: pack all windowed frames into one contiguous batch and
  // dispatch the independent FFTs to the worker pool.
  if (computePool.shouldParallelize(frameCount * nfft)) {
    const realBatch = new Float64Array(frameCount * nfft);
    const imagBatch = new Float64Array(frameCount * nfft);
    for (let f: i32 = 0; f < frameCount; f++) {
      const base: i32 = f * nfft;
      const start: i32 = starts[f];
      for (let i: i32 = 0; i < windowSize; i++) {
        realBatch[base + i] = x[start + i] * win[i];
      }
    }

    const batch = await computePool.fftBatch(realBatch, imagBatch, frameCount, nfft, false);

    for (let f: i32 = 0; f < frameCount; f++) {
      const base: i32 = f * nfft;
      const mag: number[] = [];
      for (let i: i32 = 0; i < nFreqs; i++) {
        const re: f64 = batch.result.real[base + i];
        const im: f64 = batch.result.imag[base + i];
        mag.push(Math.sqrt(re * re + im * im));
      }
      magnitude.push(mag);
    }

    return { magnitude, frequencies, times };
  }

  // Sequential fallback (below threshold or pool uninitialized).
  for (let f: i32 = 0; f < frameCount; f++) {
    const start: i32 = starts[f];
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
  opts?: { nfft?: i32; window?: string }
): { psd: number[]; frequencies: number[] } {
  const nfft: i32 = opts?.nfft ?? nextPowerOf2(x.length);
  const winType = opts?.window ?? 'hann';

  // WASM-accelerated path (uses built-in Hann window, nfft = next power of 2)
  if (
    x.length >= WASM_THRESHOLD &&
    (winType === 'hann' || winType === 'hanning') &&
    nfft === nextPowerOf2(x.length)
  ) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const nFreqs: i32 = nfft / 2 + 1;
        const inAlloc = wasmLoader.allocateFloat64Array(x);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(nFreqs);
        try {
          wasm.periodogram_wasm(inAlloc.ptr, outAlloc.ptr, x.length);
          const psd = Array.from(outAlloc.array);
          const frequencies = Array.from({ length: nFreqs }, (_, i) => i / nfft);
          return { psd, frequencies };
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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

  // WASM-accelerated path via fir_filter_wasm
  if (n >= WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const inAlloc = wasmLoader.allocateFloat64Array(x);
        const coeffAlloc = wasmLoader.allocateFloat64Array(h);
        const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
        try {
          wasm.fir_filter_wasm(inAlloc.ptr, coeffAlloc.ptr, outAlloc.ptr, n, m);
          return Array.from(outAlloc.array);
        } finally {
          wasmLoader.free(inAlloc.ptr);
          wasmLoader.free(coeffAlloc.ptr);
          wasmLoader.free(outAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

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
        w[i] =
          0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N1) + 0.08 * Math.cos((4 * Math.PI * i) / N1);
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

// =============================================================================
// Slice 5.6 — Spectral windowing WASM dispatch
// =============================================================================

/**
 * Welch's overlapped-segment-averaging Power Spectral Density.
 *
 * For arrays >= WASM_SIGNAL_THRESHOLD samples (4096) dispatches to the
 * WASM kernel (AS → JS fallback).
 *
 * @param signal - Input signal samples
 * @param opts - { frameLength, overlap, window }
 * @returns { psd: number[], frequencies: number[], frameLength: number }
 */
export function welchPSD(
  signal: number[] | Float64Array,
  opts?: { frameLength?: i32; overlap?: i32; window?: string }
): { psd: number[]; frequencies: number[]; frameLength: number } {
  const samples = signal instanceof Float64Array ? signal : new Float64Array(signal);
  const frameLength: i32 = opts?.frameLength ?? 256;
  const overlap: i32 = opts?.overlap ?? Math.floor(frameLength / 2);
  const window = opts?.window ?? 'hann';

  const psdArr = welchPSDDispatch(samples, frameLength, overlap, window);
  const nfft = frameLength;
  const psd = Array.from(psdArr);
  const frequencies = Array.from({ length: psdArr.length }, (_, i) => i / nfft);
  return { psd, frequencies, frameLength };
}

/**
 * Bartlett's non-overlapped segment-averaging Power Spectral Density.
 *
 * Special case of Welch with overlap=0 and rectangular window.
 *
 * @param signal - Input signal samples
 * @param opts - { frameLength }
 * @returns { psd: number[], frequencies: number[], frameLength: number }
 */
export function bartlettPSD(
  signal: number[] | Float64Array,
  opts?: { frameLength?: i32 }
): { psd: number[]; frequencies: number[]; frameLength: number } {
  const samples = signal instanceof Float64Array ? signal : new Float64Array(signal);
  const frameLength: i32 = opts?.frameLength ?? 256;

  const psdArr = bartlettPSDDispatch(samples, frameLength);
  const nfft = frameLength;
  const psd = Array.from(psdArr);
  const frequencies = Array.from({ length: psdArr.length }, (_, i) => i / nfft);
  return { psd, frequencies, frameLength };
}

/**
 * Multi-taper Power Spectral Density (Thomson's method, order K=5).
 *
 * Uses K discrete prolate spheroidal sequences (DPSS, approximated here
 * as Slepian windows via cos-sum) to reduce spectral leakage. The final
 * PSD is the mean of the K individual tapered periodograms.
 *
 * For large inputs, each tapered periodogram is computed via the WASM
 * Welch kernel (frame = full signal, overlap = 0).
 *
 * @param signal - Input signal samples
 * @param opts - { nfft, K } (K = number of tapers, default 5)
 * @returns { psd: number[], frequencies: number[] }
 */
export function multiTaperPSD(
  signal: number[] | Float64Array,
  opts?: { nfft?: i32; K?: i32 }
): { psd: number[]; frequencies: number[] } {
  const samples = signal instanceof Float64Array ? signal : new Float64Array(signal);
  const n: i32 = samples.length;
  const nfft: i32 = opts?.nfft ?? (Math.pow(2, Math.ceil(Math.log2(n))) as i32);
  const K: i32 = opts?.K ?? 5;

  // Approximate Slepian tapers via discrete cosine windows.
  // Taper k: w_k[n] = sin((k+1) * pi * n / (N+1)) — a sine-family taper.
  const psdLen: i32 = nfft / 2 + 1;
  const accumPsd = new Float64Array(psdLen);

  for (let k: i32 = 0; k < K; k++) {
    // Build taper k and apply to signal
    const tapered = new Float64Array(n);
    for (let j: i32 = 0; j < n; j++) {
      const w: f64 = Math.sin(((k + 1) * Math.PI * (j + 1)) / (n + 1));
      tapered[j] = samples[j] * w;
    }

    // Per-taper PSD via Welch (single frame = full signal, no overlap)
    let frameLen: i32 = nfft;
    if (frameLen > n) frameLen = n;
    const taperPsd =
      n >= WASM_SIGNAL_THRESHOLD
        ? welchPSDDispatch(tapered, frameLen, 0, 'rect')
        : welchPSDJS(tapered, frameLen, 0, 3);

    for (let i: i32 = 0; i < psdLen && i < taperPsd.length; i++) {
      accumPsd[i] += taperPsd[i];
    }
  }

  // Average over tapers
  const psd: number[] = [];
  const frequencies: number[] = [];
  for (let i: i32 = 0; i < psdLen; i++) {
    psd.push(accumPsd[i] / K);
    frequencies.push(i / nfft);
  }
  return { psd, frequencies };
}

/**
 * Goertzel algorithm: compute the power |X[k]|² at a single frequency.
 *
 * Dispatches to the WASM kernel for arrays >= 4096 samples.
 *
 * @param signal - Input signal samples
 * @param targetFreq - Target frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @returns |X[k]|² (unnormalized power at the target frequency)
 */
export function goertzel(signal: number[] | Float64Array, targetFreq: f64, sampleRate: f64): f64 {
  const samples = signal instanceof Float64Array ? signal : new Float64Array(signal);
  return goertzelDispatch(samples, targetFreq, sampleRate);
}

/**
 * Chirp-Z Transform (Bluestein algorithm).
 *
 * Computes M points of the z-transform along a chirp contour in the
 * z-plane. The contour is defined by:
 *   A = exp(2πi·phiStart)  — starting point
 *   W = exp(2πi·phiStep)   — angular step
 *
 * Dispatches to the WASM kernel for max(n, m) >= 4096.
 *
 * @param signal - Input signal samples (real)
 * @param m - Number of output points
 * @param phiStart - Start angle in turns (e.g. 0 = DC, 0.5 = Nyquist)
 * @param phiStep - Step angle in turns (negative for standard DFT)
 * @returns { re: Float64Array, im: Float64Array } — M complex output values
 */
export function chirpZTransform(
  signal: number[] | Float64Array,
  m: i32,
  phiStart: f64 = 0,
  phiStep: f64 = -1 / (signal instanceof Float64Array ? signal.length : signal.length)
): { re: Float64Array; im: Float64Array } {
  const samples = signal instanceof Float64Array ? signal : new Float64Array(signal);
  // Convert turns to complex exponentials
  const twoPi = 2 * Math.PI;
  const phiStartRe: f64 = Math.cos(twoPi * phiStart);
  const phiStartIm: f64 = Math.sin(twoPi * phiStart);
  const phiStepRe: f64 = Math.cos(twoPi * phiStep);
  const phiStepIm: f64 = Math.sin(twoPi * phiStep);

  return chirpZTransformDispatch(samples, m, phiStartRe, phiStartIm, phiStepRe, phiStepIm);
}

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
  // Slice 5.6 additions
  welchPSD,
  bartlettPSD,
  multiTaperPSD,
  goertzel,
  chirpZTransform,
  applyWindow: applyWindowDispatch,
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
