import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDeterministic } from '@danielsimonjr/mathts-core';
import { computePool } from '../src/index.js';

afterEach(() => {
  setDeterministic(false);
  vi.restoreAllMocks();
});

describe('ComputePool.shouldParallelize in deterministic mode', () => {
  it('returns false even when forced', () => {
    const pool = (computePool as unknown as { workerPool: { isReady(): boolean } }).workerPool;
    vi.spyOn(pool, 'isReady').mockReturnValue(true);
    // Off: forceParallel on a ready pool parallelizes (liveness of the gate below).
    expect(computePool.shouldParallelize(1e9, 'sum', { forceParallel: true })).toBe(true);
    setDeterministic(true);
    expect(computePool.shouldParallelize(1e9, 'sum', { forceParallel: true })).toBe(false);
    expect(computePool.shouldParallelize(1e9, 'sum')).toBe(false);
    expect(computePool.shouldParallelize(1e9)).toBe(false);
  });
});
