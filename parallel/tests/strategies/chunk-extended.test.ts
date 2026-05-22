import { describe, it, expect } from 'vitest';
import {
  calculateOptimalChunks,
  chunkFloat64Array,
  chunkArray,
  mergeFloat64Chunks,
  mergeArrayChunks,
  shouldParallelize,
  memorySizeBytes,
  partitionRange,
  partition2D,
} from '../../src/strategies/chunk.js';

describe('calculateOptimalChunks', () => {
  it('should return 0 for empty data', () => {
    expect(calculateOptimalChunks(0)).toBe(0);
  });

  it('should return 1 for small data', () => {
    expect(calculateOptimalChunks(100)).toBe(1);
  });

  it('should respect targetChunkSize', () => {
    const chunks = calculateOptimalChunks(10000, { targetChunkSize: 2500, maxChunks: 8 });
    expect(chunks).toBe(4);
  });

  it('should not exceed maxChunks', () => {
    const chunks = calculateOptimalChunks(1000000, { maxChunks: 2, minChunkSize: 100 });
    expect(chunks).toBeLessThanOrEqual(2);
  });
});

describe('chunkFloat64Array', () => {
  it('should return empty for empty array', () => {
    const result = chunkFloat64Array(new Float64Array(0));
    expect(result.chunks).toHaveLength(0);
    expect(result.totalElements).toBe(0);
    expect(result.numChunks).toBe(0);
  });

  it('should return single chunk for small array', () => {
    const data = new Float64Array([1, 2, 3]);
    const result = chunkFloat64Array(data);
    expect(result.numChunks).toBe(1);
    expect(result.chunks[0]).toEqual(data);
  });

  it('should chunk large array balanced', () => {
    const data = new Float64Array(10000);
    const result = chunkFloat64Array(data, { minChunkSize: 2500, maxChunks: 4, balanced: true });
    expect(result.numChunks).toBeGreaterThan(1);
    const totalLength = result.chunks.reduce((s, c) => s + c.length, 0);
    expect(totalLength).toBe(10000);
  });

  it('should chunk large array unbalanced', () => {
    const data = new Float64Array(10000);
    const result = chunkFloat64Array(data, { minChunkSize: 2500, maxChunks: 4, balanced: false });
    expect(result.numChunks).toBeGreaterThan(0);
    const totalLength = result.chunks.reduce((s, c) => s + c.length, 0);
    expect(totalLength).toBe(10000);
  });
});

describe('chunkArray', () => {
  it('should return empty for empty array', () => {
    const result = chunkArray([]);
    expect(result.chunks).toHaveLength(0);
    expect(result.numChunks).toBe(0);
  });

  it('should return single chunk for small array', () => {
    const result = chunkArray([1, 2, 3]);
    expect(result.numChunks).toBe(1);
  });

  it('should chunk large array', () => {
    const data = Array.from({ length: 10000 }, (_, i) => i);
    const result = chunkArray(data, { minChunkSize: 2500, maxChunks: 4, balanced: true });
    expect(result.numChunks).toBeGreaterThan(1);
    const total = result.chunks.reduce((s, c) => s + c.length, 0);
    expect(total).toBe(10000);
  });
});

describe('mergeFloat64Chunks', () => {
  it('should return empty for no chunks', () => {
    expect(mergeFloat64Chunks([])).toEqual(new Float64Array(0));
  });

  it('should return single chunk as-is', () => {
    const c = new Float64Array([1, 2, 3]);
    expect(mergeFloat64Chunks([c])).toBe(c);
  });

  it('should merge multiple chunks', () => {
    const result = mergeFloat64Chunks([new Float64Array([1, 2]), new Float64Array([3, 4])]);
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });
});

describe('mergeArrayChunks', () => {
  it('should return empty for no chunks', () => {
    expect(mergeArrayChunks([])).toEqual([]);
  });

  it('should merge multiple chunks', () => {
    expect(
      mergeArrayChunks([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([1, 2, 3, 4]);
  });
});

describe('shouldParallelize', () => {
  it('should return false below threshold', () => {
    expect(shouldParallelize(100, 10000)).toBe(false);
  });

  it('should return true at threshold', () => {
    expect(shouldParallelize(10000, 10000)).toBe(true);
  });
});

describe('memorySizeBytes', () => {
  it('should return correct byte length', () => {
    expect(memorySizeBytes(new Float64Array(10))).toBe(80);
  });
});

describe('partitionRange', () => {
  it('should return single partition for small range', () => {
    expect(partitionRange(0, 5)).toEqual([[0, 5]]);
  });

  it('should partition large range', () => {
    const result = partitionRange(0, 10000, { minChunkSize: 2500, maxChunks: 4 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0][0]).toBe(0);
    expect(result[result.length - 1][1]).toBe(10000);
  });
});

describe('partition2D', () => {
  it('should partition matrix rows with full column range', () => {
    const result = partition2D(100, 50, { minChunkSize: 10, maxChunks: 4 });
    for (const [, , colStart, colEnd] of result) {
      expect(colStart).toBe(0);
      expect(colEnd).toBe(50);
    }
  });
});
