import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';

// Oracle: NumPy 2.3.5 / SciPy (values below were generated with it).
type Bin = { re: number; im: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic probe of many signatures
const A = F as unknown as Record<string, (...a: unknown[]) => any>;
const C = (v: unknown) => v as { re: number; im: number };
/** Add +0 to every number so -0 compares equal to 0. */
const nz = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(nz)
    : typeof v === 'number'
      ? v + 0
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nz(x)]))
        : v;

describe('fft length-1 input (#1010)', () => {
  it('fft([5]) is one Complex bin, like longer inputs', () => {
    const r = A.fft([5]);
    expect(r).toHaveLength(1);
    expect(C(r[0]).re).toBe(5);
    expect(C(r[0]).im).toBe(0);
  });
  it('fft([[5]]) and fft(matrix([5])) box the bin', () => {
    expect(C(A.fft([[5]])[0][0]).re).toBe(5);
    expect(C(A.fft(A.matrix([5])).valueOf()[0]).im + 0).toBe(0);
  });
  it('fft(Float64Array([5])) and ifft([5]) box the bin', () => {
    expect(C(A.fft(new Float64Array([5]))[0]).im + 0).toBe(0);
    expect(C(A.ifft([5])[0]).re).toBe(5);
    expect(C(A.ifft([5])[0]).im + 0).toBe(0);
  });
  it('rfft([5]) / irfft round trip', () => {
    expect(nz(A.rfft([5]))).toEqual({ re: [5], im: [0] });
    expect(A.irfft({ re: [5], im: [0] }, 1)).toEqual([5]);
  });
});

describe('ifft n parameter (#1010)', () => {
  const spec = () => A.fft([1, 2, 3, 4]);
  it('ifft(fft(x), 4) round-trips', () => {
    const r = A.ifft(spec(), 4);
    expect(r.map((c: Bin) => c.re)).toEqual([1, 2, 3, 4]);
    for (const c of r) expect(Math.abs(c.im)).toBeLessThan(1e-12);
  });
  it('n larger zero-pads the spectrum (NumPy: ifft([1,2,3,4], 6))', () => {
    const r = A.ifft([1, 2, 3, 4], 6);
    expect(r).toHaveLength(6);
    expect(C(r[0]).re).toBeCloseTo(1.6666666666666667, 12);
    expect(C(r[1]).re).toBeCloseTo(-0.5833333333333334, 12);
    expect(C(r[1]).im).toBeCloseTo(0.7216878364870322, 12);
    expect(C(r[2]).im).toBeCloseTo(-0.14433756729740643, 12);
  });
  it('n smaller crops the spectrum (NumPy: ifft([1,2,3,4], 2) = [1.5, -0.5])', () => {
    const r = A.ifft([1, 2, 3, 4], 2);
    expect(r.map((c: Bin) => c.re)).toEqual([1.5, -0.5]);
  });
  it('Matrix input keeps the Matrix container', () => {
    const r = A.ifft(A.matrix([1, 2, 3, 4]), 2);
    expect(r.valueOf().map((c: Bin) => c.re)).toEqual([1.5, -0.5]);
  });
  it('rejects a bad n with an error naming ifft', () => {
    expect(() => A.ifft([1, 2], 0)).toThrow(/ifft/);
    expect(() => A.ifft([1, 2], 1.5)).toThrow(/ifft/);
    expect(() =>
      A.ifft(
        [
          [1, 2],
          [3, 4],
        ],
        2
      )
    ).toThrow(/ifft/);
  });
});

describe('fft NaN propagates to both parts (#1010)', () => {
  const allNaN = (r: Bin[]) => {
    for (const c of r) {
      expect(c.re).toBeNaN();
      expect(c.im).toBeNaN();
    }
  };
  it('n=4 matches the n>=64 kernel: every bin NaN in re and im', () => {
    allNaN(A.fft([NaN, 1, 2, 3]));
    allNaN(A.fft([1, NaN, 2, 3]));
    const big = Array.from({ length: 64 }, (_, i) => i);
    big[3] = NaN;
    allNaN(A.fft(big));
  });
  it('NaN in the imaginary part of a Complex input', () => {
    allNaN(A.fft([A.complex(1, NaN), 2, 3, 4]));
  });
  it('Float64Array, Matrix, 2-D, ifft, rfft', () => {
    allNaN(A.fft(new Float64Array([NaN, 1, 2, 3])));
    allNaN(A.fft(A.matrix([NaN, 1, 2, 3])).valueOf());
    allNaN(
      A.fft([
        [NaN, 1],
        [2, 3],
      ]).flat()
    );
    allNaN(A.ifft([NaN, 1, 2, 3]));
    const r = A.rfft([NaN, 1, 2, 3]);
    expect(r.re.every(Number.isNaN)).toBe(true);
    expect(r.im.every(Number.isNaN)).toBe(true);
  });
  it('finite input is unchanged', () => {
    const r = A.fft([1, 2, 3, 4]);
    const got = r.map((c: Bin) => [c.re, c.im]);
    [
      [10, 0],
      [-2, 2],
      [-2, 0],
      [-2, -2],
    ].forEach(([re, im], i) => {
      expect(got[i][0]).toBeCloseTo(re, 12);
      expect(got[i][1]).toBeCloseTo(im, 12);
    });
  });
});

