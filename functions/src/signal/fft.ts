import { fftCoreFloat64 } from './fft-core-f64.js';
/**
 * Fast Fourier Transform (FFT)
 *
 * Implements the Cooley-Tukey radix-2 decimation-in-time FFT algorithm.
 * For non-power-of-2 lengths, zero-pads to next power of 2.
 *
 * @packageDocumentation
 */

/**
 * Complex number representation for FFT
 */
export interface ComplexNumber {
  re: number;
  im: number;
}

/**
 * FFT result containing the frequency spectrum
 */
export interface FFTResult {
  /** Complex frequency components */
  spectrum: ComplexNumber[];
  /** Original signal length before padding */
  originalLength: number;
  /** Padded length (power of 2) */
  paddedLength: number;
}

/**
 * Create a complex number
 */
export function complex(re: number, im: number = 0): ComplexNumber {
  return { re, im };
}

/**
 * Complex conjugate
 */
export function complexConj(a: ComplexNumber): ComplexNumber {
  return { re: a.re, im: -a.im };
}

/**
 * Complex magnitude
 */
export function complexAbs(a: ComplexNumber): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

/**
 * Complex phase/argument
 */
export function complexArg(a: ComplexNumber): number {
  return Math.atan2(a.im, a.re);
}

/**
 * Check if a number is a power of 2
 */
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Get the next power of 2 >= n
 */
function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Radix-2 Cooley-Tukey over `ComplexNumber[]`, delegating to the package's flat core.
 *
 * This used to do the butterfly arithmetic in Complex OBJECTS — a `{ re, im }` allocation
 * per twiddle step and per butterfly — which made the public `fft()` ~8x slower than
 * `parallelFFT` for the IDENTICAL transform:
 *
 *   n=2^18    607 ms (objects)  vs    80 ms (flat arrays)
 *   n=2^20   2987 ms (objects)  vs   358 ms (flat arrays)
 *
 * The `ComplexNumber[]` return type was never the problem: boxing the results ONCE at the
 * boundary is cheap. Doing the arithmetic in boxes is what cost 8x. The public API is
 * unchanged — same f64 arithmetic, same 1/n inverse scaling, same results.
 */
function fftCore(data: ComplexNumber[], inverse: boolean = false): ComplexNumber[] {
  const n = data.length;

  if (!isPowerOf2(n)) {
    throw new Error(`FFT length must be power of 2, got ${n}`);
  }

  if (n === 1) {
    return [{ ...data[0] }];
  }

  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    real[i] = data[i].re;
    imag[i] = data[i].im;
  }

  const out = fftCoreFloat64(real, imag, inverse);

  const spectrum: ComplexNumber[] = new Array<ComplexNumber>(n);
  for (let i = 0; i < n; i++) {
    spectrum[i] = { re: out.real[i], im: out.imag[i] };
  }
  return spectrum;
}

/**
 * Compute the Fast Fourier Transform of a real or complex signal.
 *
 * Uses the Cooley-Tukey radix-2 decimation-in-time algorithm.
 * Input is zero-padded to the next power of 2 if necessary.
 *
 * @param signal - Input signal (real numbers or complex numbers)
 * @returns FFT result with spectrum and length info
 *
 * @example
 * ```typescript
 * // FFT of a real signal
 * const signal = [1, 0, -1, 0];
 * const result = fft(signal);
 * console.log(result.spectrum); // Frequency components
 *
 * // FFT of a complex signal
 * const complexSignal = [
 *   { re: 1, im: 0 },
 *   { re: 0, im: 1 },
 * ];
 * const result2 = fft(complexSignal);
 * ```
 */
export function fft(signal: number[] | Float64Array | ComplexNumber[]): FFTResult {
  const originalLength = signal.length;

  if (originalLength === 0) {
    return {
      spectrum: [],
      originalLength: 0,
      paddedLength: 0,
    };
  }

  // Convert to complex array
  let complexSignal: ComplexNumber[];

  if (signal instanceof Float64Array) {
    complexSignal = Array.from(signal).map((x) => complex(x, 0));
  } else if (typeof signal[0] === 'number') {
    complexSignal = (signal as number[]).map((x) => complex(x, 0));
  } else {
    complexSignal = signal as ComplexNumber[];
  }

  // Pad to next power of 2 if necessary
  const paddedLength = nextPowerOf2(originalLength);
  if (paddedLength > originalLength) {
    const padding = new Array(paddedLength - originalLength).fill(complex(0, 0));
    complexSignal = [...complexSignal, ...padding];
  }

  // Compute FFT
  const spectrum = fftCore(complexSignal, false);

  return {
    spectrum,
    originalLength,
    paddedLength,
  };
}

/**
 * Compute the Inverse Fast Fourier Transform.
 *
 * Recovers the time-domain signal from its frequency spectrum.
 *
 * @param spectrum - Complex frequency spectrum
 * @param originalLength - Optional: truncate result to this length
 * @returns Recovered signal
 *
 * @example
 * ```typescript
 * // Round-trip test
 * const signal = [1, 2, 3, 4];
 * const result = fft(signal);
 * const recovered = ifft(result.spectrum, result.originalLength);
 * // recovered ≈ signal
 * ```
 */
