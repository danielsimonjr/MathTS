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

/** One unit in the last place of `x`: the gap between `|x|` and the next double above it. */
function ulp(x: number): number {
  const magnitude = Math.abs(x);
  return magnitude === 0 ? Number.MIN_VALUE : 2 ** (Math.floor(Math.log2(magnitude)) - 52);
}

/**
 * The bound for an FFT followed by its inverse on `n` points, in ULP of the largest sample.
 *
 * Each transform has log2(n) butterfly stages and each stage adds at most one ULP, so the
 * round trip stays within 2 log2(n) ULP. The twiddle factors come from `Math.cos` and
 * `Math.sin`, and the libm of the runtime rounds those in the last bit: V8 (Node) gives
 * `sin(-pi/4) = -0.70710678118654746` and JavaScriptCore (Bun) gives
 * `-0.70710678118654757`, one ULP apart. A fixed number of digits (`toBeCloseTo(x, 15)`
 * is 5e-16, below one ULP of 4) passes on one runtime and fails on the other, so the
 * bound is in ULP and covers the variance of both libm sources.
 */
function roundTripUlps(n: number): number {
  return 2 * Math.log2(n);
}

const NUMPY_FFT_8_REAL = [36, -4, -4, -4, -4, -4, -4, -4];
const NUMPY_FFT_8_IMAG = [
  0, 9.65685424949238, 4, 1.65685424949238, 0, -1.65685424949238, -4, -9.65685424949238,
];

function naiveDft(x: number[]): { re: number; im: number }[] {
  const n = x.length;
  const out: { re: number; im: number }[] = [];
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const ang = (-2 * Math.PI * k * t) / n;
      re += x[t]! * Math.cos(ang);
      im += x[t]! * Math.sin(ang);
    }
    out.push({ re, im });
  }
  return out;
}

describe('#706 factory fft accepts Float64Array', () => {
  it('fft(new Float64Array([1,0,0,0])) does not throw and returns Complex[]', () => {
    const out = factoryFft(new Float64Array([1, 0, 0, 0])) as { re: number; im: number }[];
    expect(out).toHaveLength(4);
    expect(out[0].re).toBeCloseTo(1, 12);
    expect(out[0].im).toBeCloseTo(0, 12);
  });

  it('matches np.fft.fft for n=0, n=1, odd, and non-power-of-two lengths', () => {
    const empty = factoryFft(new Float64Array(0)) as unknown[];
    expect(empty).toEqual([]);

    const one = factoryFft(new Float64Array([3.5])) as { re: number; im: number }[];
    expect(one).toHaveLength(1);
    expect(one[0].re).toBeCloseTo(3.5, 12);
    expect(one[0].im).toBeCloseTo(0, 12);

    for (const x of [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 2, 3],
      [1, -2, 0.5, 4, -1],
      [0.2, -1, 3, 0, 2, 1],
    ]) {
      const out = factoryFft(new Float64Array(x)) as { re: number; im: number }[];
      const ref = naiveDft(x);
      expect(out).toHaveLength(x.length);
      for (let k = 0; k < x.length; k++) {
        expect(out[k].re).toBeCloseTo(ref[k]!.re, 8);
        expect(out[k].im).toBeCloseTo(ref[k]!.im, 8);
      }
    }
  });
});

describe('#774 signal fft/ifft round-trip (typed parallel path)', () => {
  it('parallelFFT → parallelIFFT recovers the series within 2 log2(n) ULP', async () => {
    const x = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const F = (await parallelFFT(x)) as { real: Float64Array; imag: Float64Array };
    expect(F.real[0]).toBeCloseTo(NUMPY_FFT_8_REAL[0]!, 10);
    expect(F.imag[1]).toBeCloseTo(NUMPY_FFT_8_IMAG[1]!, 10);
    expect(F.real).toBeInstanceOf(Float64Array);
    expect(F.imag).toBeInstanceOf(Float64Array);
    expect(F.real.length).toBe(8);
    expect(F.imag.length).toBe(8);
    const back = (await parallelIFFT(F)) as { real: Float64Array; imag: Float64Array };
    const bound = roundTripUlps(x.length) * ulp(Math.max(...x));
    for (let i = 0; i < x.length; i++) {
      expect(Math.abs(back.real[i]! - x[i]!)).toBeLessThanOrEqual(bound);
    }
  });

  it('round trip at n = 1024 and 4096 stays within 2 log2(n) ULP of the largest sample', async () => {
    // A fixed seeded series, so every runtime checks the same input. A twiddle that is the product of
    // the previous one makes the error grow with n (about 190 ULP at n = 1024 against a bound
    // of 20).
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    };
    for (const n of [1024, 4096]) {
      const x = Float64Array.from({ length: n }, () => next() * 10);
      const F = (await parallelFFT(x)) as { real: Float64Array; imag: Float64Array };
      const back = (await parallelIFFT(F)) as { real: Float64Array };
      const bound = roundTripUlps(n) * ulp(Math.max(...x.map(Math.abs)));
      for (let i = 0; i < n; i++) {
        expect(Math.abs(back.real[i]! - x[i]!)).toBeLessThanOrEqual(bound);
      }
    }
  });

  it('non-power-of-two input reports originalLength and a padded spectrum that still round-trips', async () => {
    const x = new Float64Array([1, 2, 3]);
    const F = (await parallelFFT(x)) as {
      real: Float64Array;
      imag: Float64Array;
      originalLength: number;
    };
    expect(F.originalLength).toBe(3);
    expect(F.real.length).toBe(4);
    expect(F.imag.length).toBe(4);
    const back = (await parallelIFFT(F)) as { real: Float64Array };
    for (let i = 0; i < x.length; i++) {
      expect(back.real[i]).toBeCloseTo(x[i]!, 12);
    }
  });
});

