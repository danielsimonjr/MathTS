/**
 * Coverage tests for functions/src/typed/integration.ts.
 *
 * The existing integration suite never initialises the compute pool, so every
 * worker-dispatch branch (`computePool.isReady() === false` everywhere) stays
 * uncovered. This file initialises the pool and drives:
 *   - trapzF64 / simpsonF64 at and above ARRAY_WORKER_THRESHOLD (synchronous)
 *   - gaussQuad composite mode (synchronous)
 *   - parallelGaussQuad / parallelRomberg sub-domain fan-out (workerCount > 1)
 *   - romberg deep iteration and the non-convergence return
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
  parallelGaussQuad,
  parallelRomberg,
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
    expect(computePool.isReady()).toBe(true);
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  it('trapzF64 sums arrays >= ARRAY_WORKER_THRESHOLD', () => {
    const n = ARRAY_WORKER_THRESHOLD + 1; // ensures terms.length >= threshold
    const y = new Float64Array(n).fill(2); // constant 2, dx=1 → integral = 2*(n-1)
    const result = trapzF64(y, 1);
    expect(result).toBeCloseTo(2 * (n - 1), 6);
  });

  it('simpsonF64 sums arrays >= ARRAY_WORKER_THRESHOLD', () => {
    // Need odd length (even sub-intervals) and length >= threshold.
    let n = ARRAY_WORKER_THRESHOLD + 1;
    if ((n - 1) % 2 !== 0) n += 1; // make sub-intervals even
    const y = new Float64Array(n).fill(1); // constant 1, dx=1 → integral ≈ (n-1)
    const result = simpsonF64(y, 1);
    expect(result).toBeCloseTo(n - 1, 4);
  });

  it('gaussQuad composite mode integrates on the calling thread (totalPoints >= threshold)', () => {
    // 64 sub-intervals * order 5 = 320 points >= 64.
    const result = gaussQuad((x) => x * x, 0, 1, 64);
    expect(result).toBeCloseTo(1 / 3, 8);
  });

  it('parallelGaussQuad fan-out (workerCount > 1) integrates sin over [0, pi]', async () => {
    const result = await parallelGaussQuad((x) => Math.sin(x), 0, Math.PI, 64, 5, {
      workerCount: 4,
    });
    expect(result).toBeCloseTo(2, 6);
  });

  it('parallelGaussQuad fan-out rejects an outer-scope-capturing integrand', async () => {
    // Not a literal initializer: Bun's runtime transpiler inlines a `const`
    // literal into the closure, so its source text would no longer name `scale`.
    const scale = Number('3');
    await expect(
      parallelGaussQuad((x) => x * scale, 0, 1, 64, 5, { workerCount: 4 })
    ).rejects.toThrow(/outer-scope identifier/);
  });

  it('parallelRomberg fan-out (workerCount > 1) integrates sin over [0, pi]', async () => {
    const result = await parallelRomberg((x) => Math.sin(x), 0, Math.PI, 1e-10, { workerCount: 4 });
    expect(result).toBeCloseTo(2, 8);
  });

  it('romberg deep iteration converges', () => {
    // A tight tolerance on a smooth integrand pushes Romberg to refine far
    // enough that newPointCount crosses GAUSS_WORKER_THRESHOLD (level >= 7).
    // exp(x) over [0,1] = e - 1.
    const result = romberg((x) => Math.exp(x), 0, 1, 1e-14);
    expect(result).toBeCloseTo(Math.E - 1, 10);
  });

  it('romberg returns the best estimate when tolerance is unreachable', () => {
    // An impossible tolerance (0) forces the loop to run all 20 iterations and
    // hit the final `return R[maxIter-1][maxIter-1]` line. The result is still
    // an excellent approximation of the true integral (cos over [0, pi/2] = 1).
    const result = romberg((x) => Math.cos(x), 0, Math.PI / 2, 0);
    expect(result).toBeCloseTo(1, 10);
  });
});
