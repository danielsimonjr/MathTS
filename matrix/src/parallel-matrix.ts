/**
 * Parallel-First Matrix Operations
 *
 * AssemblyScript-friendly TypeScript implementations with typed-function
 * integration and workerpool parallel execution via @danielsimonjr/mathts-parallel.
 *
 * These operations use Float64Array flat row-major format for efficient
 * parallel processing through the ComputePool worker infrastructure.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL matrix operations (matmul, transpose, etc.)
 * - Use workers for ALL element-wise operations on matrices
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool as importedPool, type ParallelResult } from '@danielsimonjr/mathts-parallel';

// Type assertion to work around TypeScript module resolution issue
// The ComputePool class has all these methods but TypeScript can't resolve them
// through the monorepo symlink. This is a known issue with TypeScript + npm workspaces.
interface ComputePoolAPI {
  initialize(): Promise<void>;
  terminate(force?: boolean): Promise<void>;
  sum(data: Float64Array): Promise<ParallelResult<number>>;
  mean(data: Float64Array): Promise<ParallelResult<number>>;
  min(data: Float64Array): Promise<ParallelResult<number>>;
  max(data: Float64Array): Promise<ParallelResult<number>>;
  variance(data: Float64Array): Promise<ParallelResult<{ mean: number; variance: number; std: number }>>;
  std(data: Float64Array): Promise<ParallelResult<number>>;
  norm(data: Float64Array): Promise<ParallelResult<number>>;
  distance(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>>;
  histogram(data: Float64Array, bins: number, min?: number, max?: number): Promise<ParallelResult<number[]>>;
  abs(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  sqrt(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  square(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  exp(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  log(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  sin(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  cos(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  tan(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  negate(data: Float64Array): Promise<ParallelResult<Float64Array>>;
  matmul(a: Float64Array, aRows: number, aCols: number, b: Float64Array, bCols: number): Promise<ParallelResult<Float64Array>>;
  matvec(matrix: Float64Array, rows: number, cols: number, vector: Float64Array): Promise<ParallelResult<Float64Array>>;
  outer(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
  transpose(data: Float64Array, rows: number, cols: number): Promise<ParallelResult<Float64Array>>;
  add(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
  subtract(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
  scale(data: Float64Array, scalar: number): Promise<ParallelResult<Float64Array>>;
  dot(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>>;
  multiply(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
  divide(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
}

const computePool = importedPool as unknown as ComputePoolAPI;

// Wrapper functions that use computePool directly
// These provide the same interface as the parallel* convenience functions
async function pSum(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.sum(data);
}

async function pMean(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.mean(data);
}

async function pMin(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.min(data);
}

async function pMax(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.max(data);
}

async function pVariance(data: Float64Array): Promise<ParallelResult<{ mean: number; variance: number; std: number }>> {
  return computePool.variance(data);
}

async function pStd(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.std(data);
}

async function pNorm(data: Float64Array): Promise<ParallelResult<number>> {
  return computePool.norm(data);
}

async function pDistance(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
  return computePool.distance(a, b);
}

async function pHistogram(data: Float64Array, bins: number, min?: number, max?: number): Promise<ParallelResult<number[]>> {
  return computePool.histogram(data, bins, min, max);
}

async function pAbs(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.abs(data);
}

async function pSqrt(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.sqrt(data);
}

async function pSquare(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.square(data);
}

async function pExp(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.exp(data);
}

async function pLog(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.log(data);
}

async function pSin(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.sin(data);
}

async function pCos(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.cos(data);
}

async function pTan(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.tan(data);
}

async function pNegate(data: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.negate(data);
}

async function pMatmul(a: Float64Array, aRows: number, aCols: number, b: Float64Array, bCols: number): Promise<ParallelResult<Float64Array>> {
  return computePool.matmul(a, aRows, aCols, b, bCols);
}

async function pMatvec(matrix: Float64Array, rows: number, cols: number, vector: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.matvec(matrix, rows, cols, vector);
}

async function pOuter(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.outer(a, b);
}

async function pTranspose(data: Float64Array, rows: number, cols: number): Promise<ParallelResult<Float64Array>> {
  return computePool.transpose(data, rows, cols);
}

async function pAdd(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.add(a, b);
}

async function pSubtract(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.subtract(a, b);
}

async function pScale(data: Float64Array, scalar: number): Promise<ParallelResult<Float64Array>> {
  return computePool.scale(data, scalar);
}

async function pDot(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
  return computePool.dot(a, b);
}

async function pMultiply(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.multiply(a, b);
}

async function pDivide(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
  return computePool.divide(a, b);
}
import { DenseMatrix } from './types/DenseMatrix.js';
import type { SignatureFunction } from '@danielsimonjr/mathts-core';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

// Helper type for signature records
type Signatures = Record<string, SignatureFunction>;

// =============================================================================
// Utility Functions (AssemblyScript-Friendly)
// =============================================================================

/**
 * Convert DenseMatrix to flat Float64Array
 */
