import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  normalPDF,
  normalCDF,
  exponentialPDF,
  exponentialCDF,
  poissonPMF,
  binomialPMF,
  geometricPMF,
  bernoulliPMF,
  entropy,
  jsDivergence,
} from '../src/typed/distributions.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

describe('Probability Distribution Functions', () => {
  // ===========================================================================
  // normalPDF
  // ===========================================================================
  describe('normalPDF', () => {
    it('normalPDF(0) ~ 0.3989 (standard normal)', () => {
      expect(normalPDF(0)).toBeCloseTo(0.39894228, 6);
    });

    it('normalPDF(0, 0, 1) ~ 0.3989', () => {
      expect(normalPDF(0, 0, 1)).toBeCloseTo(0.39894228, 6);
    });

    it('normalPDF(1, 0, 1) ~ 0.2420', () => {
      expect(normalPDF(1, 0, 1)).toBeCloseTo(0.24197072, 6);
    });

    it('normalPDF with sigma=2 stretches the density', () => {
      expect(normalPDF(0, 0, 2)).toBeCloseTo(0.19947114, 6);
    });

    it('normalPDF with negative sigma returns NaN', () => {
      expect(normalPDF(0, 0, -1)).toBeNaN();
    });

    it('symmetry: normalPDF(x) = normalPDF(-x)', () => {
      expect(normalPDF(1.5)).toBeCloseTo(normalPDF(-1.5), 10);
    });
  });

  // ===========================================================================
  // normalCDF
  // ===========================================================================
  describe('normalCDF', () => {
    it('normalCDF(0) = 0.5', () => {
      expect(normalCDF(0)).toBeCloseTo(0.5, 10);
    });

    it('normalCDF(0, 0, 1) = 0.5', () => {
      expect(normalCDF(0, 0, 1)).toBeCloseTo(0.5, 10);
    });

    it('normalCDF(1.96) ~ 0.975', () => {
      expect(normalCDF(1.96)).toBeCloseTo(0.9750021, 4);
    });

    it('normalCDF(-1.96) ~ 0.025', () => {
      expect(normalCDF(-1.96)).toBeCloseTo(0.0249979, 4);
    });

    it('normalCDF(large) ~ 1', () => {
      expect(normalCDF(10)).toBeCloseTo(1, 10);
    });

    it('normalCDF(-large) ~ 0', () => {
      expect(normalCDF(-10)).toBeCloseTo(0, 10);
    });

    it('normalCDF with non-standard parameters', () => {
      // X ~ N(5, 2): P(X <= 5) = 0.5
      expect(normalCDF(5, 5, 2)).toBeCloseTo(0.5, 10);
    });
  });

  // ===========================================================================
  // exponentialPDF
  // ===========================================================================
  describe('exponentialPDF', () => {
    it('exponentialPDF(0, 1) = 1', () => {
      expect(exponentialPDF(0, 1)).toBeCloseTo(1, 10);
    });

    it('exponentialPDF(1, 1) = 1/e', () => {
      expect(exponentialPDF(1, 1)).toBeCloseTo(1 / Math.E, 10);
    });

    it('exponentialPDF(0, 2) = 2', () => {
      expect(exponentialPDF(0, 2)).toBeCloseTo(2, 10);
    });

    it('exponentialPDF for x < 0 = 0', () => {
      expect(exponentialPDF(-1, 1)).toBe(0);
    });

    it('exponentialPDF with lambda <= 0 returns NaN', () => {
      expect(exponentialPDF(1, 0)).toBeNaN();
      expect(exponentialPDF(1, -1)).toBeNaN();
    });
  });

  // ===========================================================================
  // exponentialCDF
  // ===========================================================================
  describe('exponentialCDF', () => {
    it('exponentialCDF(0, 1) = 0', () => {
      expect(exponentialCDF(0, 1)).toBeCloseTo(0, 10);
    });

    it('exponentialCDF(1, 1) = 1 - 1/e', () => {
      expect(exponentialCDF(1, 1)).toBeCloseTo(1 - 1 / Math.E, 10);
    });

    it('exponentialCDF for x < 0 = 0', () => {
      expect(exponentialCDF(-1, 1)).toBe(0);
    });

    it('exponentialCDF(large) ~ 1', () => {
      expect(exponentialCDF(100, 1)).toBeCloseTo(1, 10);
    });
  });

  // ===========================================================================
  // poissonPMF
  // ===========================================================================
  describe('poissonPMF', () => {
    it('poissonPMF(3, 2.5) ~ 0.2138', () => {
      expect(poissonPMF(3, 2.5)).toBeCloseTo(0.21376, 4);
    });

    it('poissonPMF(0, 1) = 1/e', () => {
      expect(poissonPMF(0, 1)).toBeCloseTo(1 / Math.E, 10);
    });

    it('poissonPMF(0, 0) = 1', () => {
      expect(poissonPMF(0, 0)).toBe(1);
    });

    it('poissonPMF(k, 0) = 0 for k > 0', () => {
      expect(poissonPMF(1, 0)).toBe(0);
    });

    it('poissonPMF probabilities sum ~ 1', () => {
      let sum = 0;
      for (let k = 0; k <= 30; k++) {
        sum += poissonPMF(k, 5);
      }
      expect(sum).toBeCloseTo(1, 8);
    });

    it('poissonPMF with negative k returns NaN', () => {
      expect(poissonPMF(-1, 2)).toBeNaN();
    });
  });

  // ===========================================================================
  // binomialPMF
  // ===========================================================================
  describe('binomialPMF', () => {
    it('binomialPMF(3, 10, 0.5) ~ 0.1172', () => {
      expect(binomialPMF(3, 10, 0.5)).toBeCloseTo(0.1171875, 6);
    });

    it('binomialPMF(0, 5, 0.3) ~ 0.1681', () => {
      expect(binomialPMF(0, 5, 0.3)).toBeCloseTo(0.16807, 4);
    });

    it('binomialPMF(n, n, p) = p^n', () => {
      expect(binomialPMF(5, 5, 0.3)).toBeCloseTo(Math.pow(0.3, 5), 10);
    });

    it('binomialPMF probabilities sum to 1', () => {
      let sum = 0;
      for (let k = 0; k <= 10; k++) {
        sum += binomialPMF(k, 10, 0.4);
      }
      expect(sum).toBeCloseTo(1, 10);
    });

    it('binomialPMF with p=0', () => {
      expect(binomialPMF(0, 5, 0)).toBe(1);
      expect(binomialPMF(1, 5, 0)).toBe(0);
    });

    it('binomialPMF with p=1', () => {
      expect(binomialPMF(5, 5, 1)).toBe(1);
      expect(binomialPMF(4, 5, 1)).toBe(0);
    });
  });

  // ===========================================================================
  // geometricPMF
  // ===========================================================================
  describe('geometricPMF', () => {
    it('geometricPMF(1, 0.5) = 0.5', () => {
      expect(geometricPMF(1, 0.5)).toBeCloseTo(0.5, 10);
    });

    it('geometricPMF(3, 0.5) = 0.125', () => {
      expect(geometricPMF(3, 0.5)).toBeCloseTo(0.125, 10);
    });

    it('geometricPMF(1, 1) = 1', () => {
      expect(geometricPMF(1, 1)).toBeCloseTo(1, 10);
    });

    it('geometricPMF with k < 1 returns NaN', () => {
      expect(geometricPMF(0, 0.5)).toBeNaN();
    });

    it('geometricPMF with p <= 0 returns NaN', () => {
      expect(geometricPMF(1, 0)).toBeNaN();
      expect(geometricPMF(1, -0.5)).toBeNaN();
    });
  });

  // ===========================================================================
  // bernoulliPMF
  // ===========================================================================
  describe('bernoulliPMF', () => {
    it('bernoulliPMF(1, 0.7) = 0.7', () => {
      expect(bernoulliPMF(1, 0.7)).toBeCloseTo(0.7, 10);
    });

    it('bernoulliPMF(0, 0.7) = 0.3', () => {
      expect(bernoulliPMF(0, 0.7)).toBeCloseTo(0.3, 10);
    });

    it('bernoulliPMF(2, 0.5) = NaN (invalid k)', () => {
      expect(bernoulliPMF(2, 0.5)).toBeNaN();
    });

    it('bernoulliPMF with invalid p returns NaN', () => {
      expect(bernoulliPMF(1, -0.1)).toBeNaN();
      expect(bernoulliPMF(1, 1.1)).toBeNaN();
    });
  });

  // ===========================================================================
  // entropy
  // ===========================================================================
  describe('entropy', () => {
    it('entropy([0.5, 0.5]) = 1 bit', () => {
      expect(entropy([0.5, 0.5])).toBeCloseTo(1.0, 10);
    });

    it('entropy([0.25, 0.25, 0.25, 0.25]) = 2 bits', () => {
      expect(entropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2.0, 10);
    });

    it('entropy([1, 0]) = 0 (certain outcome)', () => {
      expect(entropy([1, 0])).toBeCloseTo(0, 10);
    });

    it('entropy of uniform distribution = log2(n)', () => {
      const n = 8;
      const uniform = Array(n).fill(1 / n);
      expect(entropy(uniform)).toBeCloseTo(Math.log2(n), 10);
    });

    it('entropy with negative probability returns NaN', () => {
      expect(entropy([-0.1, 1.1])).toBeNaN();
    });
  });

  // ===========================================================================
  // jsDivergence
  // ===========================================================================
  describe('jsDivergence', () => {
    it('jsDivergence of identical distributions = 0', () => {
      expect(jsDivergence([0.5, 0.5], [0.5, 0.5])).toBeCloseTo(0, 10);
    });

    it('jsDivergence([1,0], [0,1]) = 1 bit (maximum for 2 bins)', () => {
      expect(jsDivergence([1, 0], [0, 1])).toBeCloseTo(1.0, 10);
    });

    it('jsDivergence is symmetric: JSD(P||Q) = JSD(Q||P)', () => {
      const p = [0.1, 0.9];
      const q = [0.4, 0.6];
      expect(jsDivergence(p, q)).toBeCloseTo(jsDivergence(q, p), 10);
    });

    it('jsDivergence is non-negative', () => {
      expect(jsDivergence([0.3, 0.7], [0.6, 0.4])).toBeGreaterThanOrEqual(0);
    });

    it('jsDivergence with different lengths returns NaN', () => {
      expect(jsDivergence([0.5, 0.5], [0.33, 0.33, 0.34])).toBeNaN();
    });
  });
});

