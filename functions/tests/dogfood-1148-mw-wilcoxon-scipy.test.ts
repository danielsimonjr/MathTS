/**
 * Issue #1148: `mannWhitneyTest` and `wilcoxon` gave p-values that differ from SciPy.
 *
 * Oracle: SciPy 1.16.3, `scipy.stats.mannwhitneyu(a, b)` and `scipy.stats.wilcoxon(x, y)` with
 * their defaults (method 'auto', two-sided, `use_continuity=True` for Mann-Whitney,
 * `zero_method='wilcox'` and `correction=False` for Wilcoxon).
 */
import { describe, it, expect } from 'vitest';
import { mannWhitneyTest, wilcoxon } from '../src/index.js';

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The values 1..n, where the value at index i (0-based) is negative when i % 3 is 0. */
const signed = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => (i % 3 === 0 ? -1 : 1) * (i + 1));

describe('mannWhitneyTest matches scipy.stats.mannwhitneyu (#1148)', () => {
  it('ties: [1,9,3] vs [2,9,4] uses the tie-corrected normal approximation', async () => {
    const r = await mannWhitneyTest([1, 9, 3], [2, 9, 4]);
    expect(r.uStatistic).toBe(3.5);
    expect(r.pValue).toBeCloseTo(0.8247780950825133, 10);
  });

  it('no ties, both samples of 3: exact', async () => {
    const r = await mannWhitneyTest([1, 2, 3], [4, 5, 6]);
    expect(r.uStatistic).toBe(0);
    expect(r.pValue).toBeCloseTo(0.1, 12);
  });

  it('no ties, [1,2,30] vs [4,5,6]: exact', async () => {
    const r = await mannWhitneyTest([1, 2, 30], [4, 5, 6]);
    expect(r.uStatistic).toBe(3);
    expect(r.pValue).toBeCloseTo(0.7, 12);
  });

  it('no ties, 4 vs 4: exact', async () => {
    const r = await mannWhitneyTest([1, 2, 3, 4], [5, 6, 7, 8]);
    expect(r.pValue).toBeCloseTo(0.02857142857142857, 12);
  });

  it('no ties, both samples above 8 (9 vs 9): SciPy uses the normal approximation', async () => {
    const r = await mannWhitneyTest(range(1, 9), range(10, 18));
    expect(r.uStatistic).toBe(0);
    expect(r.pValue).toBeCloseTo(0.00041229480206169127, 12);
  });

  it('no ties, 20 vs 20: normal approximation with continuity correction', async () => {
    const r = await mannWhitneyTest(
      range(1, 20),
      range(1, 20).map((v) => v + 0.5)
    );
    expect(r.uStatistic).toBe(190);
    expect(r.pValue).toBeCloseTo(0.7971974192691748, 10);
  });

  it('no ties, 5 vs 100: exact because the smaller sample has at most 8 values', async () => {
    const r = await mannWhitneyTest(range(1, 5), range(6, 105));
    expect(r.uStatistic).toBe(0);
    expect(r.pValue).toBeCloseTo(2.0712371787570685e-8, 12);
    // The relative error is the real measure: the value is 2e-8.
    expect(Math.abs(r.pValue - 2.0712371787570685e-8) / 2.0712371787570685e-8).toBeLessThan(1e-9);
  });

  it('no ties, 8 vs 21: exact', async () => {
    const r = await mannWhitneyTest(range(1, 8), range(9, 29));
    expect(r.uStatistic).toBe(0);
    expect(Math.abs(r.pValue - 4.659674824592366e-7) / 4.659674824592366e-7).toBeLessThan(1e-9);
  });

  it('all pairs tied: [5,6] vs [5,6] gives p = 1', async () => {
    const r = await mannWhitneyTest([5, 6], [5, 6]);
    expect(r.pValue).toBe(1);
  });

  it('every value equal gives p = 1 (zero variance)', async () => {
    const r = await mannWhitneyTest([2, 2, 2], [2, 2]);
    expect(r.uStatistic).toBe(3);
    expect(r.pValue).toBe(1);
  });
});

