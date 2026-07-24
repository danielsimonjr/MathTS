import { describe, it, expect } from 'vitest';
import { glm, mvnPdf, mvnSample, tTestPower } from '../src/index.js';

/**
 * Stats-breadth chunk: GLM (Poisson/Gamma via IRLS), multivariate-normal
 * density/sampling, and two-sample t-test power. Every pinned value is an
 * EXTERNAL oracle (statsmodels 0.14 / scipy 1.17), not a self-referential
 * round trip:
 *
 *   - glm poisson: `sm.GLM(y, add_constant(X), family=Poisson()).fit().params`
 *   - glm gamma (log link): `sm.GLM(y, add_constant(X), family=Gamma(link=Log())).fit().params`
 *   - mvnPdf: `scipy.stats.multivariate_normal(mean, cov).pdf(x)`
 *   - tTestPower: `statsmodels.stats.power.tt_ind_solve_power(effect_size, nobs1, alpha)`
 */
describe('glm (IRLS/Fisher scoring)', () => {
  const X = [[1], [2], [3], [4], [5]];
  const y = [1, 2, 3, 5, 8];

  it('poisson (log link) matches statsmodels sm.GLM(..., family=Poisson())', () => {
    const m = glm(X, y, { family: 'poisson' });
    expect(m.coefficients[0]).toBeCloseTo(-0.374104, 4);
    expect(m.coefficients[1]).toBeCloseTo(0.492678, 4);
    expect(m.deviance).toBeCloseTo(0.02936958661463116, 4);
    expect(m.fittedValues.length).toBe(5);
    // Fitted values are exp(Xbeta); reproduce via predict() on the same rows.
    const predicted = m.predict(X);
    predicted.forEach((p, i) => expect(p).toBeCloseTo(m.fittedValues[i], 10));
  });

  it('gamma (log link) matches statsmodels sm.GLM(..., family=Gamma(link=Log()))', () => {
    const m = glm(X, y, { family: 'gamma', link: 'log' });
    expect(m.coefficients[0]).toBeCloseTo(-0.4211274231734348, 4);
    expect(m.coefficients[1]).toBeCloseTo(0.5063759381892458, 4);
    expect(m.deviance).toBeCloseTo(0.01872606725903825, 4);
  });

  it('gamma (inverse/canonical link) matches statsmodels sm.GLM(..., family=Gamma())', () => {
    const m = glm(X, y, { family: 'gamma', link: 'inverse' });
    expect(m.coefficients[0]).toBeCloseTo(0.7972257938430722, 4);
    expect(m.coefficients[1]).toBeCloseTo(-0.13712554166241045, 4);
  });

  it('rejects a poisson response with a negative count', () => {
    expect(() => glm(X, [1, -1, 3, 5, 8], { family: 'poisson' })).toThrow(/non-negative/);
  });

  it('rejects a gamma response with a non-positive value', () => {
    expect(() => glm(X, [1, 0, 3, 5, 8], { family: 'gamma' })).toThrow(/strictly positive/);
  });

  it('rejects an unsupported link for the poisson family', () => {
    expect(() => glm(X, y, { family: 'poisson', link: 'inverse' })).toThrow(/link/);
  });

  it('respects intercept: false (matching ols convention)', () => {
    const m = glm(X, y, { family: 'poisson', intercept: false });
    expect(m.coefficients.length).toBe(1);
  });
});

describe('mvnPdf', () => {
  it('standard bivariate normal at the origin matches scipy multivariate_normal.pdf', () => {
    expect(
      mvnPdf(
        [0, 0],
        [0, 0],
        [
          [1, 0],
          [0, 1],
        ]
      )
    ).toBeCloseTo(0.15915494309189535, 6);
  });

  it('correlated bivariate normal off-origin matches scipy multivariate_normal.pdf', () => {
    expect(
      mvnPdf(
        [1, 1],
        [0, 0],
        [
          [1, 0.5],
          [0.5, 1],
        ]
      )
    ).toBeCloseTo(0.09435389770895924, 6);
  });

  it('1-D case reduces to the ordinary normal PDF', () => {
    expect(mvnPdf(0, 0, 1)).toBeCloseTo(0.3989422804014327, 8);
    expect(mvnPdf(1.5, 0.5, 4)).toBeCloseTo(mvnPdf([1.5], [0.5], [[4]]), 12);
  });

  it('rejects a non-square / mismatched covariance', () => {
    expect(() => mvnPdf([0, 0], [0, 0], [[1, 0]])).toThrow();
    expect(() =>
      mvnPdf(
        [0, 0, 0],
        [0, 0],
        [
          [1, 0],
          [0, 1],
        ]
      )
    ).toThrow();
  });

  it('rejects an asymmetric covariance matrix', () => {
    expect(() =>
      mvnPdf(
        [0, 0],
        [0, 0],
        [
          [1, 0.9],
          [0.1, 1],
        ]
      )
    ).toThrow(/symmetric/);
  });

  it('rejects a non-positive-definite covariance matrix', () => {
    expect(() =>
      mvnPdf(
        [0, 0],
        [0, 0],
        [
          [1, 2],
          [2, 1],
        ]
      )
    ).toThrow();
  });
});

