import { describe, it, expect } from 'vitest';

import { gammaQuantile, betaQuantile } from '../src/distribution-functions.js';

/**
 * External-oracle pins for the two quantile functions the WS-1 oracle-coverage
 * audit flagged UNTESTED (`docs/roadmap/ORACLE_COVERAGE_MATRIX.md`).
 *
 * The oracle here is *independent of the implementation*: exact closed forms for
 * special parameter values, plus standard chi-square critical values (NIST /
 * published statistical tables). No round-trip against MathTS's own CDF is used —
 * that would be self-referential, not an oracle.
 *
 * Parameterization (verified in source): `gammaQuantile(p, shape, rate=1)` uses
 * the RATE (rate = 1/scale), so chi-square df=k ≡ gammaQuantile(p, k/2, 0.5)
 * (chi²_k is Gamma with shape k/2, scale 2 ⇒ rate 0.5); `betaQuantile(p, a, b)`
 * inverts the regularized incomplete beta I(x; a, b).
 */

/** Relative closeness (absolute for values near 0). */
function expectClose(actual: number, expected: number, relTol: number): void {
  const diff = Math.abs(actual - expected);
  const scale = Math.max(1, Math.abs(expected));
  expect(diff / scale).toBeLessThan(relTol);
}

describe('gammaQuantile — external oracle', () => {
  // Exponential special case: shape=1 ⇒ Gamma(1, rate) is Exponential(rate),
  // whose exact quantile is  x = -ln(1-p) / rate.  Closed form, no external tool.
  it('shape=1 matches the exponential closed form -ln(1-p)/rate', () => {
    expectClose(gammaQuantile(0.5, 1, 1), Math.LN2, 1e-8); // -ln(0.5) = ln 2
    expectClose(gammaQuantile(0.9, 1, 1), -Math.log(0.1), 1e-8);
    expectClose(gammaQuantile(0.5, 1, 2), -Math.log(0.5) / 2, 1e-8);
    expectClose(gammaQuantile(0.99, 1, 0.5), -Math.log(0.01) / 0.5, 1e-8);
  });

  // Chi-square relationship: chi²_k(p) = gammaQuantile(p, k/2, 0.5).
  // Right-tail 0.95 critical values from standard chi-square tables (NIST).
  it('matches published chi-square 0.95 critical values (shape=df/2, rate=0.5)', () => {
    expectClose(gammaQuantile(0.95, 0.5, 0.5), 3.841459, 1e-4); // chi²_1
    expectClose(gammaQuantile(0.95, 1.0, 0.5), 5.991465, 1e-4); // chi²_2
    expectClose(gammaQuantile(0.95, 1.5, 0.5), 7.814728, 1e-4); // chi²_3
    expectClose(gammaQuantile(0.95, 2.0, 0.5), 9.487729, 1e-4); // chi²_4
    expectClose(gammaQuantile(0.95, 5.0, 0.5), 18.307038, 1e-4); // chi²_10
  });

  it('chi²_2 0.99 critical value (shape=1, rate=0.5) = 9.210340', () => {
    expectClose(gammaQuantile(0.99, 1.0, 0.5), 9.21034, 1e-4);
  });
});

describe('betaQuantile — external oracle (exact closed forms)', () => {
  // Beta(1,1) is Uniform(0,1): I⁻¹(p; 1, 1) = p.
  it('Beta(1,1) is the uniform quantile p', () => {
    expectClose(betaQuantile(0.25, 1, 1), 0.25, 1e-9);
    expectClose(betaQuantile(0.5, 1, 1), 0.5, 1e-9);
    expectClose(betaQuantile(0.9, 1, 1), 0.9, 1e-9);
  });

  // I(x; a, 1) = x^a  ⇒  quantile = p^(1/a).
  it('Beta(a,1) quantile equals p^(1/a)', () => {
    expectClose(betaQuantile(0.5, 2, 1), Math.sqrt(0.5), 1e-7);
    expectClose(betaQuantile(0.5, 3, 1), Math.cbrt(0.5), 1e-7);
    expectClose(betaQuantile(0.8, 4, 1), 0.8 ** (1 / 4), 1e-7);
  });

  // I(x; 1, b) = 1 - (1-x)^b  ⇒  quantile = 1 - (1-p)^(1/b).
  it('Beta(1,b) quantile equals 1 - (1-p)^(1/b)', () => {
    expectClose(betaQuantile(0.5, 1, 2), 1 - Math.sqrt(0.5), 1e-7);
    expectClose(betaQuantile(0.3, 1, 3), 1 - 0.7 ** (1 / 3), 1e-7);
  });

  // Symmetric Beta(a,a): the median is exactly 0.5 for any a > 0.
  it('symmetric Beta(a,a) has median 0.5', () => {
    expectClose(betaQuantile(0.5, 2, 2), 0.5, 1e-7);
    expectClose(betaQuantile(0.5, 5, 5), 0.5, 1e-7);
    expectClose(betaQuantile(0.5, 0.5, 0.5), 0.5, 1e-7);
  });
});
