import { factory } from '../utils/factory.js';
import type { Matrix, Complex, TypedFunction } from '../types.js';
import { assertAllocSize } from '../utils/limits.js';
import { collectionSize } from '../typed/number-matrix.js';

const name = 'freqz';

const dependencies = ['typed', 'add', 'multiply', 'Complex', 'divide', 'matrix'];

/**
 * Frequency response result
 */
export interface FrequencyResponse {
  h: Complex[] | Matrix;
  w: number[] | Matrix;
}

/** Call signatures of `freqz` (numerator `b`, denominator `a`, optional frequencies or point count `w`). */
interface FreqzOverloads {
  (b: number[], a: number[], w?: number[] | number): FrequencyResponse;
  (b: Matrix, a: Matrix, w?: Matrix | number): FrequencyResponse;
}

/** `freqz` with its precise call signatures; still a `TypedFunction`. */
export type FreqzFunction = FreqzOverloads & TypedFunction;

export const createFreqz = /* #__PURE__ */ factory(
  name,
  dependencies,
  // The deps are untyped (`any`), so the result is declared: without it the export
  // inherits `any` from `typed(...)` instead of being a TypedFunction like the rest.
  ({ typed, add, multiply, Complex, divide, matrix }): FreqzFunction => {
    /**
     * Calculates the frequency response of a filter given its numerator and denominator coefficients.
     *
     * Syntax:
     *    math.freqz(b, a)
     *    math.freqz(b, a, w)
     *
     * Examples:
     *   math.freqz([1, 2], [1, 2, 3], 4) // returns { h: [0.5 + 0i, 0.4768589245763655 + 0.2861153547458193i, 0.25000000000000006 + 0.75i, -0.770976571635189 + 0.4625859429811135i], w: [0, 0.7853981633974483, 1.5707963267948966, 2.356194490192345 ] }
     *   math.freqz([1, 2], [1, 2, 3], [0, 1]) // returns { h: [0.5 + 0i, 0.45436781 + 0.38598051i], w: [0, 1] }
     *
     * See also:
     *  zpk2tf
     *
     * @param {Array.<number>} b The numerator coefficients of the filter.
     * @param {Array.<number>} a The denominator coefficients of the filter.
     * @param {Array.<number>} [w] A vector of frequencies (in radians/sample) at which the frequency response is to be computed or the number of points to compute (if a number is not provided, the default is 512 points)
     * @returns {Object} An object with two properties: h, a vector containing the complex frequency response, and w, a vector containing the normalized frequencies (in radians/sample) at which the response was computed.
     *
     *
     */
    // `Complex` is injected as the core class (not complex.js' callable factory), so it needs `new`.
    const mkComplex = (re: number, im: number): Complex => new Complex(re, im) as Complex;

    const freqz = typed(name, {
      'Array, Array': function (b: number[], a: number[]): FrequencyResponse {
        const w = createBins(512);
        return _freqz(b, a, w);
      },
      'Array, Array, Array': function (b: number[], a: number[], w: number[]): FrequencyResponse {
        return _freqz(b, a, w);
      },
      'Array, Array, number': function (b: number[], a: number[], w: number): FrequencyResponse {
        if (w < 0) {
          throw new Error('w must be a positive number');
        }
        assertAllocSize('freqz', [w, 8]);
        const w2 = createBins(w);
        return _freqz(b, a, w2);
      },
      'Matrix, Matrix': function (b: Matrix, a: Matrix): FrequencyResponse {
        const _w = createBins(512);
        const { w, h } = _freqz(vectorEntries('b', b), vectorEntries('a', a), _w);
        return {
          w: matrix(w),
          h: matrix(h),
        };
      },
      'Matrix, Matrix, Matrix': function (b: Matrix, a: Matrix, w: Matrix): FrequencyResponse {
        const { h } = _freqz(vectorEntries('b', b), vectorEntries('a', a), w.valueOf() as number[]);
        return {
          h: matrix(h),
          w: matrix(w),
        };
      },
      'Matrix, Matrix, number': function (b: Matrix, a: Matrix, w: number): FrequencyResponse {
        if (w < 0) {
          throw new Error('w must be a positive number');
        }
        assertAllocSize('freqz', [w, 8]);
        const _w = createBins(w);
        const { h } = _freqz(vectorEntries('b', b), vectorEntries('a', a), _w);
        return {
          h: matrix(h),
          w: matrix(_w),
        };
      },
    }) as unknown as FreqzFunction;
    return freqz;

    /**
     * Checks that a coefficient argument has one axis, as `freqz` reads it as a vector.
     * @param label - The name of the argument, for the error message.
     * @param x - The argument: an Array or a matrix.
     * @throws A `RangeError` that shows the size when the argument is not a vector.
     */
    function assertVector(label: string, x: unknown): void {
      const size = collectionSize(x);
      if (size.length !== 1) {
        throw new RangeError(`freqz: ${label} must be a vector (size: [${size.join(', ')}])`);
      }
    }

    /**
     * The entries of a coefficient matrix, after the check that it is a vector. The check reads the
     * size of the matrix, because the entries of a matrix with a zero axis do not show it.
     * @param label - The name of the argument, for the error message.
     * @param x - The coefficient matrix.
     * @returns The entries of the vector.
     */
    function vectorEntries(label: string, x: Matrix): number[] {
      assertVector(label, x);
      return x.valueOf() as number[];
    }

    /**
     * Internal frequency response calculation
     * @param b - Numerator coefficients
     * @param a - Denominator coefficients
     * @param w - Frequency bins (radians/sample)
     * @returns Frequency response with h (complex) and w (frequencies)
     */
    function _freqz(b: number[], a: number[], w: number[]): { h: Complex[]; w: number[] } {
      assertVector('b', b);
      assertVector('a', a);
      const num: Complex[] = [];
      const den: Complex[] = [];

      // Compute numerator and denominator at each frequency
      for (let i = 0; i < w.length; i++) {
        let sumNum: Complex = mkComplex(0, 0) as Complex;
        let sumDen: Complex = mkComplex(0, 0) as Complex;

        // Sum b[j] * exp(-j*w[i]*1i) for numerator
        for (let j = 0; j < b.length; j++) {
          sumNum = add(
            sumNum,
            multiply(b[j], mkComplex(Math.cos(-j * w[i]), Math.sin(-j * w[i])))
          ) as Complex;
        }

        // Sum a[j] * exp(-j*w[i]*1i) for denominator
        for (let j = 0; j < a.length; j++) {
          sumDen = add(
            sumDen,
            multiply(a[j], mkComplex(Math.cos(-j * w[i]), Math.sin(-j * w[i])))
          ) as Complex;
        }

        num.push(sumNum);
        den.push(sumDen);
      }

      // Compute frequency response H(w) = Num(w) / Den(w)
      const h: Complex[] = [];
      for (let i = 0; i < num.length; i++) {
        h.push(divide(num[i], den[i]) as Complex);
      }

      return { h, w };
    }

    /**
     * Create frequency bins from 0 to PI
     * @param n - Number of frequency bins
     * @returns Array of frequencies in radians/sample
     */
    function createBins(n: number): number[] {
      const bins: number[] = [];
      for (let i = 0; i < n; i++) {
        bins.push((i / n) * Math.PI);
      }
      return bins;
    }
  }
);
