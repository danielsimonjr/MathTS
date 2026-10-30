import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MathWorkerPool } from '../src/index.js';

describe('MathWorkerPool.exec / execFunction pins (P6-6 _timedExec)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    pool = new MathWorkerPool({ maxWorkers: 1, parallelThreshold: 1_000_000 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate(true);
  });

  beforeEach(() => {
    pool.resetMetrics();
  });

  const counts = (p: MathWorkerPool = pool): { executed: number; failed: number } => {
    const m = p.enhancedStats().metrics;
    return { executed: m.totalTasksExecuted, failed: m.totalTasksFailed };
  };

  it('throws when pool is not initialized, before any metric is recorded', async () => {
    const fresh = new MathWorkerPool();
    await expect(fresh.execFunction((x: number) => x + 1, 1)).rejects.toThrow(
      'WorkerPool not initialized. Call initialize() first.'
    );
    await expect(fresh.exec('mapChunk', [[1], '(x) => x'])).rejects.toThrow(
      'WorkerPool not initialized. Call initialize() first.'
    );
    expect(counts(fresh)).toEqual({ executed: 0, failed: 0 });
  });

  it('returns the function result and counts one executed task', async () => {
    const out = await pool.execFunction((x: number) => x * 3, 7);
    expect(out).toBe(21);
    expect(counts()).toEqual({ executed: 1, failed: 0 });
  });

  it('rejects when the worker function throws and counts one failed task', async () => {
    await expect(
      pool.execFunction(() => {
        throw new Error('execFunction fail');
      }, null)
    ).rejects.toThrow('execFunction fail');
    expect(counts()).toEqual({ executed: 1, failed: 1 });
  });

  // A timeout terminates the worker that ran the task, so each timeout test owns a pool.
  async function withOwnPool(body: (own: MathWorkerPool) => Promise<void>): Promise<void> {
    const own = new MathWorkerPool({ maxWorkers: 1, parallelThreshold: 1_000_000 });
    await own.initialize();
    try {
      await body(own);
    } finally {
      await own.terminate(true);
    }
  }

  it('execFunction honours options.taskTimeout and counts the timeout as a failure', async () => {
    await withOwnPool(async (own) => {
      const sleep = async (ms: number): Promise<number> => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return ms;
      };
      const started = performance.now();
      await expect(own.execFunction(sleep, 5000, { taskTimeout: 40 })).rejects.toThrow(
        /timed out/i
      );
      expect(performance.now() - started).toBeLessThan(2000);
      expect(counts(own)).toEqual({ executed: 1, failed: 1 });
    });
  });

  it('exec runs a named worker method and counts one executed task', async () => {
    const out = await pool.exec<number[]>('mapChunk', [[1, 2, 3], '(x) => x * 2']);
    expect(out).toEqual([2, 4, 6]);
    expect(counts()).toEqual({ executed: 1, failed: 0 });
  });

  it('exec rejects on an unknown method and counts one failed task', async () => {
    await expect(pool.exec('noSuchWorkerMethod', [])).rejects.toThrow();
    expect(counts()).toEqual({ executed: 1, failed: 1 });
  });

  it('exec honours options.taskTimeout over the pool default', async () => {
    await withOwnPool(async (own) => {
      const fnString = '(x) => { const e = Date.now() + 200; while (Date.now() < e) {} return x; }';
      await expect(own.exec('mapChunk', [[1], fnString], { taskTimeout: 30 })).rejects.toThrow(
        /timed out/i
      );
      expect(counts(own)).toEqual({ executed: 1, failed: 1 });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
  });
});
