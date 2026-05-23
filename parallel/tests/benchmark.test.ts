/**
 * Parallel Operation Benchmarks
 *
 * Measures wall-clock time for sequential vs parallel execution at various
 * matrix/array sizes. Assertions are on correctness only — timing is logged
 * for informational purposes and is not asserted (hardware-dependent).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parallelAdd, parallelMultiply, parallelSqrt } from '../src/operations/elementwise.js';
import { parallelSum } from '../src/operations/reduce.js';
import { parallelMatmul, parallelDot } from '../src/operations/matmul.js';
import { ComputePool } from '../src/ComputePool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** High-resolution wall-clock timer (ms) */
function now(): number {
  return performance.now();
}

/** Allocate a Float64Array filled with a repeating value */
function filled(size: number, value: number): Float64Array {
  return new Float64Array(size).fill(value);
}

/** Sequential element-wise add — baseline reference */
function seqAdd(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

/** Sequential element-wise multiply — baseline reference */
function seqMultiply(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i];
  return out;
}

/** Sequential sqrt — baseline reference */
function seqSqrt(a: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.sqrt(a[i]);
  return out;
}

/** Sequential sum — baseline reference */
function seqSum(a: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

/** Sequential dot product — baseline reference */
function seqDot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Sequential matrix multiply (row-major, M×K · K×N → M×N) */
function seqMatmul(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number
): Float64Array {
  const out = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i * aCols + k] * b[k * bCols + j];
      }
      out[i * bCols + j] = sum;
    }
  }
  return out;
}

