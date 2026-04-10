/**
 * Distribution Objects Tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalDist,
  betaDist,
  binomialDist,
  chiSquaredDist,
  exponentialDist,
  fDist,
  gammaDist,
  logNormalDist,
  poissonDist,
  tDist,
  uniformDist,
  weibullDist,
} from '../src/typed/dist-objects.js';

describe('Distribution Objects', () => {
  // ===========================================================================
  // normalDist
  // ===========================================================================
  describe('normalDist', () => {
    const d = normalDist(0, 1);

    it('should have correct mean and variance', () => {
      expect(d.mean).toBe(0);
      expect(d.variance).toBe(1);
    });

    it('pdf at mean should be ~0.3989', () => {
      expect(d.pdf(0)).toBeCloseTo(0.39894228, 5);
    });

    it('cdf at 0 should be 0.5', () => {
      expect(d.cdf(0)).toBeCloseTo(0.5, 5);
    });

    it('cdf at 1.96 should be ~0.975', () => {
      expect(d.cdf(1.96)).toBeCloseTo(0.975, 2);
    });

    it('quantile(0.5) should be 0', () => {
      expect(d.quantile(0.5)).toBeCloseTo(0, 3);
    });

    it('quantile(0.975) should be ~1.96', () => {
      expect(d.quantile(0.975)).toBeCloseTo(1.96, 1);
    });

    it('should support custom mu and sigma', () => {
      const d2 = normalDist(10, 2);
      expect(d2.mean).toBe(10);
      expect(d2.variance).toBe(4);
      expect(d2.cdf(10)).toBeCloseTo(0.5, 5);
    });

    it('sample should return a number', () => {
      expect(typeof d.sample()).toBe('number');
    });

    it('should throw for sigma <= 0', () => {
      expect(() => normalDist(0, 0)).toThrow();
    });
  });

  // ===========================================================================
  // betaDist
  // ===========================================================================
  describe('betaDist', () => {
    const d = betaDist(2, 5);

    it('should have correct mean', () => {
      expect(d.mean).toBeCloseTo(2 / 7, 5);
    });

    it('pdf should be 0 outside [0,1]', () => {
      expect(d.pdf(-0.1)).toBe(0);
      expect(d.pdf(1.1)).toBe(0);
    });

    it('cdf(0) = 0 and cdf(1) = 1', () => {
      expect(d.cdf(0)).toBe(0);
      expect(d.cdf(1)).toBe(1);
    });

    it('quantile should invert cdf', () => {
      const p = 0.5;
      const x = d.quantile(p);
      expect(d.cdf(x)).toBeCloseTo(p, 2);
    });

    it('should throw for non-positive params', () => {
      expect(() => betaDist(0, 1)).toThrow();
    });
  });

  // ===========================================================================
  // binomialDist
  // ===========================================================================
  describe('binomialDist', () => {
    const d = binomialDist(10, 0.5);

    it('should have correct mean', () => {
      expect(d.mean).toBe(5);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBe(2.5);
    });

    it('pdf(5) should be the mode', () => {
      expect(d.pdf(5)).toBeCloseTo(0.24609375, 5);
    });

    it('pdf should return 0 for non-integer', () => {
      expect(d.pdf(1.5)).toBe(0);
    });

    it('cdf(10) should be 1', () => {
      expect(d.cdf(10)).toBeCloseTo(1, 10);
    });

    it('quantile should return integer', () => {
      expect(Number.isInteger(d.quantile(0.5))).toBe(true);
    });

    it('should throw for invalid p', () => {
      expect(() => binomialDist(10, 1.5)).toThrow();
    });
  });

  // ===========================================================================
  // chiSquaredDist
  // ===========================================================================
  describe('chiSquaredDist', () => {
    const d = chiSquaredDist(3);

    it('should have correct mean', () => {
      expect(d.mean).toBe(3);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBe(6);
    });

    it('cdf(0) should be 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('cdf should increase with x', () => {
      expect(d.cdf(1)).toBeLessThan(d.cdf(5));
    });

    it('pdf should be non-negative', () => {
      expect(d.pdf(1)).toBeGreaterThan(0);
      expect(d.pdf(-1)).toBe(0);
    });

    it('should throw for k <= 0', () => {
      expect(() => chiSquaredDist(0)).toThrow();
    });
  });

  // ===========================================================================
  // exponentialDist
  // ===========================================================================
  describe('exponentialDist', () => {
    const d = exponentialDist(2);

    it('should have correct mean', () => {
      expect(d.mean).toBe(0.5);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBe(0.25);
    });

    it('pdf(0) = lambda', () => {
      expect(d.pdf(0)).toBe(2);
    });

    it('cdf(0) = 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('quantile should invert cdf', () => {
      const x = d.quantile(0.5);
      expect(d.cdf(x)).toBeCloseTo(0.5, 5);
    });

    it('should throw for lambda <= 0', () => {
      expect(() => exponentialDist(0)).toThrow();
    });
  });

  // ===========================================================================
  // fDist
  // ===========================================================================
  describe('fDist', () => {
    const d = fDist(5, 10);

    it('should have correct mean', () => {
      expect(d.mean).toBeCloseTo(10 / 8, 5);
    });

    it('pdf should be non-negative', () => {
      expect(d.pdf(1)).toBeGreaterThan(0);
      expect(d.pdf(-1)).toBe(0);
    });

    it('cdf(0) should be 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('should throw for non-positive dof', () => {
      expect(() => fDist(0, 10)).toThrow();
    });
  });

  // ===========================================================================
  // gammaDist
  // ===========================================================================
  describe('gammaDist', () => {
    const d = gammaDist(2, 1);

    it('should have correct mean', () => {
      expect(d.mean).toBe(2);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBe(2);
    });

    it('pdf should be non-negative', () => {
      expect(d.pdf(1)).toBeGreaterThan(0);
      expect(d.pdf(-1)).toBe(0);
    });

    it('cdf(0) should be 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('should throw for non-positive params', () => {
      expect(() => gammaDist(0, 1)).toThrow();
    });
  });

  // ===========================================================================
  // logNormalDist
  // ===========================================================================
  describe('logNormalDist', () => {
    const d = logNormalDist(0, 1);

    it('should have correct mean', () => {
      expect(d.mean).toBeCloseTo(Math.exp(0.5), 5);
    });

    it('pdf should be 0 for x <= 0', () => {
      expect(d.pdf(0)).toBe(0);
      expect(d.pdf(-1)).toBe(0);
    });

    it('cdf(0) should be 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('quantile should invert cdf', () => {
      const x = d.quantile(0.5);
      expect(d.cdf(x)).toBeCloseTo(0.5, 2);
    });
  });

  // ===========================================================================
  // poissonDist
  // ===========================================================================
  describe('poissonDist', () => {
    const d = poissonDist(5);

    it('should have correct mean', () => {
      expect(d.mean).toBe(5);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBe(5);
    });

    it('pdf(5) should be positive', () => {
      expect(d.pdf(5)).toBeGreaterThan(0);
    });

    it('pdf should return 0 for non-integer', () => {
      expect(d.pdf(1.5)).toBe(0);
    });

    it('cdf should be monotone', () => {
      expect(d.cdf(3)).toBeLessThan(d.cdf(7));
    });

    it('should throw for lambda <= 0', () => {
      expect(() => poissonDist(0)).toThrow();
    });
  });

  // ===========================================================================
  // tDist
  // ===========================================================================
  describe('tDist', () => {
    const d = tDist(10);

    it('should have mean 0', () => {
      expect(d.mean).toBe(0);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBeCloseTo(10 / 8, 5);
    });

    it('pdf should be symmetric', () => {
      expect(d.pdf(1)).toBeCloseTo(d.pdf(-1), 10);
    });

    it('cdf(0) should be 0.5', () => {
      expect(d.cdf(0)).toBeCloseTo(0.5, 3);
    });

    it('quantile(0.5) should be ~0', () => {
      expect(d.quantile(0.5)).toBeCloseTo(0, 3);
    });

    it('should throw for nu <= 0', () => {
      expect(() => tDist(0)).toThrow();
    });
  });

  // ===========================================================================
  // uniformDist
  // ===========================================================================
  describe('uniformDist', () => {
    const d = uniformDist(0, 10);

    it('should have correct mean', () => {
      expect(d.mean).toBe(5);
    });

    it('should have correct variance', () => {
      expect(d.variance).toBeCloseTo(100 / 12, 5);
    });

    it('pdf should be 1/range inside', () => {
      expect(d.pdf(5)).toBe(0.1);
    });

    it('pdf should be 0 outside', () => {
      expect(d.pdf(-1)).toBe(0);
      expect(d.pdf(11)).toBe(0);
    });

    it('cdf should be linear', () => {
      expect(d.cdf(5)).toBeCloseTo(0.5, 10);
    });

    it('quantile should invert cdf', () => {
      expect(d.quantile(0.5)).toBeCloseTo(5, 10);
    });

    it('should throw for b <= a', () => {
      expect(() => uniformDist(5, 5)).toThrow();
    });
  });

  // ===========================================================================
  // weibullDist
  // ===========================================================================
  describe('weibullDist', () => {
    const d = weibullDist(2, 1);

    it('should have positive mean', () => {
      expect(d.mean).toBeGreaterThan(0);
    });

    it('pdf should be 0 for x < 0', () => {
      expect(d.pdf(-1)).toBe(0);
    });

    it('cdf(0) should be 0', () => {
      expect(d.cdf(0)).toBe(0);
    });

    it('quantile should invert cdf', () => {
      const x = d.quantile(0.5);
      expect(d.cdf(x)).toBeCloseTo(0.5, 5);
    });

    it('should throw for non-positive params', () => {
      expect(() => weibullDist(0, 1)).toThrow();
    });
  });
});
