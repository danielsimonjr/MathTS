import { describe, it, expect } from 'vitest';
import { parallelCount } from '../../src/operations/map.js';

describe('parallelCount', () => {
  it('should return data.length when no predicate', async () => {
    const data = [1, 2, 3, 4, 5];
    const result = await parallelCount(data);
    expect(result.result).toBe(5);
    expect(result.duration).toBe(0);
    expect(result.chunks).toBe(1);
    expect(result.parallelized).toBe(false);
  });

  it('should return 0 for empty array without predicate', async () => {
    const result = await parallelCount([]);
    expect(result.result).toBe(0);
  });
});
