/**
 * Typed Statistics Functions (Parallel-First)
 *
 * AssemblyScript-friendly TypeScript implementations with typed-function
 * integration and workerpool parallel execution.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL array transformations (Float64Array)
 * - Use workers for ALL numerical computations that can be batched
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { sortF64Dispatch, WASM_SORT_THRESHOLD } from '../wasm/sort/wasm-bridge.js';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

// =============================================================================
// Normalization Types
// =============================================================================

/**
 * Normalization type for variance computation
 */
export type NormalizationType = 'unbiased' | 'uncorrected' | 'biased';

// =============================================================================
// Utility Functions (AssemblyScript-Friendly)
// =============================================================================

/**
 * Convert array to Float64Array
 */
function toFloat64Array(arr: number[]): Float64Array {
  return new Float64Array(arr);
}

/**
 * Welford's online algorithm for variance (stable numerical computation).
 * Currently unused inline — kept for the AS-port path. Prefixed `_` so
 * eslint accepts the intentional retention.
 */
function _welfordVariance(data: Float64Array): { mean: f64; variance: f64; count: i32 } {
  const n: i32 = data.length;
  if (n === 0) {
    return { mean: NaN, variance: NaN, count: 0 };
  }

  let mean: f64 = 0;
  let m2: f64 = 0;

  for (let i: i32 = 0; i < n; i++) {
    const x: f64 = data[i];
    const delta: f64 = x - mean;
    mean += delta / (i + 1);
    const delta2: f64 = x - mean;
    m2 += delta * delta2;
  }

  return { mean, variance: m2 / n, count: n };
}

// =============================================================================
// Parallel Sum Functions
// =============================================================================

/**
 * Parallel sum with typed-function dispatch
 */
export const parallelStatSum = mathTyped('parallelStatSum', {
  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.sum(data);
    return result.result;
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    const data = toFloat64Array(arr);
    const result = await computePool.sum(data);
    return result.result;
  },

  // Variadic form - multiple numbers
  'number, number': (a: f64, b: f64) => a + b,

  'number, number, number': (a: f64, b: f64, c: f64) => a + b + c,

  'number, number, number, number': (a: f64, b: f64, c: f64, d: f64) => a + b + c + d,
});

// =============================================================================
// Parallel Mean Functions
// =============================================================================

/**
 * Parallel mean with typed-function dispatch
 */
export const parallelStatMean = mathTyped('parallelStatMean', {
  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.mean(data);
    return result.result;
  },

  // Number array - parallel execution
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return NaN;
    const data = toFloat64Array(arr);
    const result = await computePool.mean(data);
    return result.result;
  },

  // Variadic form
  'number, number': (a: f64, b: f64) => (a + b) / 2,

  'number, number, number': (a: f64, b: f64, c: f64) => (a + b + c) / 3,

  'number, number, number, number': (a: f64, b: f64, c: f64, d: f64) => (a + b + c + d) / 4,
});

// =============================================================================
// Parallel Variance Functions
// =============================================================================

/**
 * Parallel variance with typed-function dispatch
 *
 * Uses Welford's algorithm for numerical stability
 */