// =============================================================================
// Parallel Float64Array overloads
// =============================================================================

describe('Distribution parallel array overloads', () => {
  beforeAll(async () => {
    await computePool.initialize();
    // Lower the threshold so the worker path is actually exercised.
    computePool.updateConfig({ thresholdElements: 64, chunkSize: 256 });
  });

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  });

  it('normalPDF over a Float64Array matches the scalar implementation', async () => {
    const xs = Float64Array.from({ length: 1000 }, (_, i) => (i - 500) / 100);
    const std = await normalPDF(xs);
    const params = await normalPDF(xs, 1, 2);
    expect(std.length).toBe(1000);
    for (let i = 0; i < xs.length; i += 37) {
      expect(std[i]).toBeCloseTo(normalPDF(xs[i]) as number, 12);
      expect(params[i]).toBeCloseTo(normalPDF(xs[i], 1, 2) as number, 12);
    }
  });

  it('normalCDF over a Float64Array matches the scalar implementation', async () => {
    const xs = Float64Array.from({ length: 1000 }, (_, i) => (i - 500) / 100);
    const arr = await normalCDF(xs, 0, 1);
    expect(arr[500]).toBeCloseTo(0.5, 12);
    for (let i = 0; i < xs.length; i += 37) {
      expect(arr[i]).toBeCloseTo(normalCDF(xs[i], 0, 1) as number, 12);
    }
  });

  it('exponential PDF/CDF over a Float64Array match the scalar implementations', async () => {
    const xs = Float64Array.from({ length: 800 }, (_, i) => i / 100);
    const pdf = await exponentialPDF(xs, 1.5);
    const cdf = await exponentialCDF(xs, 1.5);
    for (let i = 0; i < xs.length; i += 29) {
      expect(pdf[i]).toBeCloseTo(exponentialPDF(xs[i], 1.5) as number, 12);
      expect(cdf[i]).toBeCloseTo(exponentialCDF(xs[i], 1.5) as number, 12);
    }
  });

  it('discrete PMFs over a Float64Array match the scalar implementations', async () => {
    const ks = Float64Array.from({ length: 600 }, (_, i) => i % 30);
    const pois = await poissonPMF(ks, 5);
    const binom = await binomialPMF(ks, 40, 0.3);
    const geom = await geometricPMF(
      Float64Array.from({ length: 600 }, (_, i) => (i % 20) + 1),
      0.25
    );
    const bern = await bernoulliPMF(
      Float64Array.from({ length: 600 }, (_, i) => i % 2),
      0.7
    );
    for (let i = 0; i < ks.length; i += 17) {
      expect(pois[i]).toBeCloseTo(poissonPMF(ks[i], 5) as number, 12);
      expect(binom[i]).toBeCloseTo(binomialPMF(ks[i], 40, 0.3) as number, 12);
    }
    expect(geom[0]).toBeCloseTo(geometricPMF(1, 0.25) as number, 12);
    expect(bern[1]).toBeCloseTo(0.7, 12);
  });
});
