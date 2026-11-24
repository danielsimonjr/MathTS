import { Complex } from '@danielsimonjr/mathts-core';
import { arraySize } from '../utils/array.js';
import { fftCoreFloat64 } from '../signal/fft-core-f64.js';
import { complexToInterleaved } from './complex-to-interleaved.js';
import { factory } from '../utils/factory.js';
import { isMatrix } from '../utils/is.js';

// Minimum array size for WASM to be beneficial
const FAST_IFFT_THRESHOLD = 64; // At least 64 elements

/**
 * Check if n is a power of 2
 */
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Convert interleaved Float64Array back to complex array
 */
function interleavedToComplex(
  data: Float64Array,
  n: number,
  complex: (re: number, im?: number) => unknown
): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < n; i++) {
    result.push(complex(data[i * 2], data[i * 2 + 1]));
  }
  return result;
}

// Type definitions for FFT operations
type ComplexNumber = { re: number; im: number } | number;
type ComplexArrayND = ComplexNumber[] | ComplexArrayND[];

interface TypedFunction<T = unknown> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => T;
  (...args: unknown[]): T;
  find(func: unknown, signature: string[]): TypedFunction<T>;
  convert(value: unknown, type: string): unknown;
}

interface Matrix {
  _data?: unknown[] | unknown[][];
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  storage(): 'dense' | 'sparse';
  size(): number[];
  getDataType(): string;
  create(data: unknown[], datatype?: string): Matrix;
  valueOf(): unknown[] | unknown[][];
}

interface Dependencies {
  typed: TypedFunction;
  fft: TypedFunction<ComplexArrayND | Matrix>;
  dotDivide: TypedFunction;
  conj: TypedFunction;
  complex: (re: number, im?: number) => unknown;
}

const name = 'ifft';
const dependencies = ['typed', 'fft', 'dotDivide', 'conj', 'complex'];

function buildIfft({ typed, fft, dotDivide, conj, complex }: Dependencies, extended: boolean) {
  /** The inverse transform of a whole array or Matrix (every axis). */
  const inverse = function (arr: ComplexArrayND | Matrix): ComplexArrayND | Matrix {
    const size = isMatrix(arr) ? (arr as Matrix).size() : arraySize(arr);
    const totalSize = size.reduce((acc: number, curr: number) => acc * curr, 1);
    // Empty input: the transform of no elements has the same empty shape (fft validates it).
    if (totalSize === 0) return fft(arr) as ComplexArrayND | Matrix;

    // FAST PATH — 1-D, power-of-two, plain numeric/Complex data.
    //
    // The fallback below is `dotDivide(conj(fft(conj(arr))), n)`: three full passes
    // over the data through typed-function dispatch, on top of the forward transform.
    // The flat Float64Array core does the inverse directly, and already applies the
    // 1/n scaling.
    //
    // This used to route to the AssemblyScript WASM kernel, which is ~6x SLOWER than
    // the flat JS core (1039 ms vs 170 ms at n=2^20).
    //
    // `complexToInterleaved` returns null for anything not representable as f64
    // (BigNumber, Fraction, Unit), so those fall through and keep exact semantics.
    if (size.length === 1) {
      const length = size[0];
      if (length >= FAST_IFFT_THRESHOLD && isPowerOf2(length)) {
        const arrData = isMatrix(arr) ? (arr as Matrix).valueOf() : arr;
        const interleaved = complexToInterleaved(arrData as unknown[], complex);
        if (interleaved) {
          const real = new Float64Array(length);
          const imag = new Float64Array(length);
          for (let i = 0; i < length; i++) {
            real[i] = interleaved[i * 2];
            imag[i] = interleaved[i * 2 + 1];
          }
          const out = fftCoreFloat64(real, imag, true); // inverse: scales by 1/n
          const packed = new Float64Array(length * 2);
          for (let i = 0; i < length; i++) {
            packed[i * 2] = out.real[i];
            packed[i * 2 + 1] = out.imag[i];
          }
          const result = interleavedToComplex(packed, length, complex);
          if (isMatrix(arr)) {
            return (arr as Matrix).create(result);
          }
          return result as ComplexArrayND;
        }
      }
    }

    // JavaScript fallback
    return dotDivide(conj(fft(conj(arr))), totalSize) as ComplexArrayND | Matrix;
  };

  /**
   * Calculate N-dimensional inverse Fourier transform
   *
   * Syntax:
   *
   *     math.ifft(arr)
   *     math.ifft(arr, n)
   *
   * Examples:
   *
   *    math.ifft([[2, 2], [0, 0]]) // returns [[{re:1, im:0}, {re:0, im:0}], [{re:1, im:0}, {re:0, im:0}]]
   *
   * See Also:
   *
   *      fft
   *
   * @param {Array | Matrix} arr    An array or matrix
   * @param {number} [n]            Number of bins (1-D input only). The input is cropped
   *                                or zero-padded to `n` values, as NumPy does.
   * @return {Array | Matrix}       N-dimensional inverse Fourier transformation of the array
   */
  return typed(name, {
    'Array | Matrix': inverse,
    ...(extended && {
      // NumPy `ifft(a, n)`: the input is cropped or zero-padded to length `n` first, so the
      // result has `n` bins. One axis only; an N-dimensional input has no single length to set.
      'Array | Matrix, number': function (
        arr: ComplexArrayND | Matrix,
        n: number
      ): ComplexArrayND | Matrix {
        if (!Number.isInteger(n) || n < 1) {
          throw new RangeError(`ifft: n must be a positive integer (got ${n})`);
        }
        const size = isMatrix(arr) ? (arr as Matrix).size() : arraySize(arr);
        if (size.length !== 1) {
          throw new RangeError(`ifft: n is only supported for 1-D input (got ${size.length}-D)`);
        }
        const data = (isMatrix(arr) ? (arr as Matrix).valueOf() : arr) as unknown[];
        const sized = data.slice(0, n);
        while (sized.length < n) sized.push(complex(0, 0));
        const out = inverse(sized as ComplexArrayND);
        return isMatrix(arr) ? (arr as Matrix).create(out as unknown[]) : out;
      },
    }),
  });
}

export const createIfft = /* #__PURE__ */ factory(name, dependencies, (deps: Dependencies) =>
  buildIfft(deps, true)
);

export const createSelectedIfft = /* #__PURE__ */ factory(
  name,
  dependencies.filter((dependency) => dependency !== 'complex'),
  (deps: Omit<Dependencies, 'complex'>) =>
    buildIfft({ ...deps, complex: (re, im) => new Complex(re, im) }, false)
);
