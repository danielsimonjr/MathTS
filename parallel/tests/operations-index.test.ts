/**
 * Smoke test for parallel/src/operations/index.ts (operations barrel)
 *
 * Asserts that a representative sample of operation exports exist on the
 * imported namespace.
 */
import { describe, it, expect } from 'vitest';
import * as ops from '../src/operations/index.js';

describe('parallel/src/operations/index.ts – barrel smoke test', () => {
  it('exports matrix operation functions', () => {
    expect(typeof ops.parallelMatmul).toBe('function');
    expect(typeof ops.parallelMatvec).toBe('function');
    expect(typeof ops.parallelTranspose).toBe('function');
    expect(typeof ops.parallelOuter).toBe('function');
    expect(typeof ops.parallelDot).toBe('function');
  });

  it('exports element-wise operation functions', () => {
    expect(typeof ops.parallelAdd).toBe('function');
    expect(typeof ops.parallelSubtract).toBe('function');
    expect(typeof ops.parallelMultiply).toBe('function');
    expect(typeof ops.parallelSqrt).toBe('function');
    expect(typeof ops.parallelElementwise).toBe('function');
  });

  it('exports reduction operation functions', () => {
    expect(typeof ops.parallelSum).toBe('function');
    expect(typeof ops.parallelMean).toBe('function');
    expect(typeof ops.parallelMin).toBe('function');
    expect(typeof ops.parallelMax).toBe('function');
    expect(typeof ops.parallelReduce).toBe('function');
  });

  it('exports map/transform operation functions', () => {
    expect(typeof ops.parallelMap).toBe('function');
    expect(typeof ops.parallelFilter).toBe('function');
    expect(typeof ops.parallelSort).toBe('function');
    expect(typeof ops.parallelCount).toBe('function');
  });
});