export const parallelStatVariance = mathTyped('parallelStatVariance', {
  // Float64Array with default normalization (unbiased)
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.variance(data);
    // Default to unbiased (n-1 denominator)
    const n = data.length;
    if (n <= 1) return 0;
    // The computePool returns population variance, convert to sample variance
    return (result.result.variance * n) / (n - 1);
  },

  // Float64Array with normalization
  'Float64Array, string': async (
    data: Float64Array,
    normalization: NormalizationType
  ): Promise<f64> => {
    const result = await computePool.variance(data);
    const n = data.length;

    if (n === 0) return NaN;

    const populationVariance = result.result.variance;

    switch (normalization) {
      case 'uncorrected':
        return populationVariance;
      case 'biased':
        return (populationVariance * n) / (n + 1);
      case 'unbiased':
      default:
        if (n === 1) return 0;
        return (populationVariance * n) / (n - 1);
    }
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return NaN;
    const data = toFloat64Array(arr);
    return parallelStatVariance(data) as Promise<f64>;
  },

  // Number array with normalization
  'Array, string': async (arr: number[], normalization: NormalizationType): Promise<f64> => {
    if (arr.length === 0) return NaN;
    const data = toFloat64Array(arr);
    return parallelStatVariance(data, normalization) as Promise<f64>;
  },

  // Variadic form
  'number, number': (a: f64, b: f64) => {
    const mean = (a + b) / 2;
    return ((a - mean) ** 2 + (b - mean) ** 2) / 1; // unbiased
  },

  'number, number, number': (a: f64, b: f64, c: f64) => {
    const mean = (a + b + c) / 3;
    return ((a - mean) ** 2 + (b - mean) ** 2 + (c - mean) ** 2) / 2; // unbiased
  },
});

// =============================================================================
// Parallel Standard Deviation Functions
// =============================================================================

/**
 * Parallel standard deviation with typed-function dispatch
 */
export const parallelStatStd = mathTyped('parallelStatStd', {
  // Float64Array with default normalization (unbiased)
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.std(data);
    const n = data.length;
    if (n <= 1) return 0;
    // Convert population std to sample std
    return result.result * Math.sqrt(n / (n - 1));
  },

  // Float64Array with normalization
  'Float64Array, string': async (
    data: Float64Array,
    normalization: NormalizationType
  ): Promise<f64> => {
    const variance = await parallelStatVariance(data, normalization);
    return Math.sqrt(variance as number);
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return NaN;
    const data = toFloat64Array(arr);
    return parallelStatStd(data) as Promise<f64>;
  },

  // Number array with normalization
  'Array, string': async (arr: number[], normalization: NormalizationType): Promise<f64> => {
    if (arr.length === 0) return NaN;
    const data = toFloat64Array(arr);
    return parallelStatStd(data, normalization) as Promise<f64>;
  },
});

// =============================================================================
// Parallel Min/Max Functions
// =============================================================================

/**
 * Parallel minimum with typed-function dispatch
 */
export const parallelStatMin = mathTyped('parallelStatMin', {
  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.min(data);
    return result.result;
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return Infinity;
    const data = toFloat64Array(arr);
    const result = await computePool.min(data);
    return result.result;
  },

  // Two numbers
  'number, number': (a: f64, b: f64) => Math.min(a, b),

  // Three numbers
  'number, number, number': (a: f64, b: f64, c: f64) => Math.min(a, b, c),

  // Four numbers
  'number, number, number, number': (a: f64, b: f64, c: f64, d: f64) => Math.min(a, b, c, d),
});

/**
 * Parallel maximum with typed-function dispatch
 */
export const parallelStatMax = mathTyped('parallelStatMax', {
  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.max(data);
    return result.result;
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return -Infinity;
    const data = toFloat64Array(arr);
    const result = await computePool.max(data);
    return result.result;
  },

  // Two numbers
  'number, number': (a: f64, b: f64) => Math.max(a, b),

  // Three numbers
  'number, number, number': (a: f64, b: f64, c: f64) => Math.max(a, b, c),

  // Four numbers
  'number, number, number, number': (a: f64, b: f64, c: f64, d: f64) => Math.max(a, b, c, d),
});

/**
 * Parallel minmax with typed-function dispatch
 * Returns both min and max in a single pass
 */
export const parallelStatMinMax = mathTyped('parallelStatMinMax', {
  // Float64Array - parallel execution
  Float64Array: async (
    data: Float64Array
  ): Promise<{ min: f64; max: f64; minIdx: i32; maxIdx: i32 }> => {
    const result = await computePool.minMax(data);
    return result.result;
  },

  // Number array
  Array: async (arr: number[]): Promise<{ min: f64; max: f64; minIdx: i32; maxIdx: i32 }> => {
    const data = toFloat64Array(arr);
    const result = await computePool.minMax(data);
    return result.result;
  },
});