function matrixToFloat64(m: DenseMatrix): Float64Array {
  return m.toFloat64Array();
}

/**
 * Create DenseMatrix from flat Float64Array
 */
function float64ToMatrix(data: Float64Array, rows: i32, cols: i32): DenseMatrix {
  return new DenseMatrix(rows, cols, data);
}

// =============================================================================
// Parallel Matrix Creation Functions
// =============================================================================

/**
 * Create a matrix from various input types - parallel-first
 */
export const parallelMatrix = mathTyped('parallelMatrix', {
  'Array': (arr: number[][]) => DenseMatrix.fromArray(arr),

  'number, number': (rows: f64, cols: f64) =>
    DenseMatrix.zeros(rows as i32, cols as i32),

  'number, number, number': (rows: f64, cols: f64, fill: f64) =>
    DenseMatrix.fill(rows as i32, cols as i32, fill),

  'number, number, Array': (rows: f64, cols: f64, data: number[]) =>
    DenseMatrix.fromFlat(rows as i32, cols as i32, data),

  'number, number, Float64Array': (rows: f64, cols: f64, data: Float64Array) =>
    new DenseMatrix(rows as i32, cols as i32, data),
} as Signatures);

/**
 * Create an identity matrix
 */
export const parallelIdentity = mathTyped('parallelIdentity', {
  'number': (n: f64) => DenseMatrix.identity(n as i32),
} as Signatures);

/**
 * Create a matrix of zeros
 */
export const parallelZeros = mathTyped('parallelZeros', {
  'number, number': (rows: f64, cols: f64) =>
    DenseMatrix.zeros(rows as i32, cols as i32),
} as Signatures);

/**
 * Create a matrix of ones
 */
export const parallelOnes = mathTyped('parallelOnes', {
  'number, number': (rows: f64, cols: f64) =>
    DenseMatrix.ones(rows as i32, cols as i32),
} as Signatures);

/**
 * Create a diagonal matrix
 */
export const parallelDiag = mathTyped('parallelDiag', {
  'Array': (values: number[]) => DenseMatrix.diag(values),
  'Float64Array': (values: Float64Array) => DenseMatrix.diag(Array.from(values)),
} as Signatures);

/**
 * Create a random matrix
 */
export const parallelRandom = mathTyped('parallelRandom', {
  'number, number': (rows: f64, cols: f64) =>
    DenseMatrix.random(rows as i32, cols as i32),
} as Signatures);

// =============================================================================
// Parallel Matrix Arithmetic Operations
// =============================================================================

/**
 * Parallel matrix addition with typed-function dispatch
 */
export const parallelMatrixAdd = mathTyped('parallelMatrixAdd', {
  // DenseMatrix + DenseMatrix - parallel execution
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(`Matrix dimensions must match: ${a.rows}×${a.cols} vs ${b.rows}×${b.cols}`);
    }

    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);

    const result = await pAdd(dataA, dataB);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // DenseMatrix + scalar - parallel execution
  'DenseMatrix, number': async (a: DenseMatrix, scalar: f64): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const scalarArray = new Float64Array(dataA.length).fill(scalar);
    const result = await pAdd(dataA, scalarArray);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // scalar + DenseMatrix
  'number, DenseMatrix': async (scalar: f64, a: DenseMatrix): Promise<DenseMatrix> => {
    return parallelMatrixAdd(a, scalar) as Promise<DenseMatrix>;
  },

  // Float64Array + Float64Array - parallel execution
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await pAdd(a, b);
    return result.result;
  },

  // Fallback for number + number
  'number, number': (a: f64, b: f64) => a + b,
} as Signatures);