describe('mvnSample', () => {
  it('empirical mean/covariance of 20000 seeded draws match the input parameters', () => {
    const mean = [1, 2];
    const cov = [
      [2, 0.5],
      [0.5, 1],
    ];
    const n = 20000;
    const samples = mvnSample(mean, cov, n, { seed: 12345 });
    expect(samples.length).toBe(n);
    expect(samples[0].length).toBe(2);

    const empMean = [0, 0];
    for (const row of samples) {
      empMean[0] += row[0];
      empMean[1] += row[1];
    }
    empMean[0] /= n;
    empMean[1] /= n;
    expect(empMean[0]).toBeCloseTo(mean[0], 1);
    expect(empMean[1]).toBeCloseTo(mean[1], 1);

    const empCov = [
      [0, 0],
      [0, 0],
    ];
    for (const row of samples) {
      const d0 = row[0] - empMean[0];
      const d1 = row[1] - empMean[1];
      empCov[0][0] += d0 * d0;
      empCov[0][1] += d0 * d1;
      empCov[1][1] += d1 * d1;
    }
    empCov[0][0] /= n - 1;
    empCov[0][1] /= n - 1;
    empCov[1][1] /= n - 1;

    expect(Math.abs(empCov[0][0] - cov[0][0])).toBeLessThan(0.15);
    expect(Math.abs(empCov[0][1] - cov[0][1])).toBeLessThan(0.15);
    expect(Math.abs(empCov[1][1] - cov[1][1])).toBeLessThan(0.15);
  });

  it('is reproducible under a fixed seed', () => {
    const a = mvnSample(
      [0, 0],
      [
        [1, 0],
        [0, 1],
      ],
      5,
      { seed: 7 }
    );
    const b = mvnSample(
      [0, 0],
      [
        [1, 0],
        [0, 1],
      ],
      5,
      { seed: 7 }
    );
    expect(a).toEqual(b);
  });

  it('handles the 1-D case', () => {
    const samples = mvnSample(0, 1, 10, { seed: 1 });
    expect(samples.length).toBe(10);
    expect(samples[0].length).toBe(1);
  });
});

describe('tTestPower', () => {
  it('matches statsmodels tt_ind_solve_power(effect_size=0.5, nobs1=64, alpha=0.05)', () => {
    expect(tTestPower(0.5, 64, 0.05)).toBeCloseTo(0.80146, 3);
  });

  it('power increases with sample size', () => {
    const p30 = tTestPower(0.5, 30, 0.05);
    const p64 = tTestPower(0.5, 64, 0.05);
    const p128 = tTestPower(0.5, 128, 0.05);
    expect(p64).toBeGreaterThan(p30);
    expect(p128).toBeGreaterThan(p64);
  });

  it('power increases with effect size', () => {
    const pSmall = tTestPower(0.2, 64, 0.05);
    const pMed = tTestPower(0.5, 64, 0.05);
    const pLarge = tTestPower(0.8, 64, 0.05);
    expect(pMed).toBeGreaterThan(pSmall);
    expect(pLarge).toBeGreaterThan(pMed);
  });

  it('solveFor "nobs" round-trips against statsmodels tt_ind_solve_power(power=0.8)', () => {
    const nobs = tTestPower(0.5, 0.8, 0.05, { solveFor: 'nobs' });
    expect(nobs).toBeCloseTo(63.77, 1);
    expect(tTestPower(0.5, nobs, 0.05)).toBeCloseTo(0.8, 3);
  });
});
