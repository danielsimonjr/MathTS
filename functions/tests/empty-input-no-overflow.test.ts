/**
 * Empty input must return a defined value and must not overflow the stack (#988).
 *
 * The FFT family returns an empty result for `[]` and for `matrix([])`. This is the
 * same result that `fft(new Float64Array(0))` already gives. `mean`, `std` and `variance`
 * keep the NaN contract that `mean([])`, `std([])` and `variance([])` already pin.
 *
 * Each assertion uses an exact value. A bare "not a RangeError" check would also pass
 * on an accidental TypeError.
 */
import { describe, it, expect } from 'vitest';
import { fft, ifft, rfft, fftn, mean, std, variance, matrix } from '../src/index.js';

type MatrixLike = { valueOf(): unknown };

describe('empty input does not overflow the stack (#988)', () => {
  describe('fft family, plain array', () => {
    it('fft([]) returns an empty array', () => {
      expect(fft([] as never)).toStrictEqual([]);
    });

    it('ifft([]) returns an empty array', () => {
      expect(ifft([] as never)).toStrictEqual([]);
    });

    it('rfft([]) returns an empty half-spectrum', () => {
      expect(rfft([])).toStrictEqual({ re: [], im: [] });
    });

    it('fftn([]) returns an empty spectrum', () => {
      expect(fftn([])).toStrictEqual({ re: [], im: [] });
    });
  });

  describe('fft family, Float64Array and matrix inputs', () => {
    it('fft(new Float64Array(0)) returns an empty array', () => {
      expect(fft(new Float64Array(0) as never)).toStrictEqual([]);
    });

    it('ifft(new Float64Array(0)) returns an empty array', () => {
      expect(ifft(new Float64Array(0) as never)).toStrictEqual([]);
    });

    it('fft(matrix([])) returns an empty matrix', () => {
      expect((fft(matrix([]) as never) as MatrixLike).valueOf()).toStrictEqual([]);
    });

    it('ifft(matrix([])) returns an empty matrix', () => {
      expect((ifft(matrix([]) as never) as MatrixLike).valueOf()).toStrictEqual([]);
    });
  });

  describe('statistics of matrix([]) keep the NaN contract', () => {
    it('mean(matrix([])) is NaN', () => {
      expect(mean(matrix([]) as never)).toBeNaN();
    });

    it('std(matrix([])) is NaN', () => {
      expect(std(matrix([]) as never)).toBeNaN();
    });

    it('variance(matrix([])) is NaN', () => {
      expect(variance(matrix([]) as never)).toBeNaN();
    });
  });
});
