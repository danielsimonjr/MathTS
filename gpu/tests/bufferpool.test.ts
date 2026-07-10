import { describe, it, expect } from 'vitest';
import { BufferPool } from '../src/BufferPool.js';
import type { GPUContext } from '../src/GPUContext.js';

const stubContext = {} as GPUContext;

describe('BufferPool (headless)', () => {
  it('reports empty stats before any acquisition', () => {
    // autoEvict:false → no setInterval timer left dangling in the test run
    const pool = new BufferPool(stubContext, { autoEvict: false });
    const stats = pool.getStats();
    expect(stats.totalBuffers).toBe(0);
    expect(stats.inUseBuffers).toBe(0);
    expect(stats.cachedBuffers).toBe(0);
  });
});
