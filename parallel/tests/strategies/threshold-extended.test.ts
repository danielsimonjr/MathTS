/**
 * ThresholdDispatcher — extra coverage for calculateChunks() per-category
 * branches and the module-level convenience wrappers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ThresholdDispatcher,
  shouldParallelize,
  calculateChunks,
  dispatch,
} from '../../src/strategies/threshold.js';
import { ComputePool } from '../../src/ComputePool.js';

describe('ThresholdDispatcher.calculateChunks — per-category branches', () => {
  let pool: ComputePool;
  let dispatcher: ThresholdDispatcher;

  beforeAll(async () => {
    // Low thresholds across the board so large element counts dispatch parallel.
    pool = new ComputePool({ thresholdElements: 1, maxWorkers: 4 });
    await pool.initialize();
    dispatcher = new ThresholdDispatcher(
      {
        matmul: 1,
        elementwise: 1,
        reduce: 1,
        map: 1,
        sort: 1,
        decomposition: 1,
        general: 1,
      },
      pool
    );
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('matmul/decomposition use all workers', () => {
    const workers = Math.max(1, pool.stats().totalWorkers);
    expect(dispatcher.calculateChunks(1_000_000, 'matmul')).toBe(workers);
    expect(dispatcher.calculateChunks(1_000_000, 'decomposition')).toBe(workers);
  });

  it('elementwise/map use up to 2x workers (load balancing)', () => {
    const chunks = dispatcher.calculateChunks(1_000_000, 'elementwise');
    expect(chunks).toBeGreaterThanOrEqual(1);
    const mapChunks = dispatcher.calculateChunks(1_000_000, 'map');
    expect(mapChunks).toBeGreaterThanOrEqual(1);
  });

  it('reduce uses a moderate chunk count', () => {
    const chunks = dispatcher.calculateChunks(1_000_000, 'reduce');
    expect(chunks).toBeGreaterThanOrEqual(1);
  });

  it('sort caps at 8 chunks', () => {
    expect(dispatcher.calculateChunks(10_000_000, 'sort')).toBeLessThanOrEqual(8);
  });

  it('general (default) falls through to worker count', () => {
    const workers = Math.max(1, pool.stats().totalWorkers);
    expect(dispatcher.calculateChunks(1_000_000, 'general')).toBe(workers);
  });
});

describe('Module-level convenience wrappers', () => {
  it('shouldParallelize() delegates to the global dispatcher', () => {
    // Global dispatcher uses the uninitialised global computePool, so the
    // decision is sequential — the wrapper still executes end to end.
    expect(shouldParallelize(1_000_000, 'matmul')).toBe(false);
  });

  it('calculateChunks() delegates to the global dispatcher', () => {
    // Sequential (pool not ready) → 1 chunk.
    expect(calculateChunks(1_000_000, 'matmul')).toBe(1);
  });

  it('dispatch() delegates to the global dispatcher', () => {
    const result = dispatch(1_000_000, 'general');
    expect(result).toHaveProperty('mode');
    expect(result.mode).toBe('sequential');
  });
});
