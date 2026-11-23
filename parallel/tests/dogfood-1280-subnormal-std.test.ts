/**
 * Dogfood #1280 - the pool `variance` result took `std` as `Math.sqrt(variance)`. For data of order
 * 1e-160 the sum of squared deviations is subnormal, so it lost digits (1e-160 gave 9.99994e-161).
 * For data of order 1e200 the sum overflowed (the std was Infinity). The sequential path and the
 * worker path now give the std of the data divided by an exact power of 2 when the sum is outside
 * the range in which every digit is kept.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';

const EPS4 = 4 * Number.EPSILON;
const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

describe('ComputePool.variance: std for subnormal and overflowing squares', () => {
  let pool: ComputePool;
  beforeAll(async () => {
    pool = new ComputePool({ maxWorkers: 2, chunkSize: 4 });
    await pool.initialize();
  }, 60_000);
  afterAll(async () => {
    await pool.terminate();
  });

  it('sequential path: std of [1e-160, 3e-160] is 1e-160 (9.99994e-161 before)', async () => {
    const r = await pool.variance(new Float64Array([1e-160, 3e-160]), { forceSequential: true });
    expect(r.parallelized).toBe(false);
    expect(rel(r.result.std, 1e-160)).toBeLessThan(EPS4);
  });

  it('worker path: the same data on workers', async () => {
    const r = await pool.variance(new Float64Array([1e-160, 3e-160, 1e-160, 3e-160]), {
      forceParallel: true,
    });
    expect(r.parallelized).toBe(true);
    expect(rel(r.result.std, 1e-160)).toBeLessThan(EPS4);
  });

  it('overflow: std of [1e200, 3e200] is 1e200 (Infinity before)', async () => {
    const x = new Float64Array([1e200, 3e200]);
    const seq = await pool.variance(x, { forceSequential: true });
    expect(rel(seq.result.std, 1e200)).toBeLessThan(EPS4);
    const par = await pool.variance(new Float64Array([1e200, 3e200, 1e200, 3e200]), {
      forceParallel: true,
    });
    expect(rel(par.result.std, 1e200)).toBeLessThan(EPS4);
  });

  it('GUARD: ordinary data keeps its present bits', async () => {
    const r = await pool.variance(new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]), {
      forceSequential: true,
    });
    expect(r.result.variance).toBe(4);
    expect(r.result.std).toBe(2);
  });
});