describe('wilcoxon matches scipy.stats.wilcoxon defaults (#1148)', () => {
  it('paired with a tie among |d|: permutation distribution', () => {
    const r = wilcoxon([1, 9, 3, 4], [2, 3, 1, 5]);
    expect(r.statistic).toBe(3);
    expect(r.pValue).toBeCloseTo(0.625, 12);
  });

  it('paired with a zero difference: permutation distribution', () => {
    const r = wilcoxon([1, 9, 3, 4, 7], [2, 3, 1, 5, 7]);
    expect(r.statistic).toBe(3);
    expect(r.pValue).toBeCloseTo(0.625, 12);
  });

  it('one-sample with a tie: half ranks', () => {
    const r = wilcoxon([1, -1, 2, 3]);
    expect(r.statistic).toBe(1.5);
    expect(r.pValue).toBeCloseTo(0.375, 12);
  });

  it('one-sample with zeros', () => {
    const r = wilcoxon([0, 0, 1, 2, -3, 4]);
    expect(r.statistic).toBe(3);
    expect(r.pValue).toBeCloseTo(0.625, 12);
  });

  it('one-sample without ties or zeros: exact distribution', () => {
    const r = wilcoxon([1.5, -2.5, 3.5, 4.5, -5.5, 6.5]);
    expect(r.statistic).toBe(7);
    expect(r.pValue).toBeCloseTo(0.5625, 12);
  });

  it('paired without ties or zeros (9 pairs): exact distribution', () => {
    const x = [1.83, 0.5, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.3];
    const y = [0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06, 3.14, 1.29];
    const r = wilcoxon(x, y);
    expect(r.statistic).toBe(5);
    expect(r.pValue).toBeCloseTo(0.0390625, 12);
  });

  it('50 values without ties: exact distribution', () => {
    const r = wilcoxon(signed(50));
    expect(r.statistic).toBe(425);
    expect(r.pValue).toBeCloseTo(0.03996834652842374, 12);
  });

  it('51 values without ties: normal approximation, no continuity correction', () => {
    const r = wilcoxon(signed(51));
    expect(r.statistic).toBe(425);
    expect(r.pValue).toBeCloseTo(0.02568873999366418, 10);
  });

  it('60 values without ties: normal approximation, no continuity correction', () => {
    const r = wilcoxon(signed(60));
    expect(r.statistic).toBe(590);
    expect(r.pValue).toBeCloseTo(0.016733071607703435, 10);
  });

  it('13 values with a tie: permutation distribution', () => {
    const r = wilcoxon([1, -2, 2, 3, -4, ...range(5, 12)]);
    expect(r.statistic).toBe(7.5);
    expect(r.pValue).toBeCloseTo(0.005126953125, 12);
  });

  it('14 values with a tie: normal approximation', () => {
    const r = wilcoxon([1, -2, 2, 3, -4, ...range(5, 13)]);
    expect(r.statistic).toBe(7.5);
    expect(r.pValue).toBeCloseTo(0.004718659448222042, 10);
  });

  it('keeps the result shape: statistic, pValue and zStatistic', () => {
    const r = wilcoxon(signed(60));
    expect(Object.keys(r).sort()).toEqual(['pValue', 'statistic', 'zStatistic']);
    expect(Number.isFinite(r.zStatistic)).toBe(true);
  });
});

describe('wilcoxon with every difference zero matches SciPy 1.16.3 (#1148 review)', () => {
  // scipy.stats.wilcoxon(x, x) with the defaults: statistic 0.0; p 1.0 for 2 to 13 values
  // (permutation path), p nan for more (normal approximation, 0 / 0). One value raises.
  const ones = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it.each([
    [2, 1],
    [3, 1],
    [13, 1],
    [14, NaN],
    [50, NaN],
    [51, NaN],
    [60, NaN],
  ])('%i equal pairs give statistic 0 and p %s', (n, p) => {
    const r = wilcoxon(ones(n), ones(n));
    expect(r.statistic).toBe(0);
    if (Number.isNaN(p)) expect(r.pValue).toBeNaN();
    else expect(r.pValue).toBe(p);
    expect(r.zStatistic).toBeNaN();
  });

  it('the one-sample form [0, 0, 0] gives statistic 0 and p 1', () => {
    const r = wilcoxon([0, 0, 0]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
  });

  it('a single zero difference still throws, as SciPy raises', () => {
    expect(() => wilcoxon([1], [1])).toThrow(/all differences are zero/);
  });
});