describe('rfft / fftn / periodogram edge inputs (#1090)', () => {
  it('rfft over the last axis of a 2-D array (NumPy)', () => {
    const r = A.rfft([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(nz(r.re)).toEqual([
      [10, -2, -2],
      [26, -2, -2],
    ]);
    expect(nz(r.im)).toEqual([
      [0, 2, 0],
      [0, 2, 0],
    ]);
  });
  it('rfft accepts a Matrix (1-D and 2-D) and returns plain arrays', () => {
    expect(nz(A.rfft(A.matrix([1, 2, 3, 4])))).toEqual({ re: [10, -2, -2], im: [0, 2, 0] });
    expect(
      nz(
        A.rfft(
          A.matrix([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
          ])
        ).re
      )
    ).toEqual([
      [10, -2, -2],
      [26, -2, -2],
    ]);
    expect(A.rfft(A.matrix([]))).toEqual({ re: [], im: [] });
  });
  it('fftn of 1-D equals fft, as NumPy', () => {
    const r = A.fftn([1, 2, 3, 4]);
    [10, -2, -2, -2].forEach((v, i) => expect(r.re[i]).toBeCloseTo(v, 12));
    [0, 2, 0, -2].forEach((v, i) => expect(r.im[i]).toBeCloseTo(v, 12));
  });
  it('fftn of a 2-D Matrix', () => {
    expect(
      nz(
        A.fftn(
          A.matrix([
            [1, 2],
            [3, 4],
          ])
        )
      )
    ).toEqual({
      re: [
        [10, -2],
        [-4, 0],
      ],
      im: [
        [0, 0],
        [0, 0],
      ],
    });
  });
  it('fftn empty input gives arrays for array and Matrix', () => {
    expect(A.fftn([])).toEqual({ re: [], im: [] });
    expect(A.fftn(A.matrix([]))).toEqual({ re: [], im: [] });
  });
  it('periodogram([]) returns two empty arrays, as SciPy', () => {
    expect(A.periodogram([])).toEqual({ psd: [], frequencies: [] });
  });
  it('fft2d empty input keeps its shape (no padded 1x1)', () => {
    expect(A.fft2d([[]])).toEqual({ real: [[]], imag: [[]] });
    expect(A.fft2d([])).toEqual({ real: [], imag: [] });
  });
  it('names the function in the error for unsupported ranks', () => {
    expect(() => A.rfft('x')).toThrow(/rfft/);
  });
});

describe('audit: other fft-family functions at length 1 and with NaN', () => {
  it('length 1 does not throw', () => {
    expect(A.fftshift([5])).toEqual([5]);
    expect(A.ifftshift([5])).toEqual([5]);
    expect(nz(A.fft2d([[5]]))).toEqual({ real: [[5]], imag: [[0]] });
    expect(nz(A.fftn([5]))).toEqual({ re: [5], im: [0] });
    expect(A.dct([5])).toHaveLength(1);
    expect(A.idct([5])).toHaveLength(1);
    expect(A.hilbertTransform([5])).toHaveLength(1);
    expect(A.periodogram([5]).psd.length).toBeGreaterThan(0);
  });
  it('NaN reaches every psd bin', () => {
    expect(A.periodogram([NaN, 1, 2, 3]).psd.every(Number.isNaN)).toBe(true);
    const s = A.spectrogram([NaN, 1, 2, 3, 4, 5, 6, 7], { windowSize: 4, hopSize: 2 });
    expect(s.magnitude.flat().some(Number.isNaN)).toBe(true);
  });
});

describe('typed-array input to rfft and fftn', () => {
  it('Float64Array is read like an array', () => {
    expect(A.rfft(new Float64Array([1, 2, 3, 4])).re).toEqual([10, -2, -2]);
    expect(A.fftn(new Float64Array([1, 2, 3, 4])).re[0]).toBe(10);
  });
});
