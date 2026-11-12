/**
 * Dogfood relay G18 — FFT / signal API (#706 #774 #768 #773 #779).
 */
import { describe, it, expect } from 'vitest';
import { fft as factoryFft } from '../src/factories/index.js';
import {
  parallelFFT,
  parallelIFFT,
  welchPSD,
  bartlettPSD,
  resample,
  windowFunction,
} from '../src/typed/signal.js';

const SCIPY_RESAMPLE_8_TO_4 = [2.5, 3.085786437626905, 4.5, 7.914213562373095];

const SCIPY_HAMMING_8 = [
  0.08, 0.253194696254052, 0.6423596298545902, 0.9544456791377983, 0.9544456791377983,
  0.6423596298545902, 0.253194696254052, 0.08,
];

const NUMPY_FFT_8_REAL = [36, -4, -4, -4, -4, -4, -4, -4];
const NUMPY_FFT_8_IMAG = [
  0, 9.65685424949238, 4, 1.65685424949238, 0, -1.65685424949238, -4, -9.65685424949238,
];

describe('#706 factory fft accepts Float64Array', () => {
  it('fft(new Float64Array([1,0,0,0])) does not throw and returns Complex[]', () => {
    const out = factoryFft(new Float64Array([1, 0, 0, 0])) as { re: number; im: number }[];
    expect(out).toHaveLength(4);
    expect(out[0].re).toBeCloseTo(1, 12);
    expect(out[0].im).toBeCloseTo(0, 12);
  });
});

describe('#774 signal fft/ifft round-trip (typed parallel path)', () => {
  it('parallelFFT → parallelIFFT recovers the series within 1e-15', async () => {
    const x = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const F = (await parallelFFT(x)) as { real: Float64Array; imag: Float64Array };
    expect(F.real[0]).toBeCloseTo(NUMPY_FFT_8_REAL[0]!, 10);
    expect(F.imag[1]).toBeCloseTo(NUMPY_FFT_8_IMAG[1]!, 10);
    const back = (await parallelIFFT(F)) as { real: Float64Array; imag: Float64Array };
    for (let i = 0; i < x.length; i++) {
      expect(back.real[i]).toBeCloseTo(x[i]!, 15);
    }
  });
});

describe('#768 welchPSD short signal', () => {
  it('welchPSD on n=64 throws when default frameLength exceeds signal', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    expect(() => welchPSD(x)).toThrow(/shorter than frameLength/);
    expect(() => bartlettPSD(x)).toThrow(/shorter than frameLength/);
  });

  it('welchPSD with frameLength 32 returns non-empty psd', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    const out = welchPSD(x, { frameLength: 32 });
    expect(out.psd.length).toBeGreaterThan(0);
    expect(out.frequencies.length).toBe(out.psd.length);
  });
});

describe('#773 resample SciPy two-arg', () => {
  it('resample([1..8], 4) matches scipy.signal.resample (no RangeError)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = resample(x, 4);
    expect(y).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(y[i]).toBeCloseTo(SCIPY_RESAMPLE_8_TO_4[i]!, 10);
    }
  });

  it('resample(x, newRate, oldRate) keeps linear rate semantics', () => {
    expect(resample([1, 2, 3, 4, 5, 6, 7, 8], 1, 2)).toEqual([1, 3, 5, 7]);
  });
});

describe('#779 windowFunction argument order', () => {
  it("windowFunction('hamming', 8) matches SciPy hamming(8)", () => {
    const w = windowFunction('hamming', 8);
    expect(w).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(w[i]).toBeCloseTo(SCIPY_HAMMING_8[i]!, 7);
    }
  });

  it('windowFunction(8, "hamming") unchanged', () => {
    expect(windowFunction(8, 'hamming')).toEqual(windowFunction('hamming', 8));
  });
});
