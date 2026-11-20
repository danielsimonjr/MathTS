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
import { assertAllocSize } from '../utils/limits.js';
import { isMatrix } from '../utils/is.js';
import { arraySize, validate } from '../utils/array.js';
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

/** A Matrix becomes its nested-array data; a plain array passes through. */
function unwrapInput(fn: string, x: unknown): unknown[] {
  const data = isMatrix(x) ? (x as { valueOf(): unknown }).valueOf() : x;
  if (ArrayBuffer.isView(data) && !(data instanceof DataView)) {
    return Array.from(data as unknown as ArrayLike<number>);
  }
  if (!Array.isArray(data)) {
    throw new TypeError(`${fn}: expected an array or Matrix (got ${typeof data})`);
  }
  return data;
}

function rfft1d(x: unknown[]): { re: number[]; im: number[] } {
  const n = x.length;
  // An empty signal has no bins. floor(0/2)+1 would give one bin and read past the end (#988).
  if (n === 0) return { re: [], im: [] };
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

function rfftNd(x: unknown[]): { re: unknown[]; im: unknown[] } {
  if (x.length > 0 && Array.isArray(x[0])) {
    const parts = x.map((row) => rfftNd(row as unknown[]));
    return { re: parts.map((p) => p.re), im: parts.map((p) => p.im) };
  }
  return rfft1d(x);
}

/**
 * Real FFT: compute the full FFT of a real signal and keep only the first
 * `floor(n/2)+1` bins — the non-redundant half of the conjugate-symmetric spectrum.
 * A 2-D (or deeper) input transforms along its last axis, as NumPy does. A Matrix is
 * unwrapped; the result is always plain arrays.
 *
 * @param x Real input signal (1-D array, N-D nested array or Matrix)
 * @returns `{ re, im }`, with the last axis of length `floor(n/2)+1`
 */
export function rfft(x: number[]): { re: number[]; im: number[] };
export function rfft(x: number[][]): { re: number[][]; im: number[][] };
export function rfft(x: unknown): { re: unknown; im: unknown };
export function rfft(x: unknown): { re: unknown; im: unknown } {
  const data = unwrapInput('rfft', x);
  // `arraySize` reads the first row only, so `validate` rejects a ragged array, as `fft` does.
  validate(data, arraySize(data));
  return rfftNd(data);
}

/**
 * Inverse real FFT: reconstruct the full conjugate-symmetric spectrum of length `n`
 * from the non-redundant half produced by {@link rfft} (bins `n/2+1..n-1` are the
 * conjugates of bins `n/2-1..1`), inverse-FFT it, and return the real parts.
 *
 * @param spec `{ re, im }` half-spectrum (bins `0..floor(n/2)`); each part is an array, a
 *   typed array or a Matrix
 * @param n Length of the reconstructed real signal
 * @returns Real-valued signal of length `n`
 */
export function irfft(spec: { re: unknown; im: unknown }, n: number): number[] {
  // A length-0 signal has no samples. floor(0/2)+1 would build one NaN bin (#988).
  if (n === 0) return [];
  const re = unwrapInput('irfft', spec.re) as number[];
  const im = unwrapInput('irfft', spec.im) as number[];
  const halfLen = Math.floor(n / 2) + 1;
  const full: unknown[] = new Array(n);
  for (let i = 0; i < halfLen; i++) {
    full[i] = complex(re[i], im[i]);
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
 * Thin public surface over the package's single roll algorithm (`fftshift<T>` in `./fft.ts`) —
 * same behavior, delegated to keep one implementation. A Matrix or a typed array is unwrapped,
 * as in {@link rfft}; the result is always a plain array.
 *
 * @throws TypeError if `x` is not an array, a typed array or a Matrix
 */
export function fftshift(x: number[]): number[];
export function fftshift(x: unknown): unknown[];
export function fftshift(x: unknown): unknown[] {
  return fftshiftGeneric(unwrapInput('fftshift', x));
}

/**
 * Inverse of {@link fftshift} (roll by `ceil(n/2)`).
 *
 * Thin public surface over `ifftshift<T>` in `./fft.ts`. A Matrix or a typed array is
 * unwrapped; the result is always a plain array.
 *
 * @throws TypeError if `x` is not an array, a typed array or a Matrix
 */
export function ifftshift(x: number[]): number[];
export function ifftshift(x: unknown): unknown[];
export function ifftshift(x: unknown): unknown[] {
  return ifftshiftGeneric(unwrapInput('ifftshift', x));
}

/**
 * DFT sample frequencies: `[0, 1, ..., ceil(n/2)-1, -floor(n/2), ..., -1] / (n*d)`.
 *
 * @param n Number of samples
 * @param d Sample spacing (default 1)
 */
export function fftfreq(n: number, d: number = 1): number[] {
  assertAllocSize('fftfreq', [n]);
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
  assertAllocSize('rfftfreq', [n]);
  if (n === 0) return [];
  const half = Math.floor(n / 2);
  const result = new Array<number>(half + 1);
  for (let k = 0; k <= half; k++) {
    result[k] = k / (n * d);
  }
  return result;
}

/** Split a nested array of Complex bins into nested re and im arrays of the same shape. */
function splitComplex(x: unknown, part: 're' | 'im'): unknown {
  return Array.isArray(x) ? x.map((v) => splitComplex(v, part)) : toReIm(x)[part];
}

/**
 * N-D FFT over every axis, as NumPy `fftn`: a 1-D input equals `fft`, a 2-D input runs rows
 * and then columns. Delegates to the package's N-dimensional `fft`. A Matrix is unwrapped;
 * the result is always plain arrays.
 */
export function fftn(x: number[]): { re: number[]; im: number[] };
export function fftn(x: number[][]): { re: number[][]; im: number[][] };
export function fftn(x: unknown): { re: unknown; im: unknown };
export function fftn(x: unknown): { re: unknown; im: unknown } {
  const full = callFft(unwrapInput('fftn', x));
  return { re: splitComplex(full, 're'), im: splitComplex(full, 'im') };
}
