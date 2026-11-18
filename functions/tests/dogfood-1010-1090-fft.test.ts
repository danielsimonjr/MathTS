import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';
import { isComplex, isMatrix } from '@danielsimonjr/mathts-core';
import type { MathJsInstance } from '../types/index.js';

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

describe('review fixes (#1010, #1090)', () => {
  const allNaN = (r: Bin[]) => {
    for (const c of r) {
      expect(c.re).toBeNaN();
      expect(c.im).toBeNaN();
    }
  };
  it('F1: a BigNumber NaN makes every bin NaN in both parts', () => {
    allNaN(A.fft([A.bignumber(NaN), A.bignumber(1)]));
    allNaN(A.fft([A.bignumber(NaN), A.bignumber(1), A.bignumber(2), A.bignumber(3)]));
  });
  it('F2: a one-element BigNumber or Fraction input gives a Complex bin', () => {
    for (const r of [
      A.fft([A.bignumber(5)])[0],
      A.fft([[A.bignumber(5)]])[0][0],
      A.fft([A.fraction(5)])[0],
    ]) {
      expect(isComplex(r)).toBe(true);
      expect(C(r).re).toBe(5);
      expect(C(r).im + 0).toBe(0);
    }
  });
  it('F2: a numeric string boxes; a bigint and a boolean stay bare', () => {
    const r = A.fft(['5'])[0];
    expect(isComplex(r)).toBe(true);
    expect(C(r).re).toBe(5);
    expect(A.fft([5n])[0]).toBe(5n);
    expect(A.fft([true])[0]).toBe(true);
  });
  it('F2: a one-element Unit input stays a Unit', () => {
    const u = A.unit(5, 'm');
    expect(A.fft([u])[0]).toBe(u);
  });
  it('F3: irfft accepts a Matrix half-spectrum', () => {
    const r = A.irfft({ re: A.matrix([10, -2, -2]), im: A.matrix([0, 2, 0]) }, 4);
    [1, 2, 3, 4].forEach((v, i) => expect(r[i]).toBeCloseTo(v, 12));
  });
  it('F4: rfft rejects a ragged array', () => {
    expect(() =>
      A.rfft([
        [1, 2, 3],
        [4, 5],
      ])
    ).toThrow();
    expect(() =>
      A.rfft([
        [
          [1, 2],
          [3, 4],
        ],
        [[1, 2]],
      ])
    ).toThrow();
  });
  it('F5: periodogram nfft of any length, cropped when shorter (SciPy, symmetric hann)', () => {
    const close = (got: number[], want: number[]) => {
      expect(got).toHaveLength(want.length);
      want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 10));
    };
    close(A.periodogram([1, 2, 3], { nfft: 3 }).psd, [4, 8]);
    close(A.periodogram([1, 2, 3], { nfft: 5 }).psd, [4, 8, 8]);
    close(A.periodogram([1, 2, 3], { nfft: 6 }).psd, [4, 8, 8, 4]);
    close(A.periodogram([1, 2, 3, 4, 5], { nfft: 4 }).psd, [12.5, 13, 0.5]);
    close(
      A.periodogram([1, 2, 3, 4, 5], { nfft: 8 }).psd,
      [24, 35.637229415144, 13.333333333333, 1.69610391819, 0]
    );
    for (const nfft of [0, 2.5, -4, NaN]) {
      expect(() => A.periodogram([1, 2, 3], { nfft })).toThrow(/periodogram/);
    }
  });
  it('F6: multiTaperPSD of 0 and 1 samples', () => {
    expect(A.multiTaperPSD([])).toEqual({ psd: [], frequencies: [] });
    expect(() => A.multiTaperPSD([5])).toThrow(
      /multiTaperPSD: signal must have at least 2 samples \(got 1\)/
    );
  });
  it('F9: periodogram and fft2d name themselves for a Matrix', () => {
    expect(() => A.periodogram(A.matrix([1, 2, 3, 4]))).toThrow(/periodogram/);
    expect(() =>
      A.fft2d(
        A.matrix([
          [1, 2],
          [3, 4],
        ])
      )
    ).toThrow(/fft2d: expected a 2-D array/);
    const r = A.periodogram(new Float64Array([1, 2, 3, 4])).psd;
    [12.5, 13, 0.5].forEach((v, i) => expect(r[i]).toBeCloseTo(v, 10));
  });
  it('F10: length-1 values (SciPy)', () => {
    expect(A.periodogram([5])).toEqual({ psd: [25], frequencies: [0] });
    expect(A.dct([5])).toEqual([5]);
    expect(A.idct([5])).toEqual([5]);
    // scipy.signal.hilbert([5.]) = [5+0j]: the imaginary part is 0.
    expect(nz(A.hilbertTransform([5]))).toEqual([0]);
  });
  it('F11: dotDivide keeps an empty inner axis (mathjs)', () => {
    expect(A.dotDivide([[[]], [[]]], 2)).toEqual([[[]], [[]]]);
  });
  it('F11: conj of a Matrix is a Matrix (mathjs)', () => {
    const r = A.conj(A.matrix([1, 2]));
    expect(isMatrix(r)).toBe(true);
    expect(r.valueOf()).toEqual([1, 2]);
    expect(A.conj(A.matrix([A.complex(1, 2)])).valueOf()[0].im).toBe(-2);
  });
  it('F11: a Matrix of 3 or more axes has one size entry per axis (mathjs)', () => {
    const data = () => [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ];
    const m = A.matrix(data());
    expect(m.size()).toEqual([2, 2, 2]);
    expect(A.matrix([[[]], [[]]]).size()).toEqual([2, 1, 0]);
    expect(A.matrix([[[[1]]]]).size()).toEqual([1, 1, 1, 1]);
    // Every method walks every axis: a value is a number, not an inner row.
    expect(m.get([1, 0, 1])).toBe(6);
    const seen: unknown[] = [];
    m.forEach((v: unknown, index: number[]) => seen.push([v, index]));
    expect(seen).toHaveLength(8);
    expect(seen[5]).toEqual([6, [1, 0, 1]]);
    const doubled = m.map((v: number) => v * 2);
    expect(doubled.size()).toEqual([2, 2, 2]);
    expect(doubled.valueOf()[1][0][1]).toBe(12);
    const copy = m.clone();
    copy.set([1, 0, 1], 60);
    expect(copy.get([1, 0, 1])).toBe(60);
    expect(m.get([1, 0, 1])).toBe(6);
    const arr = m.toArray();
    arr[0][0][0] = 99;
    expect(m.get([0, 0, 0])).toBe(1);
    expect(A.dotDivide(A.matrix(data()), 2).valueOf()[1][1]).toEqual([3.5, 4]);
  });
  it('F11: map keeps the size when the callback returns an array (mathjs)', () => {
    expect(
      A.matrix([[1, 2]])
        .map((v: number) => [v, v])
        .size()
    ).toEqual([1, 2]);
    expect(
      A.matrix([1, 2])
        .map((v: number) => [v, v])
        .size()
    ).toEqual([2]);
  });
  it('F11: an empty matrix has size [0], and map keeps an empty size (mathjs)', () => {
    expect(A.matrix().size()).toEqual([0]);
    expect(
      A.matrix()
        .map((v: number) => v)
        .size()
    ).toEqual([0]);
    expect(A.abs(A.matrix()).size()).toEqual([0]);
    expect(A.conj(A.matrix()).size()).toEqual([0]);
    expect(A.abs(A.zeros(0, 3)).size()).toEqual([0, 3]);
  });
  it('F11: forEach and map give one index entry per axis, in row-major order', () => {
    const seen: Array<[number, number[]]> = [];
    A.matrix([
      [1, 2],
      [3, 4],
    ]).forEach((v: number, i: number[]) => seen.push([v, [...i]]));
    expect(seen).toEqual([
      [1, [0, 0]],
      [2, [0, 1]],
      [3, [1, 0]],
      [4, [1, 1]],
    ]);
    const one: number[][] = [];
    A.matrix([5, 6]).forEach((_v: number, i: number[]) => one.push([...i]));
    expect(one).toEqual([[0], [1]]);
    expect(
      A.matrix([[[1, 2]], [[3, 4]]])
        .map((v: number, i: number[]) => v * 100 + i[0] * 10 + i[2])
        .valueOf()
    ).toEqual([[[100, 201]], [[310, 411]]]);
  });
  it('fft2d takes typed-array rows and rejects 1-D, 3-D and ragged input', () => {
    expect(nz(A.fft2d([new Float64Array([1, 2]), new Float64Array([3, 4])]))).toEqual({
      real: [
        [10, -2],
        [-4, 0],
      ],
      imag: [
        [0, 0],
        [0, 0],
      ],
    });
    expect(() => A.fft2d([1, 2, 3, 4])).toThrow(/fft2d: expected a 2-D array/);
    expect(() => A.fft2d([[[1, 2]], [[3, 4]]])).toThrow(/fft2d: expected a 2-D array/);
    expect(() => A.fft2d([[1, 2], [3]])).toThrow(/fft2d: every row must have 2 values/);
    expect(() => A.fft2d([[1], [2, 3]])).toThrow(/fft2d: every row must have 1 values/);
  });
  it('periodogram rejects a nested array', () => {
    expect(() => A.periodogram([[1, 2, 3]])).toThrow(/periodogram: signal must be a 1-D array/);
    expect(() =>
      A.periodogram([
        [1, 2],
        [3, 4],
      ])
    ).toThrow(/periodogram: signal must be a 1-D array/);
  });
  it('multiTaperPSD with an odd nfft has floor(nfft/2)+1 bins and no NaN', () => {
    const r = A.multiTaperPSD([1, 2, 3, 4], { nfft: 5 });
    expect(r.frequencies).toEqual([0, 0.2, 0.4]);
    expect(r.psd).toHaveLength(3);
    expect(r.psd.some(Number.isNaN)).toBe(false);
  });
  it('F7: rfft of a Matrix or a Float64Array types as unknown, not number[][]', () => {
    const fromMatrix: unknown = F.rfft(F.matrix([1, 2, 3, 4])).re;
    const fromTyped: unknown = F.rfft(new Float64Array([1, 2, 3, 4])).re;
    expect(fromMatrix).toEqual(fromTyped);
    // @ts-expect-error a Matrix or typed array input does not claim a 2-D result
    const notNested: number[][] = F.rfft(F.matrix([1, 2, 3, 4])).re;
    expect(notNested).toHaveLength(3);
    const plain: number[] = F.rfft([1, 2, 3, 4]).re;
    expect(plain).toHaveLength(3);
  });
  it('F8: the declarations accept ifft(arr, n)', () => {
    // Type-level: this compiles only when types/index.d.ts declares the n overload.
    const ifftN = (m: MathJsInstance): number[] => m.ifft([1, 2, 3, 4], 2);
    expect(typeof ifftN).toBe('function');
  });
});
