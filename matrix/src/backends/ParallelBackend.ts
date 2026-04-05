/**
 * Parallel Matrix Backend
 *
 * Matrix backend that uses worker pool parallelization for operations
 * on large matrices. Automatically falls back to sequential execution
 * for smaller matrices.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool, type ComputePoolConfig } from '@danielsimonjr/mathts-parallel';
import { DenseMatrix } from '../types/DenseMatrix.js';
import type { BackendType } from './Backend.js';

/**
 * Configuration for ParallelBackend
 */
export interface ParallelBackendConfig {
  /** Custom ComputePool instance (optional) */
  pool?: ComputePool;
  /** Pool configuration (if creating new pool) */
  poolConfig?: Partial<ComputePoolConfig>;
  /** Threshold for parallel execution (elements) */
  parallelThreshold?: number;
}

/**
 * Parallel matrix backend using worker pool
 *
 * Provides parallel implementations of matrix operations for large matrices.
 * Uses automatic chunking and result aggregation for efficient parallel execution.
 *
 * @example
 * ```typescript
 * const backend = new ParallelBackend();
 * await backend.initialize();
 *
 * const result = await backend.multiply(largeMatrixA, largeMatrixB);
 * ```
 */
export class ParallelBackend {
  readonly type: BackendType = 'parallel' as BackendType;

  private pool: ComputePool;
  private initialized = false;
  private parallelThreshold: number;

  constructor(config: ParallelBackendConfig = {}) {
    this.pool = config.pool ?? new ComputePool(config.poolConfig);
    this.parallelThreshold = config.parallelThreshold ?? 10000;
  }

  /**
   * Check if parallel backend is available
   */
  isAvailable(): boolean {
    // Parallel backend requires WebWorker support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (globalThis as any).Worker !== 'undefined' || typeof process !== 'undefined';
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.pool.initialize();
      this.initialized = true;
    }
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.initialized && this.pool.isReady();
  }

  /**
   * Determine if operation should be parallelized
   */
  private shouldParallelize(elementCount: number): boolean {
    return elementCount >= this.parallelThreshold;
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  /**
   * Parallel matrix addition
   */
  async add(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    this.checkDimensionsMatch(a, b);

    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      // Sequential fallback
      return a.add(b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const result = await this.pool.elementwise(aData, bData, 'add');
    return new DenseMatrix(a.rows, a.cols, result.result);
  }

  /**
   * Parallel matrix subtraction
   */
  async subtract(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    this.checkDimensionsMatch(a, b);

    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      return a.subtract(b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const result = await this.pool.elementwise(aData, bData, 'subtract');
    return new DenseMatrix(a.rows, a.cols, result.result);
  }

  /**
   * Parallel element-wise multiplication
   */
  async multiplyElementwise(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    this.checkDimensionsMatch(a, b);

    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      return a.multiplyElementwise(b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const result = await this.pool.elementwise(aData, bData, 'multiply');
    return new DenseMatrix(a.rows, a.cols, result.result);
  }

  /**
   * Parallel element-wise division
   */
  async divideElementwise(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    this.checkDimensionsMatch(a, b);

    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      const result = new Float64Array(a.rows * a.cols);
      for (let i = 0; i < a.rows; i++) {
        for (let j = 0; j < a.cols; j++) {
          result[i * a.cols + j] = a.get(i, j) / b.get(i, j);
        }
      }
      return new DenseMatrix(a.rows, a.cols, result);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const result = await this.pool.elementwise(aData, bData, 'divide');
    return new DenseMatrix(a.rows, a.cols, result.result);
  }

  /**
   * Parallel scalar multiplication
   */
  async scale(a: DenseMatrix, scalar: number): Promise<DenseMatrix> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      return a.scale(scalar);
    }

    const aData = a.toFloat64Array();
    const result = await this.pool.scale(aData, scalar);
    return new DenseMatrix(a.rows, a.cols, result.result);
  }

  /**
   * Element-wise absolute value (sequential, as it's simple)
   */
  abs(a: DenseMatrix): DenseMatrix {
    return a.map((v) => Math.abs(v));
  }

  /**
   * Element-wise negation
   */
  negate(a: DenseMatrix): DenseMatrix {
    return a.negate();
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  /**
   * Parallel matrix multiplication
   */
  async multiply(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    this.checkMultiplyDimensions(a, b);

    const resultSize = a.rows * b.cols;

    if (!this.shouldParallelize(resultSize) || !this.isReady()) {
      return a.multiply(b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const result = await this.pool.matmul(
      aData,
      a.rows,
      a.cols,
      bData,
      b.cols
    );

    return new DenseMatrix(a.rows, b.cols, result.result);
  }

  /**
   * Parallel matrix transpose
   */
  async transpose(a: DenseMatrix): Promise<DenseMatrix> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      return a.transpose();
    }

    const aData = a.toFloat64Array();
    const result = await this.pool.transpose(aData, a.rows, a.cols);

    return new DenseMatrix(a.cols, a.rows, result.result);
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Parallel sum of all elements
   */
  async sum(a: DenseMatrix): Promise<number> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      return a.sum();
    }

    const aData = a.toFloat64Array();
    const result = await this.pool.sum(aData);
    return result.result;
  }

  /**
   * Sum along an axis (sequential)
   */
  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    if (axis === 0) {
      // Sum columns: result is 1×n
      const result = new Float64Array(a.cols);
      for (let j = 0; j < a.cols; j++) {
        for (let i = 0; i < a.rows; i++) {
          result[j] += a.get(i, j);
        }
      }
      return new DenseMatrix(1, a.cols, result);
    } else {
      // Sum rows: result is m×1
      const result = new Float64Array(a.rows);
      for (let i = 0; i < a.rows; i++) {
        for (let j = 0; j < a.cols; j++) {
          result[i] += a.get(i, j);
        }
      }
      return new DenseMatrix(a.rows, 1, result);
    }
  }

  /**
   * Frobenius norm (sequential)
   */
  norm(a: DenseMatrix): number {
    return a.norm();
  }

  /**
   * Parallel dot product
   */
  async dot(a: DenseMatrix, b: DenseMatrix): Promise<number> {
    if (!a.isVector || !b.isVector) {
      throw new Error('Dot product requires two vectors');
    }
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }

    const elementCount = a.length;

    if (!this.shouldParallelize(elementCount) || !this.isReady()) {
      let sum = 0;
      const aValues = Array.from(a.values());
      const bValues = Array.from(b.values());
      for (let i = 0; i < aValues.length; i++) {
        sum += aValues[i] * bValues[i];
      }
      return sum;
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();
    const result = await this.pool.dot(aData, bData);
    return result.result;
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Terminate the worker pool
   */
  async terminate(): Promise<void> {
    if (this.initialized) {
      await this.pool.terminate();
      this.initialized = false;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.stats();
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private checkDimensionsMatch(a: DenseMatrix, b: DenseMatrix): void {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(
        `Matrix dimensions must match: ${a.rows}×${a.cols} vs ${b.rows}×${b.cols}`
      );
    }
  }

  private checkMultiplyDimensions(a: DenseMatrix, b: DenseMatrix): void {
    if (a.cols !== b.rows) {
      throw new Error(
        `Cannot multiply ${a.rows}×${a.cols} matrix with ${b.rows}×${b.cols} matrix`
      );
    }
  }
}

/**
 * Default parallel backend instance using global compute pool
 */
export const parallelBackend = new ParallelBackend({ pool: computePool });

/**
 * Create a new parallel backend with custom configuration
 */
export function createParallelBackend(config?: ParallelBackendConfig): ParallelBackend {
  return new ParallelBackend(config);
}