export function ifft(spectrum: ComplexNumber[], originalLength?: number): ComplexNumber[] {
  if (spectrum.length === 0) {
    return [];
  }

  // Ensure power of 2
  const paddedLength = nextPowerOf2(spectrum.length);
  let paddedSpectrum = spectrum;

  if (paddedLength > spectrum.length) {
    const padding = new Array(paddedLength - spectrum.length).fill(complex(0, 0));
    paddedSpectrum = [...spectrum, ...padding];
  }

  // Compute inverse FFT
  const result = fftCore(paddedSpectrum, true);

  // Truncate to original length if specified
  if (originalLength !== undefined && originalLength < result.length) {
    return result.slice(0, originalLength);
  }

  return result;
}

/**
 * Compute the real part of IFFT result
 */
export function ifftReal(spectrum: ComplexNumber[], originalLength?: number): number[] {
  const complex = ifft(spectrum, originalLength);
  return complex.map((c) => c.re);
}

/**
 * Compute the magnitude spectrum (|X(k)|)
 */
export function fftMagnitude(spectrum: ComplexNumber[]): number[] {
  return spectrum.map(complexAbs);
}

/**
 * Compute the power spectrum (|X(k)|²)
 */
export function fftPower(spectrum: ComplexNumber[]): number[] {
  return spectrum.map((c) => c.re * c.re + c.im * c.im);
}

/**
 * Compute the phase spectrum (arg(X(k)))
 */
export function fftPhase(spectrum: ComplexNumber[]): number[] {
  return spectrum.map(complexArg);
}

/**
 * Compute FFT frequency bins for a given sample rate
 *
 * @param n - Number of FFT points
 * @param sampleRate - Sample rate in Hz
 * @returns Array of frequencies in Hz
 */
export function fftFrequencies(n: number, sampleRate: number = 1): number[] {
  const frequencies = new Array(n);
  const halfN = Math.floor(n / 2);

  for (let k = 0; k <= halfN; k++) {
    frequencies[k] = (k * sampleRate) / n;
  }

  for (let k = halfN + 1; k < n; k++) {
    frequencies[k] = ((k - n) * sampleRate) / n;
  }

  return frequencies;
}

/**
 * Compute the 2D FFT of a matrix
 *
 * @param matrix - 2D array of real or complex values
 * @returns 2D frequency spectrum
 */
export function fft2(matrix: number[][] | ComplexNumber[][]): ComplexNumber[][] {
  const rows = matrix.length;
  if (rows === 0) return [];

  const cols = matrix[0].length;
  if (cols === 0) return [];

  // FFT each row
  const rowFFTs: ComplexNumber[][] = [];
  for (let i = 0; i < rows; i++) {
    const row = matrix[i];
    const isReal = typeof row[0] === 'number';
    const complexRow = isReal
      ? (row as number[]).map((x) => complex(x, 0))
      : (row as ComplexNumber[]);
    rowFFTs.push(fft(complexRow).spectrum);
  }

  // Ensure consistent column size (use max padded length)
  const maxCols = rowFFTs[0].length;

  // FFT each column
  const result: ComplexNumber[][] = [];
  for (let j = 0; j < maxCols; j++) {
    const column: ComplexNumber[] = [];
    for (let i = 0; i < rows; i++) {
      column.push(rowFFTs[i][j] || complex(0, 0));
    }
    const colFFT = fft(column).spectrum;
    for (let i = 0; i < colFFT.length; i++) {
      if (!result[i]) result[i] = [];
      result[i][j] = colFFT[i];
    }
  }

  return result;
}

/**
 * Compute the 2D inverse FFT
 *
 * @param spectrum - 2D frequency spectrum
 * @returns 2D spatial domain result
 */
export function ifft2(spectrum: ComplexNumber[][]): ComplexNumber[][] {
  const rows = spectrum.length;
  if (rows === 0) return [];

  const cols = spectrum[0].length;
  if (cols === 0) return [];

  // IFFT each column
  const colIFFTs: ComplexNumber[][] = [];
  for (let j = 0; j < cols; j++) {
    const column: ComplexNumber[] = [];
    for (let i = 0; i < rows; i++) {
      column.push(spectrum[i][j] || complex(0, 0));
    }
    colIFFTs.push(ifft(column));
  }

  // IFFT each row
  const maxRows = colIFFTs[0].length;
  const result: ComplexNumber[][] = [];

  for (let i = 0; i < maxRows; i++) {
    const row: ComplexNumber[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(colIFFTs[j][i] || complex(0, 0));
    }
    result.push(ifft(row));
  }

  return result;
}

/**
 * Shift zero-frequency component to center of spectrum
 *
 * @param spectrum - FFT spectrum
 * @returns Shifted spectrum
 */
export function fftshift<T>(spectrum: T[]): T[] {
  const n = spectrum.length;
  const half = Math.floor(n / 2);
  return [...spectrum.slice(half), ...spectrum.slice(0, half)];
}

/**
 * Inverse of fftshift
 */
export function ifftshift<T>(spectrum: T[]): T[] {
  const n = spectrum.length;
  const half = Math.ceil(n / 2);
  return [...spectrum.slice(half), ...spectrum.slice(0, half)];
}
