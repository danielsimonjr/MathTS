/**
 * WASM-Accelerated FFT Operations
 *
 * Wraps the Rust WASM FFT exports (interleaved complex format) with a
 * high-level TypeScript API. Falls back to a pure JavaScript Cooley-Tukey
 * radix-2 implementation when WASM is unavailable.
 *
 * The Rust WASM uses interleaved complex arrays: [re0, im0, re1, im1, ...].
 * This module converts between split (separate real/imag) and interleaved
 * formats as needed.
 *
 * @packageDocumentation
 */

import { wasmLoader } from '../WasmLoader.js';

// =============================================================================
// Types
// =============================================================================

/**
 * FFT result with separate real and imaginary arrays
 */
export interface FFTResult {
  real: Float64Array;
  imag: Float64Array;
}

/**
 * FFT backend selection
 */
export type FFTBackend = 'wasm' | 'js' | 'auto';

/**
 * Configuration for FFT operations
 */
export interface FFTConfig {
  /** Backend to use (default: 'auto') */
  backend?: FFTBackend;
  /** Minimum elements to use WASM (default: 64) */
  wasmThreshold?: number;
}

const DEFAULT_FFT_CONFIG: Required<FFTConfig> = {
  backend: 'auto',
  wasmThreshold: 64,
};

// =============================================================================
// Format Conversion Utilities
// =============================================================================

/**
 * Convert split real/imag arrays to interleaved format [re0, im0, re1, im1, ...]
 */
function toInterleaved(real: Float64Array, imag: Float64Array): Float64Array {
  const n = real.length;
  const interleaved = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    interleaved[i * 2] = real[i];
    interleaved[i * 2 + 1] = imag[i];
  }
  return interleaved;
}

/**
 * Convert interleaved format to split real/imag arrays
 */
function fromInterleaved(interleaved: Float64Array, n: number): FFTResult {
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    real[i] = interleaved[i * 2];
    imag[i] = interleaved[i * 2 + 1];
  }
  return { real, imag };
}

// =============================================================================
// JavaScript Fallback FFT (Cooley-Tukey Radix-2)
// =============================================================================

/**
 * Bit-reverse permutation index
 */
function bitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * Check if n is a power of 2
 */
export function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Next power of 2 >= n
 */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

/**
 * Pure JavaScript Cooley-Tukey radix-2 FFT
 *
 * Input length must be a power of 2.
 */
export function fftJS(
  real: Float64Array,
  imag: Float64Array,
  inverse: boolean = false
): FFTResult {
  const n = real.length;

  if (n === 0) {
    return { real: new Float64Array(0), imag: new Float64Array(0) };
  }

  if (n === 1) {
    return {
      real: new Float64Array([real[0]]),
      imag: new Float64Array([imag[0]]),
    };
  }

  if (!isPowerOf2(n)) {
    throw new Error(`FFT length must be a power of 2, got ${n}`);
  }

  const bits = Math.round(Math.log2(n));

  // Bit-reverse reorder
  const outReal = new Float64Array(n);
  const outImag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    outReal[j] = real[i];
    outImag[j] = imag[i];
  }

  // Direction factor: -1 for forward, +1 for inverse
  const direction = inverse ? 1.0 : -1.0;

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size >>> 1;
    const angle = (direction * 2.0 * Math.PI) / size;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let start = 0; start < n; start += size) {
      let tRe = 1.0;
      let tIm = 0.0;

      for (let j = 0; j < halfSize; j++) {
        const evenIdx = start + j;
        const oddIdx = start + j + halfSize;

        // Twiddle factor multiplication
        const uRe = outReal[oddIdx] * tRe - outImag[oddIdx] * tIm;
        const uIm = outReal[oddIdx] * tIm + outImag[oddIdx] * tRe;

        // Butterfly
        const eRe = outReal[evenIdx];
        const eIm = outImag[evenIdx];

        outReal[evenIdx] = eRe + uRe;
        outImag[evenIdx] = eIm + uIm;
        outReal[oddIdx] = eRe - uRe;
        outImag[oddIdx] = eIm - uIm;

        // Update twiddle factor
        const nextTRe = tRe * wRe - tIm * wIm;
        const nextTIm = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
  }

  // Scale for inverse
  if (inverse) {
    const scale = 1.0 / n;
    for (let i = 0; i < n; i++) {
      outReal[i] *= scale;
      outImag[i] *= scale;
    }
  }

  return { real: outReal, imag: outImag };
}

