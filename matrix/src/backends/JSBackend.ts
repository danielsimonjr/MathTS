/**
 * Pure TypeScript Matrix Backend
 *
 * Reference implementation of matrix operations using plain JavaScript.
 * Serves as baseline for correctness and fallback when WASM/GPU unavailable.
 *
 * @packageDocumentation
 */

import { DenseMatrix, denseContiguousData } from '../types/DenseMatrix.js';
import * as reduction from '../types/dense/reduction.js';
import type { MatrixBackend, BackendType } from './Backend.js';

/**
 * Pure JavaScript matrix backend
 *
 * All operations are implemented in TypeScript without external dependencies.
 * Performance is optimized where possible but prioritizes correctness.
 */
export class JSBackend implements MatrixBackend {
  readonly type: BackendType = 'js';

  /**
   * JS backend is always available
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * No initialization needed for JS backend
   */
  async initialize(): Promise<void> {
    // No-op for JS backend
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  /**
   * Matrix addition
   */
  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = ad[i] + bd[i];

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Matrix subtraction
   */
  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = ad[i] - bd[i];

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise multiplication
   */
  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = ad[i] * bd[i];

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise division
   */
  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = ad[i] / bd[i];

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Scalar multiplication
   */
  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const ad = denseContiguousData(a);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = ad[i] * scalar;

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise absolute value
   */
  abs(a: DenseMatrix): DenseMatrix {
    const ad = denseContiguousData(a);
    const n = ad.length;
    const result = new Float64Array(n);
    for (let i = 0; i < n; i++) result[i] = Math.abs(ad[i]);

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise negation
   */
  negate(a: DenseMatrix): DenseMatrix {
    return this.scale(a, -1);
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  /**
   * Matrix multiplication using the naive O(n³) algorithm
   *
   * For larger matrices, consider using blocked/tiled multiplication
   * or Strassen's algorithm (implemented in WASM backend).
   */
  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkMultiplyDimensions(a, b);

    const m = a.rows;
    const n = b.cols;
    const k = a.cols;
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);
    const result = new Float64Array(m * n);

    // i-k-j loop: row-major flat reads (matches dense/arithmetic.ts)
    for (let i = 0; i < m; i++) {
      const ai = i * k;
      const ri = i * n;
      for (let p = 0; p < k; p++) {
        const aip = ad[ai + p];
        const bp = p * n;
        for (let j = 0; j < n; j++) {
          result[ri + j] += aip * bd[bp + j];
        }
      }
    }

    return new DenseMatrix(m, n, result);
  }

  /**
   * Matrix transpose
   */
  transpose(a: DenseMatrix): DenseMatrix {
    const rows = a.rows;
    const cols = a.cols;
    const ad = denseContiguousData(a);
    const result = new Float64Array(cols * rows);

    for (let i = 0; i < rows; i++) {
      const ai = i * cols;
      for (let j = 0; j < cols; j++) {
        result[j * rows + i] = ad[ai + j];
      }
    }

    return new DenseMatrix(cols, rows, result);
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements
   */
  sum(a: DenseMatrix): number {
    const ad = denseContiguousData(a);
    let total = 0;
    for (let i = 0; i < ad.length; i++) total += ad[i];
    return total;
  }

  /**
   * Sum along an axis
   * axis=0: sum columns (result is 1×n row vector)
   * axis=1: sum rows (result is m×1 column vector)
   */
  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    const rows = a.rows;
    const cols = a.cols;
    const ad = denseContiguousData(a);
    if (axis === 0) {
      // Sum columns: result is 1×n (row-major walk, same per-column order)
      const result = new Float64Array(cols);
      for (let i = 0; i < rows; i++) {
        const ai = i * cols;
        for (let j = 0; j < cols; j++) result[j] += ad[ai + j];
      }
      return new DenseMatrix(1, cols, result);
    } else {
      // Sum rows: result is m×1
      const result = new Float64Array(rows);
      for (let i = 0; i < rows; i++) {
        const ai = i * cols;
        let acc = 0;
        for (let j = 0; j < cols; j++) acc += ad[ai + j];
        result[i] = acc;
      }
      return new DenseMatrix(rows, 1, result);
    }
  }

  /**
   * Frobenius norm: sqrt(sum of squared elements)
   */
  norm(a: DenseMatrix): number {
    return reduction.norm(a);
  }

  /**
   * Dot product of two vectors
   *
   * Works with row vectors (1×n) or column vectors (m×1).
   */
  dot(a: DenseMatrix, b: DenseMatrix): number {
    // Check that both are vectors
    if (!a.isVector || !b.isVector) {
      throw new Error('Dot product requires two vectors');
    }

    // Check that lengths match
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    const ad = denseContiguousData(a);
    const bd = denseContiguousData(b);

    for (let i = 0; i < ad.length; i++) {
      sum += ad[i] * bd[i];
    }

    return sum;
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private checkDimensionsMatch(a: DenseMatrix, b: DenseMatrix): void {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      throw new Error(`Matrix dimensions must match: ${a.rows}×${a.cols} vs ${b.rows}×${b.cols}`);
    }
  }

  private checkMultiplyDimensions(a: DenseMatrix, b: DenseMatrix): void {
    if (a.cols !== b.rows) {
      throw new Error(`Cannot multiply ${a.rows}×${a.cols} matrix with ${b.rows}×${b.cols} matrix`);
    }
  }
}

/**
 * Default JS backend instance
 */
export const jsBackend = new JSBackend();
