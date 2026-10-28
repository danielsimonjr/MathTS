/**
 * Oracle tests for chunk planning: chunkFloat64Array vs chunkArray must stay
 * bit-identical to independent reference planners (pinned before planChunks merge).
 */

import { describe, it, expect } from 'vitest';
import {
  chunkFloat64Array,
  chunkArray,
  type ChunkInfo,
  type ChunkOptions,
} from '../../src/strategies/chunk.js';

const DEFAULT_MIN = 1000;
const DEFAULT_MAX = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

function refCalculateOptimalChunks(totalElements: number, options: ChunkOptions = {}): number {
  const minChunkSize = options.minChunkSize ?? DEFAULT_MIN;
  const maxChunks = options.maxChunks ?? DEFAULT_MAX;
  const targetChunkSize = options.targetChunkSize ?? 0;

  if (totalElements === 0) return 0;
  if (targetChunkSize > 0) {
    return Math.min(maxChunks, Math.ceil(totalElements / targetChunkSize));
  }
  const maxPossibleChunks = Math.floor(totalElements / minChunkSize);
  return Math.max(1, Math.min(maxChunks, maxPossibleChunks));
}

/** Reference chunk-info planner for Float64Array (unbalanced uses minChunkSize floor). */
function refPlanFloat64(totalElements: number, options: ChunkOptions = {}): ChunkInfo[] {
  const minChunkSize = options.minChunkSize ?? DEFAULT_MIN;
  const balanced = options.balanced ?? true;

  if (totalElements === 0) return [];

  const numChunks = refCalculateOptimalChunks(totalElements, options);
  if (numChunks <= 1) {
    return [{ startIndex: 0, endIndex: totalElements, length: totalElements, chunkIndex: 0 }];
  }

  const chunkInfo: ChunkInfo[] = [];
  if (balanced) {
    const baseChunkSize = Math.floor(totalElements / numChunks);
    const remainder = totalElements % numChunks;
    let currentIndex = 0;
    for (let i = 0; i < numChunks; i++) {
      const thisChunkSize = baseChunkSize + (i < remainder ? 1 : 0);
      const endIndex = currentIndex + thisChunkSize;
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex: i,
      });
      currentIndex = endIndex;
    }
  } else {
    const chunkSize = Math.max(minChunkSize, Math.ceil(totalElements / numChunks));
    let currentIndex = 0;
    let chunkIndex = 0;
    while (currentIndex < totalElements) {
      const endIndex = Math.min(currentIndex + chunkSize, totalElements);
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: endIndex - currentIndex,
        chunkIndex,
      });
      currentIndex = endIndex;
      chunkIndex++;
    }
  }
  return chunkInfo;
}

/** Reference chunk-info planner for generic arrays (unbalanced has no min floor). */
function refPlanArray(totalElements: number, options: ChunkOptions = {}): ChunkInfo[] {
  const balanced = options.balanced ?? true;

  if (totalElements === 0) return [];

  const numChunks = refCalculateOptimalChunks(totalElements, options);
  if (numChunks <= 1) {
    return [{ startIndex: 0, endIndex: totalElements, length: totalElements, chunkIndex: 0 }];
  }

  const chunkInfo: ChunkInfo[] = [];
  if (balanced) {
    const baseChunkSize = Math.floor(totalElements / numChunks);
    const remainder = totalElements % numChunks;
    let currentIndex = 0;
    for (let i = 0; i < numChunks; i++) {
      const thisChunkSize = baseChunkSize + (i < remainder ? 1 : 0);
      const endIndex = currentIndex + thisChunkSize;
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex: i,
      });
      currentIndex = endIndex;
    }
  } else {
    const chunkSize = Math.ceil(totalElements / numChunks);
    let currentIndex = 0;
    let chunkIndex = 0;
    while (currentIndex < totalElements) {
      const endIndex = Math.min(currentIndex + chunkSize, totalElements);
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: endIndex - currentIndex,
        chunkIndex,
      });
      currentIndex = endIndex;
      chunkIndex++;
    }
  }
  return chunkInfo;
}

const CASES: Array<{ n: number; options: ChunkOptions; label: string }> = [
  { n: 0, options: {}, label: 'empty' },
  { n: 5, options: { minChunkSize: 1000 }, label: 'n below minChunkSize' },
  { n: 1500, options: { minChunkSize: 1000, maxChunks: 8 }, label: 'single chunk band' },
  { n: 10000, options: { minChunkSize: 100, maxChunks: 4, balanced: true }, label: 'balanced' },
  {
    n: 103,
    options: { minChunkSize: 25, maxChunks: 4, balanced: true },
    label: 'balanced remainder',
  },
  {
    n: 10000,
    options: { minChunkSize: 2500, maxChunks: 4, balanced: false },
    label: 'unbalanced float64 min',
  },
  {
    n: 500,
    options: { minChunkSize: 1000, maxChunks: 4, balanced: false },
    label: 'unbalanced n < minChunkSize',
  },
  {
    n: 9000,
    options: { targetChunkSize: 2000, maxChunks: 16, balanced: true },
    label: 'targetChunkSize',
  },
];

describe('chunk planning oracle (pre-merge pin)', () => {
  it('chunkFloat64Array chunkInfo matches refPlanFloat64', () => {
    for (const { n, options } of CASES) {
      const data = new Float64Array(n);
      for (let i = 0; i < n; i++) data[i] = i;
      const result = chunkFloat64Array(data, options);
      expect(result.chunkInfo).toEqual(refPlanFloat64(n, options));
      expect(result.numChunks).toBe(result.chunkInfo.length || (n === 0 ? 0 : 1));
      if (n === 0) {
        expect(result.chunks).toHaveLength(0);
      } else if (refCalculateOptimalChunks(n, options) <= 1) {
        expect(result.chunks).toHaveLength(1);
        expect(result.chunks[0]).toBe(data);
      }
    }
  });

  it('chunkArray chunkInfo matches refPlanArray', () => {
    for (const { n, options } of CASES) {
      const data = Array.from({ length: n }, (_, i) => i);
      const result = chunkArray(data, options);
      expect(result.chunkInfo).toEqual(refPlanArray(n, options));
      if (n === 0) {
        expect(result.chunks).toHaveLength(0);
      } else if (refCalculateOptimalChunks(n, options) <= 1) {
        expect(result.chunks).toHaveLength(1);
        expect(result.chunks[0]).toBe(data);
      }
    }
  });

  it('chunkFloat64Array views cover original buffer without copy when split', () => {
    const data = new Float64Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    const result = chunkFloat64Array(data, { minChunkSize: 25, maxChunks: 4 });
    if (result.chunks.length > 1) {
      for (const chunk of result.chunks) {
        expect(chunk.buffer).toBe(data.buffer);
      }
    }
  });

  it('chunkArray slices are copies when split', () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const result = chunkArray(data, { minChunkSize: 25, maxChunks: 4 });
    if (result.chunks.length > 1) {
      for (const chunk of result.chunks) {
        expect(chunk).not.toBe(data);
      }
    }
  });
});