// =============================================================================
// WASM FFT Operations
// =============================================================================

/**
 * Check if the WASM FFT backend is available
 */
export function isWasmFFTAvailable(): boolean {
  const module = wasmLoader.getModule();
  return module !== null && typeof module.fft === 'function';
}

/**
 * Perform FFT using WASM backend
 *
 * The Rust WASM operates on interleaved complex data in-place.
 * This function handles the conversion and memory management.
 */
function fftWasmCore(
  real: Float64Array,
  imag: Float64Array,
  inverse: boolean = false
): FFTResult {
  const module = wasmLoader.getModule();
  if (!module) {
    throw new Error('WASM module not loaded');
  }

  const n = real.length;
  if (n === 0) {
    return { real: new Float64Array(0), imag: new Float64Array(0) };
  }

  // Convert to interleaved format
  const interleaved = toInterleaved(real, imag);

  // Allocate WASM memory and copy data
  const alloc = wasmLoader.allocateFloat64Array(interleaved);

  try {
    // Call WASM FFT (in-place, interleaved)
    module.fft(alloc.ptr, n, inverse ? 1 : 0);

    // Read back results -- need to re-create view since memory might have grown
    const resultInterleaved = new Float64Array(module.memory.buffer, alloc.ptr, n * 2);
    return fromInterleaved(resultInterleaved, n);
  } finally {
    wasmLoader.free(alloc.ptr);
  }
}

// =============================================================================
// Public FFT API (Auto Backend Selection)
// =============================================================================

/**
 * Compute the Fast Fourier Transform.
 *
 * Automatically selects WASM or JS backend based on availability and
 * array size. Input length must be a power of 2.
 *
 * @param real - Real part of input signal
 * @param imag - Imaginary part (zeros for real-only input)
 * @param config - Backend configuration
 * @returns FFT result with real and imaginary arrays
 */
export function fft(
  real: Float64Array,
  imag: Float64Array,
  config: FFTConfig = {}
): FFTResult {
  const cfg = { ...DEFAULT_FFT_CONFIG, ...config };
  const n = real.length;

  if (!isPowerOf2(n) && n > 0) {
    throw new Error(`FFT length must be a power of 2, got ${n}`);
  }

  const useWasm =
    cfg.backend === 'wasm' ||
    (cfg.backend === 'auto' && n >= cfg.wasmThreshold && isWasmFFTAvailable());

  if (useWasm) {
    return fftWasmCore(real, imag, false);
  }
  return fftJS(real, imag, false);
}

/**
 * Compute the Inverse Fast Fourier Transform.
 *
 * @param real - Real part of frequency-domain signal
 * @param imag - Imaginary part of frequency-domain signal
 * @param config - Backend configuration
 * @returns Time-domain signal with real and imaginary arrays
 */
export function ifft(
  real: Float64Array,
  imag: Float64Array,
  config: FFTConfig = {}
): FFTResult {
  const cfg = { ...DEFAULT_FFT_CONFIG, ...config };
  const n = real.length;

  if (!isPowerOf2(n) && n > 0) {
    throw new Error(`IFFT length must be a power of 2, got ${n}`);
  }

  const useWasm =
    cfg.backend === 'wasm' ||
    (cfg.backend === 'auto' && n >= cfg.wasmThreshold && isWasmFFTAvailable());

  if (useWasm) {
    return fftWasmCore(real, imag, true);
  }
  return fftJS(real, imag, true);
}

/**
 * Compute the real FFT (real input -> complex output).
 *
 * Convenience wrapper that creates a zero imaginary array.
 *
 * @param data - Real-valued input signal (length must be power of 2)
 * @param config - Backend configuration
 * @returns FFT result
 */