// =============================================================================
// Parallel Median Functions
// =============================================================================

/**
 * Parallel median with typed-function dispatch
 *
 * Note: Median requires sorting which is O(n log n)
 */
export const parallelStatMedian = mathTyped('parallelStatMedian', {
  // Float64Array
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const n: i32 = data.length;
    if (n === 0) return NaN;
    if (n === 1) return data[0];

    // Sort a copy — WASM-accelerated above WASM_SORT_THRESHOLD (16 K).
    const sorted = new Float64Array(data);
    sortF64Dispatch(sorted);

    const mid: i32 = Math.floor(n / 2);
    if (n % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    if (arr.length === 0) return NaN;
    return parallelStatMedian(toFloat64Array(arr)) as Promise<f64>;
  },

  // Variadic form
  'number, number': (a: f64, b: f64) => (a + b) / 2,

  'number, number, number': (a: f64, b: f64, c: f64) => {
    // Median of three: sort and take middle
    const arr = [a, b, c].sort((x, y) => x - y);
    return arr[1];
  },
});

// =============================================================================
// Parallel Mode Functions
// =============================================================================

/**
 * Parallel mode with typed-function dispatch
 * Returns the most frequently occurring value(s)
 */
export const parallelStatMode = mathTyped('parallelStatMode', {
  // Number array
  Array: (arr: number[]): number[] => {
    if (arr.length === 0) return [];

    const counts = new Map<number, i32>();
    let maxCount: i32 = 0;

    for (let i: i32 = 0; i < arr.length; i++) {
      const val = arr[i];
      const count = (counts.get(val) || 0) + 1;
      counts.set(val, count);
      if (count > maxCount) maxCount = count;
    }

    const modes: number[] = [];
    counts.forEach((count, value) => {
      if (count === maxCount) modes.push(value);
    });

    return modes.sort((a, b) => a - b);
  },

  // Float64Array
  Float64Array: (data: Float64Array): number[] => {
    return parallelStatMode(Array.from(data)) as number[];
  },
});

// =============================================================================
// Parallel Product Functions
// =============================================================================

/**
 * Parallel product with typed-function dispatch
 */
export const parallelStatProd = mathTyped('parallelStatProd', {
  // Number array
  Array: (arr: number[]): f64 => {
    if (arr.length === 0) return 1;
    let prod: f64 = 1;
    for (let i: i32 = 0; i < arr.length; i++) {
      prod *= arr[i];
    }
    return prod;
  },

  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    if (data.length === 0) return 1;
    if (computePool.shouldParallelize(data.length)) {
      return (await computePool.prod(data)).result;
    }
    let prod: f64 = 1;
    for (let i: i32 = 0; i < data.length; i++) {
      prod *= data[i];
    }
    return prod;
  },

  // Variadic form
  'number, number': (a: f64, b: f64) => a * b,

  'number, number, number': (a: f64, b: f64, c: f64) => a * b * c,

  'number, number, number, number': (a: f64, b: f64, c: f64, d: f64) => a * b * c * d,
});

// =============================================================================
// Parallel Norm Functions
// =============================================================================

/**
 * Parallel Euclidean norm (L2 norm) with typed-function dispatch
 */