/**
 * Parallel matrix subtraction with typed-function dispatch
 */
export const parallelMatrixSubtract = mathTyped('parallelMatrixSubtract', {
  // DenseMatrix - DenseMatrix - parallel execution
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(`Matrix dimensions must match: ${a.rows}×${a.cols} vs ${b.rows}×${b.cols}`);
    }

    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);

    const result = await pSubtract(dataA, dataB);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // DenseMatrix - scalar
  'DenseMatrix, number': async (a: DenseMatrix, scalar: f64): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const scalarArray = new Float64Array(dataA.length).fill(scalar);
    const result = await pSubtract(dataA, scalarArray);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // scalar - DenseMatrix
  'number, DenseMatrix': async (scalar: f64, a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const scalarArray = new Float64Array(dataA.length).fill(scalar);
    const result = await pSubtract(scalarArray, dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // Float64Array - Float64Array
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await pSubtract(a, b);
    return result.result;
  },

  // Fallback
  'number, number': (a: f64, b: f64) => a - b,
} as Signatures);

/**
 * Parallel matrix multiplication (matmul) with typed-function dispatch
 */
export const parallelMatrixMultiply = mathTyped('parallelMatrixMultiply', {
  // Matrix * Matrix (matmul) - parallel execution
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    if (a.cols !== b.rows) {
      throw new Error(`Matrix multiply dimensions: ${a.cols} ≠ ${b.rows}`);
    }

    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);

    const result = await pMatmul(dataA, a.rows, a.cols, dataB, b.cols);
    return float64ToMatrix(result.result, a.rows, b.cols);
  },

  // Matrix * scalar (scale) - parallel execution
  'DenseMatrix, number': async (a: DenseMatrix, scalar: f64): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pScale(dataA, scalar);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // scalar * Matrix (scale)
  'number, DenseMatrix': async (scalar: f64, a: DenseMatrix): Promise<DenseMatrix> => {
    return parallelMatrixMultiply(a, scalar) as Promise<DenseMatrix>;
  },

  // Fallback
  'number, number': (a: f64, b: f64) => a * b,
} as Signatures);

/**
 * Element-wise multiplication (Hadamard product) - parallel execution
 */
export const parallelDotMultiply = mathTyped('parallelDotMultiply', {
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(`Matrix dimensions must match for element-wise multiply`);
    }

    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);

    const result = await pMultiply(dataA, dataB);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await pMultiply(a, b);
    return result.result;
  },

  'number, number': (a: f64, b: f64) => a * b,
} as Signatures);

/**
 * Parallel matrix division
 */
export const parallelMatrixDivide = mathTyped('parallelMatrixDivide', {
  // Matrix / scalar
  'DenseMatrix, number': async (a: DenseMatrix, scalar: f64): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pScale(dataA, 1 / scalar);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // scalar / Matrix (element-wise)
  'number, DenseMatrix': async (scalar: f64, a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const scalarArray = new Float64Array(dataA.length).fill(scalar);
    const result = await pDivide(scalarArray, dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  // Element-wise Matrix / Matrix
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(`Matrix dimensions must match for element-wise divide`);
    }
    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);
    const result = await pDivide(dataA, dataB);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await pDivide(a, b);
    return result.result;
  },

  'number, number': (a: f64, b: f64) => a / b,
} as Signatures);

/**
 * Matrix negation - parallel execution
 */
export const parallelUnaryMinus = mathTyped('parallelUnaryMinus', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pNegate(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pNegate(a);
    return result.result;
  },

  'number': (a: f64) => -a,
} as Signatures);

/**
 * Matrix transpose - parallel execution
 */
export const parallelMatrixTranspose = mathTyped('parallelMatrixTranspose', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pTranspose(dataA, a.rows, a.cols);
    return float64ToMatrix(result.result, a.cols, a.rows);
  },
} as Signatures);

