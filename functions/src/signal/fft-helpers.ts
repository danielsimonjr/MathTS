/**
 * numpy.fft-style helpers built on top of the package's own exported `fft`/`ifft`
 * (the typed-function factories in `../matrix/fft.ts` / `../matrix/ifft.ts`, wired
 * as the public `fft`/`ifft` in `../factories/index.ts`). Those already handle
 * non-power-of-2 lengths correctly (via chirp-z transform), so the helpers here
 * never need to zero-pad.
 *
 * @packageDocumentation
 */
import { fft, ifft, complex } from '../factories/index.js';
import { fftshift as fftshiftGeneric, ifftshift as ifftshiftGeneric } from './fft.js';

/** Minimal complex shape used to normalize typed-function outputs (number or Complex). */
interface ComplexLike {
  re: number;
  im: number;
}

// `fft`/`ifft` are exported as the typed-function factory's inferred `unknown` result
// (see `createFft`/`createIfft`'s callback return type) — narrow to callable once here.
const callFft = fft as (arg: unknown) => unknown;
const callIfft = ifft as (arg: unknown) => unknown;

/** Normalize a value returned by the typed `fft`/`ifft` (plain number or Complex instance). */
function toReIm(value: unknown): ComplexLike {
  if (typeof value === 'number') {
    return { re: value, im: 0 };
  }
  const c = value as ComplexLike;
  return { re: c.re, im: c.im };
}

/**
 * Real FFT: compute the full FFT of a real signal and keep only the first
 * `floor(n/2)+1` bins — the non-redundant half of the conjugate-symmetric spectrum.
 *
 * @param x Real input signal
 * @returns `{ re, im }` arrays of length `floor(n/2)+1`
 */
export function rfft(x: number[]): { re: number[]; im: number[] } {
  const n = x.length;
  const full = callFft(x) as unknown[];
  const keep = Math.floor(n / 2) + 1;
  const re = new Array<number>(keep);
  const im = new Array<number>(keep);
  for (let i = 0; i < keep; i++) {
    const c = toReIm(full[i]);
    re[i] = c.re;
    im[i] = c.im;
  }
  return { re, im };
}

/**
 * Inverse real FFT: reconstruct the full conjugate-symmetric spectrum of length `n`
 * from the non-redundant half produced by {@link rfft} (bins `n/2+1..n-1` are the
 * conjugates of bins `n/2-1..1`), inverse-FFT it, and return the real parts.
 *
 * @param spec `{ re, im }` half-spectrum (bins `0..floor(n/2)`)
 * @param n Length of the reconstructed real signal
 * @returns Real-valued signal of length `n`
 */
export function irfft(spec: { re: number[]; im: number[] }, n: number): number[] {
  const halfLen = Math.floor(n / 2) + 1;
  const full: unknown[] = new Array(n);
  for (let i = 0; i < halfLen; i++) {
    full[i] = complex(spec.re[i], spec.im[i]);
  }
  for (let i = halfLen; i < n; i++) {
    const mirror = toReIm(full[n - i]);
    full[i] = complex(mirror.re, -mirror.im);
  }
  const result = callIfft(full) as unknown[];
  return result.map((v) => toReIm(v).re);
}

/**
 * Shift the zero-frequency component to the center of the spectrum (roll by `floor(n/2)`).
 *
 * Thin `number[]` public surface over the package's single roll algorithm
 * (`fftshift<T>` in `./fft.ts`) — same behavior, delegated to keep one
 * implementation.
 */
export function fftshift(x: number[]): number[] {
  return fftshiftGeneric(x);
}

/**
 * Inverse of {@link fftshift} (roll by `ceil(n/2)`).
 *
 * Thin `number[]` public surface over `ifftshift<T>` in `./fft.ts`.
 */
export function ifftshift(x: number[]): number[] {
  return ifftshiftGeneric(x);
}

/**
 * DFT sample frequencies: `[0, 1, ..., ceil(n/2)-1, -floor(n/2), ..., -1] / (n*d)`.
 *
 * @param n Number of samples
 * @param d Sample spacing (default 1)
 */
export function fftfreq(n: number, d: number = 1): number[] {
  const result = new Array<number>(n);
  const posCount = Math.ceil(n / 2);
  const negCount = Math.floor(n / 2);
  for (let k = 0; k < posCount; k++) {
    result[k] = k / (n * d);
  }
  for (let k = 0; k < negCount; k++) {
    result[posCount + k] = (k - negCount) / (n * d);
  }
  return result;
}

/**
 * DFT sample frequencies matching {@link rfft} output: `[0, 1, ..., floor(n/2)] / (n*d)`.
 *
 * @param n Number of samples
 * @param d Sample spacing (default 1)
 */
export function rfftfreq(n: number, d: number = 1): number[] {
  const half = Math.floor(n / 2);
  const result = new Array<number>(half + 1);
  for (let k = 0; k <= half; k++) {
    result[k] = k / (n * d);
  }
  return result;
}

/**
 * 2-D FFT: FFT each row, then FFT each column of the result. Delegates directly to
 * the package's N-dimensional `fft`, which already performs exactly this row-then-
 * column transform when given a 2-D array.
 */
export function fftn(x: number[][]): { re: number[][]; im: number[][] } {
  const full = callFft(x) as unknown[][];
  const re = full.map((row) => row.map((v) => toReIm(v).re));
  const im = full.map((row) => row.map((v) => toReIm(v).im));
  return { re, im };
}
