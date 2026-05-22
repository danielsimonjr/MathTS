import { describe, it, expect } from 'vitest';
import { parallelCount } from '../../src/operations/map.js';

describe('parallelCount (no predicate)', () => {
  it('should count all elements without predicate', async () => {
    const data = new Float64Array([1, 2, 3, 4, 5]);
    const result = await parallelCount(data);
    // Without predicate, returns length directly as ParallelResult
    expect(result).toHaveProperty('result');
    expect((result as any).result).toBe(5);
  });

  it('should handle empty array', async () => {
    const data = new Float64Array([]);
    const result = await parallelCount(data);
    expect((result as any).result).toBe(0);
  });

  it('should return ParallelResult shape', async () => {
    const data = new Float64Array([1, 2]);
    const result = await parallelCount(data);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('chunks');
    expect(result).toHaveProperty('parallelized');
  });
});
