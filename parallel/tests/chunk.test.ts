/**
 * Chunking Strategy Tests
 *
 * Tests for array chunking utilities used in parallel processing.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOptimalChunks,
  chunkFloat64Array,
  chunkArray,
  mergeFloat64Chunks,
  mergeArrayChunks,
  shouldParallelize,
  partitionRange,
  partition2D,
} from '../src/strategies/chunk.js';

describe('Chunking Strategies', () => {
  describe('calculateOptimalChunks', () => {
    it('should return 0 for empty arrays', () => {
      expect(calculateOptimalChunks(0)).toBe(0);
    });

    it('should return 1 for small arrays', () => {
      expect(calculateOptimalChunks(100, { minChunkSize: 1000 })).toBe(1);
    });

    it('should respect maxChunks', () => {
      expect(calculateOptimalChunks(1000000, { maxChunks: 4, minChunkSize: 1 })).toBe(4);
    });

    it('should calculate based on minChunkSize', () => {
      expect(calculateOptimalChunks(10000, { minChunkSize: 1000, maxChunks: 16 })).toBe(10);
    });

    it('should use targetChunkSize when specified', () => {
      expect(calculateOptimalChunks(10000, { targetChunkSize: 2000, maxChunks: 16 })).toBe(5);
    });
  });

  describe('chunkFloat64Array', () => {
    it('should handle empty arrays', () => {
      const data = new Float64Array(0);
      const result = chunkFloat64Array(data);

      expect(result.chunks).toHaveLength(0);
      expect(result.totalElements).toBe(0);
      expect(result.numChunks).toBe(0);
    });

    it('should return single chunk for small arrays', () => {
      const data = new Float64Array([1, 2, 3, 4, 5]);
      const result = chunkFloat64Array(data, { minChunkSize: 1000 });

      expect(result.chunks).toHaveLength(1);
      expect(result.numChunks).toBe(1);
      expect(Array.from(result.chunks[0])).toEqual([1, 2, 3, 4, 5]);
    });

    it('should chunk large arrays evenly', () => {
      const data = new Float64Array(10000);
      for (let i = 0; i < 10000; i++) data[i] = i;

      const result = chunkFloat64Array(data, { minChunkSize: 100, maxChunks: 4 });

      expect(result.chunks).toHaveLength(4);
      expect(result.numChunks).toBe(4);

      // Each chunk should have 2500 elements
      for (const chunk of result.chunks) {
        expect(chunk.length).toBe(2500);
      }
    });

    it('should provide correct chunk info', () => {
      const data = new Float64Array(100);
      for (let i = 0; i < 100; i++) data[i] = i;

      const result = chunkFloat64Array(data, { minChunkSize: 25, maxChunks: 4 });

      expect(result.chunkInfo).toHaveLength(4);
      expect(result.chunkInfo[0]).toEqual({
        startIndex: 0,
        endIndex: 25,
        length: 25,
        chunkIndex: 0,
      });
      expect(result.chunkInfo[3]).toEqual({
        startIndex: 75,
        endIndex: 100,
        length: 25,
        chunkIndex: 3,
      });
    });

    it('should handle non-evenly divisible arrays', () => {
      const data = new Float64Array(103);
      for (let i = 0; i < 103; i++) data[i] = i;

      const result = chunkFloat64Array(data, { minChunkSize: 25, maxChunks: 4 });

      // Total should still be 103
      const totalElements = result.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalElements).toBe(103);

      // First 3 chunks get 26, last gets 25 (balanced distribution)
      expect(result.chunks[0].length).toBe(26);
      expect(result.chunks[1].length).toBe(26);
      expect(result.chunks[2].length).toBe(26);
      expect(result.chunks[3].length).toBe(25);
    });
  });

  describe('chunkArray', () => {
    it('should handle empty arrays', () => {
      const result = chunkArray<number>([]);

      expect(result.chunks).toHaveLength(0);
      expect(result.totalElements).toBe(0);
    });

    it('should chunk arrays of objects', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const result = chunkArray(data, { minChunkSize: 1, maxChunks: 2 });

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0]).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.chunks[1]).toEqual([{ id: 3 }, { id: 4 }]);
    });

    it('should chunk string arrays', () => {
      const data = ['a', 'b', 'c', 'd', 'e', 'f'];
      const result = chunkArray(data, { minChunkSize: 1, maxChunks: 3 });

      expect(result.chunks).toHaveLength(3);
      expect(result.chunks.flat()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });
  });

  describe('mergeFloat64Chunks', () => {
    it('should handle empty chunks', () => {
      expect(mergeFloat64Chunks([])).toEqual(new Float64Array(0));
    });

    it('should return single chunk as-is', () => {
      const chunk = new Float64Array([1, 2, 3]);
      expect(mergeFloat64Chunks([chunk])).toBe(chunk);
    });

    it('should merge multiple chunks', () => {
      const chunks = [new Float64Array([1, 2]), new Float64Array([3, 4]), new Float64Array([5, 6])];

      const result = mergeFloat64Chunks(chunks);

      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should handle chunks of different sizes', () => {
      const chunks = [new Float64Array([1]), new Float64Array([2, 3, 4]), new Float64Array([5, 6])];

      const result = mergeFloat64Chunks(chunks);

      expect(result.length).toBe(6);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('mergeArrayChunks', () => {
    it('should handle empty chunks', () => {
      expect(mergeArrayChunks([])).toEqual([]);
    });

    it('should merge string chunks', () => {
      const chunks = [['a', 'b'], ['c'], ['d', 'e', 'f']];

      expect(mergeArrayChunks(chunks)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('should merge object chunks', () => {
      const chunks = [[{ x: 1 }], [{ x: 2 }, { x: 3 }]];

      expect(mergeArrayChunks(chunks)).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }]);
    });
  });

  describe('shouldParallelize', () => {
    it('should return false for small arrays', () => {
      expect(shouldParallelize(100)).toBe(false);
      expect(shouldParallelize(9999)).toBe(false);
    });

    it('should return true for large arrays', () => {
      expect(shouldParallelize(10000)).toBe(true);
      expect(shouldParallelize(100000)).toBe(true);
    });

    it('should respect custom threshold', () => {
      expect(shouldParallelize(500, 1000)).toBe(false);
      expect(shouldParallelize(1000, 1000)).toBe(true);
      expect(shouldParallelize(5000, 1000)).toBe(true);
    });
  });

  describe('partitionRange', () => {
    it('should handle single partition', () => {
      const result = partitionRange(0, 100, { minChunkSize: 1000 });

      expect(result).toEqual([[0, 100]]);
    });

    it('should partition evenly', () => {
      const result = partitionRange(0, 100, { minChunkSize: 25, maxChunks: 4 });

      expect(result).toHaveLength(4);
      expect(result).toEqual([
        [0, 25],
        [25, 50],
        [50, 75],
        [75, 100],
      ]);
    });

    it('should handle non-zero start', () => {
      const result = partitionRange(10, 110, { minChunkSize: 25, maxChunks: 4 });

      expect(result).toHaveLength(4);
      expect(result[0][0]).toBe(10);
      expect(result[3][1]).toBe(110);
    });

    it('should handle odd ranges', () => {
      const result = partitionRange(0, 103, { minChunkSize: 25, maxChunks: 4 });

      // Verify all elements are covered
      let totalElements = 0;
      for (const [start, end] of result) {
        totalElements += end - start;
      }
      expect(totalElements).toBe(103);
    });
  });

  describe('partition2D', () => {
    it('should partition rows', () => {
      const result = partition2D(100, 100, { minChunkSize: 25, maxChunks: 4 });

      expect(result).toHaveLength(4);

      // Each partition should cover all columns
      for (const [, , colStart, colEnd] of result) {
        expect(colStart).toBe(0);
        expect(colEnd).toBe(100);
      }

      // Rows should be partitioned evenly
      expect(result[0]).toEqual([0, 25, 0, 100]);
      expect(result[3]).toEqual([75, 100, 0, 100]);
    });

    it('should handle non-square matrices', () => {
      const result = partition2D(50, 200, { minChunkSize: 12, maxChunks: 4 });

      expect(result).toHaveLength(4);

      // Verify row coverage
      let totalRows = 0;
      for (const [rowStart, rowEnd] of result) {
        totalRows += rowEnd - rowStart;
      }
      expect(totalRows).toBe(50);
    });
  });

  describe('Roundtrip: chunk and merge', () => {
    it('should preserve Float64Array data through chunk/merge', () => {
      const original = new Float64Array(1000);
      for (let i = 0; i < 1000; i++) {
        original[i] = Math.random() * 100;
      }

      const chunked = chunkFloat64Array(original, { minChunkSize: 100, maxChunks: 8 });
      const merged = mergeFloat64Chunks(chunked.chunks);

      expect(merged.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(merged[i]).toBe(original[i]);
      }
    });

    it('should preserve array data through chunk/merge', () => {
      const original = Array.from({ length: 100 }, (_, i) => ({ id: i, value: i * 2 }));

      const chunked = chunkArray(original, { minChunkSize: 10, maxChunks: 8 });
      const merged = mergeArrayChunks(chunked.chunks);

      expect(merged).toEqual(original);
    });
  });
});
