import { describe, it, expect } from 'vitest';
import {
  chi2Contingency,
  cochranQ,
  fTest,
  gTest,
  jarqueBera,
  kruskalWallis,
  ljungBox,
  moodMedianTest,
  powerDivergence,
} from '../src/index.js';

function rel(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a }, (_, i) => a + i);
const groups = [range(0, 50), range(100, 150), range(200, 250)];

// References: scipy.stats (kruskal, jarque_bera, chi2_contingency, median_test,
// power_divergence) and statsmodels (cochrans_q, acorr_ljungbox). Every p-value is
// below 1e-20, where 1 - chiSquaredCDF returns 0.
describe('chi-square p-values come from the direct upper tail', () => {
  it('kruskalWallis', () => {
    const r = kruskalWallis(...groups);
    expect(rel(r.statistic, 132.4503311258278)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 1.7329100998027503e-29)).toBeLessThan(1e-9);
  });

  it('jarqueBera', () => {
    const r = jarqueBera([...Array(95).fill(0), ...Array(5).fill(10)]);
    expect(rel(r.statistic, 1228.3010156971377)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 1.8959347351314615e-267)).toBeLessThan(1e-9);
  });

  it('chi2Contingency', () => {
    const r = chi2Contingency([
      [300, 10, 20],
      [10, 300, 20],
    ]);
    expect(rel(r.chi2, 542.5806451612904)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 1.5139443428054017e-118)).toBeLessThan(1e-9);
  });

  it('cochranQ', () => {
    const data = [...Array(60).fill([1, 0, 0]), ...Array(5).fill([1, 1, 0])];
    const r = cochranQ(data);
    expect(rel(r.Q, 120.76923076923077)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 5.9606654422196675e-27)).toBeLessThan(1e-9);
  });

  it('moodMedianTest', () => {
    const r = moodMedianTest(groups);
    expect(r.statistic).toBe(100);
    expect(rel(r.pValue, 1.9287498479639183e-22)).toBeLessThan(1e-9);
  });

  it('powerDivergence (Pearson) and gTest', () => {
    const pearson = powerDivergence([300, 10, 10]);
    expect(rel(pearson.statistic, 525.625)).toBeLessThan(1e-12);
    expect(rel(pearson.pValue, 7.277487611359447e-115)).toBeLessThan(1e-9);
    const g = gTest([300, 10, 10]);
    expect(rel(g.statistic, 525.7593159530584)).toBeLessThan(1e-12);
    expect(rel(g.pValue, 6.804796408895768e-115)).toBeLessThan(1e-9);
  });

  it('ljungBox', () => {
    const r = ljungBox(range(0, 100), 5);
    expect(rel(r.statistic, 435.91778010384303)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 5.352637533314213e-92)).toBeLessThan(1e-9);
  });

  it('fTest takes the upper tail from fSF', () => {
    const r = fTest(
      [-100, 100, -100, 100, -100, 100, -100, 100, -100, 100],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    );
    expect(r.statistic).toBe(40000);
    // scipy: 2 * min(f.cdf(s, 9, 9), f.sf(s, 9, 9))
    expect(rel(r.pValue, 2.5864232181828113e-19)).toBeLessThan(1e-9);
  });
});
