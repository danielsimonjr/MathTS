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

import { nativeMatrixRows, type NativeMatrixInput } from '../matrix/native-matrix-rows.js';
import { windowFunctionCore, type SpectralSegmentOptions } from '../signal/spectral-segments.js';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { assertAllocSize } from '../utils/limits.js';
import { toSamples } from '../utils/samples.js';
import type { PublicParallelFFT } from './public-type-exports.js';
import { fftCoreFloat64, fftExactFloat64, fftRealCoreFloat64 } from '../signal/fft-core-f64.js';
import { fftGpuDispatch } from '../gpu/fft-gpu.js';
import { implicitGpuAllowed } from '../gpu/implicit.js';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { mapBinaryF64 } from './parallel-map.js';
import {
  applyWindowDispatch,
  bartlettPSDDispatch,
  chirpZTransformDispatch,
  goertzelDispatch,
  welchPSDDispatch,
  welchPSDJS,
  windowTypeCode,
  WASM_SIGNAL_THRESHOLD,
} from '../wasm/signal/wasm-bridge.js';
import { dwtPeriodization } from '../signal/wavelet-filters.js';

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

/** The FFT result shape. `gen-public-overloads` reads the return annotation of each signature. */
type FftResult = { real: Float64Array; imag: Float64Array; originalLength: number };
type FftResultPromise = Promise<{ real: Float64Array; imag: Float64Array; originalLength: number }>;

/**
 * Parallel FFT with typed-function dispatch.
 *
 * Supports: number[], Float64Array.
 *
 * Return shape (both signatures): `{ real: Float64Array, imag: Float64Array, originalLength: number }`.
 * `real` and `imag` have length `nextPowerOf2(n)` (zero-padded when `n` is not a power of two).
 * `originalLength` is the input length `n`. This is not NumPy's length-n `np.fft.fft`; the
 * factory `fft` in `functions/src/matrix/fft.ts` is the length-n `Complex[]` transform.
 * `parallelIFFT` of this object inverts the padded spectrum, so the first `originalLength`
 * samples of `.real` recover a real input.
 */
export const parallelFFT = mathTyped('parallelFFT', {
  // FFT of number array
  Array: (signal: number[]): FftResult => {
    // `toSamples` rejects an entry with no numeric reading (a nested Array gave NaN bins, #964).
    const samples = toSamples('parallelFFT', signal);
    const n: i32 = samples.length;
    if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0), originalLength: 0 };

    const paddedLength: i32 = nextPowerOf2(n);
    const real = paddedLength === n ? samples : new Float64Array(paddedLength);
    if (real !== samples) real.set(samples);

    const result = fftRealCoreFloat64(real);
    return { ...result, originalLength: n };
  },

  // FFT of Float64Array (parallel-ready)
  Float64Array: async (signal: Float64Array): FftResultPromise => {
    const n: i32 = signal.length;
    if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0), originalLength: 0 };

    const paddedLength: i32 = nextPowerOf2(n);
    const useWorkers = computePool.shouldParallelize(paddedLength, 'parallelFFT');
    const useGpu = implicitGpuAllowed();
    if (!useWorkers && !useGpu && paddedLength === n) {
      const result = fftRealCoreFloat64(signal);
      return { ...result, originalLength: n };
    }

    const real = new Float64Array(paddedLength);
    real.set(signal);
    if (!useWorkers && !useGpu) {
      const result = fftRealCoreFloat64(real);
      return { ...result, originalLength: n };
    }

    // GPU execution may defer reading the input, so use the private padded copy.
    const imag = new Float64Array(paddedLength);
    const gpu = useGpu ? await fftGpuDispatch(real, imag, false) : null;
    if (gpu) return { real: gpu.real, imag: gpu.imag, originalLength: n };

    const result = useWorkers ? await fourStepFFT(real, imag, false) : fftRealCoreFloat64(real);
    return { ...result, originalLength: n };
  },
}) as PublicParallelFFT;

/**
 * Parallel IFFT with typed-function dispatch.
 *
 * Async: large inverse transforms are parallelized across worker threads via
 * the four-step (transpose) decomposition; small ones run on this thread.
 */
export const parallelIFFT = mathTyped('parallelIFFT', {
  // IFFT from real/imag arrays
  'Float64Array, Float64Array': async (real: Float64Array, imag: Float64Array) => {
    // Same tier rules as parallelFFT — see the note there.
    const gpu = await fftGpuDispatch(real, imag, true);
    if (gpu) return gpu;

    return computePool.shouldParallelize(real.length, 'parallelFFT')
      ? fourStepFFT(real, imag, true)
      : fftCoreFloat64(real, imag, true);
  },

  // IFFT from object with real/imag
  Object: async (spectrum: { real: Float64Array; imag: Float64Array }) => {
    const gpu = await fftGpuDispatch(spectrum.real, spectrum.imag, true);
    if (gpu) return gpu;

    return computePool.shouldParallelize(spectrum.real.length, 'parallelFFT')
      ? fourStepFFT(spectrum.real, spectrum.imag, true)
      : fftCoreFloat64(spectrum.real, spectrum.imag, true);
  },
});

/**
 * FFT magnitude spectrum
 */
