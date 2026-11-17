/**
 * The sequential path of the reductions passes a non-array to the core sums, which throw a
 * `TypeError`. A number has no `length`, so a guard on `length` gave a silent `0` (#1011).
 */
import { afterAll, describe, it, expect } from 'vitest';
import { ComputePool } from '../src/index.js';
import { parallelMean, parallelStd, parallelSum, parallelVariance } from '../src/index.js';

const pool = new ComputePool({ maxWorkers: 1 });
afterAll(async () => {
  await pool.terminate(true);
});

describe('reductions reject a non-array on the sequential path (#1011)', () => {
  it('parallelSum(1) throws a TypeError', async () => {
    await expect(parallelSum(1 as never, { pool })).rejects.toThrow(TypeError);
  });
  it('parallelMean(1) throws a TypeError', async () => {
    await expect(parallelMean(1 as never, { pool })).rejects.toThrow(TypeError);
  });
  it('parallelVariance(1) throws a TypeError', async () => {
    await expect(parallelVariance(1 as never, { pool })).rejects.toThrow(TypeError);
  });
  it('parallelStd(1) throws a TypeError', async () => {
    await expect(parallelStd(1 as never, { pool })).rejects.toThrow(TypeError);
  });
  it('an empty array still gives a mean and a variance of 0', async () => {
    const r = await parallelVariance(new Float64Array(0), { pool });
    expect(r.result).toEqual({ mean: 0, variance: 0, std: 0 });
  });
});
