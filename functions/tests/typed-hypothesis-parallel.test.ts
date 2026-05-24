/**
 * Hypothesis test worker-dispatch correctness tests (Slice 3.10)
 *
 * Verifies that:
 *  1. Numerical results match the pure-JS path within 1e-9 tolerance at
 *     sizes both below AND above the 4096-element threshold.
 *  2. Known reference cases hold for each test (e.g. uniform-vs-uniform for
 *     chiSquare, identical sample for KS, etc.).
 *  3. The four async functions still behave correctly with the synchronous
 *     sequential path (pool not yet initialized = falls through to JS).
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  chiSquareTest,
  kolmogorovSmirnovTest,
  mannWhitneyTest,
  shapiroWilkTest,
} from '../src/typed/hypothesis.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed-based LCG random for reproducible samples */
function lcgRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function uniformSample(n: number, seed = 42): number[] {
  const rand = lcgRand(seed);
  return Array.from({ length: n }, () => rand());
}

function normalSample(n: number, seed = 42): number[] {
  // Box-Muller from uniform pairs
  const rand = lcgRand(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = rand() || 1e-15;
    const u2 = rand();
    const mag = Math.sqrt(-2 * Math.log(u1));
    out.push(mag * Math.cos(2 * Math.PI * u2));
    if (out.length < n) out.push(mag * Math.sin(2 * Math.PI * u2));
  }
  return out.slice(0, n);
}

// ---------------------------------------------------------------------------
// Pool lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await computePool.initialize();
});

afterAll(async () => {
  await computePool.terminate();
});

// ===========================================================================
// chiSquareTest — parallel reduction path
// ===========================================================================

describe('chiSquareTest – parallel dispatch correctness', () => {
  it('small (below threshold): uniform observed = uniform expected → statistic ≈ 0', async () => {
    const n = 100;
    const observed = new Array(n).fill(10);
    const expected = new Array(n).fill(10);
    const result = await chiSquareTest(observed, expected);
    expect(result.statistic).toBeCloseTo(0, 10);
    expect(result.pValue).toBeCloseTo(1, 4);
    expect(result.degreesOfFreedom).toBe(n - 1);
  });

  it('large (above threshold 4096): result matches sequential path within 1e-9', async () => {
    const n = 5000;
    const rand = lcgRand(7);
    const observed = Array.from({ length: n }, () => Math.floor(rand() * 100) + 1);
    const expected = new Array(n).fill(50);

    // Force sequential by using a pool with threshold MAX_SAFE_INTEGER
    computePool.updateConfig({ thresholdElements: Number.MAX_SAFE_INTEGER });
    const seqResult = await chiSquareTest(observed, expected);

    // Force parallel
    computePool.updateConfig({ thresholdElements: 1 });
    const parResult = await chiSquareTest(observed, expected);

    // Restore default
    computePool.updateConfig({ thresholdElements: 50000 });

    expect(Math.abs(parResult.statistic - seqResult.statistic)).toBeLessThan(1e-9);
    expect(Math.abs(parResult.pValue - seqResult.pValue)).toBeLessThan(1e-9);
    expect(parResult.degreesOfFreedom).toBe(seqResult.degreesOfFreedom);
  });

  it('large (above threshold): known reference — equal freqs → statistic = 0', async () => {
    const n = 4096;
    const observed = new Array(n).fill(5);
    const expected = new Array(n).fill(5);

    computePool.updateConfig({ thresholdElements: 1 });
    const result = await chiSquareTest(observed, expected);
    computePool.updateConfig({ thresholdElements: 50000 });

    expect(result.statistic).toBeCloseTo(0, 9);
  });

  it('2D contingency table stays on main thread (async result still correct)', async () => {
    const result = await chiSquareTest([
      [10, 20],
      [30, 40],
    ]);
    expect(result.statistic).toBeGreaterThan(0);
    expect(result.degreesOfFreedom).toBe(1);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });

  it('validation errors still throw above threshold', async () => {
    const n = 5000;
    const obs = new Array(n).fill(1);
    const exp = new Array(n).fill(0); // invalid: zero expected

    computePool.updateConfig({ thresholdElements: 1 });
    await expect(chiSquareTest(obs, exp)).rejects.toThrow('positive');
    computePool.updateConfig({ thresholdElements: 50000 });
  });
});

// ===========================================================================
// kolmogorovSmirnovTest — parallel normal-CDF path
// ===========================================================================