// =============================================================================
// Parallel Reduction Operations
// =============================================================================

/**
 * Parallel sum of all elements
 */
export const parallelMatrixSum = mathTyped('parallelMatrixSum', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pSum(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pSum(a);
    return result.result;
  },

  'Array': (arr: number[]) => {
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum;
  },
} as Signatures);

/**
 * Parallel mean of all elements
 */
export const parallelMatrixMean = mathTyped('parallelMatrixMean', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pMean(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pMean(a);
    return result.result;
  },

  'Array': (arr: number[]) => {
    if (arr.length === 0) return NaN;
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum / arr.length;
  },
} as Signatures);

/**
 * Parallel minimum element
 */
export const parallelMatrixMin = mathTyped('parallelMatrixMin', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pMin(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pMin(a);
    return result.result;
  },

  'Array': (arr: number[]) => {
    if (arr.length === 0) return Infinity;
    let minVal: f64 = arr[0];
    for (let i: i32 = 1; i < arr.length; i++) {
      if (arr[i] < minVal) minVal = arr[i];
    }
    return minVal;
  },

  'number, number': (a: f64, b: f64) => Math.min(a, b),
} as Signatures);

/**
 * Parallel maximum element
 */
export const parallelMatrixMax = mathTyped('parallelMatrixMax', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pMax(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pMax(a);
    return result.result;
  },

  'Array': (arr: number[]) => {
    if (arr.length === 0) return -Infinity;
    let maxVal: f64 = arr[0];
    for (let i: i32 = 1; i < arr.length; i++) {
      if (arr[i] > maxVal) maxVal = arr[i];
    }
    return maxVal;
  },

  'number, number': (a: f64, b: f64) => Math.max(a, b),
} as Signatures);

/**
 * Parallel variance computation
 */
export const parallelMatrixVariance = mathTyped('parallelMatrixVariance', {
  'DenseMatrix': async (a: DenseMatrix): Promise<{ mean: f64; variance: f64; std: f64 }> => {
    const dataA = matrixToFloat64(a);
    const result = await pVariance(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<{ mean: f64; variance: f64; std: f64 }> => {
    const result = await pVariance(a);
    return result.result;
  },
} as Signatures);

/**
 * Parallel standard deviation
 */
export const parallelMatrixStd = mathTyped('parallelMatrixStd', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pStd(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pStd(a);
    return result.result;
  },
} as Signatures);

/**
 * Parallel Frobenius norm
 */
export const parallelMatrixNorm = mathTyped('parallelMatrixNorm', {
  'DenseMatrix': async (a: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const result = await pNorm(dataA);
    return result.result;
  },

  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await pNorm(a);
    return result.result;
  },

  'Array': (arr: number[]) => {
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i] * arr[i];
    }
    return Math.sqrt(sum);
  },
} as Signatures);

/**
 * Parallel dot product
 */
export const parallelMatrixDot = mathTyped('parallelMatrixDot', {
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);
    const result = await pDot(dataA, dataB);
    return result.result;
  },

  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<f64> => {
    const result = await pDot(a, b);
    return result.result;
  },

  'Array, Array': (a: number[], b: number[]) => {
    let sum: f64 = 0;
    const n: i32 = Math.min(a.length, b.length);
    for (let i: i32 = 0; i < n; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  },
} as Signatures);

/**
 * Matrix trace (sum of diagonal elements)
 */
export const parallelMatrixTrace = mathTyped('parallelMatrixTrace', {
  'DenseMatrix': (a: DenseMatrix) => a.trace(),
} as Signatures);

/**
 * Parallel Euclidean distance
 */
export const parallelMatrixDistance = mathTyped('parallelMatrixDistance', {
  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<f64> => {
    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);
    const result = await pDistance(dataA, dataB);
    return result.result;
  },

  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<f64> => {
    const result = await pDistance(a, b);
    return result.result;
  },
} as Signatures);

// =============================================================================
// Parallel Element-wise Functions
// =============================================================================

/**
 * Parallel element-wise absolute value
 */
export const parallelMatrixAbs = mathTyped('parallelMatrixAbs', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pAbs(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pAbs(a);
    return result.result;
  },

  'number': (a: f64) => Math.abs(a),
} as Signatures);

