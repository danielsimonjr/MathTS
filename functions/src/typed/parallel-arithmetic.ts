/**
 * Parallel-First Typed Arithmetic Functions
 *
 * AssemblyScript-friendly TypeScript implementation with deep integration
 * with workerpool for WebWorkers spawning and pooling.
 *
 * Uses typed-function for polymorphic dispatch and ComputePool for
 * automatic parallelization of array operations.
 *
 * @packageDocumentation
 */

import {
  mathTyped,
  Complex,
  Fraction,
  BigNumber,
} from '@mathts/core';

import { ComputePool, computePool } from '@mathts/parallel';

// =============================================================================
// Type Aliases for AssemblyScript Compatibility
// =============================================================================

type f64 = number;
type i32 = number;
type i64 = bigint;

// =============================================================================
// Parallel-First Addition
// =============================================================================

/**
 * Polymorphic addition with parallel execution for arrays
 *
 * For Float64Array inputs, uses worker pool for parallel computation.
 * Falls back to sequential for scalar types.
 */
export const parallelAdd = mathTyped('parallelAdd', {
  'number, number': (a: f64, b: f64): f64 => a + b,

  'bigint, bigint': (a: i64, b: i64): i64 => a + b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.add(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.add(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.add(b),

  // Parallel array addition using ComputePool
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.add(a, b);
    return result.result;
  },

  // Mixed scalar-array operations
  'number, Complex': (a: f64, b: Complex): Complex => Complex.fromNumber(a).add(b),
  'Complex, number': (a: Complex, b: f64): Complex => a.add(Complex.fromNumber(b)),

  // Variadic addition (sequential - no benefit from parallelization)
  'number, number, ...number': (a: f64, b: f64, ...rest: f64[]): f64 =>
    rest.reduce((acc: f64, val: f64): f64 => acc + val, a + b),
});

// =============================================================================
// Parallel-First Subtraction
// =============================================================================

/**
 * Polymorphic subtraction with parallel execution for arrays
 */
export const parallelSubtract = mathTyped('parallelSubtract', {
  'number, number': (a: f64, b: f64): f64 => a - b,

  'bigint, bigint': (a: i64, b: i64): i64 => a - b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.subtract(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.subtract(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.subtract(b),

  // Parallel array subtraction
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.subtract(a, b);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Multiplication
// =============================================================================

/**
 * Polymorphic multiplication with parallel execution for arrays
 */
export const parallelMultiply = mathTyped('parallelMultiply', {
  'number, number': (a: f64, b: f64): f64 => a * b,

  'bigint, bigint': (a: i64, b: i64): i64 => a * b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.multiply(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.multiply(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.multiply(b),

  // Parallel element-wise multiplication
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.multiply(a, b);
    return result.result;
  },

  // Parallel scalar multiplication (scale)
  'Float64Array, number': async (a: Float64Array, scalar: f64): Promise<Float64Array> => {
    const result = await computePool.scale(a, scalar);
    return result.result;
  },

  'number, Float64Array': async (scalar: f64, a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.scale(a, scalar);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Division
// =============================================================================

/**
 * Polymorphic division with parallel execution for arrays
 */
export const parallelDivide = mathTyped('parallelDivide', {
  'number, number': (a: f64, b: f64): f64 => a / b,

  'bigint, bigint': (a: i64, b: i64): i64 => a / b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.divide(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.divide(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.divide(b),

  // Parallel element-wise division
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.divide(a, b);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Unary Operations
// =============================================================================

/**
 * Parallel absolute value
 */
export const parallelAbs = mathTyped('parallelAbs', {
  'number': (a: f64): f64 => Math.abs(a),
  'bigint': (a: i64): i64 => (a < 0n ? -a : a),
  'Complex': (a: Complex): f64 => a.abs(),
  'Fraction': (a: Fraction): Fraction => a.abs(),
  'BigNumber': (a: BigNumber): BigNumber => a.abs(),

  // Parallel array abs
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.abs(a);
    return result.result;
  },
});

/**
 * Parallel negation
 */
export const parallelNegate = mathTyped('parallelNegate', {
  'number': (a: f64): f64 => -a,
  'bigint': (a: i64): i64 => -a,
  'Complex': (a: Complex): Complex => a.neg(),
  'Fraction': (a: Fraction): Fraction => a.neg(),
  'BigNumber': (a: BigNumber): BigNumber => a.neg(),

  // Parallel array negation
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.negate(a);
    return result.result;
  },
});

/**
 * Parallel square
 */
export const parallelSquare = mathTyped('parallelSquare', {
  'number': (a: f64): f64 => a * a,
  'bigint': (a: i64): i64 => a * a,
  'Complex': (a: Complex): Complex => a.multiply(a),
  'Fraction': (a: Fraction): Fraction => a.multiply(a),
  'BigNumber': (a: BigNumber): BigNumber => a.multiply(a),

  // Parallel array square
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.square(a);
    return result.result;
  },
});

/**
 * Parallel square root
 */
export const parallelSqrt = mathTyped('parallelSqrt', {
  'number': (a: f64): f64 | Complex => {
    if (a < 0) {
      return new Complex(0, Math.sqrt(-a));
    }
    return Math.sqrt(a);
  },
  'Complex': (a: Complex): Complex => a.sqrt(),
  'BigNumber': (a: BigNumber): BigNumber => a.sqrt(),

  // Parallel array sqrt
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.sqrt(a);
    return result.result;
  },
});

/**
 * Parallel exponential
 */
export const parallelExp = mathTyped('parallelExp', {
  'number': (a: f64): f64 => Math.exp(a),
  'Complex': (a: Complex): Complex => a.exp(),
  'BigNumber': (a: BigNumber): BigNumber => a.exp(),

  // Parallel array exp
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.exp(a);
    return result.result;
  },
});

/**
 * Parallel natural logarithm
 */
export const parallelLog = mathTyped('parallelLog', {
  'number': (a: f64): f64 => Math.log(a),
  'Complex': (a: Complex): Complex => a.log(),
  'BigNumber': (a: BigNumber): BigNumber => a.ln(),

  // Parallel array log
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.log(a);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Trigonometric Operations
// =============================================================================

/**
 * Parallel sine
 */
export const parallelSin = mathTyped('parallelSin', {
  'number': (a: f64): f64 => Math.sin(a),
  'Complex': (a: Complex): Complex => a.sin(),
  'BigNumber': (a: BigNumber): BigNumber => a.sin(),

  // Parallel array sin
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.sin(a);
    return result.result;
  },
});

/**
 * Parallel cosine
 */
export const parallelCos = mathTyped('parallelCos', {
  'number': (a: f64): f64 => Math.cos(a),
  'Complex': (a: Complex): Complex => a.cos(),
  'BigNumber': (a: BigNumber): BigNumber => a.cos(),

  // Parallel array cos
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.cos(a);
    return result.result;
  },
});

/**
 * Parallel tangent
 */
export const parallelTan = mathTyped('parallelTan', {
  'number': (a: f64): f64 => Math.tan(a),
  'Complex': (a: Complex): Complex => a.tan(),
  'BigNumber': (a: BigNumber): BigNumber => a.tan(),

  // Parallel array tan
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.tan(a);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Statistical Operations
// =============================================================================

/**
 * Parallel sum
 */
export const parallelSum = mathTyped('parallelSum', {
  'Array': (arr: f64[]): f64 => {
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum;
  },

  // Parallel Float64Array sum
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.sum(a);
    return result.result;
  },
});

/**
 * Parallel mean
 */
export const parallelMean = mathTyped('parallelMean', {
  'Array': (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let sum: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum / arr.length;
  },

  // Parallel Float64Array mean
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.mean(a);
    return result.result;
  },
});

/**
 * Parallel variance
 */
export const parallelVariance = mathTyped('parallelVariance', {
  'Array': (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let mean: f64 = 0;
    let m2: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      const delta: f64 = arr[i] - mean;
      mean += delta / (i + 1);
      const delta2: f64 = arr[i] - mean;
      m2 += delta * delta2;
    }
    return m2 / arr.length;
  },

  // Parallel Float64Array variance
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.variance(a);
    return result.result.variance;
  },
});

/**
 * Parallel standard deviation
 */
export const parallelStd = mathTyped('parallelStd', {
  'Array': (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let mean: f64 = 0;
    let m2: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      const delta: f64 = arr[i] - mean;
      mean += delta / (i + 1);
      const delta2: f64 = arr[i] - mean;
      m2 += delta * delta2;
    }
    return Math.sqrt(m2 / arr.length);
  },

  // Parallel Float64Array std
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.std(a);
    return result.result;
  },
});

/**
 * Parallel minimum
 */
export const parallelMin = mathTyped('parallelMin', {
  'number, number': (a: f64, b: f64): f64 => Math.min(a, b),
  'bigint, bigint': (a: i64, b: i64): i64 => (a < b ? a : b),
  'Array': (arr: f64[]): f64 => Math.min(...arr),
  'number, number, ...number': (a: f64, b: f64, ...rest: f64[]): f64 => Math.min(a, b, ...rest),

  // Parallel Float64Array min
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.min(a);
    return result.result;
  },
});

/**
 * Parallel maximum
 */
export const parallelMax = mathTyped('parallelMax', {
  'number, number': (a: f64, b: f64): f64 => Math.max(a, b),
  'bigint, bigint': (a: i64, b: i64): i64 => (a > b ? a : b),
  'Array': (arr: f64[]): f64 => Math.max(...arr),
  'number, number, ...number': (a: f64, b: f64, ...rest: f64[]): f64 => Math.max(a, b, ...rest),

  // Parallel Float64Array max
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.max(a);
    return result.result;
  },
});

/**
 * Parallel norm (Euclidean length)
 */
export const parallelNorm = mathTyped('parallelNorm', {
  'number': (a: f64): f64 => Math.abs(a),
  'Complex': (a: Complex): f64 => a.abs(),
  'BigNumber': (a: BigNumber): BigNumber => a.abs(),
  'Array': (arr: f64[]): f64 => Math.sqrt(arr.reduce((sum, x) => sum + x * x, 0)),

  // Parallel Float64Array norm
  'Float64Array': async (a: Float64Array): Promise<f64> => {
    const result = await computePool.norm(a);
    return result.result;
  },

  // P-norm for arrays
  'Array, number': (arr: f64[], p: f64): f64 => {
    if (p === Infinity) return Math.max(...arr.map(Math.abs));
    if (p === -Infinity) return Math.min(...arr.map(Math.abs));
    if (p === 0) return arr.filter(x => x !== 0).length;
    return Math.pow(arr.reduce((sum, x) => sum + Math.pow(Math.abs(x), p), 0), 1/p);
  },
});

/**
 * Parallel dot product
 */
export const parallelDot = mathTyped('parallelDot', {
  'Array, Array': (a: f64[], b: f64[]): f64 => {
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }
    let sum: f64 = 0;
    for (let i: i32 = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  },

  // Parallel Float64Array dot product
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<f64> => {
    const result = await computePool.dot(a, b);
    return result.result;
  },
});

// =============================================================================
// Parallel-First Matrix Operations
// =============================================================================

/**
 * Parallel matrix multiplication
 * @param a First matrix as flat Float64Array (row-major)
 * @param aRows Number of rows in A
 * @param aCols Number of columns in A (must equal bRows)
 * @param b Second matrix as flat Float64Array (row-major)
 * @param bCols Number of columns in B
 */
export const parallelMatmul = async (
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bCols: i32
): Promise<Float64Array> => {
  const result = await computePool.matmul(a, aRows, aCols, b, bCols);
  return result.result;
};

/**
 * Parallel matrix transpose
 */
export const parallelTranspose = async (
  data: Float64Array,
  rows: i32,
  cols: i32
): Promise<Float64Array> => {
  const result = await computePool.transpose(data, rows, cols);
  return result.result;
};

/**
 * Parallel matrix-vector multiplication
 */
export const parallelMatvec = async (
  matrix: Float64Array,
  rows: i32,
  cols: i32,
  vector: Float64Array
): Promise<Float64Array> => {
  const result = await computePool.matvec(matrix, rows, cols, vector);
  return result.result;
};

/**
 * Parallel outer product
 */
export const parallelOuter = async (
  a: Float64Array,
  b: Float64Array
): Promise<Float64Array> => {
  const result = await computePool.outer(a, b);
  return result.result;
};

// =============================================================================
// Pool Lifecycle Management
// =============================================================================

/**
 * Initialize the compute pool (call before using parallel operations)
 */
export async function initializeParallel(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate the compute pool (call when done)
 */
export async function terminateParallel(): Promise<void> {
  await computePool.terminate();
}

/**
 * Check if parallelization should be used for given element count
 */
export function shouldParallelize(elementCount: i32): boolean {
  return computePool.shouldParallelize(elementCount);
}

/**
 * Get the underlying ComputePool instance
 */
export function getComputePool(): ComputePool {
  return computePool;
}

// =============================================================================
// Export all parallel functions
// =============================================================================

export const parallelArithmetic = {
  // Basic operations
  add: parallelAdd,
  subtract: parallelSubtract,
  multiply: parallelMultiply,
  divide: parallelDivide,

  // Unary
  abs: parallelAbs,
  negate: parallelNegate,
  square: parallelSquare,
  sqrt: parallelSqrt,
  exp: parallelExp,
  log: parallelLog,

  // Trigonometric
  sin: parallelSin,
  cos: parallelCos,
  tan: parallelTan,

  // Statistical
  sum: parallelSum,
  mean: parallelMean,
  variance: parallelVariance,
  std: parallelStd,
  min: parallelMin,
  max: parallelMax,
  norm: parallelNorm,
  dot: parallelDot,

  // Matrix (async only)
  matmul: parallelMatmul,
  transpose: parallelTranspose,
  matvec: parallelMatvec,
  outer: parallelOuter,

  // Lifecycle
  initialize: initializeParallel,
  terminate: terminateParallel,
  shouldParallelize,
  getPool: getComputePool,
};
