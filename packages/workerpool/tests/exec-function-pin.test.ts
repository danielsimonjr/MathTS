import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MathWorkerPool } from '../src/index.js';

describe('MathWorkerPool.execFunction pins', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    pool = new MathWorkerPool({ maxWorkers: 1, parallelThreshold: 1_000_000 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate(true);
  });

  it('throws when pool is not initialized', async () => {
    const fresh = new MathWorkerPool();
    await expect(fresh.execFunction((x: number) => x + 1, 1)).rejects.toThrow(
      'WorkerPool not initialized. Call initialize() first.'
    );
  });

  it('returns the function result', async () => {
    const out = await pool.execFunction((x: number) => x * 3, 7);
    expect(out).toBe(21);
  });

  it('rejects when the worker function throws', async () => {
    await expect(
      pool.execFunction(() => {
        throw new Error('execFunction fail');
      }, null)
    ).rejects.toThrow('execFunction fail');
  });
});
