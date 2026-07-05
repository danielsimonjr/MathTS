import { describe, it, expect } from 'vitest';
import {
  shapiroWilkTest,
  generalizedEig,
  exponentialDist,
  binomialDist,
  parallelIFFT,
  parallelStatHistogram,
  spectrogram,
} from '@danielsimonjr/mathts-functions';
import type { ShapiroWilkResult } from '../src/typed/hypothesis.js';

/**
 * WS-1 P2 — the FINAL SELF-REF tail, pinned to scipy 1.17.1 references and closed
 * forms. scipy values generated on 2026-07-04 (`scipy.stats.shapiro`,
 * `scipy.linalg.eig(A, B)`); see [[feedback-oracle-tests-implementation-independent]].
 *
 * shapiroWilkTest was FIXED alongside this file: the old implementation used plain
 * Blom scores without Royston's (1995, AS R94) tail-weight corrections — W was 1.7%
 * low (0.9014 vs scipy 0.9166 on the 8-point sample) — and its p-value transform
 * used Shapiro-FRANCIA constants. After the fix, W agrees with scipy to ~2e-10 and
 * p to ~6e-8 (limited by the Acklam probit / normalCDF approximations).
 */

describe('shapiroWilkTest — scipy-pinned Royston W and p', () => {
  it('W and p for [2,4,4,4,5,5,7,9] match scipy.stats.shapiro', async () => {
    const r = (await shapiroWilkTest([2, 4, 4, 4, 5, 5, 7, 9])) as ShapiroWilkResult;
    expect(r.statistic).toBeCloseTo(0.9166338305870235, 8);
    expect(r.pValue).toBeCloseTo(0.403149610448198, 6);
  });

  it('W and p for a 10-point sample match scipy.stats.shapiro', async () => {
    const r = (await shapiroWilkTest([
      1.1, 2.3, 0.5, -0.7, 1.9, 3.2, 0.1, 1.4, 2.8, -1.2,
    ])) as ShapiroWilkResult;
    expect(r.statistic).toBeCloseTo(0.9697916837102326, 8);
    expect(r.pValue).toBeCloseTo(0.8889070954202427, 6);
  });
});

describe('generalizedEig — scipy-pinned eigenvalues of a general pencil', () => {
  it('eig(A, B) matches scipy.linalg.eig for a fixed 3×3 pencil', () => {
    // A = [[4,1,2],[1,3,0],[2,0,5]], B = [[2,0,1],[0,3,0],[1,0,2]] (B nonsingular).
    // The eigenvalue SET is convention-free (unlike the QZ factors).
    const ev = generalizedEig(
      [
        [4, 1, 2],
        [1, 3, 0],
        [2, 0, 5],
      ],
      [
        [2, 0, 1],
        [0, 3, 0],
        [1, 0, 2],
      ]
    )
      .values.map((v) => (typeof v === 'object' ? v.re : v))
      .sort((a, b) => a - b);
    expect(ev[0]).toBeCloseTo(0.8276289227205352, 9);
    expect(ev[1]).toBeCloseTo(2.1345252069870093, 9);
    expect(ev[2]).toBeCloseTo(2.7045125369591205, 9);
  });
});

describe('distribution objects — closed-form cdf/quantile (the last SELF-REF dist rows)', () => {
  it('exponentialDist(2): cdf(1) = 1 − e⁻², quantile(½) = ln2/2 (exact)', () => {
    const e = exponentialDist(2);
    expect(e.cdf(1)).toBeCloseTo(1 - Math.exp(-2), 14);
    expect(e.quantile(0.5)).toBeCloseTo(Math.log(2) / 2, 14);
  });

  it('binomialDist(4, ½): cdf(2) = 11/16 (exact sum of pmfs)', () => {
    expect(binomialDist(4, 0.5).cdf(2)).toBeCloseTo(11 / 16, 12);
  });
});

describe('parallelIFFT — known spectrum, not a round-trip', () => {
  it('IDFT of the hand-written spectrum [4,0,0,0] = [1,1,1,1]', async () => {
    const r = await parallelIFFT(new Float64Array([4, 0, 0, 0]), new Float64Array([0, 0, 0, 0]));
    for (let i = 0; i < 4; i++) {
      expect(r.real[i]).toBeCloseTo(1, 12);
      expect(r.imag[i]).toBeCloseTo(0, 12);
    }
  });
});

describe('parallelStatHistogram — exact bin contents (not just Σ=N)', () => {
  it('6 values across 3 unit bins → [2,2,2]', async () => {
    const h = await parallelStatHistogram(new Float64Array([0.1, 0.9, 1.1, 1.9, 2.1, 2.9]), 3);
    expect(h).toEqual([2, 2, 2]);
  });
});

describe('spectrogram — pure tone lands in the analytically-known bin', () => {
  it('sin(2π·32·t/N), window 64 → peak magnitude at bin 32·(64/256) = 8', async () => {
    const N = 256;
    const sig = Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 32 * i) / N));
    const sp = await spectrogram(sig, { windowSize: 64, hopSize: 32 });
    // in every time frame, the peak frequency bin is 8 (tone freq × window/N)
    for (const frame of sp.magnitude) {
      let peak = 0;
      for (let k = 1; k < frame.length; k++) if (frame[k] > frame[peak]) peak = k;
      expect(peak).toBe(8);
    }
  });
});
