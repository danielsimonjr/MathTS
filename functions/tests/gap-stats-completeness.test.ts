import { describe, it, expect } from 'vitest';
import {
  kolmogorovSmirnov2Test,
  leveneTest,
  bartlettTest,
  hypergeometricDist,
  negativeBinomialDist,
  studentTTestPaired,
  proportionZTest,
  binomialTest,
  kendallTau,
  poissonDist,
  logNormalDist,
  weibullDist,
} from '../src/index.js';

/**
 * Statistics/probability completeness waves (2026-07-06) — closing the breadth
 * gap to matrix-level parity. Every new function is pinned to an EXTERNAL oracle
 * (scipy 1.17.1), not to its own output. Reference values are generated with
 * scipy and embedded per test.
 *
 * Wave 1 — two-sample Kolmogorov–Smirnov. D pinned to `scipy.stats.ks_2samp`
 * (exact statistic); p-value pinned to the asymptotic Kolmogorov distribution
 * `scipy.stats.distributions.kstwobign.sf(√(n₁n₂/(n₁+n₂))·D)` (scipy's small-n
 * `ks_2samp` p is an exact combinatorial value, version-specific; the asymptotic
 * is the stable, standard oracle).
 */
describe('Wave 1: kolmogorovSmirnov2Test vs scipy.ks_2samp', () => {
  it('D matches scipy exactly, p matches kstwobign (n=8,8)', () => {
    const a = [0.1, 0.2, 0.35, 0.4, 0.55, 0.6, 0.7, 0.85];
    const b = [0.3, 0.45, 0.5, 0.65, 0.75, 0.8, 0.9, 0.95];
    const r = kolmogorovSmirnov2Test(a, b);
    expect(r.statistic).toBeCloseTo(0.375, 10);
    expect(r.pValue).toBeCloseTo(0.6271670418, 8);
  });

  it('D and p match scipy (n=10,10, shifted)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const r = kolmogorovSmirnov2Test(a, b);
    expect(r.statistic).toBeCloseTo(0.5, 10);
    expect(r.pValue).toBeCloseTo(0.1640791977, 8);
  });

  it('identical samples give D=0, p=1', () => {
    const r = kolmogorovSmirnov2Test([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
  });

  it('rejects empty samples', () => {
    expect(() => kolmogorovSmirnov2Test([], [1, 2])).toThrow(/non-empty/);
  });
});

describe('Wave 2: Levene + Bartlett vs scipy', () => {
  const g1 = [8.1, 8.3, 7.9, 8.0, 8.2];
  const g2 = [9.1, 9.5, 8.9, 9.3, 9.0];
  const g3 = [7.1, 7.3, 6.9, 7.5, 7.0];

  it('leveneTest (median-centered) matches scipy.stats.levene', () => {
    const r = leveneTest([g1, g2, g3]);
    expect(r.statistic).toBeCloseTo(0.3529411765, 8);
    expect(r.pValue).toBeCloseTo(0.7096733516, 7);
    expect(r.degreesOfFreedom).toEqual([2, 12]);
  });

  it('leveneTest (mean-centered) matches scipy', () => {
    const r = leveneTest([g1, g2, g3], 'mean');
    expect(r.statistic).toBeCloseTo(0.8404669261, 8);
    expect(r.pValue).toBeCloseTo(0.4553999912, 7);
  });

  it('bartlettTest matches scipy.stats.bartlett', () => {
    const r = bartlettTest([g1, g2, g3]);
    expect(r.statistic).toBeCloseTo(0.758451453, 8);
    expect(r.pValue).toBeCloseTo(0.68439111, 7);
    expect(r.degreesOfFreedom).toBe(2);
  });

  it('both reject <2 groups', () => {
    expect(() => leveneTest([g1])).toThrow(/at least 2/);
    expect(() => bartlettTest([g1])).toThrow(/at least 2/);
  });
});

describe('Wave 3: hypergeometric + negative-binomial vs scipy', () => {
  it('hypergeometricDist(50,5,10) pmf/cdf/mean/var match scipy.stats.hypergeom', () => {
    const h = hypergeometricDist(50, 5, 10);
    const pmf = [0.310562782, 0.4313371972, 0.2098397176, 0.0441767826, 0.0039645831, 0.0001189375];
    pmf.forEach((v, k) => expect(h.pdf(k)).toBeCloseTo(v, 10));
    expect(h.cdf(2)).toBeCloseTo(0.9517396968, 9);
    expect(h.mean).toBeCloseTo(1.0, 12);
    expect(h.variance).toBeCloseTo(0.7346938776, 9);
    // pmf sums to 1 over support
    let s = 0;
    for (let k = 0; k <= 5; k++) s += h.pdf(k);
    expect(s).toBeCloseTo(1, 10);
  });

  it('negativeBinomialDist(5,0.4) pmf/cdf/mean/var match scipy.stats.nbinom', () => {
    const nb = negativeBinomialDist(5, 0.4);
    expect(nb.pdf(0)).toBeCloseTo(0.01024, 10);
    expect(nb.pdf(3)).toBeCloseTo(0.0774144, 10);
    expect(nb.pdf(5)).toBeCloseTo(0.1003290624, 9);
    expect(nb.pdf(10)).toBeCloseTo(0.0619792816, 9);
    expect(nb.cdf(5)).toBeCloseTo(0.3668967424, 8);
    expect(nb.mean).toBeCloseTo(7.5, 10);
    expect(nb.variance).toBeCloseTo(18.75, 10);
  });

  it('reject invalid params', () => {
    expect(() => hypergeometricDist(10, 20, 5)).toThrow();
    expect(() => negativeBinomialDist(0, 0.5)).toThrow();
    expect(() => negativeBinomialDist(5, 1.5)).toThrow();
  });
});

describe('Wave 4: paired-t / proportion-z / binomial test vs scipy', () => {
  it('studentTTestPaired matches scipy.stats.ttest_rel', () => {
    const r = studentTTestPaired([1.2, 2.3, 3.1, 4.8, 5.2], [1.0, 2.0, 3.5, 4.0, 5.0]);
    expect(r.statistic).toBeCloseTo(1.1531133204, 8);
    expect(r.pValue).toBeCloseTo(0.3130803955, 8);
    expect(r.degreesOfFreedom).toBe(4);
  });

  it('one-sample proportionZTest (40/100 vs 0.5)', () => {
    const r = proportionZTest(40, 100, 0.5);
    expect(r.statistic).toBeCloseTo(-2.0, 10);
    expect(r.pValue).toBeCloseTo(0.0455002639, 9);
  });

  it('two-sample proportionZTest (40/100 vs 30/100)', () => {
    const r = proportionZTest([40, 30], [100, 100]);
    expect(r.statistic).toBeCloseTo(1.4824986333, 8);
    expect(r.pValue).toBeCloseTo(0.138207667, 8);
  });

  it('binomialTest(8,20,0.5) matches scipy.stats.binomtest (two-sided)', () => {
    const r = binomialTest(8, 20, 0.5);
    expect(r.pValue).toBeCloseTo(0.5034446716, 9);
    expect(r.statistic).toBeCloseTo(0.4, 12);
  });

  it('rejects malformed inputs', () => {
    expect(() => studentTTestPaired([1, 2], [1])).toThrow();
    expect(() => binomialTest(25, 20, 0.5)).toThrow();
  });
});

describe('Wave 5: Kendall tau + external pins for 3 round-trip methods', () => {
  it('kendallTau (no ties) matches scipy.stats.kendalltau', () => {
    expect(kendallTau([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.6, 12);
  });

  it('kendallTau (with ties, τ_b correction) matches scipy', () => {
    expect(kendallTau([1, 2, 2, 3, 4], [1, 3, 2, 4, 5])).toBeCloseTo(0.9486832981, 9);
  });

  it('kendallTau perfect concordance/discordance', () => {
    expect(kendallTau([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 12);
    expect(kendallTau([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });

  // External scipy pins for methods previously verified only by inversion round-trips
  it('poissonDist(3).cdf(2) pinned to scipy.stats.poisson', () => {
    expect(poissonDist(3).cdf(2)).toBeCloseTo(0.423190081127, 11);
  });

  it('logNormalDist(0,1).quantile(0.9) pinned to scipy.stats.lognorm.ppf', () => {
    expect(logNormalDist(0, 1).quantile(0.9)).toBeCloseTo(3.602224479279, 10);
  });

  it('weibullDist(2,1).quantile(0.5) pinned to scipy.stats.weibull_min.ppf', () => {
    expect(weibullDist(2, 1).quantile(0.5)).toBeCloseTo(0.832554611158, 11);
  });
});

import {
  linregress,
  pearsonr,
  spearmanr,
  kendalltau,
  ptp,
  variation,
  trimmedMean,
  describe as statDescribe,
  histogram,
} from '../src/index.js';

describe('Wave B/C/D: regression, correlation tests, descriptive vs scipy', () => {
  it('linregress matches scipy.stats.linregress', () => {
    const r = linregress([1, 2, 3, 4, 5, 6], [2.1, 3.9, 6.2, 7.8, 10.1, 11.9]);
    expect(r.slope).toBeCloseTo(1.9771428571, 9);
    expect(r.intercept).toBeCloseTo(0.08, 9);
    expect(r.rValue).toBeCloseTo(0.9991907325, 9);
    expect(r.pValue).toBeCloseTo(0.0000009821, 10);
    expect(r.stdErr).toBeCloseTo(0.0397953951, 9);
    expect(r.interceptStdErr).toBeCloseTo(0.1549807976, 8);
  });

  it('pearsonr / spearmanr match scipy (r + p)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7];
    const b = [2, 1, 4, 3, 6, 5, 7];
    const p = pearsonr(a, b);
    expect(p.coefficient).toBeCloseTo(0.8928571429, 9);
    expect(p.pValue).toBeCloseTo(0.0068071874, 9);
    const s = spearmanr(a, b);
    expect(s.coefficient).toBeCloseTo(0.8928571429, 9);
    expect(s.pValue).toBeCloseTo(0.0068071874, 9);
  });

  it('kendalltau coefficient matches scipy; p via normal approximation', () => {
    const k = kendalltau([1, 2, 3, 4, 5, 6, 7], [2, 1, 4, 3, 6, 5, 7]);
    expect(k.coefficient).toBeCloseTo(0.7142857143, 9);
    expect(k.pValue).toBeCloseTo(0.0242706404, 9); // normal-approx (scipy exact = 0.03016)
  });

  it('ptp / variation / trimmedMean / describe / histogram match numpy/scipy', () => {
    const d = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(ptp(d)).toBe(7);
    expect(variation(d)).toBeCloseTo(0.4, 12);
    expect(trimmedMean(d, 0.25)).toBeCloseTo(4.5, 12);
    const de = statDescribe(d);
    expect(de.nobs).toBe(8);
    expect(de.variance).toBeCloseTo(4.5714285714, 9); // sample ddof=1
    expect(de.skewness).toBeCloseTo(0.65625, 9); // biased
    expect(de.kurtosis).toBeCloseTo(-0.21875, 9); // biased Fisher
    const h = histogram([1, 2, 2, 3, 3, 3, 4, 4, 4, 4], 4);
    expect(h.counts).toEqual([1, 2, 3, 4]);
    expect(h.edges).toEqual([1, 1.75, 2.5, 3.25, 4]);
  });
});

import {
  andersonDarlingTest,
  dagostinoTest,
  friedmanTest,
  anova2,
  multipleComparison,
} from '../src/index.js';

describe('Wave E: normality + repeated-measures tests vs scipy', () => {
  it('andersonDarlingTest A2 statistic matches scipy.stats.anderson', () => {
    const d = [2.1, 3.4, 1.9, 4.2, 2.8, 3.1, 2.5, 3.9, 2.2, 3.6];
    const r = andersonDarlingTest(d);
    expect(r.statistic).toBeCloseTo(0.2060815568, 8);
    expect(r.pValue).toBeGreaterThan(0.5); // clearly normal-looking
  });

  it('dagostinoTest (normaltest) matches scipy.stats.normaltest', () => {
    const big = [
      1.1, 2.3, 1.8, 4.5, 2.2, 3.1, 2.9, 3.5, 1.5, 2.8, 3.3, 2.1, 4.0, 1.9, 2.6, 3.8, 2.4, 3.0, 2.7,
      3.2,
    ];
    const r = dagostinoTest(big);
    expect(r.statistic).toBeCloseTo(0.0667893601, 7);
    expect(r.pValue).toBeCloseTo(0.9671567668, 7);
  });

  it('friedmanTest matches scipy.stats.friedmanchisquare', () => {
    const r = friedmanTest([
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
      [1, 1, 2, 2, 3],
    ]);
    expect(r.statistic).toBeCloseTo(9.5789473684, 8);
    expect(r.pValue).toBeCloseTo(0.0083168335, 8);
    expect(r.degreesOfFreedom).toBe(2);
  });

  it('anova2 two-way F-tests match the balanced SS decomposition', () => {
    const data = [
      [
        [10, 12],
        [14, 16],
        [18, 20],
      ],
      [
        [11, 13],
        [15, 17],
        [19, 21],
      ],
    ];
    const r = anova2(data);
    expect(r.factorA.F).toBeCloseTo(1.5, 6);
    expect(r.factorB.F).toBeCloseTo(32.0, 6);
    expect(r.factorA.pValue).toBeCloseTo(0.2665697, 6);
    expect(r.factorB.pValue).toBeCloseTo(0.00062974, 7);
    expect(r.factorA.degreesOfFreedom).toEqual([1, 6]);
    expect(r.factorB.degreesOfFreedom).toEqual([2, 6]);
  });

  it('multipleComparison matches bonferroni / holm / BH-FDR', () => {
    const p = [0.01, 0.04, 0.03, 0.005, 0.2];
    expect(multipleComparison(p, 'bonferroni')).toEqual([0.05, 0.2, 0.15, 0.025, 1.0]);
    const holm = multipleComparison(p, 'holm');
    [0.04, 0.09, 0.09, 0.025, 0.2].forEach((v, i) => expect(holm[i]).toBeCloseTo(v, 10));
    const bh = multipleComparison(p, 'bh');
    [0.025, 0.05, 0.05, 0.025, 0.2].forEach((v, i) => expect(bh[i]).toBeCloseTo(v, 10));
  });
});

import {
  paretoDist,
  rayleighDist,
  triangularDist,
  discreteUniformDist,
  gumbelDist,
  invGaussDist,
  multivariateNormal,
} from '../src/index.js';

describe('Wave F: common distributions vs scipy', () => {
  it('paretoDist(3,2) matches scipy.stats.pareto', () => {
    const d = paretoDist(3, 2);
    expect(d.pdf(3)).toBeCloseTo(0.2962962963, 9);
    expect(d.cdf(4)).toBeCloseTo(0.875, 10);
    expect(d.mean).toBeCloseTo(3.0, 10);
    expect(d.variance).toBeCloseTo(3.0, 10);
    expect(d.quantile(0.5)).toBeCloseTo(2.5198420998, 9);
  });

  it('rayleighDist(2) matches scipy.stats.rayleigh', () => {
    const d = rayleighDist(2);
    expect(d.pdf(2)).toBeCloseTo(0.3032653299, 9);
    expect(d.cdf(3)).toBeCloseTo(0.6753475326, 9);
    expect(d.mean).toBeCloseTo(2.5066282746, 9);
    expect(d.variance).toBeCloseTo(1.7168146928, 9);
  });

  it('triangularDist(0,4,6) matches scipy.stats.triang', () => {
    const d = triangularDist(0, 4, 6);
    expect(d.pdf(3)).toBeCloseTo(0.25, 10);
    expect(d.cdf(4)).toBeCloseTo(0.6666666667, 9);
    expect(d.mean).toBeCloseTo(3.3333333333, 9);
    expect(d.variance).toBeCloseTo(1.5555555556, 9);
  });

  it('discreteUniformDist(1,6) matches scipy.stats.randint', () => {
    const d = discreteUniformDist(1, 6);
    expect(d.pdf(3)).toBeCloseTo(0.1666666667, 9);
    expect(d.cdf(4)).toBeCloseTo(0.6666666667, 9);
    expect(d.mean).toBeCloseTo(3.5, 10);
    expect(d.variance).toBeCloseTo(2.9166666667, 9);
  });

  it('gumbelDist(1,2) matches scipy.stats.gumbel_r', () => {
    const d = gumbelDist(1, 2);
    expect(d.pdf(2)).toBeCloseTo(0.1653521494, 9);
    expect(d.cdf(3)).toBeCloseTo(0.6922006276, 9);
    expect(d.mean).toBeCloseTo(2.1544313298, 9);
    expect(d.quantile(0.5)).toBeCloseTo(1.7330258412, 8);
  });

  it('invGaussDist(1,1) matches scipy.stats.invgauss', () => {
    const d = invGaussDist(1, 1);
    expect(d.pdf(1)).toBeCloseTo(0.3989422804, 9);
    expect(d.cdf(1.5)).toBeCloseTo(0.810767993, 8);
    expect(d.mean).toBeCloseTo(1.0, 10);
  });

  it('multivariateNormal matches scipy.stats.multivariate_normal.pdf', () => {
    const m = multivariateNormal(
      [0, 0],
      [
        [1, 0.5],
        [0.5, 2],
      ]
    );
    expect(m.pdf([0, 0])).toBeCloseTo(0.1203098284, 9);
    expect(m.pdf([0.5, 1])).toBeCloseTo(0.0904101042, 9);
  });
});
