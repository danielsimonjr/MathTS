/**
 * Dogfood #990 (part B): windows, frequency grids, special matrices, samples, filter
 * orders and curve fits check their size before they allocate. Every throwing row
 * throws at once. Every value row is small and checks a SciPy 1.16.3 or NumPy value.
 */
import { describe, it, expect } from 'vitest';
import {
  blackmanHarrisWindow,
  kaiserWindow,
  fftfreq,
  rfftfreq,
  unitImpulse,
  firwin,
  stepResponse,
  impulseResponse,
  wiener,
  hilbertMatrix,
  invHilbertMatrix,
  pascalMatrix,
  helmertMatrix,
  dftMatrix,
  vander,
  adjacencyMatrix,
  histogram,
  rootsChebyshevT,
  rootsChebyshevU,
  dirichletSample,
  mvnSample,
  medfilt,
  butter,
  cheby1,
  cheby2,
  bartlettPSD,
  welchPSD,
  goertzel,
  chirpZTransform,
  resample,
  lowpassFilter,
  newtonInterp,
  polyFit,
  polymul,
  stirlingS2,
  format,
  pickRandom,
  quantileSeq,
  nthRoots,
  diag,
  bignumber,
  parallelStatHistogram,
} from '../src/index.js';

describe('dogfood #990 allocation sites', () => {
  it('windows and 1-D outputs throw before they allocate', () => {
    expect(() => blackmanHarrisWindow(1e9)).toThrow(/window: result too large/);
    expect(() => kaiserWindow(1e9, 5)).toThrow(/kaiserWindow: n = 1000000000 exceeds/);
    expect(() => fftfreq(1e9)).toThrow(/fftfreq: result too large/);
    expect(() => rfftfreq(1e9)).toThrow(/rfftfreq: result too large/);
    expect(() => unitImpulse(1e9)).toThrow(/unitImpulse: result too large/);
    expect(() => firwin(1e9, 0.2)).toThrow(/firwin: result too large/);
    expect(() => stepResponse([1], [1], 1e9)).toThrow(/stepResponse: result too large/);
    expect(() => impulseResponse([1], [1], 1e9)).toThrow(/impulseResponse: result too large/);
    expect(() => wiener([1, 2, 3], 1e9)).toThrow(/wiener: result too large/);
    expect(() => histogram([1, 2, 3], 1e9)).toThrow(/histogram: result too large/);
    expect(() => rootsChebyshevT(1e9)).toThrow(/rootsChebyshevT: result too large/);
    expect(() => rootsChebyshevU(1e9)).toThrow(/rootsChebyshevU: result too large/);
    expect(() => chirpZTransform([1, 2], 1e9)).toThrow(/chirpZTransform: result too large/);
    expect(() => resample([1, 2], 1e9)).toThrow(/resample: result too large/);
    expect(() => resample([1, 2], 1e9, 1)).toThrow(/resample: result too large/);
    expect(() => lowpassFilter([1, 2], 0.2, 1e9)).toThrow(/lowpassFilter: result too large/);
  });

  it('matrices and samples throw before they allocate', () => {
    expect(() => hilbertMatrix(1e6)).toThrow(/hilbertMatrix: result too large/);
    expect(() => invHilbertMatrix(1e6)).toThrow(/invHilbertMatrix: result too large/);
    expect(() => pascalMatrix(1e6)).toThrow(/pascalMatrix: result too large/);
    expect(() => helmertMatrix(1e6)).toThrow(/helmertMatrix: result too large/);
    expect(() => dftMatrix(1e6)).toThrow(/dftMatrix: result too large/);
    expect(() => vander([1, 2, 3], 1e9)).toThrow(/vander: result too large/);
    expect(() => adjacencyMatrix([], 1e6)).toThrow(/adjacencyMatrix: result too large/);
    expect(() => dirichletSample([1, 1], 1e9)).toThrow(/dirichletSample: result too large/);
    expect(() =>
      mvnSample(
        [0, 0],
        [
          [1, 0],
          [0, 1],
        ],
        1e9
      )
    ).toThrow(/mvnSample: result too large/);
  });

  it('filter orders and the other bounded loops throw', () => {
    expect(() => butter(1e9, 0.2)).toThrow(
      /butter: N = 1000000000 exceeds the supported maximum of 1000/
    );
    expect(() => cheby1(1e9, 1, 0.2)).toThrow(/cheby1: N = 1000000000 exceeds/);
    expect(() => cheby2(1e9, 40, 0.2)).toThrow(/cheby2: N = 1000000000 exceeds/);
    expect(() => format(1e9, 1e9)).toThrow(/format: precision = 1000000000 exceeds/);
    expect(() => format(bignumber(1), { precision: 1e9 })).toThrow(/format: precision/);
    expect(() => pickRandom([1, 2, 3], 1e9)).toThrow(/pickRandom: n = 1000000000 exceeds/);
    expect(() => quantileSeq([1, 2, 3], 1e9)).toThrow(/quantileSeq: N = 1000000000 exceeds/);
    expect(() => nthRoots(1, 1e9)).toThrow(/nthRoots: result too large/);
    expect(() => diag([1, 2], 1e9)).toThrow(/diag: result too large/);
    expect(() => stirlingS2(1e9, 2)).toThrow(/stirlingS2: result too large/);
  });

  it('parallelStatHistogram rejects before it allocates', async () => {
    await expect(parallelStatHistogram(new Float64Array([1, 2]), 1e9)).rejects.toThrow(
      /parallelStatHistogram: result too large/
    );
  });

  it('array arguments that are not arrays throw a TypeError', () => {
    expect(() => polyFit(2 as never, 2 as never, 1e9)).toThrow(
      new TypeError('polyFit: xs must be an array or a Float64Array')
    );
    expect(() => newtonInterp(2 as never, 2 as never, 1)).toThrow(/must be an array/);
    expect(() => bartlettPSD(5 as never)).toThrow(
      new TypeError('bartlettPSD: signal must be an array or a Float64Array')
    );
    expect(() => welchPSD(5 as never)).toThrow(/welchPSD: signal must be an array/);
    expect(() => goertzel(4 as never, 1, 8)).toThrow(/goertzel: signal must be an array/);
    expect(() => polymul(3 as never, 3 as never)).toThrow(/polymul: a must be an array/);
    expect(() => resample(5 as never, 4)).toThrow(/resample: x must be an array/);
  });

  it('small values match SciPy 1.16.3 and NumPy', () => {
    expect(fftfreq(4)).toEqual([0, 0.25, -0.5, -0.25]);
    expect(rfftfreq(4)).toEqual([0, 0.25, 0.5]);
    expect(unitImpulse(3)).toEqual([1, 0, 0]);
    expect(hilbertMatrix(3)).toEqual([
      [1, 1 / 2, 1 / 3],
      [1 / 2, 1 / 3, 1 / 4],
      [1 / 3, 1 / 4, 1 / 5],
    ]);
    expect(invHilbertMatrix(3)).toEqual([
      [9, -36, 30],
      [-36, 192, -180],
      [30, -180, 180],
    ]);
    expect(pascalMatrix(3)).toEqual([
      [1, 1, 1],
      [1, 2, 3],
      [1, 3, 6],
    ]);
    const h = helmertMatrix(3);
    expect(h[0][0]).toBeCloseTo(0.7071067811865475, 14);
    expect(h[1][2]).toBeCloseTo(-0.8164965809277261, 14);
    expect(vander([1, 2, 3], 4)).toEqual([
      [1, 1, 1, 1],
      [8, 4, 2, 1],
      [27, 9, 3, 1],
    ]);
    expect(histogram([1, 2, 3], 4)).toEqual({ counts: [1, 0, 1, 1], edges: [1, 1.5, 2, 2.5, 3] });
    const w = blackmanHarrisWindow(5);
    expect(w[0]).toBeCloseTo(6e-5, 12);
    expect(w[1]).toBeCloseTo(0.21747, 12);
    expect(w[2]).toBeCloseTo(1, 14);
    expect(kaiserWindow(5, 0)).toEqual([1, 1, 1, 1, 1]);
    expect(polymul([1, 1], [1, 1])).toEqual([1, 2, 1]);
    expect(adjacencyMatrix([[0, 1]], 2)).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(dftMatrix(2)[1][1].re).toBeCloseTo(-1, 14);
    expect(rootsChebyshevT(3).nodes[2]).toBeCloseTo(0.8660254037844387, 14);
    expect((nthRoots(1, 2) as unknown[]).length).toBe(2);
    expect(diag([1, 2])).toEqual([
      [1, 0],
      [0, 2],
    ]);
    expect(format(3.14159, 3)).toBe('3.14');
    expect(polyFit([0, 1, 2, 3], [0, 1, 4, 9], 2)[2]).toBeCloseTo(1, 12);
    expect(dirichletSample([1, 1], 3, { seed: 1 })).toHaveLength(3);
  });

  it('medfilt clamps a huge window to the signal length', () => {
    expect(medfilt([1, 2, 3], 1e9)).toEqual([2, 2, 2]);
  });

  it('stirlingS2 with a long n and a small k does not build a table', () => {
    expect(stirlingS2(1e6, 2)).toBe(Infinity);
    expect(stirlingS2(5, 2)).toBe(15);
    expect(stirlingS2(10, 3)).toBe(9330);
    // S(1050, 1000) = 1.5296419287168441e221 (exact integer DP in Python); the table
    // (1051 x 1001) is above the cache limit, so this takes the row-by-row path
    const big = stirlingS2(bignumber(1050), bignumber(1000)) as unknown as { toString(): string };
    expect(Number(big.toString()) / 1.5296419287168441e221).toBeCloseTo(1, 10);
  });
});
