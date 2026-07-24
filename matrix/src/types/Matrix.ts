/**
 * Matrix Base Class
 *
 * Abstract base class defining the common interface for all matrix types.
 * Provides a unified API for DenseMatrix, SparseMatrix, and future implementations.
 *
 * @packageDocumentation
 */

/**
 * Matrix dimension type, consolidated from `@danielsimonjr/mathts-core`'s
 * byte-identical copy (see docs/Architecture/duplicate-symbols.json).
 */
import type { MatrixDimensions } from '@danielsimonjr/mathts-core';
export type { MatrixDimensions };

/**
 * Matrix index for element access
 */
export interface MatrixIndex {
  row: number;
  col: number;
}

/**
 * Slice specification for submatrix extraction
 */
export interface SliceSpec {
  rowStart?: number;
  rowEnd?: number;
  colStart?: number;
  colEnd?: number;
}

/**
 * Matrix iterator result
 */
export interface MatrixEntry<T = number> {
  row: number;
  col: number;
  value: T;
}

/**
 * Matrix storage format identifier
 */
export type MatrixType = 'DenseMatrix' | 'SparseMatrix' | 'DiagonalMatrix' | 'BandMatrix';

/**
 * Abstract base class for all matrix types
 *
 * @typeParam T - The element type (default: number)
 */
export abstract class Matrix<T = number> {
  /**
   * The matrix storage format type
   */
  abstract readonly type: MatrixType;

  /**
   * Number of rows
   */
  abstract readonly rows: number;

  /**
   * Number of columns
   */
  abstract readonly cols: number;

  /**
   * Get the dimensions of the matrix
   */
  get size(): MatrixDimensions {
    return { rows: this.rows, cols: this.cols };
  }

  /**
   * Check if the matrix is square
   */
  get isSquare(): boolean {
    return this.rows === this.cols;
  }

  /**
   * Check if the matrix is a vector (single row or column)
   */
  get isVector(): boolean {
    return this.rows === 1 || this.cols === 1;
  }

  /**
   * Check if the matrix is a row vector
   */
  get isRowVector(): boolean {
    return this.rows === 1;
  }

  /**
   * Check if the matrix is a column vector
   */
  get isColumnVector(): boolean {
    return this.cols === 1;
  }

  /**
   * Total number of elements
   */
  get length(): number {
    return this.rows * this.cols;
  }

  // =========================================================================
  // Abstract Element Access Methods
  // =========================================================================

  /**
   * Get element at position (row, col)
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   */
  abstract get(row: number, col: number): T;

  /**
   * Set element at position (row, col)
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @param value - Value to set
   * @returns A new matrix with the updated value (immutable)
   */
  abstract set(row: number, col: number, value: T): Matrix<T>;

  // =========================================================================
  // Abstract Submatrix/View Methods
  // =========================================================================

  /**
   * Get a row as a new matrix (1×n)
   * @param index - Row index
   */
  abstract row(index: number): Matrix<T>;

  /**
   * Get a column as a new matrix (m×1)
   * @param index - Column index
   */
  abstract column(index: number): Matrix<T>;

  /**
   * Get a submatrix (view or copy depending on implementation)
   * @param spec - Slice specification
   */
  abstract slice(spec: SliceSpec): Matrix<T>;

  /**
   * Get the diagonal elements as a vector
   * @param k - Diagonal offset (0 = main diagonal, positive = above, negative = below)
   */
  abstract diagonal(k?: number): Matrix<T>;

  // =========================================================================
  // Abstract Arithmetic Operations
  // =========================================================================

  /**
   * Matrix addition
   */
  abstract add(other: Matrix<T>): Matrix<T>;

  /**
   * Matrix subtraction
   */
  abstract subtract(other: Matrix<T>): Matrix<T>;

  /**
   * Element-wise multiplication (Hadamard product)
   */
  abstract multiplyElementwise(other: Matrix<T>): Matrix<T>;

  /**
   * Matrix multiplication
   */
  abstract multiply(other: Matrix<T>): Matrix<T>;

  /**
   * Scalar multiplication
   */
  abstract scale(scalar: T): Matrix<T>;

  /**
   * Matrix transpose
   */
  abstract transpose(): Matrix<T>;

  // =========================================================================
  // Abstract Conversion Methods
  // =========================================================================

  /**
   * Convert to nested array representation
   */
  abstract toArray(): T[][];

  /**
   * Convert to flat array (row-major order)
   */
  abstract toFlatArray(): T[];

  /**
   * Create a deep copy of the matrix
   */
  abstract clone(): Matrix<T>;

  // =========================================================================
  // Iteration Support
  // =========================================================================

  /**
   * Iterate over all elements with their indices
   */
  abstract entries(): IterableIterator<MatrixEntry<T>>;

  /**
   * Iterate over all values (row-major order)
   */
  abstract values(): IterableIterator<T>;

  // =========================================================================
  // Utility Methods (default implementations)
  // =========================================================================

  /**
   * Check if indices are within bounds
   */
  protected checkBounds(row: number, col: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new RangeError(
        `Index (${row}, ${col}) out of bounds for matrix of size ${this.rows}×${this.cols}`
      );
    }
  }

  /**
   * Check if dimensions match for element-wise operations
   */
  protected checkDimensionsMatch(other: Matrix<T>): void {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error(
        `Matrix dimensions must match: ${this.rows}×${this.cols} vs ${other.rows}×${other.cols}`
      );
    }
  }

  /**
   * Check if matrices can be multiplied
   */
  protected checkMultiplyDimensions(other: Matrix<T>): void {
    if (this.cols !== other.rows) {
      throw new Error(
        `Cannot multiply ${this.rows}×${this.cols} matrix with ${other.rows}×${other.cols} matrix`
      );
    }
  }

  /**
   * Format matrix for display
   */
  toString(): string {
    const lines: string[] = [];
    for (let i = 0; i < this.rows; i++) {
      const rowValues: string[] = [];
      for (let j = 0; j < this.cols; j++) {
        rowValues.push(String(this.get(i, j)));
      }
      lines.push(`[ ${rowValues.join(', ')} ]`);
    }
    return lines.join('\n');
  }

  /**
   * Check equality with another matrix
   */
  equals(other: Matrix<T>, tolerance: number = 0): boolean {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      return false;
    }

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const a = this.get(i, j);
        const b = other.get(i, j);
        if (typeof a === 'number' && typeof b === 'number') {
          if (Math.abs(a - b) > tolerance) {
            return false;
          }
        } else if (a !== b) {
          return false;
        }
      }
    }
    return true;
  }
}

/**
 * Type guard to check if a value is a Matrix
 */
export function isMatrix<T = number>(value: unknown): value is Matrix<T> {
  return (
    value instanceof Matrix ||
    (typeof value === 'object' &&
      value !== null &&
      'rows' in value &&
      'cols' in value &&
      'get' in value &&
      typeof (value as { type?: string }).type === 'string')
  );
}