export const parallelStatNorm = mathTyped('parallelStatNorm', {
  // Float64Array - parallel execution
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const result = await computePool.norm(data);
    return result.result;
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    const data = toFloat64Array(arr);
    const result = await computePool.norm(data);
    return result.result;
  },

  // With p-norm parameter
  'Float64Array, number': (data: Float64Array, p: f64): f64 => {
    if (p === 2) {
      // Euclidean norm
      let sum: f64 = 0;
      for (let i: i32 = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      return Math.sqrt(sum);
    } else if (p === 1) {
      // Manhattan norm
      let sum: f64 = 0;
      for (let i: i32 = 0; i < data.length; i++) {
        sum += Math.abs(data[i]);
      }
      return sum;
    } else if (p === Infinity) {
      // Max norm
      let maxVal: f64 = 0;
      for (let i: i32 = 0; i < data.length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > maxVal) maxVal = absVal;
      }
      return maxVal;
    } else if (p === -Infinity) {
      // Min norm
      let minVal: f64 = Infinity;
      for (let i: i32 = 0; i < data.length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal < minVal) minVal = absVal;
      }
      return minVal;
    } else {
      // General p-norm
      let sum: f64 = 0;
      for (let i: i32 = 0; i < data.length; i++) {
        sum += Math.pow(Math.abs(data[i]), p);
      }
      return Math.pow(sum, 1 / p);
    }
  },

  // Number array with p-norm
  'Array, number': (arr: number[], p: f64): f64 => {
    return parallelStatNorm(toFloat64Array(arr), p) as f64;
  },
});

// =============================================================================
// Parallel Distance Functions
// =============================================================================

/**
 * Parallel Euclidean distance with typed-function dispatch
 */
export const parallelStatDistance = mathTyped('parallelStatDistance', {
  // Float64Array - parallel execution
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<f64> => {
    const result = await computePool.distance(a, b);
    return result.result;
  },

  // Number arrays
  'Array, Array': async (a: number[], b: number[]): Promise<f64> => {
    const result = await computePool.distance(toFloat64Array(a), toFloat64Array(b));
    return result.result;
  },

  // Two 2D points
  'number, number, number, number': (x1: f64, y1: f64, x2: f64, y2: f64): f64 => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },
});

// =============================================================================
// Parallel Correlation Functions
// =============================================================================

/**
 * Parallel Pearson correlation coefficient
 */
export const parallelStatCorr = mathTyped('parallelStatCorr', {
  // Float64Array pairs - compute correlation
  'Float64Array, Float64Array': async (x: Float64Array, y: Float64Array): Promise<f64> => {
    const n: i32 = Math.min(x.length, y.length);
    if (n === 0) return NaN;

    // Compute means
    const resultX = await computePool.variance(x);
    const resultY = await computePool.variance(y);

    const meanX = resultX.result.mean;
    const meanY = resultY.result.mean;
    const stdX = resultX.result.std;
    const stdY = resultY.result.std;

    if (stdX === 0 || stdY === 0) return NaN;

    // Compute covariance
    let cov: f64 = 0;
    for (let i: i32 = 0; i < n; i++) {
      cov += (x[i] - meanX) * (y[i] - meanY);
    }
    cov /= n;

    // Correlation coefficient
    return cov / (stdX * stdY);
  },

  // Number arrays
  'Array, Array': async (x: number[], y: number[]): Promise<f64> => {
    return parallelStatCorr(toFloat64Array(x), toFloat64Array(y)) as Promise<f64>;
  },
});

// =============================================================================
// Parallel MAD (Mean Absolute Deviation) Functions
// =============================================================================

/**
 * Parallel Mean Absolute Deviation
 */
export const parallelStatMAD = mathTyped('parallelStatMAD', {
  // Float64Array
  Float64Array: async (data: Float64Array): Promise<f64> => {
    const n: i32 = data.length;
    if (n === 0) return NaN;

    // Get mean
    const result = await computePool.mean(data);
    const mean = result.result;

    // Compute mean absolute deviation
    let mad: f64 = 0;
    for (let i: i32 = 0; i < n; i++) {
      mad += Math.abs(data[i] - mean);
    }
    return mad / n;
  },

  // Number array
  Array: async (arr: number[]): Promise<f64> => {
    return parallelStatMAD(toFloat64Array(arr)) as Promise<f64>;
  },
});

// =============================================================================
// Parallel Cumulative Sum
// =============================================================================

/**
 * Parallel cumulative sum
 */