/**
 * Parallel element-wise square root
 */
export const parallelMatrixSqrt = mathTyped('parallelMatrixSqrt', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pSqrt(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pSqrt(a);
    return result.result;
  },

  'number': (a: f64) => Math.sqrt(a),
} as Signatures);

/**
 * Parallel element-wise square
 */
export const parallelMatrixSquare = mathTyped('parallelMatrixSquare', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pSquare(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pSquare(a);
    return result.result;
  },

  'number': (a: f64) => a * a,
} as Signatures);

/**
 * Parallel element-wise exponential
 */
export const parallelMatrixExp = mathTyped('parallelMatrixExp', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pExp(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pExp(a);
    return result.result;
  },

  'number': (a: f64) => Math.exp(a),
} as Signatures);

/**
 * Parallel element-wise natural logarithm
 */
export const parallelMatrixLog = mathTyped('parallelMatrixLog', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pLog(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pLog(a);
    return result.result;
  },

  'number': (a: f64) => Math.log(a),
} as Signatures);

/**
 * Parallel element-wise sine
 */
export const parallelMatrixSin = mathTyped('parallelMatrixSin', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pSin(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pSin(a);
    return result.result;
  },

  'number': (a: f64) => Math.sin(a),
} as Signatures);

/**
 * Parallel element-wise cosine
 */
export const parallelMatrixCos = mathTyped('parallelMatrixCos', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pCos(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pCos(a);
    return result.result;
  },

  'number': (a: f64) => Math.cos(a),
} as Signatures);

/**
 * Parallel element-wise tangent
 */
export const parallelMatrixTan = mathTyped('parallelMatrixTan', {
  'DenseMatrix': async (a: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const result = await pTan(dataA);
    return float64ToMatrix(result.result, a.rows, a.cols);
  },

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await pTan(a);
    return result.result;
  },

  'number': (a: f64) => Math.tan(a),
} as Signatures);

// =============================================================================
// Parallel Matrix Query Functions
// =============================================================================

/**
 * Get matrix dimensions
 */
export const parallelMatrixSize = mathTyped('parallelMatrixSize', {
  'DenseMatrix': (a: DenseMatrix) => [a.rows, a.cols],

  'Float64Array': (a: Float64Array) => [a.length],

  'Array': (arr: unknown[]) => {
    if (Array.isArray(arr[0])) {
      return [arr.length, (arr[0] as unknown[]).length];
    }
    return [arr.length];
  },
} as Signatures);

/**
 * Get element at position
 */
export const parallelMatrixSubset = mathTyped('parallelMatrixSubset', {
  'DenseMatrix, number, number': (a: DenseMatrix, row: f64, col: f64) =>
    a.get(row as i32, col as i32),
} as Signatures);

/**
 * Get row from matrix
 */
export const parallelMatrixRow = mathTyped('parallelMatrixRow', {
  'DenseMatrix, number': (a: DenseMatrix, index: f64) => a.row(index as i32),
} as Signatures);

/**
 * Get column from matrix
 */
export const parallelMatrixColumn = mathTyped('parallelMatrixColumn', {
  'DenseMatrix, number': (a: DenseMatrix, index: f64) => a.column(index as i32),
} as Signatures);

/**
 * Get diagonal from matrix
 */
export const parallelMatrixDiagonal = mathTyped('parallelMatrixDiagonal', {
  'DenseMatrix': (a: DenseMatrix) => a.diagonal(),
  'DenseMatrix, number': (a: DenseMatrix, k: f64) => a.diagonal(k as i32),
} as Signatures);

// =============================================================================
// Additional Parallel Matrix Operations
// =============================================================================

/**
 * Parallel matrix-vector multiplication
 */