describe('#768 welchPSD short signal', () => {
  it('welchPSD on n=64 clamps a defaulted frameLength to 64 (#897, SciPy nperseg clamp)', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    expect(welchPSD(x).frameLength).toBe(64);
    expect(bartlettPSD(x).frameLength).toBe(64);
  });

  it('welchPSD still throws for an explicit frameLength longer than the signal', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    expect(() => welchPSD(x, { frameLength: 256 })).toThrow(/shorter than frameLength/);
    expect(() => bartlettPSD(x, { frameLength: 256 })).toThrow(/shorter than frameLength/);
  });

  it('welchPSD with frameLength 32 returns non-empty psd', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * i) / 8));
    const out = welchPSD(x, { frameLength: 32 });
    expect(out.psd.length).toBeGreaterThan(0);
    expect(out.frequencies.length).toBe(out.psd.length);
  });
});

/**
 * SciPy `signal.resample` Fourier method for a real vector (no window).
 * Spectrum copy follows `scipy/signal/_signaltools.py`: keep `min(n, num)//2+1`
 * bins, double or halve the Nyquist bin when that length is even, mirror the
 * negative frequencies, then scale by `n/num` is applied because SciPy's
 * `irfft`/`ifft` pair uses the unnormalized forward transform and divides by
 * the output length — equivalent to dividing the copied spectrum by `num/n`.
 */
function scipyResampleReference(x: number[], num: number): number[] {
  const n = x.length;
  const X = naiveDft(x);
  const Yre = new Array(num).fill(0);
  const Yim = new Array(num).fill(0);
  const N = Math.min(num, n);
  const nyq = Math.floor(N / 2) + 1;
  const scale = n / num;
  for (let k = 0; k < nyq; k++) {
    Yre[k] = X[k]!.re / scale;
    Yim[k] = X[k]!.im / scale;
  }
  if (N % 2 === 0 && num !== n) {
    const k = Math.floor(N / 2);
    const factor = num < n ? 2 : 0.5;
    Yre[k] *= factor;
    Yim[k] *= factor;
  }
  for (let k = 1; k <= Math.floor((num - 1) / 2); k++) {
    Yre[num - k] = Yre[k];
    Yim[num - k] = -Yim[k];
  }
  const out = new Array(num).fill(0);
  for (let t = 0; t < num; t++) {
    let re = 0;
    for (let k = 0; k < num; k++) {
      const ang = (2 * Math.PI * k * t) / num;
      re += Yre[k] * Math.cos(ang) - Yim[k] * Math.sin(ang);
    }
    out[t] = re / num;
  }
  return out;
}

describe('#773 resample SciPy two-arg', () => {
  it('resample([1..8], 4) matches scipy.signal.resample (no RangeError)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = resample(x, 4);
    expect(y).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(y[i]).toBeCloseTo(SCIPY_RESAMPLE_8_TO_4[i]!, 10);
    }
  });

  it('the Fourier reference reproduces the published SciPy 8→4 vector', () => {
    const ref = scipyResampleReference([1, 2, 3, 4, 5, 6, 7, 8], 4);
    for (let i = 0; i < 4; i++) {
      expect(ref[i]).toBeCloseTo(SCIPY_RESAMPLE_8_TO_4[i]!, 8);
    }
  });

  it('matches SciPy Fourier resample for upsample and downsample, even and odd lengths', () => {
    const cases: [number[], number][] = [
      [[1, 2, 3, 4], 8],
      [[1, 2, 3, 4, 5], 3],
      [[1, 2, 3, 4, 5], 9],
      [[1, 2, 3, 4, 5, 6, 7, 8], 5],
      [[1, 0, -1, 0, 1, 0], 4],
      [[1, 0, -1, 0, 1, 0], 8],
    ];
    for (const [x, num] of cases) {
      const y = resample(x, num);
      const expected = scipyResampleReference(x, num);
      expect(y).toHaveLength(num);
      for (let i = 0; i < num; i++) {
        expect(y[i]).toBeCloseTo(expected[i]!, 8);
      }
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