/** Relative difference between two Float64Arrays (max absolute delta / scale) */
function maxRelDiff(a: Float64Array, b: Float64Array, scale = 1): number {
  let maxDiff = 0;
  for (let i = 0; i < a.length; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
  }
  return maxDiff / scale;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Parallel Benchmarks', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    // Use a very high threshold to keep all operations sequential in the test
    // environment. Worker-based parallelism requires registered worker scripts
    // that are not available in the Vitest runtime (see ComputePool.test.ts).
    // The benchmark still measures the API call overhead vs raw sequential loops
    // and verifies correctness at each size.
    pool = new ComputePool({ thresholdElements: 10_000_000 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  // -------------------------------------------------------------------------
  // Element-wise Add
  // -------------------------------------------------------------------------
  describe('elementwise add', () => {
    const sizes = [1_000, 10_000, 100_000];

    for (const size of sizes) {
      it(`size=${size.toLocaleString()}`, async () => {
        const a = filled(size, 1.5);
        const b = filled(size, 2.5);

        // Sequential baseline
        const t0 = now();
        const seqResult = seqAdd(a, b);
        const seqMs = now() - t0;

        // Parallel
        const t1 = now();
        const parResult = await parallelAdd(a, b, { pool });
        const parMs = now() - t1;

        // Correctness
        expect(seqResult[0]).toBeCloseTo(4.0);
        expect(parResult.result[0]).toBeCloseTo(4.0);
        expect(parResult.result.length).toBe(size);
        expect(maxRelDiff(seqResult, parResult.result, 4.0)).toBeLessThan(1e-10);

        console.log(
          `  add(${size.toLocaleString()}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Element-wise Multiply
  // -------------------------------------------------------------------------
  describe('elementwise multiply', () => {
    const sizes = [1_000, 10_000, 100_000];

    for (const size of sizes) {
      it(`size=${size.toLocaleString()}`, async () => {
        const a = filled(size, 3.0);
        const b = filled(size, 2.0);

        const t0 = now();
        const seqResult = seqMultiply(a, b);
        const seqMs = now() - t0;

        const t1 = now();
        const parResult = await parallelMultiply(a, b, { pool });
        const parMs = now() - t1;

        expect(seqResult[0]).toBeCloseTo(6.0);
        expect(parResult.result[0]).toBeCloseTo(6.0);
        expect(parResult.result.length).toBe(size);
        expect(maxRelDiff(seqResult, parResult.result, 6.0)).toBeLessThan(1e-10);

        console.log(
          `  multiply(${size.toLocaleString()}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Element-wise Sqrt
  // -------------------------------------------------------------------------
  describe('elementwise sqrt', () => {
    const sizes = [1_000, 10_000, 100_000];

    for (const size of sizes) {
      it(`size=${size.toLocaleString()}`, async () => {
        const a = filled(size, 9.0);

        const t0 = now();
        const seqResult = seqSqrt(a);
        const seqMs = now() - t0;

        const t1 = now();
        const parResult = await parallelSqrt(a, { pool });
        const parMs = now() - t1;

        expect(seqResult[0]).toBeCloseTo(3.0);
        expect(parResult.result[0]).toBeCloseTo(3.0);
        expect(parResult.result.length).toBe(size);
        expect(maxRelDiff(seqResult, parResult.result, 3.0)).toBeLessThan(1e-10);

        console.log(
          `  sqrt(${size.toLocaleString()}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Reduce: sum
  // -------------------------------------------------------------------------
  describe('reduce sum', () => {
    const sizes = [1_000, 10_000, 100_000];

    for (const size of sizes) {
      it(`size=${size.toLocaleString()}`, async () => {
        const a = filled(size, 1.0);
        const expectedSum = size;

        const t0 = now();
        const seqResult = seqSum(a);
        const seqMs = now() - t0;

        const t1 = now();
        const parResult = await parallelSum(a, { pool });
        const parMs = now() - t1;

        expect(seqResult).toBeCloseTo(expectedSum);
        expect(parResult.result).toBeCloseTo(expectedSum, 0);

        console.log(
          `  sum(${size.toLocaleString()}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Reduce: dot product
  // -------------------------------------------------------------------------
  describe('reduce dot', () => {
    const sizes = [1_000, 10_000, 100_000];

    for (const size of sizes) {
      it(`size=${size.toLocaleString()}`, async () => {
        const a = filled(size, 2.0);
        const b = filled(size, 3.0);
        const expectedDot = size * 6.0;

        const t0 = now();
        const seqResult = seqDot(a, b);
        const seqMs = now() - t0;

        const t1 = now();
        const parResult = await parallelDot(a, b, { pool });
        const parMs = now() - t1;

        expect(seqResult).toBeCloseTo(expectedDot);
        expect(parResult.result).toBeCloseTo(expectedDot, -3);

        console.log(
          `  dot(${size.toLocaleString()}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Matrix multiply (square matrices)
  // -------------------------------------------------------------------------
  describe('matmul (square)', () => {
    // Keep sizes small: an N×N matmul is O(N^3)
    const dims = [32, 64, 128];

    for (const dim of dims) {
      it(`${dim}x${dim}`, async () => {
        const size = dim * dim;
        // Fill with 1s: result of dim×dim · dim×dim of ones = dim (each cell)
        const a = filled(size, 1.0);
        const b = filled(size, 1.0);
        const expectedCell = dim;

        const t0 = now();
        const seqResult = seqMatmul(a, dim, dim, b, dim);
        const seqMs = now() - t0;

        const t1 = now();
        const parResult = await parallelMatmul(a, dim, dim, b, dim, { pool });
        const parMs = now() - t1;

        expect(seqResult[0]).toBeCloseTo(expectedCell);
        expect(parResult.result[0]).toBeCloseTo(expectedCell);
        expect(parResult.result.length).toBe(size);
        expect(maxRelDiff(seqResult, parResult.result, expectedCell)).toBeLessThan(1e-9);

        console.log(
          `  matmul(${dim}x${dim}): seq=${seqMs.toFixed(2)}ms  par=${parMs.toFixed(2)}ms` +
            `  parallelized=${parResult.parallelized}  chunks=${parResult.chunks}`
        );
      });
    }
  });
});
