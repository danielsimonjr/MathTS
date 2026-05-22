/**
 * WASM Utilities Index
 * @packageDocumentation
 */

export {
  detectWasmFeatures,
  isWasmAvailable,
  isSharedMemoryAvailable,
  isAtomicsAvailable,
  clearFeatureCache,
  getCachedFeatures,
} from './detect.js';

export type { WasmFeatures } from './detect.js';

// FFT WASM operations
export {
  fft as wasmFFT,
  ifft as wasmIFFT,
  rfft as wasmRFFT,
  fftJS,
  convolve as wasmConvolve,
  powerSpectrum,
  magnitudeSpectrum,
  phaseSpectrum,
  isPowerOf2,
  nextPowerOf2,
  isWasmFFTAvailable,
} from './fft-wasm.js';

export type { FFTResult, FFTBackend, FFTConfig } from './fft-wasm.js';
