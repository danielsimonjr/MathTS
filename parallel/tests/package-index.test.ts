/**
 * Smoke test for parallel/src/index.ts (package entry barrel)
 *
 * Asserts that a representative sample of named exports from the public
 * API are present and have the expected types.
 */
import { describe, it, expect } from 'vitest';
import * as par from '../src/index.js';

describe('parallel/src/index.ts – package entry smoke test', () => {
  it('exports ComputePool as a constructor and computePool as an instance', () => {
    expect(typeof par.ComputePool).toBe('function');
    expect(par.computePool).toBeDefined();
  });

  it('exports Transfer helper and DEFAULT_POOL_CONFIG', () => {
    expect(typeof par.Transfer).toBe('function');
    expect(par.DEFAULT_POOL_CONFIG).toBeDefined();
  });

  it('exports resolveOpThreshold as a function', () => {
    expect(typeof par.resolveOpThreshold).toBe('function');
  });

  it('exports core parallel matrix operation functions', () => {
    expect(typeof par.parallelMatmul).toBe('function');
    expect(typeof par.parallelAdd).toBe('function');
    expect(typeof par.parallelSum).toBe('function');
    expect(typeof par.parallelMap).toBe('function');
  });

  it('exports chunking strategy helpers', () => {
    expect(typeof par.chunkFloat64Array).toBe('function');
    expect(typeof par.calculateOptimalChunks).toBe('function');
    expect(typeof par.shouldParallelize).toBe('function');
    expect(typeof par.dispatch).toBe('function');
  });

  it('exports bitwise operation functions', () => {
    expect(typeof par.bitAnd).toBe('function');
    expect(typeof par.bitOr).toBe('function');
    expect(typeof par.bitXor).toBe('function');
  });
});
