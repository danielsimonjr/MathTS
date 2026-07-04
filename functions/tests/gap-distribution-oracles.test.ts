import { describe, it, expect } from 'vitest';
import {
  betaDist,
  gammaDist,
  poissonDist,
  logNormalDist,
  weibullDist,
} from '@danielsimonjr/mathts-functions';

/**
 * WS-1 P2 — external/closed-form oracle pins for the statistical distribution
 * objects (`betaDist`/`gammaDist`/`poissonDist`/`logNormalDist`/`weibullDist`),
 * which the oracle-coverage matrix listed as SELF-REF. Each value below is derived
 * from the distribution's closed form independently of the implementation, so a
 * systematically-biased pdf/cdf/mean/variance is caught (line coverage ≠ numerical
 * correctness — see [[feedback-oracle-tests-implementation-independent]]).
 *
 * These distributions back the standalone `*CDF`/`*Quantile` surface, so their
 * correctness is load-bearing.
 */

const E = Math.E;
const SQRT_2PI = Math.sqrt(2 * Math.PI);
const GAMMA_1_5 = Math.sqrt(Math.PI) / 2; // Γ(3/2) = √π/2

describe('betaDist(2, 3) — closed-form oracle', () => {
  const d = betaDist(2, 3);
  // Beta(α,β): B(2,3)=Γ(2)Γ(3)/Γ(5)=1·2/24=1/12; pdf(x)=x^(α-1)(1-x)^(β-1)/B = 12·x·(1-x)².
  it('mean = α/(α+β) = 2/5', () => expect(d.mean).toBeCloseTo(0.4, 15));
  it('variance = αβ/((α+β)²(α+β+1)) = 6/150', () => expect(d.variance).toBeCloseTo(0.04, 15));
  it('pdf(0.5) = 12·0.5·0.25 = 1.5', () => expect(d.pdf(0.5)).toBeCloseTo(1.5, 10));
  it('cdf(0.5) = ∫₀^½ 12x(1-x)² dx = 11/16', () => expect(d.cdf(0.5)).toBeCloseTo(0.6875, 8));
  it('quantile(11/16) inverts cdf → 0.5', () => expect(d.quantile(0.6875)).toBeCloseTo(0.5, 6));
});

describe('gammaDist(2, 1) — closed-form oracle (shape 2, rate 1)', () => {
  const d = gammaDist(2, 1);
  // pdf(x)=rate^shape x^(shape-1) e^(−rate·x)/Γ(shape) = x·e^(−x); CDF P(2,x)=1−e^(−x)(1+x).
  it('mean = shape/rate = 2', () => expect(d.mean).toBeCloseTo(2, 15));
  it('variance = shape/rate² = 2', () => expect(d.variance).toBeCloseTo(2, 15));
  it('pdf(1) = 1·e^(−1)', () => expect(d.pdf(1)).toBeCloseTo(1 / E, 12));
  it('cdf(1) = 1 − 2·e^(−1)', () => expect(d.cdf(1)).toBeCloseTo(1 - 2 / E, 10));
});

describe('poissonDist(3) — closed-form oracle', () => {
  const d = poissonDist(3);
  // pmf(k)=λ^k e^(−λ)/k!; cdf(2)=e^(−3)(1+3+4.5)=8.5·e^(−3).
  it('mean = λ = 3', () => expect(d.mean).toBeCloseTo(3, 15));
  it('variance = λ = 3', () => expect(d.variance).toBeCloseTo(3, 15));
  it('pmf(2) = 3²·e^(−3)/2! = 4.5·e^(−3)', () =>
    expect(d.pdf(2)).toBeCloseTo(4.5 * Math.exp(-3), 12));
  it('cdf(2) = 8.5·e^(−3)', () => expect(d.cdf(2)).toBeCloseTo(8.5 * Math.exp(-3), 10));
});

describe('logNormalDist(0, 1) — closed-form oracle', () => {
  const d = logNormalDist(0, 1);
  // mean=e^(μ+σ²/2); var=(e^(σ²)−1)e^(2μ+σ²); pdf(1)=1/(1·σ√2π)=1/√2π; median e^μ=1 so cdf(1)=½.
  it('mean = e^(1/2)', () => expect(d.mean).toBeCloseTo(Math.exp(0.5), 12));
  it('variance = (e−1)·e', () => expect(d.variance).toBeCloseTo((E - 1) * E, 10));
  it('pdf(1) = 1/√(2π)', () => expect(d.pdf(1)).toBeCloseTo(1 / SQRT_2PI, 12));
  it('cdf(1) = 1/2 (median is e^μ = 1)', () => expect(d.cdf(1)).toBeCloseTo(0.5, 12));
});

describe('weibullDist(2, 1) — closed-form oracle (k=2 → Rayleigh)', () => {
  const d = weibullDist(2, 1);
  // pdf(x)=(k/λ)(x/λ)^(k-1)e^(−(x/λ)^k)=2x·e^(−x²); cdf(x)=1−e^(−x²); mean=λΓ(1+1/k)=Γ(3/2).
  it('mean = Γ(3/2) = √π/2', () => expect(d.mean).toBeCloseTo(GAMMA_1_5, 10));
  it('variance = Γ(2) − Γ(3/2)² = 1 − π/4', () =>
    expect(d.variance).toBeCloseTo(1 - Math.PI / 4, 10));
  it('pdf(1) = 2·e^(−1)', () => expect(d.pdf(1)).toBeCloseTo(2 / E, 12));
  it('cdf(1) = 1 − e^(−1)', () => expect(d.cdf(1)).toBeCloseTo(1 - 1 / E, 12));
  it('quantile(1 − e^(−1)) inverts cdf → 1', () => expect(d.quantile(1 - 1 / E)).toBeCloseTo(1, 6));
});
