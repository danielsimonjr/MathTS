/**
 * Signal Processing Module
 *
 * Exports FFT, IFFT, convolution, and related signal processing functions.
 *
 * @packageDocumentation
 */

// FFT and inverse FFT
export {
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
  complexConj,
  complexAbs,
  complexArg,
  type FFTResult,
  type ComplexNumber,
} from './fft.js';

// Convolution
export {
  conv,
  convDirect,
  convFFT,
  conv2,
  conv2Direct,
  conv2FFT,
  xcorr,
  autocorr,
  type ConvMode,
} from './conv.js';

// Existing exports
export * from './freqz.js';
export * from './zpk2tf.js';
