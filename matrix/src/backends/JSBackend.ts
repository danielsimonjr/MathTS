/**
 * Pure TypeScript Matrix Backend
 *
 * Reference implementation of matrix operations using plain JavaScript.
 * Serves as baseline for correctness and fallback when WASM/GPU unavailable.
 *
 * @packageDocumentation
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
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
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = a.get(i, j) + b.get(i, j);
      }
    }

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Matrix subtraction
   */
  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = a.get(i, j) - b.get(i, j);
      }
    }

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise multiplication
   */
  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = a.get(i, j) * b.get(i, j);
      }
    }

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise division
   */
  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    this.checkDimensionsMatch(a, b);
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = a.get(i, j) / b.get(i, j);
      }
    }

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Scalar multiplication
   */
  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = a.get(i, j) * scalar;
      }
    }

    return new DenseMatrix(a.rows, a.cols, result);
  }

  /**
   * Element-wise absolute value
   */
  abs(a: DenseMatrix): DenseMatrix {
    const result = new Float64Array(a.rows * a.cols);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[i * a.cols + j] = Math.abs(a.get(i, j));
      }
    }

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
    const result = new Float64Array(m * n);

    // Standard O(mn*k) multiplication with inner product form
    // Optimized for row-major access pattern
    for (let i = 0; i < m; i++) {
      for (let p = 0; p < k; p++) {
        const aip = a.get(i, p);
        for (let j = 0; j < n; j++) {
          result[i * n + j] += aip * b.get(p, j);
        }
      }
    }

    return new DenseMatrix(m, n, result);
  }

  /**
   * Matrix transpose
   */
  transpose(a: DenseMatrix): DenseMatrix {
    const result = new Float64Array(a.cols * a.rows);

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result[j * a.rows + i] = a.get(i, j);
      }
    }

    return new DenseMatrix(a.cols, a.rows, result);
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements
   */
  sum(a: DenseMatrix): number {
    let total = 0;

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        total += a.get(i, j);
      }
    }

    return total;
  }

  /**
   * Sum along an axis
   * axis=0: sum columns (result is 1×n row vector)
   * axis=1: sum rows (result is m×1 column vector)
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
   * Frobenius norm: sqrt(sum of squared elements)
   */
  norm(a: DenseMatrix): number {
    let sumSq = 0;

    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        const val = a.get(i, j);
        sumSq += val * val;
      }
    }

    return Math.sqrt(sumSq);
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
    const aValues = Array.from(a.values());
    const bValues = Array.from(b.values());

    for (let i = 0; i < aValues.length; i++) {
      sum += aValues[i] * bValues[i];
    }

    return sum;
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
 * Default JS backend instance
 */
export const jsBackend = new JSBackend();
