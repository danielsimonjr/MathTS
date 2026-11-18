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
  bellNumbers,
  windowFunction,
  getWindow,
  freqz,
  random,
  randomInt,
  firls,
  print,
  evaluate,
  matrix,
} from '../src/index.js';
import { BigNumber, isBigNumber } from '@danielsimonjr/mathts-core';

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
      new TypeError('polyFit: xs must be an array or a typed array')
    );
    expect(() => newtonInterp(2 as never, 2 as never, 1)).toThrow(/must be an array/);
    expect(() => bartlettPSD(5 as never)).toThrow(
      new TypeError('bartlettPSD: signal must be an array or a typed array')
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
    // The heap stays small; a child process outside vitest checks the memory.
    expect(stirlingS2(1e6, 2)).toBe(Infinity);
    expect(stirlingS2(5, 2)).toBe(15);
    expect(stirlingS2(10, 3)).toBe(9330);
    expect(stirlingS2(999, 998)).toBe(498501);
    expect(stirlingS2(1001, 1000)).toBe(500500);
    expect(stirlingS2(2000, 1999)).toBe(1999000);
  });

  it('BigNumber stirlingS2 gives exact values on the cache and the row-by-row paths', () => {
    // Exact integer DP in Python. The result rounds to config.precision (#1118); the table is
    // exact, so a call at a precision above the digit count gives every digit.
    const at = (precision: number, n: number, k: number): string => {
      BigNumber.config({ precision });
      try {
        return (
          stirlingS2(bignumber(n), bignumber(k)) as unknown as { toFixed(): string }
        ).toFixed();
      } finally {
        BigNumber.config({ precision: 64 });
      }
    };
    const rounded = (exact: string): string => {
      BigNumber.config({ precision: 1000 });
      const r = BigNumber.parse(exact).toSignificantDigits(64).toFixed();
      BigNumber.config({ precision: 64 });
      return r;
    };
    expect(at(64, 120, 60)).toBe(rounded(S_120_60));
    expect(at(1000, 120, 60)).toBe(S_120_60);
    // A cached table filled at precision 64 still gives every digit at a higher precision.
    expect(at(1000, 400, 200)).toBe(S_400_200);
    expect(at(64, 400, 200)).toBe(rounded(S_400_200));
    expect(isBigNumber(stirlingS2(bignumber(150), bignumber(150)))).toBe(true);
    expect(isBigNumber(stirlingS2(bignumber(5), bignumber(5)))).toBe(true);
    expect(() => stirlingS2(bignumber(1000), bignumber(998))).toThrow(
      /exceeds the supported maximum of 300000/
    );
  });

  it('BigNumber bellNumbers uses the Bell triangle', () => {
    const b = (bellNumbers(bignumber(300)) as unknown as { toFixed(): string }).toFixed();
    expect(b).toHaveLength(454);
    expect(b.startsWith('95937171608392702773')).toBe(true);
    expect((bellNumbers(bignumber(10)) as unknown as { toFixed(): string }).toFixed()).toBe(
      '115975'
    );
    expect(bellNumbers(10)).toBe(115975);
  });

  it('typed arrays stay accepted; a Matrix and a BigInt64Array throw', () => {
    expect(polymul(new Float32Array([1, 2]) as never, new Float32Array([1, 3]) as never)).toEqual([
      1, 5, 6,
    ]);
    expect(polymul(new Int32Array([1, 2]) as never, new Int32Array([1, 3]) as never)).toEqual([
      1, 5, 6,
    ]);
    expect(polymul(new Uint8Array([1, 2]) as never, new Uint8Array([1, 3]) as never)).toEqual([
      1, 5, 6,
    ]);
    expect(goertzel(new Float32Array([1, 0, -1, 0, 1, 0, -1, 0]) as never, 2, 8)).toBeCloseTo(
      16,
      12
    );
    expect(welchPSD(new Float32Array(64).fill(1) as never).psd).toHaveLength(33);
    expect(bartlettPSD(new Float32Array(64).fill(1) as never).psd).toHaveLength(33);
    expect(resample(new Float32Array([1, 2, 3, 4]) as never, 2)).toEqual([1.5, 3.5]);
    expect(
      newtonInterp(new Float32Array([0, 1, 2]) as never, new Float32Array([0, 1, 4]) as never, 1.5)
    ).toBeCloseTo(2.25, 12);
    expect(
      polyFit(
        new Float32Array([0, 1, 2, 3]) as never,
        new Float32Array([0, 1, 4, 9]) as never,
        2
      )[2]
    ).toBeCloseTo(1, 12);
    expect(() => polymul(matrix([1, 2]) as never, matrix([1, 3]) as never)).toThrow(
      new TypeError('polymul: a must be an array or a typed array')
    );
    expect(() => welchPSD(new BigInt64Array(4) as never)).toThrow(
      new TypeError('welchPSD: signal must be an array or a typed array')
    );
    expect(() => welchPSD(new Set([1, 2]) as never)).toThrow(TypeError);
    expect(() => welchPSD({ length: 2, 0: 1, 1: 2 } as never)).toThrow(TypeError);
    expect(evaluate('polymul([1, 1], [1, 1])')).toEqual([1, 2, 1]);
  });

  it('sizes at the limit throw, and sizes below it work', () => {
    expect(() => format(1 / 3, { notation: 'fixed', precision: 1e7 + 1 })).toThrow(
      /format: precision = 10000001 exceeds the supported maximum of 10000000/
    );
    expect(() => kaiserWindow(1e6 + 1, 5)).toThrow(/kaiserWindow: n = 1000001 exceeds/);
    expect(() => butter(1001, 0.2)).toThrow(/butter: N = 1001 exceeds/);
    expect(fftfreq(100)).toHaveLength(100);
  });

  it('the last allocation sites throw before they allocate', () => {
    expect(() => print('$a', { a: 1 / 3 }, 1e9)).toThrow(/format: precision = 1000000000 exceeds/);
    expect(() => evaluate('print("$a", {a: 1/3}, 1e9)')).toThrow(/format: precision/);
    expect(() => windowFunction('hann', 1e9)).toThrow(/windowFunction: result too large/);
    expect(() => windowFunction(1e9, 'hann')).toThrow(/windowFunction: result too large/);
    expect(() => getWindow('hann', 1e9)).toThrow(/windowFunction: result too large/);
    expect(() => freqz([1], [1], 1e9)).toThrow(/freqz: result too large/);
    expect(() => freqz(matrix([1]), matrix([1]), 1e9)).toThrow(/freqz: result too large/);
    // Each point costs about 215 bytes, so the count is eight elements a point: 3e7 aborted the process at the default heap.
    expect(() => freqz([1], [1], 3e7)).toThrow(/freqz: result too large \(30000000×8 exceeds/);
    expect(freqz([1], [1], 4).w).toHaveLength(4);
    expect(() => random([1e5, 1e5])).toThrow(/random: result too large/);
    expect(() => randomInt([1e5, 1e5])).toThrow(/randomInt: result too large/);
    expect(() => firls(1e9 + 1, [0, 0.2, 0.3, 1], [1, 1, 0, 0])).toThrow(
      /firls: numtaps = 1000000001 exceeds the supported maximum of 3001/
    );
    expect(() => pascalMatrix(2001)).toThrow(/pascalMatrix: n = 2001 exceeds/);
    expect(() => invHilbertMatrix(1001)).toThrow(/invHilbertMatrix: n = 1001 exceeds/);
    expect(() => dirichletSample([1, 1], 2e7)).toThrow(/dirichletSample: result too large/);
    expect(() =>
      mvnSample(
        [0, 0],
        [
          [1, 0],
          [0, 1],
        ],
        2e7
      )
    ).toThrow(/mvnSample: result too large/);
    expect(windowFunction('hann', 3)).toEqual([0, 1, 0]);
    expect(random([2, 3])).toHaveLength(2);
    expect(firls(3, [0, 0.2, 0.3, 1], [1, 1, 0, 0])).toHaveLength(3);
  });
});

// S(120, 60) and S(400, 200) from exact integer DP in Python
const S_120_60 =
  '7946563576429034580690211359179388391325823038898056463020538639222333040320910060822374414240577498237290634119975986449206160';
const S_400_200 =
  '114729365338753782395604478698366476648931208279800022882755112374916484049289259907703305878842634633537419135945523930190900031944483996217802596886519229202928084555002147658923155545649004492472393974290870832651080144504819949776213307609661578652145628464162697444630988404034290923848737602497764986153705373320259309513282047608259104411423933337476698569847680474175391526854439859313373442409621558239553012620530567444071435925545129667416435591520562273918614789402985300695041329704157285794675540704069194627288566948';
