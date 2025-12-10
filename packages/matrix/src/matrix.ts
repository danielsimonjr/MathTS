/**
 * Base Matrix class
 */

import type { MatrixLike, MatrixOptions } from './types';

/**
 * Abstract base class for all matrix types
 */
export abstract class Matrix {
  abstract readonly rows: number;
  abstract readonly cols: number;

  /**
   * Create a matrix from a 2D array
   */
  static from(data: MatrixLike, _options?: MatrixOptions): Matrix {
    // TODO: Implement factory method
    throw new Error(`Matrix.from not yet implemented for data: ${typeof data}`);
  }

  /**
   * Create a zero matrix
   */
  static zeros(_rows: number, _cols: number, _options?: MatrixOptions): Matrix {
    throw new Error('Matrix.zeros not yet implemented');
  }

  /**
   * Create an identity matrix
   */
  static eye(_size: number, _options?: MatrixOptions): Matrix {
    throw new Error('Matrix.eye not yet implemented');
  }

  /**
   * Create a matrix with random values
   */
  static random(_rows: number, _cols: number, _options?: MatrixOptions): Matrix {
    throw new Error('Matrix.random not yet implemented');
  }

  /**
   * Get element at position
   */
  abstract get(row: number, col: number): number;

  /**
   * Set element at position
   */
  abstract set(row: number, col: number, value: number): void;

  /**
   * Matrix multiplication
   */
  abstract multiply(other: Matrix): Matrix;

  /**
   * Matrix addition
   */
  abstract add(other: Matrix): Matrix;

  /**
   * Matrix subtraction
   */
  abstract subtract(other: Matrix): Matrix;

  /**
   * Transpose
   */
  abstract transpose(): Matrix;

  /**
   * Determinant
   */
  abstract determinant(): number;

  /**
   * Inverse
   */
  abstract inverse(): Matrix;

  /**
   * Eigenvalues
   */
  abstract eigenvalues(): number[];

  /**
   * Convert to 2D array
   */
  abstract toArray(): number[][];
}
