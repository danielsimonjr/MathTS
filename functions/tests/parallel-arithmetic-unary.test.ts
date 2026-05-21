/**
 * Correctness tests: parallel Float64Array overloads vs scalar for
 * arithmetic unary functions added in this sprint.
 *
 * Pattern follows special.test.ts: initialize computePool, lower the threshold
 * so the worker path is exercised, assert element-wise match against the scalar
 * overload, then restore defaults.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tanh } from '../src/typed/arithmetic.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

describe('Parallel Float64Array overloads — arithmetic unary (tanh)', () => {
  beforeAll(async () => {
    await computePool.initialize();
    // Lower threshold to ensure the worker path is exercised.
    computePool.updateConfig({ thresholdElements: 64, chunkSize: 256 });
  });

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  });

  // A sample of indices checked element-wise against the scalar overload.
  const sample = [0, 1, 7, 49, 99, 173, 249];

  it('tanh Float64Array matches scalar overload element-wise', async () => {
    // 250 values > threshold of 64, so the worker path is taken.
    const xs = Float64Array.from({ length: 250 }, (_, i) => -5 + i * 0.04);
    const result = await (tanh(xs) as Promise<Float64Array>);
    expect(result.length).toBe(250);
    for (const i of sample) {
      expect(result[i]).toBeCloseTo(tanh(xs[i]) as number, 12);
    }
  });
});
