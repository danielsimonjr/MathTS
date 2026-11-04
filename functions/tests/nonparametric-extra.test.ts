import { describe, it, expect } from 'vitest';
import {
  signTest,
  runsTest,
  moodMedianTest,
  powerDivergence,
  gTest,
  jackknife,
} from '../src/stats/nonparametric-extra.js';

const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

describe('signTest', () => {
  it('two-sided exact p for 5 of 5 positive', () => {
    const r = signTest([1, 2, 3, 4, 5], 0);
    expect(r.pValue).toBeCloseTo(0.0625, 12);
    expect(r.nPos).toBe(5);
    expect(r.nNeg).toBe(0);
  });
  it('drops ties with the median', () => {
    const r = signTest([0, 1, 2, -1], 0);
    expect(r.nPos + r.nNeg).toBe(3);
  });
  it('returns p = 1 when every value ties', () => {
    expect(signTest([0, 0], 0).pValue).toBe(1);
  });
});

describe('runsTest', () => {
  it('counts runs and z for a boolean sequence', () => {
    const r = runsTest([true, true, true, false, false, false]);
    expect(r.runs).toBe(2);
    expect(r.z).toBeCloseTo(-1.8257418583505538, 12);
    expect(r.pValue).toBeCloseTo(0.0679, 3);
  });
  it('numeric input classifies against the median', () => {
    const r = runsTest([1, 1, 1, 0, 0, 0]);
    expect(r.runs).toBe(2);
  });
  it('one-class sequences give NaN z and p = 1', () => {
    const r = runsTest([true, true, true]);
    expect(r.z).toBeNaN();
    expect(r.pValue).toBe(1);
  });
});

describe('moodMedianTest', () => {
  it('returns a finite statistic and the grand median', () => {
    const r = moodMedianTest([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(r.grandMedian).toBe(4.5);
    expect(r.statistic).toBeGreaterThan(0);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });
});

describe('powerDivergence and gTest', () => {
  const obs = [16, 18, 16, 14, 12, 12];
  it('G statistic (λ = 0) matches the reference value', () => {
    const r = powerDivergence(obs, undefined, 0);
    expect(r.statistic).toBeCloseTo(2.006573162632538, 10);
    // Closed form for χ² with 5 df: erfc(√(x/2)) + √(2x/π)·e^(−x/2)·(1 + x/3).
    // (The brief's 0.8482347660754797 is off by 1.7e-9; this is the exact value.)
    expect(r.pValue).toBeCloseTo(0.8482347677946378, 10);
    expect(gTest(obs).statistic).toBeCloseTo(2.006573162632538, 10);
  });
  it('Pearson χ² (λ = 1) equals 2 here', () => {
    expect(powerDivergence(obs).statistic).toBeCloseTo(2, 10);
  });
  it('zero observed counts contribute 0 when λ = 0', () => {
    expect(powerDivergence([0, 2], [1, 1], 0).statistic).toBeCloseTo(2 * 2 * Math.log(2), 12);
  });
  it('rejects λ = −1 and mismatched expected lengths', () => {
    expect(() => powerDivergence([1, 2], undefined, -1)).toThrow(RangeError);
    expect(() => powerDivergence([1, 2], [1])).toThrow(RangeError);
  });
});

describe('jackknife', () => {
  it('mean of 1..5 has zero bias and se sqrt(1/2)', () => {
    const r = jackknife([1, 2, 3, 4, 5], mean);
    expect(r.estimate).toBeCloseTo(3, 12);
    expect(r.bias).toBeCloseTo(0, 12);
    expect(r.se).toBeCloseTo(0.7071067811865476, 12);
  });
});