export const parallelStatCumsum = mathTyped('parallelStatCumsum', {
  // Float64Array
  Float64Array: (data: Float64Array): Float64Array => {
    const result = new Float64Array(data.length);
    let sum: f64 = 0;
    for (let i: i32 = 0; i < data.length; i++) {
      sum += data[i];
      result[i] = sum;
    }
    return result;
  },

  // Number array
  Array: (arr: number[]): number[] => {
    const result: number[] = [];
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i];
      result.push(sum);
    }
    return result;
  },
});

// =============================================================================
// Parallel Quantile Functions
// =============================================================================

/**
 * Parallel quantile computation
 */
export const parallelStatQuantile = mathTyped('parallelStatQuantile', {
  // Float64Array with quantile value
  'Float64Array, number': (data: Float64Array, q: f64): f64 => {
    if (q < 0 || q > 1) {
      throw new Error('Quantile must be between 0 and 1');
    }
    if (data.length === 0) return NaN;
    if (data.length === 1) return data[0];

    // Sort a copy — WASM-accelerated above WASM_SORT_THRESHOLD (16 K).
    const sorted = new Float64Array(data);
    sortF64Dispatch(sorted);

    const pos = (sorted.length - 1) * q;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);

    if (lower === upper) return sorted[lower];

    const frac = pos - lower;
    return sorted[lower] * (1 - frac) + sorted[upper] * frac;
  },

  // Number array
  'Array, number': (arr: number[], q: f64): f64 => {
    return parallelStatQuantile(toFloat64Array(arr), q) as f64;
  },

  // Multiple quantiles
  'Float64Array, Array': (data: Float64Array, quantiles: number[]): number[] => {
    return quantiles.map((q) => parallelStatQuantile(data, q) as number);
  },
});

// =============================================================================
// Percentile (thin wrapper on quantile, 0-100 scale — Slice 5.7b)
// =============================================================================

/**
 * Compute the p-th percentile of a Float64Array.
 *
 * Identical to `parallelStatQuantile(data, p / 100)`.
 * Uses WASM sort acceleration above WASM_SORT_THRESHOLD elements.
 *
 * @param data - Input data array.
 * @param p    - Percentile in [0, 100].
 */
export function parallelStatPercentile(data: Float64Array, p: f64): f64 {
  if (p < 0 || p > 100) throw new Error('Percentile must be between 0 and 100');
  return parallelStatQuantile(data, p / 100) as f64;
}

// =============================================================================
// Parallel Histogram
// =============================================================================

/**
 * Parallel histogram computation
 */
export const parallelStatHistogram = mathTyped('parallelStatHistogram', {
  // Float64Array with number of bins
  'Float64Array, number': async (data: Float64Array, bins: f64): Promise<number[]> => {
    const result = await computePool.histogram(data, bins as i32);
    return result.result;
  },

  // Float64Array with bins, min, and max
  'Float64Array, number, number, number': async (
    data: Float64Array,
    bins: f64,
    min: f64,
    max: f64
  ): Promise<number[]> => {
    const result = await computePool.histogram(data, bins as i32, min, max);
    return result.result;
  },

  // Number array
  'Array, number': async (arr: number[], bins: f64): Promise<number[]> => {
    return parallelStatHistogram(toFloat64Array(arr), bins) as Promise<number[]>;
  },
});

// =============================================================================
// Selection Algorithms
// =============================================================================

/**
 * Select the k-th smallest element from an array using Hoare's quickselect algorithm.
 * Average O(n) time complexity.
 *
 * @param arr - Input array (not modified)
 * @param k - Zero-based index of the desired order statistic
 * @returns The k-th smallest element
 */
export function quickSelect(arr: number[], k: i32): f64 {
  if (k < 0 || k >= arr.length) {
    throw new RangeError(`k=${k} is out of range for array of length ${arr.length}`);
  }
  const a = arr.slice(); // work on a copy
  return _quickSelect(a, 0, a.length - 1, k);
}

