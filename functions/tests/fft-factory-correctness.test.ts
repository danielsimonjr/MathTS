/**
 * The public (factory) `fft` fast-paths power-of-2 input to the flat Float64Array core.
 * These pin that the shortcut computes the SAME transform, against an independent
 * O(n^2) DFT oracle — not against the implementation it replaced.
 */
import { describe, it, expect } from 'vitest';
import { fft, ifft } from '../src/index.js';

type C = { re: number; im: number };
const re = (v: unknown): number => (typeof v === 'number' ? v : (v as C).re);
const im = (v: unknown): number => (typeof v === 'number' ? 0 : (v as C).im);

/** Naive DFT. Implementation-independent oracle: X[k] = sum_n x[n] e^(-2pi i kn/N). */
function dftOracle(x: number[]): C[] {
  const N = x.length;
  const out: C[] = [];
  for (let k = 0; k < N; k++) {
    let sr = 0;
    let si = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      sr += x[n] * Math.cos(a);
      si += x[n] * Math.sin(a);
    }
    out.push({ re: sr, im: si });
  }
  return out;
}

describe('factory fft — the flat-core fast path', () => {
  // 64 is FAST_FFT_THRESHOLD, so 128/256 exercise the fast path; 32 stays on the old path.
  it.each([32, 64, 128, 256])('matches a naive DFT oracle at n=%i', (N) => {
    const x = Array.from({ length: N }, (_, i) => Math.sin(i * 0.3) + 0.25 * Math.cos(i * 1.1));
    const got = fft(x) as unknown[];
    const want = dftOracle(x);

    expect(got.length).toBe(N);
    for (let k = 0; k < N; k++) {
      const mag = Math.hypot(want[k].re, want[k].im);
      const scale = Math.max(1e-9, mag);
      expect(Math.abs(re(got[k]) - want[k].re) / scale).toBeLessThan(1e-9);
      expect(Math.abs(im(got[k]) - want[k].im) / scale).toBeLessThan(1e-9);
    }
  });

  it('round-trips through ifft on the fast path (n=256)', () => {
    const N = 256;
    const x = Array.from({ length: N }, (_, i) => Math.sin(i * 0.17) + i * 1e-3);
    const back = ifft(fft(x)) as unknown[];
    for (let i = 0; i < N; i++) {
      expect(re(back[i])).toBeCloseTo(x[i], 9);
      expect(im(back[i])).toBeCloseTo(0, 9);
    }
  });

  it('accepts complex input on the fast path', () => {
    const N = 128;
    const x = Array.from({ length: N }, (_, i) => ({
      re: Math.cos(i * 0.2),
      im: Math.sin(i * 0.4),
    }));
    const got = fft(x) as unknown[];
    // Parseval: sum |x|^2 = (1/N) sum |X|^2 — a property of the transform, not of our code.
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < N; i++) e1 += x[i].re ** 2 + x[i].im ** 2;
    for (let k = 0; k < N; k++) e2 += re(got[k]) ** 2 + im(got[k]) ** 2;
    expect(e2 / N).toBeCloseTo(e1, 8);
  });

  it('non-power-of-2 input still works (the chirp-z path is untouched)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const got = fft(x) as unknown[];
    const want = dftOracle(x);
    for (let k = 0; k < x.length; k++) {
      const scale = Math.max(1e-9, Math.hypot(want[k].re, want[k].im));
      expect(Math.abs(re(got[k]) - want[k].re) / scale).toBeLessThan(1e-8);
      expect(Math.abs(im(got[k]) - want[k].im) / scale).toBeLessThan(1e-8);
    }
  });
});
