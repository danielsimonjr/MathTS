/**
 * Coverage tests for functions/src/typed/integration.ts.
 *
 * The existing integration suite never initialises the compute pool, so every
 * worker-dispatch branch (`computePool.isReady() === false` everywhere) stays
 * uncovered. This file initialises the pool and drives:
 *   - trapzF64 / simpsonF64 worker-summation paths (length >= ARRAY_WORKER_THRESHOLD)
 *   - gaussQuad dot-product offload (totalPoints >= GAUSS_WORKER_THRESHOLD)
 *   - gaussQuad / romberg sub-domain fan-out (workerCount > 1)
 *   - romberg deep-iteration worker-sum path and the non-convergence return
 *   - validateClosureSource rejection cases (async + outer-scope capture)
 *
 * Results are cross-checked against the analytic value or the sequential path,
 * so this is real correctness coverage, not branch-hitting.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  trapzF64,
  simpsonF64,
  gaussQuad,
  romberg,
  validateClosureSource,
  ARRAY_WORKER_THRESHOLD,
  GAUSS_WORKER_THRESHOLD,
} from '../src/typed/integration.js';

describe('integration — closure validation', () => {
  it('accepts a self-contained arrow closure', () => {
    expect(() => validateClosureSource('(x) => Math.sin(x) * x + 2')).not.toThrow();
  });

  it('accepts a classic function expression', () => {
    expect(() => validateClosureSource('function (x) { return x * x; }')).not.toThrow();
  });

  it('rejects async closures', () => {
    expect(() => validateClosureSource('async (x) => x')).toThrow(/async closures/);
  });

  it('rejects closures capturing an outer-scope identifier', () => {
    expect(() => validateClosureSource('(x) => x * outerScale')).toThrow(/outer-scope identifier/);
  });

  it('thresholds are exported with expected values', () => {
    expect(GAUSS_WORKER_THRESHOLD).toBe(64);
    expect(ARRAY_WORKER_THRESHOLD).toBe(65_536);
  });
});

describe('integration — worker-dispatch paths (pool initialised)', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  it('trapzF64 offloads summation for arrays >= ARRAY_WORKER_THRESHOLD', async () => {
    const n = ARRAY_WORKER_THRESHOLD + 1; // ensures terms.length >= threshold
    const y = new Float64Array(n).fill(2); // constant 2, dx=1 → integral = 2*(n-1)
    const result = await trapzF64(y, 1);
    expect(result).toBeCloseTo(2 * (n - 1), 6);
  });

  it('simpsonF64 offloads summation for arrays >= ARRAY_WORKER_THRESHOLD', async () => {
    // Need odd length (even sub-intervals) and length >= threshold.
    let n = ARRAY_WORKER_THRESHOLD + 1;
    if ((n - 1) % 2 !== 0) n += 1; // make sub-intervals even
    const y = new Float64Array(n).fill(1); // constant 1, dx=1 → integral ≈ (n-1)
    const result = await simpsonF64(y, 1);
    expect(result).toBeCloseTo(n - 1, 4);
  });

  it('gaussQuad composite offloads the dot product (totalPoints >= threshold)', async () => {
    // 64 sub-intervals * order 5 = 320 points >= 64 → pool dot path.
    const result = (await gaussQuad((x) => x * x, 0, 1, 64)) as number;
    expect(result).toBeCloseTo(1 / 3, 8);
  });

  it('gaussQuad fan-out (workerCount > 1) integrates sin over [0, pi]', async () => {
    const result = (await gaussQuad((x) => Math.sin(x), 0, Math.PI, 64, 5, {
      workerCount: 4,
    })) as number;
    expect(result).toBeCloseTo(2, 6);
  });

  it('gaussQuad fan-out rejects an outer-scope-capturing integrand', async () => {
    const scale = 3;
    await expect(async () =>
      gaussQuad((x) => x * scale, 0, 1, 64, 5, { workerCount: 4 })
    ).rejects.toThrow(/outer-scope identifier/);
  });

  it('romberg fan-out (workerCount > 1) integrates sin over [0, pi]', async () => {
    const result = await romberg((x) => Math.sin(x), 0, Math.PI, 1e-10, { workerCount: 4 });
    expect(result).toBeCloseTo(2, 8);
  });

  it('romberg deep-iteration engages the worker-sum path and converges', async () => {
    // A tight tolerance on a smooth integrand pushes Romberg to refine far
    // enough that newPointCount crosses GAUSS_WORKER_THRESHOLD (level >= 7),
    // exercising the pooled-sum branch. exp(x) over [0,1] = e - 1.
    const result = await romberg((x) => Math.exp(x), 0, 1, 1e-14);
    expect(result).toBeCloseTo(Math.E - 1, 10);
  });

  it('romberg returns the best estimate when tolerance is unreachable', async () => {
    // An impossible tolerance (0) forces the loop to run all 20 iterations and
    // hit the final `return R[maxIter-1][maxIter-1]` line. The result is still
    // an excellent approximation of the true integral (cos over [0, pi/2] = 1).
    const result = await romberg((x) => Math.cos(x), 0, Math.PI / 2, 0);
    expect(result).toBeCloseTo(1, 10);
  });
});
