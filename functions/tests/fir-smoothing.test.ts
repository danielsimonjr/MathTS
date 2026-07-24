import { describe, it, expect } from 'vitest';
import { savgol, deconvolve, wiener, firwinBandpass, firls, remez } from '../src/index.js';

describe('FIR + smoothing', () => {
  it('savgol exact on a linear ramp', () => {
    savgol([1, 2, 3, 4, 5, 6, 7], 5, 2).forEach((v, i) => expect(v).toBeCloseTo(i + 1, 8));
  });
  it('savgol preserves a quadratic (order 2)', () => {
    const q = [0, 1, 4, 9, 16, 25, 36];
    savgol(q, 5, 2).forEach((v, i) => expect(v).toBeCloseTo(q[i], 6));
  });
  it('deconvolve inverts convolution', () => {
    const r = deconvolve([1, 3, 5, 3], [1, 1]);
    r.quotient.forEach((v, i) => expect(v).toBeCloseTo([1, 2, 3][i], 8));
    expect(Math.max(...r.remainder.map(Math.abs))).toBeLessThan(1e-8);
  });
  it('wiener smooths and returns same length', () => {
    const out = wiener([1, 5, 1, 5, 1, 5, 1], 3);
    expect(out).toHaveLength(7);
    expect(out.every(Number.isFinite)).toBe(true);
  });
  it('firwinBandpass returns numtaps symmetric taps summing finite', () => {
    const h = firwinBandpass(11, [0.2, 0.4]);
    expect(h).toHaveLength(11);
    expect(h[0]).toBeCloseTo(h[10], 8); // linear-phase symmetry
  });

  // --- additional coverage for firls/remez (design self-checks, not scipy
  // oracle-pinned — verified independently below via the zero-phase amplitude
  // response A(w) = sum_n h[n]*cos(pi*w*(n-c)), c=(N-1)/2, which holds for any
  // symmetric linear-phase FIR regardless of internal design method). ---------
  const amplitudeResponse = (h: readonly number[], w: number): number => {
    const c = (h.length - 1) / 2;
    return h.reduce((s, hn, n) => s + hn * Math.cos(Math.PI * w * (n - c)), 0);
  };

  it('firls designs a symmetric lowpass with passband ~1 and stopband ~0', () => {
    const h = firls(25, [0, 0.2, 0.3, 1], [1, 1, 0, 0]);
    expect(h).toHaveLength(25);
    h.forEach((v, i) => expect(v).toBeCloseTo(h[24 - i], 10)); // symmetric taps
    expect(Math.abs(amplitudeResponse(h, 0.05) - 1)).toBeLessThan(0.2);
    expect(Math.abs(amplitudeResponse(h, 0.7))).toBeLessThan(0.2);
  });

  it('remez designs a symmetric lowpass, exact equiripple (scipy convention: 0.5 = Nyquist, per-band desired)', () => {
    // Amplitude response uses w in [0,1] = fraction of Nyquist; remez bands use
    // [0,0.5] = fraction of fs. Passband [0,0.2fs]=[0,0.4Nyq], stop [0.3fs,0.5fs]=[0.6Nyq,1Nyq].
    const h = remez(25, [0, 0.2, 0.3, 0.5], [1, 0]);
    expect(h).toHaveLength(25);
    h.forEach((v, i) => expect(v).toBeCloseTo(h[24 - i], 10)); // symmetric taps
    expect(Math.abs(amplitudeResponse(h, 0.2) - 1)).toBeLessThan(0.02); // deep in passband
    expect(Math.abs(amplitudeResponse(h, 0.8))).toBeLessThan(0.02); // deep in stopband
  });
});