function _quickSelect(a: number[], lo: i32, hi: i32, k: i32): f64 {
  while (lo < hi) {
    // Median-of-three pivot selection
    const mid: i32 = (lo + hi) >>> 1;
    if (a[mid] < a[lo]) {
      const t = a[lo];
      a[lo] = a[mid];
      a[mid] = t;
    }
    if (a[hi] < a[lo]) {
      const t = a[lo];
      a[lo] = a[hi];
      a[hi] = t;
    }
    if (a[mid] < a[hi]) {
      const t = a[mid];
      a[mid] = a[hi];
      a[hi] = t;
    }
    const pivot: f64 = a[hi];

    let i: i32 = lo;
    let j: i32 = hi - 1;
    while (true) {
      while (a[i] < pivot) i++;
      while (j > lo && a[j] > pivot) j--;
      if (i >= j) break;
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
      i++;
      j--;
    }
    const t = a[i];
    a[i] = a[hi];
    a[hi] = t;

    if (k === i) return a[i];
    if (k < i) hi = i - 1;
    else lo = i + 1;
  }
  return a[lo];
}

/**
 * Find the median of an array in O(n) average time using quickselect.
 *
 * @param arr - Input array (not modified)
 * @returns The median value
 */
export function medianSelect(arr: number[]): f64 {
  const n: i32 = arr.length;
  if (n === 0) return NaN;
  if (n === 1) return arr[0];

  const mid: i32 = Math.floor(n / 2);
  if (n % 2 === 1) {
    return quickSelect(arr, mid);
  }
  // For even length, average of two middle elements
  const a = arr.slice();
  const lower = _quickSelect(a, 0, a.length - 1, mid - 1);
  const upper = _quickSelect(a, 0, a.length - 1, mid);
  return (lower + upper) / 2;
}

/**
 * Find the k smallest elements from an array.
 *
 * @param arr - Input array (not modified)
 * @param k - Number of smallest elements to return
 * @returns Array of k smallest elements, sorted ascending
 */
export function minSelect(arr: number[], k: i32): number[] {
  if (k <= 0) return [];
  if (k >= arr.length) return arr.slice().sort((a, b) => a - b);

  const a = arr.slice();
  // Partition around the k-th smallest
  _quickSelect(a, 0, a.length - 1, k - 1);
  // Everything in a[0..k-1] is <= a[k-1], just sort that portion
  const result = a.slice(0, k);
  result.sort((x, y) => x - y);
  return result;
}

/**
 * Find the k largest elements from an array.
 *
 * @param arr - Input array (not modified)
 * @param k - Number of largest elements to return
 * @returns Array of k largest elements, sorted descending
 */
export function maxSelect(arr: number[], k: i32): number[] {
  if (k <= 0) return [];
  if (k >= arr.length) return arr.slice().sort((a, b) => b - a);

  const a = arr.slice();
  // Partition around (n-k)-th smallest to get k largest at the end
  const pivot: i32 = a.length - k;
  _quickSelect(a, 0, a.length - 1, pivot);
  const result = a.slice(pivot);
  result.sort((x, y) => y - x);
  return result;
}

// =============================================================================
// Export All Parallel Statistics Functions
// =============================================================================

/**
 * Primary export: typed statistics functions
 */
export const typedStatistics = {
  sum: parallelStatSum,
  mean: parallelStatMean,
  variance: parallelStatVariance,
  std: parallelStatStd,
  min: parallelStatMin,
  max: parallelStatMax,
  minMax: parallelStatMinMax,
  median: parallelStatMedian,
  mode: parallelStatMode,
  prod: parallelStatProd,
  norm: parallelStatNorm,
  distance: parallelStatDistance,
  corr: parallelStatCorr,
  mad: parallelStatMAD,
  cumsum: parallelStatCumsum,
  quantile: parallelStatQuantile,
  percentile: parallelStatPercentile,
  histogram: parallelStatHistogram,
  quickSelect,
  medianSelect,
  minSelect,
  maxSelect,
};

/**
 * Initialize statistics processing pool
 */
export async function initializeStatistics(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate statistics processing pool
 */
export async function terminateStatistics(): Promise<void> {
  await computePool.terminate();
}
