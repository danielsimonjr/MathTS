/**
 * The parallel package re-exports the sequential matmul kernel of the worker pool, and
 * ComputePool.matmul below its threshold gives the same values.
 */
import { describe, it, expect } from 'vitest';
import { matmulSequential, computePool } from '../src/index.js';

describe('matmulSequential (re-export)', () => {
  it('equals ComputePool.matmul on a 2x3 by 3x4 product', async () => {
    const a = Float64Array.of(1, 2, 3, 4, 5, 6);
    const b = Float64Array.of(7, -8, 9, 10, 11, 12, -13, 14, 15, 16, 17, -18);
    const seq = matmulSequential(a, 2, 3, b, 4);
    expect(Array.from(seq)).toEqual([74, 64, 34, -16, 173, 124, 73, 2]);
    const pooled = await computePool.matmul(a, 2, 3, b, 4);
    expect(Array.from(pooled.result)).toEqual(Array.from(seq));
  });
});
