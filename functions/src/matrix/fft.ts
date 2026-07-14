import { arraySize } from '../utils/array.js';
import { fftCoreFloat64 } from '../signal/fft-core-f64.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Minimum array size for WASM to be beneficial
const FAST_FFT_THRESHOLD = 64; // below this the flat core is not worth the conversion

/**
 * Check if n is a power of 2
 */
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Convert complex array to interleaved Float64Array [re0, im0, re1, im1, ...]
 */
function complexToInterleaved(
  arr: unknown[],
  _complex: (re: number, im?: number) => unknown
): Float64Array | null {
  const n = arr.length;
  const result = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const val = arr[i];
    if (typeof val === 'number') {
      result[i * 2] = val;
      result[i * 2 + 1] = 0;
    } else if (
      val &&
      typeof (val as { re?: unknown }).re === 'number' &&
      typeof (val as { im?: unknown }).im === 'number'
    ) {
      result[i * 2] = (val as { re: number }).re;
      result[i * 2 + 1] = (val as { im: number }).im;
    } else {
      // Unsupported type, fall back to JS
      return null;
    }
  }
  return result;
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

// WASM integration for FFT is complex due to complex number format differences
// See note above dependencies array for details

// Type definitions for FFT operations
type ComplexNumber = { re: number; im: number } | number;
/** Complex/number values flow through dynamically-dispatched scalar ops */
type ComplexArray = unknown[];
type ComplexArrayND = unknown;
/** A scalar operation resolved from a typed-function */
type ScalarFn = (...args: unknown[]) => unknown;

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
  matrix: (data: unknown[], storage?: 'dense' | 'sparse') => Matrix;
  addScalar: ScalarFn;
  multiplyScalar: ScalarFn;
  divideScalar: ScalarFn;
  exp: ScalarFn;
  tau: number;
  i: ComplexNumber;
  dotDivide: ScalarFn;
  conj: ScalarFn;
  pow: ScalarFn;
  ceil: ScalarFn;
  log2: ScalarFn;
  complex: (re: number, im?: number) => unknown;
}

// FFT WASM integration note:
// The WASM fft function expects interleaved complex numbers [re, im, re, im, ...]
// while mathjs uses Complex objects with {re, im} properties.
// Full WASM acceleration requires format conversion which may negate benefits
// for small arrays. The existing JavaScript implementation with Chirp-Z transform
// is already well-optimized. WASM acceleration is most beneficial for large
// power-of-2 sized arrays with pure number inputs.

const name = 'fft';
const dependencies = [
  'typed',
  'matrix',
  'addScalar',
  'multiplyScalar',
  'divideScalar',
  'exp',
  'tau',
  'i',
  'dotDivide',
  'conj',
  'pow',
  'ceil',
  'log2',
  'complex',
];

