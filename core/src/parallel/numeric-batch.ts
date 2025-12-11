/**
 * Parallel Batch Operations for MathTS Numeric Types
 *
 * Provides parallel-first batch operations for Complex, Fraction, and BigNumber arrays.
 * These operations maximize throughput by processing arrays in parallel chunks.
 *
 * @packageDocumentation
 */

import { Complex, COMPLEX_ZERO } from '../types/complex.js';
import { Fraction, FRACTION_ZERO } from '../types/fraction.js';
import { BigNumber } from '../types/bignumber.js';
import {
  parallelMap,
  chunkArray,
  shouldParallelize,
  getCpuCount,
  type ParallelResult,
  type ParallelOptions,
  getParallelConfig,
} from './index.js';

// =============================================================================
// Complex Batch Operations
// =============================================================================

/**
 * Batch add Complex numbers: result[i] = a[i] + b[i]
 */
export async function batchComplexAdd(
  a: Complex[],
  b: Complex[],
  options?: ParallelOptions
): Promise<ParallelResult<Complex[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.add(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.add(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Batch subtract Complex numbers: result[i] = a[i] - b[i]
 */
export async function batchComplexSubtract(
  a: Complex[],
  b: Complex[],
  options?: ParallelOptions
): Promise<ParallelResult<Complex[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.subtract(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.subtract(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Batch multiply Complex numbers: result[i] = a[i] * b[i]
 */
export async function batchComplexMultiply(
  a: Complex[],
  b: Complex[],
  options?: ParallelOptions
): Promise<ParallelResult<Complex[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.multiply(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.multiply(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Batch divide Complex numbers: result[i] = a[i] / b[i]
 */
export async function batchComplexDivide(
  a: Complex[],
  b: Complex[],
  options?: ParallelOptions
): Promise<ParallelResult<Complex[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.divide(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.divide(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Sum all Complex numbers in array
 */
export async function batchComplexSum(
  values: Complex[],
  options?: ParallelOptions
): Promise<ParallelResult<Complex>> {
  const start = performance.now();

  if (values.length === 0) {
    return {
      value: COMPLEX_ZERO,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 0,
      workers: 0,
    };
  }

  if (!shouldParallelize(values.length, options)) {
    let sum = values[0];
    for (let i = 1; i < values.length; i++) {
      sum = sum.add(values[i]);
    }
    return {
      value: sum,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const chunks = chunkArray(values, chunkSize);

  const partialSums = await Promise.all(
    chunks.map(chunk => {
      let sum = chunk[0];
      for (let i = 1; i < chunk.length; i++) {
        sum = sum.add(chunk[i]);
      }
      return Promise.resolve(sum);
    })
  );

  let finalSum = partialSums[0];
  for (let i = 1; i < partialSums.length; i++) {
    finalSum = finalSum.add(partialSums[i]);
  }

  return {
    value: finalSum,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Apply function to all Complex numbers in parallel
 */
export async function batchComplexMap(
  values: Complex[],
  fn: (c: Complex, index: number) => Complex,
  options?: ParallelOptions
): Promise<ParallelResult<Complex[]>> {
  return parallelMap(values, fn, options);
}

// =============================================================================
// Fraction Batch Operations
// =============================================================================

/**
 * Batch add Fraction numbers: result[i] = a[i] + b[i]
 */
export async function batchFractionAdd(
  a: Fraction[],
  b: Fraction[],
  options?: ParallelOptions
): Promise<ParallelResult<Fraction[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.add(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.add(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Batch multiply Fraction numbers: result[i] = a[i] * b[i]
 */
export async function batchFractionMultiply(
  a: Fraction[],
  b: Fraction[],
  options?: ParallelOptions
): Promise<ParallelResult<Fraction[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.multiply(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.multiply(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Sum all Fraction numbers in array
 */
export async function batchFractionSum(
  values: Fraction[],
  options?: ParallelOptions
): Promise<ParallelResult<Fraction>> {
  const start = performance.now();

  if (values.length === 0) {
    return {
      value: FRACTION_ZERO,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 0,
      workers: 0,
    };
  }

  if (!shouldParallelize(values.length, options)) {
    let sum = values[0];
    for (let i = 1; i < values.length; i++) {
      sum = sum.add(values[i]);
    }
    return {
      value: sum,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const chunks = chunkArray(values, chunkSize);

  const partialSums = await Promise.all(
    chunks.map(chunk => {
      let sum = chunk[0];
      for (let i = 1; i < chunk.length; i++) {
        sum = sum.add(chunk[i]);
      }
      return Promise.resolve(sum);
    })
  );

  let finalSum = partialSums[0];
  for (let i = 1; i < partialSums.length; i++) {
    finalSum = finalSum.add(partialSums[i]);
  }

  return {
    value: finalSum,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

// =============================================================================
// BigNumber Batch Operations
// =============================================================================

/**
 * Batch add BigNumber numbers: result[i] = a[i] + b[i]
 */
export async function batchBigNumberAdd(
  a: BigNumber[],
  b: BigNumber[],
  options?: ParallelOptions
): Promise<ParallelResult<BigNumber[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.add(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.add(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Batch multiply BigNumber numbers: result[i] = a[i] * b[i]
 */
export async function batchBigNumberMultiply(
  a: BigNumber[],
  b: BigNumber[],
  options?: ParallelOptions
): Promise<ParallelResult<BigNumber[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => x.multiply(b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => x.multiply(bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Sum all BigNumber numbers in array
 */
export async function batchBigNumberSum(
  values: BigNumber[],
  options?: ParallelOptions
): Promise<ParallelResult<BigNumber>> {
  const start = performance.now();

  if (values.length === 0) {
    return {
      value: BigNumber.fromNumber(0),
      duration: performance.now() - start,
      parallelized: false,
      chunks: 0,
      workers: 0,
    };
  }

  if (!shouldParallelize(values.length, options)) {
    let sum = values[0];
    for (let i = 1; i < values.length; i++) {
      sum = sum.add(values[i]);
    }
    return {
      value: sum,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const chunks = chunkArray(values, chunkSize);

  const partialSums = await Promise.all(
    chunks.map(chunk => {
      let sum = chunk[0];
      for (let i = 1; i < chunk.length; i++) {
        sum = sum.add(chunk[i]);
      }
      return Promise.resolve(sum);
    })
  );

  let finalSum = partialSums[0];
  for (let i = 1; i < partialSums.length; i++) {
    finalSum = finalSum.add(partialSums[i]);
  }

  return {
    value: finalSum,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

// =============================================================================
// Generic Batch Operations
// =============================================================================

/**
 * Generic batch binary operation on any numeric type
 */
export async function batchBinaryOp<T>(
  a: T[],
  b: T[],
  op: (x: T, y: T) => T,
  options?: ParallelOptions
): Promise<ParallelResult<T[]>> {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }

  const start = performance.now();

  if (!shouldParallelize(a.length, options)) {
    const result = a.map((x, i) => op(x, b[i]));
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const aChunks = chunkArray(a, chunkSize);
  const bChunks = chunkArray(b, chunkSize);

  const chunkResults = await Promise.all(
    aChunks.map((aChunk, i) => {
      const bChunk = bChunks[i];
      return Promise.resolve(aChunk.map((x, j) => op(x, bChunk[j])));
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: aChunks.length,
    workers: Math.min(aChunks.length, getCpuCount()),
  };
}

/**
 * Generic batch reduce on any numeric type
 */
export async function batchReduce<T>(
  values: T[],
  reducer: (acc: T, val: T) => T,
  initial: T,
  options?: ParallelOptions
): Promise<ParallelResult<T>> {
  const start = performance.now();

  if (values.length === 0) {
    return {
      value: initial,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 0,
      workers: 0,
    };
  }

  if (!shouldParallelize(values.length, options)) {
    let acc = initial;
    for (const val of values) {
      acc = reducer(acc, val);
    }
    return {
      value: acc,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? getParallelConfig().chunkSize;
  const chunks = chunkArray(values, chunkSize);

  const partialResults = await Promise.all(
    chunks.map(chunk => {
      let acc = initial;
      for (const val of chunk) {
        acc = reducer(acc, val);
      }
      return Promise.resolve(acc);
    })
  );

  let finalResult = initial;
  for (const partial of partialResults) {
    finalResult = reducer(finalResult, partial);
  }

  return {
    value: finalResult,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}
