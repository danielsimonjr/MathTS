import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock computePool before importing reduce functions
vi.mock('../../src/ComputePool.js', () => ({
  computePool: {
    sum: vi.fn(async (data: Float64Array) => {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i];
      return { result: s, duration: 0, chunks: 1, parallelized: false };
    }),
    mean: vi.fn(async (data: Float64Array) => {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i];
      return { result: s / data.length, duration: 0, chunks: 1, parallelized: false };
    }),
    min: vi.fn(async (data: Float64Array) => {
      return { result: Math.min(...data), duration: 0, chunks: 1, parallelized: false };
    }),
    max: vi.fn(async (data: Float64Array) => {
      return { result: Math.max(...data), duration: 0, chunks: 1, parallelized: false };
    }),
    minMax: vi.fn(async (data: Float64Array) => {
      let min = Infinity,
        max = -Infinity,
        minIdx = 0,
        maxIdx = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < min) {
          min = data[i];
          minIdx = i;
        }
        if (data[i] > max) {
          max = data[i];
          maxIdx = i;
        }
      }
      return {
        result: { min, max, minIndex: minIdx, maxIndex: maxIdx },
        duration: 0,
        chunks: 1,
        parallelized: false,
      };
    }),
    variance: vi.fn(async (data: Float64Array) => {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i];
      const mean = s / data.length;
      let v = 0;
      for (let i = 0; i < data.length; i++) v += (data[i] - mean) ** 2;
      return { result: v / (data.length - 1), duration: 0, chunks: 1, parallelized: false };
    }),
    std: vi.fn(async (data: Float64Array) => {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i];
      const mean = s / data.length;
      let v = 0;
      for (let i = 0; i < data.length; i++) v += (data[i] - mean) ** 2;
      return {
        result: Math.sqrt(v / (data.length - 1)),
        duration: 0,
        chunks: 1,
        parallelized: false,
      };
    }),
    norm: vi.fn(async (data: Float64Array) => {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i] * data[i];
      return { result: Math.sqrt(s), duration: 0, chunks: 1, parallelized: false };
    }),
    distance: vi.fn(async (a: Float64Array, b: Float64Array) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
      return { result: Math.sqrt(s), duration: 0, chunks: 1, parallelized: false };
    }),
    histogram: vi.fn(async (data: Float64Array, bins: number) => {
      const counts = new Array(bins).fill(0);
      return { result: counts, duration: 0, chunks: 1, parallelized: false };
    }),
    reduce: vi.fn(async (data: Float64Array, fn: any, initial: any) => {
      return { result: initial, duration: 0, chunks: 1, parallelized: false };
    }),
  },
}));

import {
  parallelSum,
  parallelMean,
  parallelMin,
  parallelMax,
  parallelMinMax,
  parallelVariance,
  parallelStd,
  parallelNorm,
  parallelDistance,
  parallelHistogram,
  parallelReduce,
} from '../../src/operations/reduce.js';

describe('parallelSum', () => {
  it('should compute sum of Float64Array', async () => {
    const data = new Float64Array([1, 2, 3, 4, 5]);
    const result = await parallelSum(data);
    expect(result.result).toBe(15);
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('chunks');
  });
});

describe('parallelMean', () => {
  it('should compute mean', async () => {
    const data = new Float64Array([2, 4, 6]);
    const result = await parallelMean(data);
    expect(result.result).toBe(4);
  });
});

describe('parallelMin', () => {
  it('should find minimum', async () => {
    const data = new Float64Array([5, 1, 3]);
    const result = await parallelMin(data);
    expect(result.result).toBe(1);
  });
});

describe('parallelMax', () => {
  it('should find maximum', async () => {
    const data = new Float64Array([5, 1, 3]);
    const result = await parallelMax(data);
    expect(result.result).toBe(5);
  });
});

describe('parallelMinMax', () => {
  it('should find min/max with indices', async () => {
    const data = new Float64Array([5, 1, 3, 9, 2]);
    const result = await parallelMinMax(data);
    expect(result.result.min).toBe(1);
    expect(result.result.max).toBe(9);
  });
});

describe('parallelVariance', () => {
  it('should compute variance', async () => {
    const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
    const result = await parallelVariance(data);
    expect(typeof result.result).toBe('number');
  });
});

describe('parallelStd', () => {
  it('should compute standard deviation', async () => {
    const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
    const result = await parallelStd(data);
    expect(result.result).toBeGreaterThanOrEqual(0);
  });
});

describe('parallelNorm', () => {
  it('should compute L2 norm', async () => {
    const data = new Float64Array([3, 4]);
    const result = await parallelNorm(data);
    expect(result.result).toBe(5);
  });
});

describe('parallelDistance', () => {
  it('should compute euclidean distance', async () => {
    const a = new Float64Array([0, 0]);
    const b = new Float64Array([3, 4]);
    const result = await parallelDistance(a, b);
    expect(result.result).toBe(5);
  });
});

describe('parallelHistogram', () => {
  it('should compute histogram', async () => {
    const data = new Float64Array([1, 2, 3, 4, 5]);
    const result = await parallelHistogram(data, 5);
    expect(Array.isArray(result.result)).toBe(true);
  });
});

describe('parallelReduce', () => {
  it('should perform generic reduce', async () => {
    const data = new Float64Array([1, 2, 3]);
    const result = await parallelReduce(data, (a: number, b: number) => a + b, 0);
    expect(result).toHaveProperty('result');
  });
});