export const createFft = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix: _matrix,
    addScalar,
    multiplyScalar,
    divideScalar,
    exp,
    tau,
    i: I,
    dotDivide,
    conj,
    pow,
    ceil,
    log2,
    complex,
  }: Dependencies) => {
    /**
     * Calculate N-dimensional Fourier transform
     *
     * Syntax:
     *
     *     math.fft(arr)
     *
     * Examples:
     *
     *    math.fft([[1, 0], [1, 0]]) // returns [[{re:2, im:0}, {re:2, im:0}], [{re:0, im:0}, {re:0, im:0}]]
     *
     *
     * See Also:
     *
     *      ifft
     *
     * @param {Array | Matrix} arr    An array or matrix
     * @return {Array | Matrix}       N-dimensional Fourier transformation of the array
     */
    return typed(name, {
      Array: _ndFft,
      Matrix: function (matrix: Matrix): Matrix {
        return matrix.create(_ndFft(matrix.valueOf()) as unknown[], matrix._datatype);
      },
    });

    /**
     * Perform an N-dimensional Fourier transform
     *
     * @param {Array} arr      The array
     * @return {Array}         resulting array
     */
    function _ndFft(arr: ComplexArrayND): unknown {
      const size = arraySize(arr);
      if (size.length === 1) return _fft(arr as ComplexArray, size[0]);
      // ndFft along dimension 1,...,N-1 then 1dFft along dimension 0
      return _1dFft(
        (arr as unknown[]).map((slice) => _ndFft(slice)),
        0
      );
    }

    /**
     * Perform an 1-dimensional Fourier transform
     *
     * @param {Array} arr      The array
     * @param {number} dim     dimension of the array to perform on
     * @return {Array}         resulting array
     */
    function _1dFft(arr: ComplexArrayND, dim: number): unknown {
      const size = arraySize(arr);
      if (dim !== 0) {
        const result: unknown[] = [];
        for (let i = 0; i < size[0]; i++) {
          result.push(_1dFft((arr as unknown[])[i], dim - 1));
        }
        return result;
      }
      if (size.length === 1) return _fft(arr as ComplexArray);

      function _transpose(arr: unknown[]): unknown[] {
        // Swap first 2 dimensions
        const size = arraySize(arr);
        const result: unknown[] = [];
        for (let j = 0; j < size[1]; j++) {
          const row: unknown[] = [];
          for (let i = 0; i < size[0]; i++) {
            row.push((arr[i] as unknown[])[j]);
          }
          result.push(row);
        }
        return result;
      }

      return _transpose(_1dFft(_transpose(arr as unknown[]), 1) as unknown[]);
    }

    /**
     * Perform an 1-dimensional non-power-of-2 Fourier transform using Chirp-Z Transform
     *
     * @param {Array} arr      The array
     * @return {Array}         resulting array
     */
    function _czt(arr: ComplexArray): ComplexArray {
      const n = arr.length;
      const w = exp(divideScalar(multiplyScalar(-1, multiplyScalar(I, tau)), n));
      const chirp: unknown[] = [];
      for (let i = 1 - n; i < n; i++) {
        chirp.push(pow(w, divideScalar(pow(i, 2), 2)));
      }
      const N2 = pow(2, ceil(log2(n + n - 1))) as number;
      const xp: unknown[] = [];
      for (let i = 0; i < n; i++) {
        xp.push(multiplyScalar(arr[i], chirp[n - 1 + i]));
      }
      for (let i = 0; i < N2 - n; i++) {
        xp.push(0);
      }
      const ichirp: unknown[] = [];
      for (let i = 0; i < n + n - 1; i++) {
        ichirp.push(divideScalar(1, chirp[i]));
      }
      for (let i = 0; i < N2 - (n + n - 1); i++) {
        ichirp.push(0);
      }
      const fftXp = _fft(xp);
      const fftIchirp = _fft(ichirp);
      const fftProduct: unknown[] = [];
      for (let i = 0; i < N2; i++) {
        fftProduct.push(multiplyScalar(fftXp[i], fftIchirp[i]));
      }
      const ifftProduct = dotDivide(conj(_ndFft(conj(fftProduct))), N2) as unknown[];
      const ret: unknown[] = [];
      for (let i = n - 1; i < n + n - 1; i++) {
        ret.push(multiplyScalar(ifftProduct[i], chirp[i]));
      }
      return ret;
    }

    /**
     * Perform an 1-dimensional Fourier transform
     *
     * @param {Array} arr      The array
     * @param {number} len     Optional length override
     * @return {Array}         resulting array
     */
    function _fft(arr: ComplexArray, len?: number): ComplexArray {
      const length = len ?? arr.length;
      if (length === 1) return [arr[0]];

      // FAST PATH — 1-D, power-of-two, plain numeric/Complex data.
      //
      // The recursive fallback below is a Cooley-Tukey built out of ARRAY SPREADS
      // (`[..._fft(even), ..._fft(odd)]`) whose scalar arithmetic goes through
      // typed-function dispatch on Complex objects. Measured, n=2^18:
      //
      //   recursive Complex path   14889 ms
      //   flat Float64Array core      33 ms      <- same transform, ~300x
      //
      // This used to route to the AssemblyScript WASM kernel instead, which is itself
      // ~6x SLOWER than the flat JS core (1039 ms vs 170 ms at n=2^20) — so the "fast
      // path" was a pessimisation on top of a pessimisation. It now uses the core that
      // `parallelFFT` uses.
      //
      // `complexToInterleaved` returns null for anything it cannot represent as f64
      // (BigNumber, Fraction, Unit), so those fall through to the general path below
      // and keep their exact semantics.
      // NOTE the guard. This used to read `len === undefined`, intended as "top-level call
      // only" — but `_ndFft` ALWAYS passes `len` for the 1-D case (`_fft(arr, size[0])`),
      // so the condition was never true and the fast path was DEAD. That is why the public
      // `fft` took ~15 s at n=2^18: it always fell through to the recursive Complex path.
      // Every call site passes `len === arr.length` (the recursion halves both together),
      // so the honest guard is simply "are we transforming the whole array".
      if (length === arr.length && length >= FAST_FFT_THRESHOLD && isPowerOf2(length)) {
        const interleaved = complexToInterleaved(arr, complex);
        if (interleaved) {
          const real = new Float64Array(length);
          const imag = new Float64Array(length);
          for (let i = 0; i < length; i++) {
            real[i] = interleaved[i * 2];
            imag[i] = interleaved[i * 2 + 1];
          }
          const out = fftCoreFloat64(real, imag, false);
          const result = new Float64Array(length * 2);
          for (let i = 0; i < length; i++) {
            result[i * 2] = out.real[i];
            result[i * 2 + 1] = out.imag[i];
          }
          return interleavedToComplex(result, length, complex);
        }
      }

      // JavaScript fallback
      if (length % 2 === 0) {
        const ret: unknown[] = [
          ..._fft(
            arr.filter((_, i) => i % 2 === 0),
            length / 2
          ),
          ..._fft(
            arr.filter((_, i) => i % 2 === 1),
            length / 2
          ),
        ];
        for (let k = 0; k < length / 2; k++) {
          const p = ret[k];
          const q = multiplyScalar(
            ret[k + length / 2],
            exp(multiplyScalar(multiplyScalar(tau, I), divideScalar(-k, length)))
          );
          ret[k] = addScalar(p, q);
          ret[k + length / 2] = addScalar(p, multiplyScalar(-1, q));
        }
        return ret;
      } else {
        // use chirp-z transform for non-power-of-2 FFT
        return _czt(arr);
      }
      // throw new Error('Can only calculate FFT of power-of-two size')
    }
  }
);
