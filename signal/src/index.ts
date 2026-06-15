/**
 * @danielsimonjr/mathts-signal
 *
 * Standalone signal-processing functions for MathTS. Re-exports the `signal` typed-function domain
 * from {@link @danielsimonjr/mathts-functions} as a focused package. The
 * implementation lives in functions; this is an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  parallelFFT,
  parallelIFFT,
  parallelFFTMagnitude,
  parallelFFTPower,
  parallelConv,
  parallelXCorr,
  parallelAutoCorr,
  crossCorrelation,
  autoCorrelation,
  groupDelay,
  unwrapPhase,
  dct,
  idct,
  dst,
  idst,
  dwt,
  fourier,
  invFourier,
  hilbertTransform,
  periodogram,
  lowpassFilter,
  highpassFilter,
  bandpassFilter,
  resample,
  medfilt,
  windowFunction,
  convolve,
  correlate,
  welchPSD,
  bartlettPSD,
  multiTaperPSD,
  goertzel,
  chirpZTransform,
  typedSignal,
} from '@danielsimonjr/mathts-functions';