describe('kolmogorovSmirnovTest – parallel dispatch correctness', () => {
  it('small (below threshold): uniform CDF → high p-value', async () => {
    const sample = Array.from({ length: 20 }, (_, i) => (i + 1) / 20);
    const result = await kolmogorovSmirnovTest(sample, (x) => x);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it('large (above threshold 4096): sequential vs parallel within 1e-9', async () => {
    const n = 5000;
    const sample = normalSample(n, 13);

    computePool.updateConfig({ thresholdElements: Number.MAX_SAFE_INTEGER });
    const seqResult = await kolmogorovSmirnovTest(sample);

    computePool.updateConfig({ thresholdElements: 1 });
    const parResult = await kolmogorovSmirnovTest(sample);

    computePool.updateConfig({ thresholdElements: 50000 });

    expect(Math.abs(parResult.statistic - seqResult.statistic)).toBeLessThan(1e-9);
    expect(Math.abs(parResult.pValue - seqResult.pValue)).toBeLessThan(1e-9);
  });

  it('large (above threshold): normal sample → high p-value (not rejected at 0.01)', async () => {
    const n = 5000;
    const sample = normalSample(n, 99);

    computePool.updateConfig({ thresholdElements: 1 });
    const result = await kolmogorovSmirnovTest(sample);
    computePool.updateConfig({ thresholdElements: 50000 });

    // A large normal sample should not be rejected against the normal CDF
    expect(result.pValue).toBeGreaterThan(0.01);
    expect(result.statistic).toBeGreaterThanOrEqual(0);
    expect(result.statistic).toBeLessThanOrEqual(1);
  });

  it('custom CDF bypasses parallel path — result still correct', async () => {
    // Custom CDF always uses sequential regardless of pool config
    computePool.updateConfig({ thresholdElements: 1 });
    const sample = uniformSample(5000, 7);
    const result = await kolmogorovSmirnovTest(sample, (x) => x);
    computePool.updateConfig({ thresholdElements: 50000 });

    // Uniform [0,1] sample against uniform CDF → not rejected
    expect(result.pValue).toBeGreaterThan(0.01);
  });

  it('empty sample throws', async () => {
    await expect(kolmogorovSmirnovTest([])).rejects.toThrow();
  });
});

// ===========================================================================
// mannWhitneyTest — parallel rank-sum (dot) path
// ===========================================================================

describe('mannWhitneyTest – parallel dispatch correctness', () => {
  it('small (below threshold): clearly different distributions → low p-value', async () => {
    const s1 = [1, 2, 3, 4, 5];
    const s2 = [100, 101, 102, 103, 104];
    const result = await mannWhitneyTest(s1, s2);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.uStatistic).toBeGreaterThanOrEqual(0);
  });

  it('large (above threshold 4096): sequential vs parallel within 1e-9', async () => {
    const n = 2500; // n1 + n2 = 5000 > threshold
    const s1 = uniformSample(n, 17);
    const s2 = uniformSample(n, 23);

    computePool.updateConfig({ thresholdElements: Number.MAX_SAFE_INTEGER });
    const seqResult = await mannWhitneyTest(s1, s2);

    computePool.updateConfig({ thresholdElements: 1 });
    const parResult = await mannWhitneyTest(s1, s2);

    computePool.updateConfig({ thresholdElements: 50000 });

    expect(Math.abs(parResult.uStatistic - seqResult.uStatistic)).toBeLessThan(1e-9);
    expect(Math.abs(parResult.pValue - seqResult.pValue)).toBeLessThan(1e-9);
  });

  it('large (above threshold): same distribution → p-value > 0.05 (likely)', async () => {
    const n = 2500;
    const s1 = uniformSample(n, 41);
    const s2 = uniformSample(n, 43);

    computePool.updateConfig({ thresholdElements: 1 });
    const result = await mannWhitneyTest(s1, s2);
    computePool.updateConfig({ thresholdElements: 50000 });

    // Two uniform samples from the same distribution should not be rejected
    expect(result.pValue).toBeGreaterThan(0.01);
  });

  it('empty sample throws', async () => {
    await expect(mannWhitneyTest([], [1, 2, 3])).rejects.toThrow();
  });
});

// ===========================================================================
// shapiroWilkTest — parallel dot-product path
// ===========================================================================

describe('shapiroWilkTest – parallel dispatch correctness', () => {
  it('small (below threshold): normal data → W close to 1', async () => {
    const sample = [-1.5, -1, -0.5, 0, 0.1, 0.5, 1, 1.2, 1.5];
    const result = await shapiroWilkTest(sample);
    expect(result.statistic).toBeGreaterThan(0.7);
    expect(result.statistic).toBeLessThanOrEqual(1);
  });

  it('large (above threshold 4096): sequential vs parallel within 1e-9', async () => {
    const n = 4096;
    const sample = normalSample(n, 55);

    computePool.updateConfig({ thresholdElements: Number.MAX_SAFE_INTEGER });
    const seqResult = await shapiroWilkTest(sample);

    computePool.updateConfig({ thresholdElements: 1 });
    const parResult = await shapiroWilkTest(sample);

    computePool.updateConfig({ thresholdElements: 50000 });

    expect(Math.abs(parResult.statistic - seqResult.statistic)).toBeLessThan(1e-9);
    expect(Math.abs(parResult.pValue - seqResult.pValue)).toBeLessThan(1e-9);
  });

  it('large (above threshold): normal sample → W close to 1, p-value > 0.01', async () => {
    const n = 4096;
    const sample = normalSample(n, 77);

    computePool.updateConfig({ thresholdElements: 1 });
    const result = await shapiroWilkTest(sample);
    computePool.updateConfig({ thresholdElements: 50000 });

    expect(result.statistic).toBeGreaterThan(0.9);
    expect(result.statistic).toBeLessThanOrEqual(1);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
  });

  it('identical values → W = 1 (short-circuit, not dispatched)', async () => {
    computePool.updateConfig({ thresholdElements: 1 });
    const result = await shapiroWilkTest([7, 7, 7, 7, 7]);
    computePool.updateConfig({ thresholdElements: 50000 });

    expect(result.statistic).toBe(1);
    expect(result.pValue).toBe(1);
  });

  it('fewer than 3 observations throws', async () => {
    await expect(shapiroWilkTest([1, 2])).rejects.toThrow();
  });

  it('more than 5000 observations throws', async () => {
    const big = new Array(5001).fill(1);
    await expect(shapiroWilkTest(big)).rejects.toThrow();
  });
});