export const parallelFFTMagnitude = mathTyped('parallelFFTMagnitude', {
  'Float64Array, Float64Array': (real: Float64Array, imag: Float64Array): Promise<Float64Array> =>
    mapBinaryF64(
      real,
      imag,
      (re, im) => Math.sqrt(re * re + im * im),
      '(re, im) => Math.sqrt(re * re + im * im)',
      'parallelFFT'
    ),

  Object: async (spectrum: { real: Float64Array; imag: Float64Array }): Promise<Float64Array> => {
    return parallelFFTMagnitude(spectrum.real, spectrum.imag) as Promise<Float64Array>;
  },
});

/**
 * FFT power spectrum (|X|^2)
 */
export const parallelFFTPower = mathTyped('parallelFFTPower', {
  'Float64Array, Float64Array': (real: Float64Array, imag: Float64Array): Promise<Float64Array> =>
    mapBinaryF64(
      real,
      imag,
      (re, im) => re * re + im * im,
      '(re, im) => re * re + im * im',
      'parallelFFT'
    ),

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
    return parallelConv(
      toSamples('parallelConv', x, 'x'),
      toSamples('parallelConv', h, 'h')
    ) as Promise<Float64Array>;
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
    return parallelXCorr(
      toSamples('parallelXCorr', x, 'x'),
      toSamples('parallelXCorr', h, 'h')
    ) as Promise<Float64Array>;
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
    return parallelAutoCorr(toSamples('parallelAutoCorr', x)) as Promise<Float64Array>;
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
 * Floating-point remainder with the sign of the divisor, as `numpy.mod` (`npy_divmod`) for
 * floats. A zero result is +0 for a positive divisor. A NaN or an infinite dividend gives NaN.
 * `((a % b) + b) % b` is not the same: its addition rounds.
 */
function floatMod(a: f64, b: f64): f64 {
  let r: f64 = a % b;
  if (r !== 0) {
    if (r < 0 !== b < 0) r += b;
  } else {
    // A zero remainder takes the sign of the divisor (`copysign(0, b)` in `npy_divmod`).
    r = b < 0 ? -0 : 0;
  }
  return r;
}

/**
 * Unwrap phase angles by adding multiples of 2*pi, so no step between neighbours exceeds pi.
 *
 * This is `numpy.unwrap` with period 2*pi and `discont = pi`: each correction comes from the
 * raw difference of two neighbours, and the corrections add up in one pass, so the cost is
 * O(n) at any phase value. A step of exactly -pi becomes +pi when the raw step was positive.
 * Values equal `numpy.unwrap` to the last bit. A step that is NaN, infinite or overflows has
 * no wrapped value: that entry and every later entry are NaN, as in NumPy.
 *
 * @param phase - Array of phase values in radians
 * @returns Unwrapped phase array
 * @throws TypeError if `phase` is not a 1-D array or a typed array (a Matrix or a nested array is
 *   rejected by name)
 */
export function unwrapPhase(phase: number[]): number[] {
  // A nested array is not a phase signal: its rows would be read as strings and NaN.
  if (Array.isArray(phase) && Array.isArray(phase[0])) {
    throw new TypeError('unwrapPhase: phase must be a 1-D array or a typed array');
  }
  // An array is read in place: a Float64Array copy of it costs more than the loop. Any other
  // value goes through toSamples, which converts a typed array and rejects the rest by name.
  const samples: ArrayLike<number> = Array.isArray(phase)
    ? phase
    : toSamples('unwrapPhase', phase, 'phase');
  const n: i32 = samples.length;
  if (n === 0) return [];
  const period: f64 = 2 * Math.PI;
  const result: number[] = new Array<number>(n);
  let previous: f64 = samples[0];
  result[0] = previous;
  let cumulative: f64 = 0;
  for (let i: i32 = 1; i < n; i++) {
    const current: f64 = samples[i];
    const diff: f64 = current - previous;
    previous = current;
    // A step below pi keeps its value: its correction is exactly zero, so the remainder (a slow
    // fmod) runs only for a step of pi or more, or a NaN step, whose correction is NaN.
    if (!(Math.abs(diff) < Math.PI)) {
      let wrapped: f64 = floatMod(diff + Math.PI, period) - Math.PI;
      if (wrapped === -Math.PI && diff > 0) wrapped = Math.PI;
      cumulative += wrapped - diff;
    }
    result[i] = current + cumulative;
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
 * @throws TypeError if `x` is not an array or a typed array (a Matrix is rejected by name)
 *
 * @example
 * dct([1, 2, 3, 4]) // DCT-II coefficients
 */
export function dct(x: number[]): number[] {
  const samples = toSamples('dct', x);
  const N: i32 = samples.length;

  const result = new Array(N);
  for (let k: i32 = 0; k < N; k++) {
    let sum: f64 = 0;
    for (let n: i32 = 0; n < N; n++) {
      sum += samples[n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
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
 * @throws TypeError if `X` is not an array or a typed array (a Matrix is rejected by name)
 */
export function idct(X: number[]): number[] {
  const coeffs = toSamples('idct', X);
  const N: i32 = coeffs.length;

  const result = new Array(N);
  for (let n: i32 = 0; n < N; n++) {
    let sum: f64 = coeffs[0] * Math.sqrt(1 / N);
    for (let k: i32 = 1; k < N; k++) {
      sum += coeffs[k] * Math.sqrt(2 / N) * Math.cos((Math.PI / N) * (n + 0.5) * k);
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
 * @throws TypeError if `x` is not an array or a typed array (a Matrix is rejected by name)
 */
export function dst(x: number[]): number[] {
  const samples = toSamples('dst', x);
  const N: i32 = samples.length;

  const result = new Array(N);
  for (let k: i32 = 0; k < N; k++) {
    let sum: f64 = 0;
    for (let n: i32 = 0; n < N; n++) {
      sum += samples[n] * Math.sin((Math.PI / N) * (n + 0.5) * (k + 1));
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
 * @throws TypeError if `X` is not an array or a typed array (a Matrix is rejected by name)
 */
export function idst(X: number[]): number[] {
  const coeffs = toSamples('idst', X);
  const N: i32 = coeffs.length;

  const result = new Array(N);
  for (let n: i32 = 0; n < N; n++) {
    let sum: f64 = 0;
    for (let k: i32 = 0; k < N; k++) {
      const factor = k === N - 1 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      sum += coeffs[k] * factor * Math.sin((Math.PI / N) * (n + 0.5) * (k + 1));
    }
    result[n] = sum;
  }
  return result;
}

// =============================================================================
// Discrete Wavelet Transform (Haar)
// =============================================================================

/**
 * Single-level discrete wavelet transform (periodization boundary).
 *
 * Haar/db1 use a dedicated closed-form 2-tap path.
 * All other supported families (db2-4, sym2-4, coif1-2) route through the
 * general orthogonal filter bank in `../signal/wavelet-filters.ts`, which is
 * verified to reproduce this same Haar/db1 result bit-for-bit and to match
 * `pywt.dwt(..., mode='periodization')` for every family.
 *
 * @param x - Input signal (length >= 2)
 * @param wavelet - Wavelet name; see `SUPPORTED_WAVELETS` in
 *   `../signal/wavelet-filters.ts` for the full list
 * @returns `{ approx: number[], detail: number[] }`
 */
export function dwt(x: number[], wavelet: string = 'haar'): { approx: number[]; detail: number[] } {
  const n: i32 = x.length;
  if (n < 2) throw new Error('dwt: signal must have at least 2 samples');

  const half: i32 = Math.floor(n / 2);

  if (wavelet === 'haar' || wavelet === 'db1') {
    const approx = new Array(half);
    const detail = new Array(half);
    const s: f64 = 1 / Math.SQRT2;
    for (let i: i32 = 0; i < half; i++) {
      approx[i] = s * (x[2 * i] + x[2 * i + 1]);
      detail[i] = s * (x[2 * i] - x[2 * i + 1]);
    }
    return { approx, detail };
  } else {
    try {
      return dwtPeriodization(x, wavelet);
    } catch (err) {
      throw new Error(`dwt: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
}

// =============================================================================
// 2D FFT
// =============================================================================

/**
 * 2D FFT of a matrix (array of arrays).
 *
 * The transform is two batches of independent 1D FFTs: every row, then every
 * column. It is synchronous at every size. For worker threads, call
 * `computePool.fftBatch` from `@danielsimonjr/mathts-parallel` on the packed rows.
 *
 * @param xInput - 2D input (rows x cols), each value is real
 * @returns `{ real: number[][], imag: number[][] }`
 */
export function fft2d(xInput: NativeMatrixInput<number[][]>): {
  real: number[][];
  imag: number[][];
} {
  const x: number[][] = nativeMatrixRows(xInput);
  if (!Array.isArray(x)) throw new TypeError('fft2d: expected a 2-D array');
  const rows: i32 = x.length;
  // No elements, no spectrum: keep the input shape. Padding 0 to a power of two would give 1x1.
  if (rows === 0) return { real: [], imag: [] };
  // Each row is an array or a typed array of values. A 1-D or 3-D input, or rows of unequal
  // length, would read `undefined` or an array as a sample and give NaN or a cropped spectrum.
  const isRow = (row: unknown): boolean =>
    Array.isArray(row) || (ArrayBuffer.isView(row) && !(row instanceof DataView));
  const cols: i32 = isRow(x[0]) ? x[0].length : 0;
  for (let r: i32 = 0; r < rows; r++) {
    if (!isRow(x[r]) || Array.isArray(x[r][0])) {
      throw new TypeError('fft2d: expected a 2-D array');
    }
    if (x[r].length !== cols) {
      throw new RangeError(
        `fft2d: every row must have ${cols} values (row ${r} has ${x[r].length})`
      );
    }
  }
  if (cols === 0) {
    return { real: x.map(() => []), imag: x.map(() => []) };
  }
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

  // fftCoreFloat64 returns new arrays; copy each row result back into the batch.
  for (let r: i32 = 0; r < paddedRows; r++) {
    const base: i32 = r * paddedCols;
    const slice = fftCoreFloat64(
      rowReal.subarray(base, base + paddedCols),
      rowImag.subarray(base, base + paddedCols),
      false
    );
    rowReal.set(slice.real, base);
    rowImag.set(slice.imag, base);
  }
  const rowFFTReal = rowReal;
  const rowFFTImag = rowImag;

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

  for (let c: i32 = 0; c < paddedCols; c++) {
    const base: i32 = c * paddedRows;
    const slice = fftCoreFloat64(
      colReal.subarray(base, base + paddedRows),
      colImag.subarray(base, base + paddedRows),
      false
    );
    colReal.set(slice.real, base);
    colImag.set(slice.imag, base);
  }
  const colFFTReal = colReal;
  const colFFTImag = colImag;

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
 * @returns `{ re: number, im: number }`
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
 * @throws TypeError if `x` is not an array or a typed array (a Matrix is rejected by name)
 */
export function hilbertTransform(x: number[]): number[] {
  const samples = toSamples('hilbertTransform', x);
  const n: i32 = samples.length;
  const N: i32 = nextPowerOf2(n);

  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i: i32 = 0; i < n; i++) real[i] = samples[i];

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
 * Each windowed frame is an independent FFT, zero-padded to the next power of two (`nfft`), so
 * bin `i` is at the frequency `i / nfft`. The function is synchronous at every size. For worker
 * threads, call `computePool.fftBatch` from `@danielsimonjr/mathts-parallel` on the packed frames.
 *
 * A defaulted `windowSize` is 256 clamped to the signal length, as for {@link welchPSD}; a
 * defaulted `hopSize` is half the window, and at least 1. An explicit `windowSize` longer than
 * the signal returns no frames. `windowSize` and `hopSize` must be integers of at least 1.
 * An empty signal has no frames and no frequencies, as for {@link welchPSD}.
 *
 * @param x - Input signal
 * @param opts - { windowSize, hopSize, window }
 * @returns `{ magnitude: number[][], frequencies: number[], times: number[] }`
 * @throws TypeError if `x` is not an array or a typed array (a Matrix is rejected by name)
 * @throws RangeError if the window has no power (a Hann window of length 2 is all zeros)
 */
export function spectrogram(
  x: number[],
  opts?: { windowSize?: i32; hopSize?: i32; window?: string }
): { magnitude: number[][]; frequencies: number[]; times: number[] } {
  const samples = toSamples('spectrogram', x);
  if (samples.length === 0) return { magnitude: [], frequencies: [], times: [] };
  const windowSize: i32 = resolvePsdFrameLength(samples.length, opts?.windowSize);
  const hopSize: i32 = opts?.hopSize ?? Math.max(1, Math.floor(windowSize / 2));
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError(
      `spectrogram: windowSize must be an integer of at least 1 (got ${windowSize})`
    );
  }
  if (!Number.isInteger(hopSize) || hopSize < 1) {
    throw new RangeError(`spectrogram: hopSize must be an integer of at least 1 (got ${hopSize})`);
  }
  const winType = opts?.window ?? 'hann';
  const nfft: i32 = nextPowerOf2(windowSize);
  const nFreqs: i32 = Math.floor(nfft / 2) + 1;

  const win = windowFunction(windowSize, winType);
  // A Hann window of length 2 is [0, 0]: every frame would have zero magnitude.
  let winPower: f64 = 0;
  for (let i: i32 = 0; i < windowSize; i++) winPower += win[i] * win[i];
  if (!(winPower > 0)) {
    throw new RangeError(
      `spectrogram: the '${winType}' window of length ${windowSize} is all zeros; use another window or more samples`
    );
  }

  const frequencies: number[] = Array.from({ length: nFreqs }, (_, i) => i / nfft);

  // Collect every frame start offset; each frame is an independent FFT.
  const starts: i32[] = [];
  for (let start: i32 = 0; start + windowSize <= samples.length; start += hopSize) {
    starts.push(start);
  }
  const frameCount: i32 = starts.length;
  // Outputs are sized once from the frame count rather than grown with push.
  const magnitude: number[][] = new Array<number[]>(frameCount);
  const times: number[] = new Array<number>(frameCount);
  if (frameCount === 0) {
    return { magnitude, frequencies, times };
  }

  for (let f: i32 = 0; f < frameCount; f++) {
    times[f] = starts[f] + windowSize / 2;
  }

  // Each frame is an independent FFT of nfft points.
  for (let f: i32 = 0; f < frameCount; f++) {
    const start: i32 = starts[f];
    const real = new Float64Array(nfft);
    const imag = new Float64Array(nfft);
    for (let i: i32 = 0; i < windowSize; i++) {
      real[i] = samples[start + i] * win[i];
    }

    const result = fftCoreFloat64(real, imag, false);

    const mag: number[] = new Array<number>(nFreqs);
    for (let i: i32 = 0; i < nFreqs; i++) {
      mag[i] = Math.sqrt(result.real[i] ** 2 + result.imag[i] ** 2);
    }
    magnitude[f] = mag;
  }

  return { magnitude, frequencies, times };
}

// =============================================================================
// Periodogram (Power Spectral Density)
// =============================================================================

/**
 * Estimate power spectral density using periodogram method.
 *
 * `nfft` can be any positive integer (default: the next power of two). A signal longer
 * than `nfft` is cropped to its first `nfft` samples, as SciPy does.
 *
 * @param x - Input signal (an array or a typed array)
 * @param opts - { nfft, window }
 * @returns `{ psd: number[], frequencies: number[] }`
 * @throws TypeError if x is not an array or a typed array
 * @throws RangeError if nfft is not a positive integer
 */
export function periodogram(
  x: number[] | Float64Array,
  opts?: { nfft?: i32; window?: string }
): { psd: number[]; frequencies: number[] } {
  // A nested array is not a signal: its rows would be read as NaN samples.
  if (Array.isArray(x) && Array.isArray(x[0])) {
    throw new TypeError('periodogram: signal must be a 1-D array or a typed array');
  }
  const samples = toSamples('periodogram', x);
  // SciPy: an empty signal has an empty spectrum.
  if (samples.length === 0) return { psd: [], frequencies: [] };
  const nfftOpt = opts?.nfft;
  if (nfftOpt !== undefined && !(Number.isInteger(nfftOpt) && nfftOpt >= 1)) {
    throw new RangeError(`periodogram: nfft must be a positive integer (got ${nfftOpt})`);
  }
  const nfft: i32 = nfftOpt ?? nextPowerOf2(samples.length);
  // SciPy crops the signal to nfft before the window and the normalisation.
  const seg = nfft < samples.length ? samples.subarray(0, nfft) : samples;
  const n: i32 = seg.length;
  const winType = opts?.window ?? 'hann';

  const win = windowFunction(n, winType);
  let winPower: f64 = 0;
  for (let i: i32 = 0; i < n; i++) winPower += win[i] * win[i];
  winPower /= n;
  // A Hann window of length 2 is [0, 0]: no power, so the periodogram would be 0 / 0 (NaN).
  if (!(winPower > 0)) {
    throw new RangeError(
      `periodogram: the '${winType}' window of length ${n} is all zeros; use another window or more samples`
    );
  }

  const real = new Float64Array(nfft);
  const imag = new Float64Array(nfft);
  for (let i: i32 = 0; i < n; i++) {
    real[i] = seg[i] * win[i];
  }

  // Any length: nfft need not be a power of two.
  const result = fftExactFloat64(real, imag, false);

  const nFreqs: i32 = Math.floor(nfft / 2) + 1;
  const psd: number[] = new Array<number>(nFreqs);
  const frequencies: number[] = new Array<number>(nFreqs);

  for (let i: i32 = 0; i < nFreqs; i++) {
    const power: f64 = (result.real[i] ** 2 + result.imag[i] ** 2) / (n * winPower);
    psd[i] = i > 0 && i < nfft / 2 ? 2 * power : power;
    frequencies[i] = i / nfft;
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
  const h = _sincFilter('lowpassFilter', order, cutoff, 'lowpass');
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
  const h = _sincFilter('highpassFilter', order, cutoff, 'highpass');
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
  const hLow = _sincFilter('bandpassFilter', order, low, 'highpass');
  const hHigh = _sincFilter('bandpassFilter', order, high, 'lowpass');
  // Combine: bandpass = lowpass(high) * highpass(low) via convolution
  const mid = _convolve(x, hHigh);
  return _convolve(mid, hLow);
}

/** Create windowed sinc FIR filter coefficients */
function _sincFilter(fn: string, order: i32, cutoff: f64, type: 'lowpass' | 'highpass'): number[] {
  assertAllocSize(fn, [order]);
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
 * Fourier resample to a target length (SciPy `signal.resample` for real inputs).
 *
 * @param x - Input signal (treated as one period)
 * @param num - Target number of samples
 */
function resampleFftToLength(x: number[], num: i32): number[] {
  const n_x: i32 = x.length;
  if (n_x === 0) return [];
  if (num === n_x) return x.slice();
  if (num < 1 || !Number.isInteger(num)) {
    throw new TypeError('resample(x, num): num must be a positive integer');
  }

  const s_fac: f64 = n_x / num;
  const m: i32 = Math.min(num, n_x);
  const m2: i32 = Math.floor(m / 2) + 1;

  const realIn = new Float64Array(n_x);
  const imagIn = new Float64Array(n_x);
  for (let i: i32 = 0; i < n_x; i++) realIn[i] = x[i]!;
  const spec = fftExactFloat64(realIn, imagIn, false);

  const halfRe = new Float64Array(m2);
  const halfIm = new Float64Array(m2);
  for (let k: i32 = 0; k < m2; k++) {
    halfRe[k] = spec.real[k]! / s_fac;
    halfIm[k] = spec.imag[k]! / s_fac;
  }
  if (m % 2 === 0 && num !== n_x) {
    const k: i32 = Math.floor(m / 2);
    halfRe[k] = halfRe[k]! * (num < n_x ? 2 : 0.5);
    halfIm[k] = halfIm[k]! * (num < n_x ? 2 : 0.5);
  }

  const fullRe = new Float64Array(num);
  const fullIm = new Float64Array(num);
  for (let k: i32 = 0; k < m2; k++) {
    fullRe[k] = halfRe[k]!;
    fullIm[k] = halfIm[k]!;
  }
  for (let k: i32 = 1; k <= Math.floor((num - 1) / 2); k++) {
    fullRe[num - k] = fullRe[k]!;
    fullIm[num - k] = -fullIm[k]!;
  }

  const outSpec = fftExactFloat64(fullRe, fullIm, true);
  const result: number[] = new Array(num);
  for (let i: i32 = 0; i < num; i++) result[i] = outSpec.real[i];
  return result;
}

/**
 * Linear resample by changing sample rate (not SciPy `signal.resample`).
 */
function resampleLinear(x: number[], newRate: f64, oldRate: f64): number[] {
  const ratio: f64 = oldRate / newRate;
  const newLen: i32 = Math.round(x.length / ratio);
  assertAllocSize('resample', [newLen]);
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

/**
 * Resample a signal.
 *
 * - `resample(x, num)` — SciPy Fourier method to `num` samples (real input).
 * - `resample(x, newRate, oldRate)` — linear interpolation between sample rates.
 *
 * @param x - Input signal
 * @param newRate - Target length (2-arg) or target sample rate (3-arg)
 * @param oldRate - Original sample rate (linear mode only)
 * @returns Resampled signal
 */
export function resample(x: number[], newRate: f64, oldRate?: f64): number[] {
  toSamples('resample', x, 'x');
  if (oldRate === undefined) {
    if (!Number.isFinite(newRate) || !Number.isInteger(newRate) || newRate < 1) {
      throw new TypeError(
        'resample(x, num): num must be a positive integer (SciPy Fourier resample), or pass resample(x, newRate, oldRate) for linear rate interpolation'
      );
    }
    assertAllocSize('resample', [newRate]);
    return resampleFftToLength(x, newRate);
  }
  if (!Number.isFinite(oldRate) || oldRate <= 0 || !Number.isFinite(newRate) || newRate <= 0) {
    throw new TypeError(
      'resample(x, newRate, oldRate): both rates must be finite positive numbers'
    );
  }
  return resampleLinear(x, newRate, oldRate);
}

// =============================================================================
// Median Filter
// =============================================================================

/**
 * Apply a median filter to a signal, as `scipy.signal.medfilt` does.
 *
 * The signal is padded with zeros at both ends, so every window holds `n` values. A window
 * longer than the signal is allowed; its padded values are zeros.
 *
 * @param x - Input signal
 * @param n - Window size (default 3). An even size is increased by one.
 * @returns Filtered signal
 * @throws TypeError if `x` is not an array or a typed array (a Matrix is rejected by name)
 * @throws RangeError if `n` is not a positive integer
 */
export function medfilt(x: number[], n: i32 = 3): number[] {
  if (!Array.isArray(x)) x = Array.from(toSamples('medfilt', x, 'x'));
  if (!(Number.isInteger(n) && n >= 1)) {
    throw new RangeError(`medfilt: n must be a positive integer (got ${n})`);
  }
  if (n % 2 === 0) n += 1;
  const half: i32 = Math.floor(n / 2);
  const len: i32 = x.length;
  const result: number[] = new Array(len);

  for (let i: i32 = 0; i < len; i++) {
    // The in-range values of the window. The other n - window.length values are zero padding,
    // which is counted and never stored, so a huge n allocates nothing more.
    const lo: i32 = Math.max(0, i - half);
    const hi: i32 = Math.min(len - 1, i + half);
    const window: number[] = x.slice(lo, hi + 1);
    window.sort((a, b) => a - b);
    const zeros: i32 = n - window.length;
    // The sorted window with the zeros in place: the negative values, the zeros, the rest.
    let negatives: i32 = 0;
    while (negatives < window.length && window[negatives] < 0) negatives++;
    if (half < negatives) result[i] = window[half];
    else if (half < negatives + zeros) result[i] = 0;
    else result[i] = window[half - zeros];
  }

  return result;
}

// =============================================================================
// Window Functions
// =============================================================================

/**
 * Generate a window function of given type and length.
 *
 * Accepts `(length, type)` or SciPy-style `(type, length)`.
 *
 * Coefficients are the **symmetric** window (`scipy.signal.windows.*` with `sym=True`,
 * and `scipy.signal.get_window(type, n)`): the cosine period is `n - 1`, so the first
 * and last taps match. The periodic form (`sym=False`, period `n`) is not this function.
 *
 * @param n - Window length
 * @param type - Window type: 'hamming' | 'hann' | 'blackman' | 'rectangular' | 'bartlett'
 * @returns Window coefficients
 */
export function windowFunction(n: i32 | string, type?: string | i32): number[] {
  let length: i32;
  let winType: string;
  if (typeof n === 'string') {
    winType = n;
    if (typeof type !== 'number' || !Number.isInteger(type) || type < 1) {
      throw new TypeError(
        'windowFunction(type, length): length must be a positive integer (or call windowFunction(length, type))'
      );
    }
    length = type;
  } else {
    length = n;
    if (typeof type !== 'string' || type.length === 0) {
      throw new TypeError('windowFunction(length, type): type must be a non-empty string');
    }
    winType = type;
  }
  return windowFunctionCore(length, winType);
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

function assertPsdFrameLength(
  signalLength: i32,
  frameLength: i32,
  name: 'welchPSD' | 'bartlettPSD'
): void {
  if (signalLength === 0) return;
  if (signalLength < frameLength) {
    throw new RangeError(
      `${name}: signal length (${signalLength}) is shorter than frameLength (${frameLength})`
    );
  }
  if (frameLength < 2) {
    throw new RangeError(
      `${name}: frameLength must be at least 2 (got ${frameLength}); a defaulted frameLength is min(256, signal length)`
    );
  }
}

/**
 * Frame length for a PSD or spectrogram call. An explicit length is used as given and validated.
 * A defaulted one is 256 clamped to the signal length, as `scipy.signal.welch` clamps
 * `nperseg`. An empty signal keeps the 256 default, so it still returns an empty result.
 */
function resolvePsdFrameLength(signalLength: i32, requested: i32 | undefined): i32 {
  if (requested !== undefined) return requested;
  return signalLength === 0 ? 256 : Math.min(256, signalLength);
}

/**
 * Pack a one-sided PSD array and normalized frequency grid for Welch/Bartlett exports.
 *
 * @param signal - Input samples (coerced to Float64Array by callers)
 * @param frameLength - FFT frame length used as the frequency normalizer
 * @param compute - Kernel that returns the PSD buffer for the given samples and frame
 */
function packPsd(
  signal: Float64Array,
  frameLength: i32,
  compute: (samples: Float64Array, frameLen: i32) => Float64Array
): { psd: number[]; frequencies: number[]; frameLength: number } {
  const psdArr = compute(signal, frameLength);
  const nfft = frameLength;
  const psd = Array.from(psdArr);
  const frequencies = Array.from({ length: psdArr.length }, (_, i) => i / nfft);
  return { psd, frequencies, frameLength };
}

/**
 * Welch's overlapped-segment-averaging Power Spectral Density.
 *
 * Welch PSD measures slower on WASM than JS (`functions/src/wasm/policy.ts` header);
 * bridges may be consulted but `wasmPolicyAllows` keeps welch/bartlett on JS.
 *
 * Uses a periodic window and subtracts the mean from each segment by default, as SciPy does.
 * Pass `{ periodic: false, detrend: false }` for the previous convention.
 *
 * @param signal - Input signal samples
 * @param opts - Segment length, overlap, window, periodicity and detrending
 * @returns `{ psd: number[], frequencies: number[], frameLength: number }`
 * @throws RangeError if the frame is shorter than 2, longer than the signal, or the window has zero power
 */
export function welchPSD(
  signal: number[] | Float64Array,
  opts?: { frameLength?: i32; overlap?: i32; window?: string } & SpectralSegmentOptions
): { psd: number[]; frequencies: number[]; frameLength: number } {
  const samples = toSamples('welchPSD', signal);
  const frameLength: i32 = resolvePsdFrameLength(samples.length, opts?.frameLength);
  const overlap: i32 = opts?.overlap ?? Math.floor(frameLength / 2);
  const window = opts?.window ?? 'hann';

  assertPsdFrameLength(samples.length, frameLength, 'welchPSD');
  if (samples.length > 0 && overlap >= frameLength) {
    throw new RangeError(
      `welchPSD: overlap (${overlap}) must be less than frameLength (${frameLength})`
    );
  }
  const periodic = opts?.periodic ?? true;
  const detrend = opts?.detrend ?? 'constant';
  if (samples.length > 0 && !periodic && frameLength === 2 && windowTypeCode(window) === 0) {
    throw new RangeError(
      "welchPSD: a 'hann' window of length 2 is all zeros; use another window, a periodic window or a longer frame"
    );
  }
  if (!periodic && detrend === false) {
    return packPsd(samples, frameLength, (s, fl) => welchPSDDispatch(s, fl, overlap, window));
  }
  const coefficients = windowFunctionCore(frameLength, window, periodic);
  return packPsd(samples, frameLength, (s, fl) =>
    welchPSDJS(s, fl, overlap, windowTypeCode(window), { coefficients, detrend })
  );
}

/**
 * Bartlett's non-overlapped segment-averaging Power Spectral Density.
 *
 * Special case of Welch with overlap=0 and rectangular window.
 *
 * @param signal - Input signal samples
 * @param opts - { frameLength }
 * @returns `{ psd: number[], frequencies: number[], frameLength: number }`
 */
export function bartlettPSD(
  signal: number[] | Float64Array,
  opts?: { frameLength?: i32 }
): { psd: number[]; frequencies: number[]; frameLength: number } {
  const samples = toSamples('bartlettPSD', signal);
  const frameLength: i32 = resolvePsdFrameLength(samples.length, opts?.frameLength);

  assertPsdFrameLength(samples.length, frameLength, 'bartlettPSD');
  return packPsd(samples, frameLength, (s, fl) => bartlettPSDDispatch(s, fl));
}

/**
 * Multi-taper Power Spectral Density (Thomson's method, order K=5).
 *
 * Uses K discrete prolate spheroidal sequences (DPSS, approximated here
 * as Slepian windows via cos-sum) to reduce spectral leakage. The final
 * PSD is the mean of the K individual tapered periodograms.
 *
 * For large inputs, each tapered periodogram uses the Welch dispatch (JS path per
 * `wasmPolicyAllows`; see `functions/src/wasm/policy.ts`).
 *
 * When `nfft` is larger than the signal, each taper is zero-padded to `nfft`, so bin `i` is at
 * the frequency `i / nfft` and the PSD is the periodogram `|X|^2 / n` of the `n` samples.
 *
 * When `nfft` is smaller than the signal, each tapered signal is cut into `floor(n / nfft)`
 * frames of `nfft` samples with no overlap, and a tail shorter than `nfft` is dropped. The
 * per-taper PSD is then the mean of the periodograms of these frames (Welch's method with a
 * rectangular window), and bin `i` is at the frequency `i / nfft`.
 *
 * @param signal - Input signal samples
 * @param opts - { nfft, K } (K = number of tapers, default 5)
 * @returns `{ psd: number[], frequencies: number[] }`; empty for an empty signal
 * @throws RangeError if the signal has exactly one sample, or if `nfft` or `K` is not a positive integer
 */
export function multiTaperPSD(
  signal: number[] | Float64Array,
  opts?: { nfft?: i32; K?: i32 }
): { psd: number[]; frequencies: number[] } {
  const samples = toSamples('multiTaperPSD', signal);
  const n: i32 = samples.length;
  if (n === 0) return { psd: [], frequencies: [] };
  if (n === 1) {
    throw new RangeError('multiTaperPSD: signal must have at least 2 samples (got 1)');
  }
  const nfft: i32 = opts?.nfft ?? (Math.pow(2, Math.ceil(Math.log2(n))) as i32);
  const K: i32 = opts?.K ?? 5;
  if (!(Number.isInteger(nfft) && nfft >= 1)) {
    throw new RangeError(`multiTaperPSD: nfft must be a positive integer (got ${nfft})`);
  }
  if (!(Number.isInteger(K) && K >= 1)) {
    throw new RangeError(`multiTaperPSD: K must be a positive integer (got ${K})`);
  }

  // Approximate Slepian tapers via discrete cosine windows.
  // Taper k: w_k[n] = sin((k+1) * pi * n / (N+1)) — a sine-family taper.
  const psdLen: i32 = Math.floor(nfft / 2) + 1;
  const accumPsd = new Float64Array(psdLen);

  // An nfft above n zero-pads each taper to nfft (the tail of this buffer stays zero), so the
  // frame has nfft samples and bin i is at i / nfft. A frame of n samples would put bin i at i / n.
  const tapered = new Float64Array(nfft > n ? nfft : n);

  for (let k: i32 = 0; k < K; k++) {
    // Build taper k and apply to signal
    for (let j: i32 = 0; j < n; j++) {
      const w: f64 = Math.sin(((k + 1) * Math.PI * (j + 1)) / (n + 1));
      tapered[j] = samples[j] * w;
    }

    // Per-taper PSD via Welch: frames of nfft samples, no overlap (one frame when nfft >= n)
    const taperPsd =
      n >= WASM_SIGNAL_THRESHOLD
        ? welchPSDDispatch(tapered, nfft, 0, 'rect')
        : welchPSDJS(tapered, nfft, 0, 3);

    for (let i: i32 = 0; i < psdLen && i < taperPsd.length; i++) {
      accumPsd[i] += taperPsd[i];
    }
  }

  // Average over tapers. The kernel divides by its frame length (nfft); the periodogram of the
  // n samples divides by n, so a padded frame is scaled by nfft / n.
  const padScale: f64 = nfft > n ? nfft / n : 1;
  const psd: number[] = [];
  const frequencies: number[] = [];
  for (let i: i32 = 0; i < psdLen; i++) {
    psd.push((accumPsd[i] / K) * padScale);
    frequencies.push(i / nfft);
  }
  return { psd, frequencies };
}

/**
 * Goertzel algorithm: compute the power |X[k]|² at a single frequency.
 *
 * Goertzel measures slower on WASM (`functions/src/wasm/policy.ts`); JS runs after the bridge check.
 *
 * @param signal - Input signal samples
 * @param targetFreq - Target frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @returns |X[k]|² (unnormalized power at the target frequency)
 */
export function goertzel(signal: number[] | Float64Array, targetFreq: f64, sampleRate: f64): f64 {
  const samples = toSamples('goertzel', signal);
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
 * Chirp-Z measures slower on WASM (`functions/src/wasm/policy.ts`); JS runs after the bridge check.
 *
 * @param signal - Input signal samples (real)
 * @param m - Number of output points
 * @param phiStart - Start angle in turns (e.g. 0 = DC, 0.5 = Nyquist)
 * @param phiStep - Step angle in turns (negative for standard DFT)
 * @returns `{ re: Float64Array, im: Float64Array }` — M complex output values
 */
export function chirpZTransform(
  signal: number[] | Float64Array,
  m: i32,
  phiStart: f64 = 0,
  phiStep: f64 = -1 / (signal instanceof Float64Array ? signal.length : signal.length)
): { re: Float64Array; im: Float64Array } {
  const samples = toSamples('chirpZTransform', signal);
  assertAllocSize('chirpZTransform', [m]);
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