export function rfft(data: Float64Array, config: FFTConfig = {}): FFTResult {
  const cfg = { ...DEFAULT_FFT_CONFIG, ...config };
  const n = data.length;

  if (!isPowerOf2(n) && n > 0) {
    throw new Error(`RFFT length must be a power of 2, got ${n}`);
  }

  // Check for dedicated WASM rfft
  const useWasm =
    cfg.backend === 'wasm' ||
    (cfg.backend === 'auto' && n >= cfg.wasmThreshold && isWasmFFTAvailable());

  if (useWasm) {
    const module = wasmLoader.getModule();
    if (module && typeof module.rfft === 'function') {
      const dataAlloc = wasmLoader.allocateFloat64Array(data);
      const resultAlloc = wasmLoader.allocateFloat64ArrayEmpty(n * 2);

      try {
        module.rfft(dataAlloc.ptr, n, resultAlloc.ptr);
        const resultInterleaved = new Float64Array(
          module.memory.buffer,
          resultAlloc.ptr,
          n * 2
        );
        return fromInterleaved(resultInterleaved, n);
      } finally {
        wasmLoader.free(dataAlloc.ptr);
        wasmLoader.free(resultAlloc.ptr);
      }
    }
  }

  // Fallback: create zero imag and use standard FFT
  const imag = new Float64Array(n);
  return fft(data, imag, config);
}

/**
 * Compute the power spectrum: |X[k]|^2 for each frequency bin.
 *
 * @param real - Real part of FFT output
 * @param imag - Imaginary part of FFT output
 * @returns Power spectrum array
 */
export function powerSpectrum(
  real: Float64Array,
  imag: Float64Array
): Float64Array {
  const n = real.length;

  // Try WASM if available
  if (isWasmFFTAvailable()) {
    const module = wasmLoader.getModule()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exports = module as any;
    if (typeof exports.powerSpectrum === 'function') {
      // powerSpectrum expects interleaved input
      const interleaved = toInterleaved(real, imag);
      const dataAlloc = wasmLoader.allocateFloat64Array(interleaved);
      const resultAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);

      try {
        exports.powerSpectrum(dataAlloc.ptr, n, resultAlloc.ptr);
        return new Float64Array(
          new Float64Array(module.memory.buffer, resultAlloc.ptr, n)
        );
      } finally {
        wasmLoader.free(dataAlloc.ptr);
        wasmLoader.free(resultAlloc.ptr);
      }
    }
  }

  // JS fallback
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = real[i] * real[i] + imag[i] * imag[i];
  }
  return result;
}

/**
 * Compute the magnitude spectrum: |X[k]| for each frequency bin.
 *
 * @param real - Real part of FFT output
 * @param imag - Imaginary part of FFT output
 * @returns Magnitude spectrum array
 */
export function magnitudeSpectrum(
  real: Float64Array,
  imag: Float64Array
): Float64Array {
  const n = real.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return result;
}

/**
 * Compute the phase spectrum: angle(X[k]) for each frequency bin.
 *
 * @param real - Real part of FFT output
 * @param imag - Imaginary part of FFT output
 * @returns Phase spectrum array (radians)
 */
export function phaseSpectrum(
  real: Float64Array,
  imag: Float64Array
): Float64Array {
  const n = real.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = Math.atan2(imag[i], real[i]);
  }
  return result;
}

/**
 * FFT-based convolution: conv(signal, kernel) = IFFT(FFT(signal) * FFT(kernel))
 *
 * @param signal - Input signal
 * @param kernel - Convolution kernel
 * @param config - Backend configuration
 * @returns Convolution result (length = signal.length + kernel.length - 1)
 */
export function convolve(
  signal: Float64Array,
  kernel: Float64Array,
  config: FFTConfig = {}
): Float64Array {
  const n = signal.length;
  const m = kernel.length;

  if (n === 0 || m === 0) return new Float64Array(0);

  const fullLength = n + m - 1;
  const paddedLength = nextPowerOf2(fullLength);

  // Zero-pad both to next power of 2
  const sigPadded = new Float64Array(paddedLength);
  const kerPadded = new Float64Array(paddedLength);
  sigPadded.set(signal);
  kerPadded.set(kernel);

  const zeros = new Float64Array(paddedLength);

  // Forward FFT both
  const S = fft(sigPadded, zeros, config);
  const K = fft(kerPadded, new Float64Array(paddedLength), config);

  // Frequency-domain complex multiplication
  const yReal = new Float64Array(paddedLength);
  const yImag = new Float64Array(paddedLength);
  for (let i = 0; i < paddedLength; i++) {
    yReal[i] = S.real[i] * K.real[i] - S.imag[i] * K.imag[i];
    yImag[i] = S.real[i] * K.imag[i] + S.imag[i] * K.real[i];
  }

  // Inverse FFT
  const result = ifft(yReal, yImag, config);

  // Return only the valid part
  return result.real.slice(0, fullLength);
}
