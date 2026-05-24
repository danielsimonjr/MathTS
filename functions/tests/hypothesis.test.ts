/**
 * Statistical Hypothesis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  studentTTest,
  chiSquareTest,
  anova,
  kolmogorovSmirnovTest,
  mannWhitneyTest,
  shapiroWilkTest,
  principalComponentAnalysis,
} from '../src/typed/hypothesis.js';

describe('Statistical Hypothesis Tests', () => {
  // ===========================================================================
  // studentTTest
  // ===========================================================================
  describe('studentTTest', () => {
    it('one-sample test: sample with mean ~0 should have high p-value', () => {
      const sample = [-1, 0, 1, -0.5, 0.5];
      const result = studentTTest(sample);
      expect(result.pValue).toBeGreaterThan(0.5);
      expect(result.degreesOfFreedom).toBe(4);
    });

    it('one-sample test: sample with large mean should have low p-value', () => {
      const sample = [10, 11, 12, 13, 14];
      const result = studentTTest(sample);
      expect(result.pValue).toBeLessThan(0.001);
    });

    it('two-sample test: same distribution should have high p-value', () => {
      const s1 = [1, 2, 3, 4, 5];
      const s2 = [1.5, 2.5, 3.5, 4.5, 5.5];
      const result = studentTTest(s1, s2);
      expect(result.pValue).toBeGreaterThan(0.1);
    });

    it('two-sample test: very different means should have low p-value', () => {
      const s1 = [1, 2, 3, 4, 5];
      const s2 = [100, 101, 102, 103, 104];
      const result = studentTTest(s1, s2);
      expect(result.pValue).toBeLessThan(0.001);
    });

    it('should have statistic and degrees of freedom', () => {
      const result = studentTTest([1, 2, 3], [4, 5, 6]);
      expect(typeof result.statistic).toBe('number');
      expect(result.degreesOfFreedom).toBeGreaterThan(0);
    });

    it('should throw for sample with < 2 elements', () => {
      expect(() => studentTTest([1])).toThrow();
    });
  });

  // ===========================================================================
  // chiSquareTest
  // ===========================================================================
  describe('chiSquareTest', () => {
    it('should detect significant deviation', async () => {
      const result = await chiSquareTest([10, 20, 30], [20, 20, 20]);
      expect(result.statistic).toBe(10);
      expect(result.degreesOfFreedom).toBe(2);
      expect(result.pValue).toBeLessThan(0.01);
    });

    it('should return high p-value for matching frequencies', async () => {
      const result = await chiSquareTest([20, 20, 20], [20, 20, 20]);
      expect(result.statistic).toBe(0);
      expect(result.pValue).toBeCloseTo(1, 5);
    });

    it('should throw for mismatched lengths', async () => {
      await expect(chiSquareTest([1], [1, 2])).rejects.toThrow();
    });

    it('should throw for non-positive expected values', async () => {
      await expect(chiSquareTest([1, 2], [0, 2])).rejects.toThrow();
    });
  });

  // ===========================================================================
  // anova
  // ===========================================================================
  describe('anova', () => {
    it('should detect significant group differences', () => {
      const result = anova([
        [1, 2, 3],
        [10, 11, 12],
        [20, 21, 22],
      ]);
      expect(result.fStatistic).toBeGreaterThan(10);
      expect(result.pValue).toBeLessThan(0.001);
    });

    it('should return high p-value for similar groups', () => {
      const result = anova([
        [1, 2, 3],
        [1.5, 2.5, 3.5],
        [1, 3, 2],
      ]);
      expect(result.pValue).toBeGreaterThan(0.1);
    });

    it('should have correct degrees of freedom', () => {
      const result = anova([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
      expect(result.dfBetween).toBe(2);
      expect(result.dfWithin).toBe(3);
    });

    it('should throw for < 2 groups', () => {
      expect(() => anova([[1, 2, 3]])).toThrow();
    });
  });

  // ===========================================================================
  // kolmogorovSmirnovTest
  // ===========================================================================
  describe('kolmogorovSmirnovTest', () => {
    it('should accept uniform data against uniform CDF', async () => {
      const sample = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      const result = await kolmogorovSmirnovTest(sample, (x) => x);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('should reject non-uniform data against uniform CDF', async () => {
      const sample = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
      const result = await kolmogorovSmirnovTest(sample, (x) => x);
      expect(result.statistic).toBeGreaterThan(0.5);
    });

    it('statistic should be between 0 and 1', async () => {
      const result = await kolmogorovSmirnovTest([1, 2, 3, 4, 5]);
      expect(result.statistic).toBeGreaterThanOrEqual(0);
      expect(result.statistic).toBeLessThanOrEqual(1);
    });

    it('should throw for empty sample', async () => {
      await expect(kolmogorovSmirnovTest([])).rejects.toThrow();
    });
  });

  // ===========================================================================
  // mannWhitneyTest
  // ===========================================================================
  describe('mannWhitneyTest', () => {
    it('should detect different distributions', async () => {
      const s1 = [1, 2, 3, 4, 5];
      const s2 = [10, 11, 12, 13, 14];
      const result = await mannWhitneyTest(s1, s2);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('should accept similar distributions', async () => {
      const s1 = [1, 3, 5, 7, 9];
      const s2 = [2, 4, 6, 8, 10];
      const result = await mannWhitneyTest(s1, s2);
      expect(result.pValue).toBeGreaterThan(0.1);
    });

    it('should return U statistic', async () => {
      const result = await mannWhitneyTest([1, 2, 3], [4, 5, 6]);
      expect(result.uStatistic).toBeGreaterThanOrEqual(0);
    });

    it('should throw for empty samples', async () => {
      await expect(mannWhitneyTest([], [1, 2])).rejects.toThrow();
    });
  });

  // ===========================================================================
  // shapiroWilkTest
  // ===========================================================================
  describe('shapiroWilkTest', () => {
    it('should accept approximately normal data', async () => {
      // Approximately normal sample
      const sample = [-1.5, -1, -0.5, 0, 0.1, 0.5, 1, 1.2, 1.5];
      const result = await shapiroWilkTest(sample);
      expect(result.statistic).toBeGreaterThan(0.7);
      expect(result.statistic).toBeLessThanOrEqual(1);
    });

    it('statistic should be in (0, 1]', async () => {
      const result = await shapiroWilkTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.statistic).toBeGreaterThan(0);
      expect(result.statistic).toBeLessThanOrEqual(1);
    });

    it('should return W=1 for identical values', async () => {
      const result = await shapiroWilkTest([5, 5, 5, 5, 5]);
      expect(result.statistic).toBe(1);
    });

    it('should throw for < 3 observations', async () => {
      await expect(shapiroWilkTest([1, 2])).rejects.toThrow();
    });
  });

  // ===========================================================================
  // principalComponentAnalysis
  // ===========================================================================
  describe('principalComponentAnalysis', () => {
    it('should reduce to k components', () => {
      const data = [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ];
      const result = principalComponentAnalysis(data, 1);
      expect(result.components.length).toBe(1);
      expect(result.explained.length).toBe(1);
      expect(result.scores.length).toBe(4);
      expect(result.scores[0].length).toBe(1);
    });

    it('should explain all variance with full components', () => {
      const data = [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 0],
      ];
      const result = principalComponentAnalysis(data);
      const totalExplained = result.explained.reduce((a, b) => a + b, 0);
      expect(totalExplained).toBeCloseTo(1, 3);
    });

    it('perfectly correlated data should have one dominant component', () => {
      const data = [
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
        [5, 10],
      ];
      const result = principalComponentAnalysis(data, 2);
      expect(result.explained[0]).toBeGreaterThan(0.95);
    });

    it('components should be unit vectors', () => {
      const data = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ];
      const result = principalComponentAnalysis(data);
      for (const comp of result.components) {
        const norm = Math.sqrt(comp.reduce((s, v) => s + v * v, 0));
        expect(norm).toBeCloseTo(1, 5);
      }
    });

    it('should throw for < 2 observations', () => {
      expect(() => principalComponentAnalysis([[1, 2]])).toThrow();
    });
  });
});