export const parallelMatrixMatvec = mathTyped('parallelMatrixMatvec', {
  'DenseMatrix, DenseMatrix': async (matrix: DenseMatrix, vector: DenseMatrix): Promise<DenseMatrix> => {
    if (vector.cols !== 1) {
      throw new Error('Second argument must be a column vector');
    }
    if (matrix.cols !== vector.rows) {
      throw new Error(`Dimension mismatch: ${matrix.cols} ≠ ${vector.rows}`);
    }

    const matData = matrixToFloat64(matrix);
    const vecData = matrixToFloat64(vector);

    const result = await pMatvec(matData, matrix.rows, matrix.cols, vecData);
    return float64ToMatrix(result.result, matrix.rows, 1);
  },

  'DenseMatrix, Float64Array': async (matrix: DenseMatrix, vector: Float64Array): Promise<Float64Array> => {
    if (matrix.cols !== vector.length) {
      throw new Error(`Dimension mismatch: ${matrix.cols} ≠ ${vector.length}`);
    }

    const matData = matrixToFloat64(matrix);
    const result = await pMatvec(matData, matrix.rows, matrix.cols, vector);
    return result.result;
  },
} as Signatures);

/**
 * Parallel outer product
 */
export const parallelMatrixOuter = mathTyped('parallelMatrixOuter', {
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<DenseMatrix> => {
    const result = await pOuter(a, b);
    return float64ToMatrix(result.result, a.length, b.length);
  },

  'DenseMatrix, DenseMatrix': async (a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> => {
    const dataA = matrixToFloat64(a);
    const dataB = matrixToFloat64(b);
    const result = await pOuter(dataA, dataB);
    return float64ToMatrix(result.result, a.rows * a.cols, b.rows * b.cols);
  },
} as Signatures);

/**
 * Parallel histogram computation
 */
export const parallelMatrixHistogram = mathTyped('parallelMatrixHistogram', {
  'DenseMatrix, number': async (a: DenseMatrix, bins: f64): Promise<number[]> => {
    const dataA = matrixToFloat64(a);
    const result = await pHistogram(dataA, bins as i32);
    return result.result;
  },

  'Float64Array, number': async (a: Float64Array, bins: f64): Promise<number[]> => {
    const result = await pHistogram(a, bins as i32);
    return result.result;
  },

  'Float64Array, number, number, number': async (
    a: Float64Array,
    bins: f64,
    min: f64,
    max: f64
  ): Promise<number[]> => {
    const result = await pHistogram(a, bins as i32, min, max);
    return result.result;
  },
} as Signatures);

// =============================================================================
// Export All Parallel Matrix Functions
// =============================================================================

export const parallelMatrixOperations = {
  // Creation
  matrix: parallelMatrix,
  identity: parallelIdentity,
  zeros: parallelZeros,
  ones: parallelOnes,
  diag: parallelDiag,
  random: parallelRandom,

  // Arithmetic
  add: parallelMatrixAdd,
  subtract: parallelMatrixSubtract,
  multiply: parallelMatrixMultiply,
  dotMultiply: parallelDotMultiply,
  divide: parallelMatrixDivide,
  unaryMinus: parallelUnaryMinus,
  transpose: parallelMatrixTranspose,

  // Reductions
  sum: parallelMatrixSum,
  mean: parallelMatrixMean,
  min: parallelMatrixMin,
  max: parallelMatrixMax,
  variance: parallelMatrixVariance,
  std: parallelMatrixStd,
  norm: parallelMatrixNorm,
  dot: parallelMatrixDot,
  trace: parallelMatrixTrace,
  distance: parallelMatrixDistance,

  // Element-wise
  abs: parallelMatrixAbs,
  sqrt: parallelMatrixSqrt,
  square: parallelMatrixSquare,
  exp: parallelMatrixExp,
  log: parallelMatrixLog,
  sin: parallelMatrixSin,
  cos: parallelMatrixCos,
  tan: parallelMatrixTan,

  // Query
  size: parallelMatrixSize,
  subset: parallelMatrixSubset,
  row: parallelMatrixRow,
  column: parallelMatrixColumn,
  diagonal: parallelMatrixDiagonal,

  // Additional
  matvec: parallelMatrixMatvec,
  outer: parallelMatrixOuter,
  histogram: parallelMatrixHistogram,
};

/**
 * Initialize parallel matrix operations
 */
export async function initializeParallelMatrix(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate parallel matrix operations pool
 */
export async function terminateParallelMatrix(): Promise<void> {
  await computePool.terminate();
}
