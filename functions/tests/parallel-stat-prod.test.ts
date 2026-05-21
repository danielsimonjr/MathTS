/**
 * Correctness tests for the parallel `parallelStatProd` Float64Array overload.
 *
 * Verifies that the worker-dispatched product reduction matches the sequential
 * result for both the parallel and sequential code paths.  Uses moderate values
 * (all near 1.0) so the product does not overflow or underflow to ±Infinity.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { parallelStatProd } from '../src/typed/statistics.js';

describe('parallelStatProd — Float64Array parallel reduction', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  // ------------------------------------------------------------------
  // Sequential path (pool below threshold)
  // ------------------------------------------------------------------

  it('returns 1 for an empty array', async () => {
    const result = await parallelStatProd(new Float64Array(0));
    expect(result).toBe(1);
  });

  it('returns the single element for a length-1 array', async () => {
    const result = await parallelStatProd(new Float64Array([3.14]));
    expect(result).toBeCloseTo(3.14, 12);
  });

  it('computes the correct product on the sequential fallback path', async () => {
    // Default threshold is 50 000; 10 elements stays sequential.
    const data = new Float64Array([1.1, 1.2, 0.9, 1.05, 0.95, 1.0, 1.15, 0.85, 1.1, 0.9]);
    const expected = data.reduce((acc, v) => acc * v, 1);
    const result = await parallelStatProd(data);
    expect(result).toBeCloseTo(expected, 10);
  });

  it('matches the Array overload (synchronous) result', async () => {
    const values = [1.1, 0.9, 1.2, 0.8, 1.0, 1.05, 0.95, 1.1, 0.9, 1.15];
    const syncResult = parallelStatProd(values) as number;
    const f64Result = await parallelStatProd(new Float64Array(values));
    expect(f64Result).toBeCloseTo(syncResult, 10);
  });

  // ------------------------------------------------------------------
  // Parallel path (force threshold below data length)
  // ------------------------------------------------------------------

  it('parallel product matches sequential product (forced parallel path)', async () => {
    // Build an array of 200 values near 1.0 so the product stays finite.
    const n = 200;
    const data = Float64Array.from({ length: n }, (_, i) => 1 + (i % 5 - 2) * 0.01);

    // Expected: sequential reduction
    const expected = data.reduce((acc, v) => acc * v, 1);

    // Force the parallel path by lowering the threshold below n.
    const originalConfig = computePool.getConfig();
    computePool.updateConfig({ thresholdElements: 50 });

    let parallelResult: number;
    try {
      parallelResult = await parallelStatProd(data);
    } finally {
      // Always restore the original config.
      computePool.updateConfig({ thresholdElements: originalConfig.thresholdElements });
    }

    // Allow a small relative tolerance for floating-point reordering.
    const relErr = Math.abs(parallelResult - expected) / Math.abs(expected);
    expect(relErr).toBeLessThan(1e-10);
  });

  it('parallel and sequential agree on a 500-element near-1 array', async () => {
    const n = 500;
    const data = Float64Array.from({ length: n }, (_, i) => {
      // Alternate slight increments and decrements so the partial products
      // stay well away from overflow / underflow.
      return i % 2 === 0 ? 1.001 : 0.999;
    });

    const seqProduct = data.reduce((acc, v) => acc * v, 1);

    const originalConfig = computePool.getConfig();
    computePool.updateConfig({ thresholdElements: 100, chunkSize: 50 });

    let parProduct: number;
    try {
      parProduct = await parallelStatProd(data);
    } finally {
      computePool.updateConfig({
        thresholdElements: originalConfig.thresholdElements,
        chunkSize: originalConfig.chunkSize,
      });
    }

    const relErr = Math.abs(parProduct - seqProduct) / Math.abs(seqProduct);
    expect(relErr).toBeLessThan(1e-10);
  });
});
