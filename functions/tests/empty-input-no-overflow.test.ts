/**
 * Empty input must return a defined value and must not overflow the stack (#988).
 *
 * The FFT family returns an empty result for `[]` and for `matrix([])`. This is the
 * same result that `fft(new Float64Array(0))` already gives. A multi-dimensional input
 * with a zero-length dimension keeps its shape, and a jagged input throws a
 * DimensionError. `irfft(spec, 0)` and `rfftfreq(0)` return `[]`, as `fftfreq(0)` does.
 * `closestPair` of a Matrix throws a TypeError. The `mean`, `std` and `variance` cases are
 * regression pins: `matrix([])` keeps the NaN contract of `[]` (NumPy gives NaN too).
 *
 * Each assertion uses an exact value. A bare "not a RangeError" check would also pass
 * on an accidental TypeError.
 */
import { describe, it, expect } from 'vitest';
import {
  fft,
  ifft,
  rfft,
  irfft,
  fftn,
  fftfreq,
  rfftfreq,
  closestPair,
  mean,
  std,
  variance,
  matrix,
  zeros,
  sparse,
} from '../src/index.js';

type MatrixLike = { valueOf(): unknown; size(): number[] };
const sizeOf = (m: unknown): number[] => (m as MatrixLike).size();

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
      expect(sizeOf(fft(matrix([]) as never))).toStrictEqual([0]);
    });

    it('ifft(matrix([])) returns an empty matrix', () => {
      expect(sizeOf(ifft(matrix([]) as never))).toStrictEqual([0]);
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

  describe('a zero-length dimension keeps the shape', () => {
    it('fft and ifft of nested empty arrays return the same shape', () => {
      expect(fft([[]] as never)).toStrictEqual([[]]);
      expect(fft([[], []] as never)).toStrictEqual([[], []]);
      expect(fft([[[]], [[]]] as never)).toStrictEqual([[[]], [[]]]);
      expect(ifft([[]] as never)).toStrictEqual([[]]);
      expect(ifft([[[]], [[]]] as never)).toStrictEqual([[[]], [[]]]);
    });

    it('fft and ifft of an empty matrix keep its size', () => {
      expect(sizeOf(fft(zeros(3, 0) as never))).toStrictEqual([3, 0]);
      expect(sizeOf(fft(zeros(0, 3) as never))).toStrictEqual([0, 3]);
      expect(sizeOf(ifft(zeros(3, 0) as never))).toStrictEqual([3, 0]);
      expect(sizeOf(ifft(matrix([[]]) as never))).toStrictEqual([1, 0]);
      expect(sizeOf(fft(sparse([]) as never))).toStrictEqual([0, 0]);
    });

    it('a jagged array throws a DimensionError', () => {
      expect(() => fft([[], [1]] as never)).toThrow(/Dimension mismatch/);
      expect(() => ifft([[], [1]] as never)).toThrow(/Dimension mismatch/);
    });

    it('fftn keeps the shape of a nested empty array', () => {
      expect(fftn([[]] as never)).toStrictEqual({ re: [[]], im: [[]] });
      expect(fftn([[], []] as never)).toStrictEqual({ re: [[], []], im: [[], []] });
    });

    it('a non-empty input is unchanged', () => {
      const got = fft([1, 2, 3] as never) as Array<{ re: number; im: number }>;
      expect(got).toHaveLength(3);
      expect(got[0].re).toBeCloseTo(6, 12);
    });
  });

  describe('length-0 helpers', () => {
    it('rfft of an empty Float64Array is an empty half-spectrum', () => {
      expect(rfft(new Float64Array(0) as never)).toStrictEqual({ re: [], im: [] });
    });

    it('irfft with n = 0 is an empty signal and round-trips rfft([])', () => {
      expect(irfft({ re: [], im: [] }, 0)).toStrictEqual([]);
      expect(irfft(rfft([] as never) as { re: number[]; im: number[] }, 0)).toStrictEqual([]);
    });

    it('rfftfreq(0) and fftfreq(0) are empty; rfftfreq(1) is [0]', () => {
      expect(rfftfreq(0)).toStrictEqual([]);
      expect(fftfreq(0)).toStrictEqual([]);
      expect(rfftfreq(1)).toStrictEqual([0]);
    });
  });

  describe('closestPair rejects a Matrix instead of overflowing', () => {
    it('a Matrix throws a TypeError', () => {
      expect(() => closestPair(matrix([]) as never)).toThrow(TypeError);
      expect(() =>
        closestPair(
          matrix([
            [0, 0],
            [1, 1],
            [3, 3],
          ]) as never
        )
      ).toThrow(/points must be an array/);
    });

    it('arrays keep their behaviour', () => {
      expect(() => closestPair([])).toThrow(/need at least two points/);
      expect(
        closestPair([
          [0, 0],
          [1, 1],
          [3, 3],
        ])
      ).toStrictEqual({ i: 0, j: 1, distance: Math.SQRT2 });
    });
  });
});
