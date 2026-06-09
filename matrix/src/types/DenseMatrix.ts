/**
 * Dense Matrix Implementation
 *
 * Row-major dense matrix backed by Float64Array for efficient storage
 * and operations. Supports views (slices without copying) where possible.
 *
 * @packageDocumentation
 */

import { Matrix, MatrixEntry, SliceSpec } from './Matrix.js';
import * as arithmetic from './dense/arithmetic.js';
import * as reduction from './dense/reduction.js';

/**
 * Dense matrix implementation using Float64Array
 *
 * Data is stored in row-major order for cache-friendly row access.
 * All operations return new matrices (immutable API).
 */
export class DenseMatrix extends Matrix<number> {
  readonly type = 'DenseMatrix' as const;
  readonly rows: number;
  readonly cols: number;

  /**
   * Internal data storage (row-major Float64Array)
   */
  private readonly data!: Float64Array;

  /**
   * Whether this matrix is a view into another matrix's data
   */
  private readonly isView: boolean;

  /**
   * Offset into data array (for views)
   */
  private readonly offset: number;

  /**
   * Stride between rows (for views)
   */
  private readonly rowStride: number;

  /**
   * Create a new DenseMatrix
   *
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param data - Optional initial data (row-major order)
   */
  constructor(
    rows: number,
    cols: number,
    data?: Float64Array | number[] | number[][],
    viewConfig?: { isView: boolean; offset: number; rowStride: number }
  ) {
    super();

    if (rows < 0 || cols < 0) {
      throw new Error('Matrix dimensions must be non-negative');
    }

    this.rows = rows;
    this.cols = cols;

    if (viewConfig) {
      // View into existing data
      this.isView = viewConfig.isView;
      this.offset = viewConfig.offset;
      this.rowStride = viewConfig.rowStride;
      this.data = data as Float64Array;
    } else {
      this.isView = false;
      this.offset = 0;
      this.rowStride = cols;

      if (data === undefined) {
        // Zero-initialized matrix
        this.data = new Float64Array(rows * cols);
      } else if (data instanceof Float64Array) {
        if (data.length !== rows * cols) {
          throw new Error(`Data length ${data.length} does not match dimensions ${rows}×${cols}`);
        }
        this.data = data;
      } else if (Array.isArray(data)) {
        if (Array.isArray(data[0])) {
          // Nested array
          const nested = data as number[][];
          if (nested.length !== rows) {
            throw new Error(`Expected ${rows} rows, got ${nested.length}`);
          }
          this.data = new Float64Array(rows * cols);
          for (let i = 0; i < rows; i++) {
            if (nested[i].length !== cols) {
              throw new Error(`Row ${i} has ${nested[i].length} elements, expected ${cols}`);
            }
            for (let j = 0; j < cols; j++) {
              this.data[i * cols + j] = nested[i][j];
            }
          }
        } else {
          // Flat array
          const flat = data as number[];
          if (flat.length !== rows * cols) {
            throw new Error(`Data length ${flat.length} does not match dimensions ${rows}×${cols}`);
          }
          this.data = new Float64Array(flat);
        }
      }
    }
  }

  // =========================================================================
  // Static Factory Methods
  // =========================================================================

  /**
   * Create a matrix from a nested array
   */
  static fromArray(arr: number[][]): DenseMatrix {
    const rows = arr.length;
    const cols = arr[0]?.length ?? 0;
    return new DenseMatrix(rows, cols, arr);
  }

  /**
   * Create a matrix from a flat array with specified dimensions
   */
  static fromFlat(rows: number, cols: number, data: number[]): DenseMatrix {
    return new DenseMatrix(rows, cols, data);
  }

  /**
   * Create a zero matrix
   */
  static zeros(rows: number, cols: number): DenseMatrix {
    return new DenseMatrix(rows, cols);
  }

  /**
   * Create a matrix filled with ones
   */
  static ones(rows: number, cols: number): DenseMatrix {
    const data = new Float64Array(rows * cols).fill(1);
    return new DenseMatrix(rows, cols, data);
  }

  /**
   * Create an identity matrix
   */
  static identity(n: number): DenseMatrix {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = 1;
    }
    return new DenseMatrix(n, n, data);
  }

  /**
   * Create a diagonal matrix from values
   */
  static diag(values: number[]): DenseMatrix {
    const n = values.length;
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = values[i];
    }
    return new DenseMatrix(n, n, data);
  }

  /**
   * Create a matrix filled with a constant value
   */
  static fill(rows: number, cols: number, value: number): DenseMatrix {
    const data = new Float64Array(rows * cols).fill(value);
    return new DenseMatrix(rows, cols, data);
  }

  /**
   * Create a matrix with random values in [0, 1)
   */
  static random(rows: number, cols: number): DenseMatrix {
    const data = new Float64Array(rows * cols);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random();
    }
    return new DenseMatrix(rows, cols, data);
  }

  // =========================================================================
  // Element Access
  // =========================================================================

  /**
   * Get element at (row, col)
   * O(1) access time
   */
  get(row: number, col: number): number {
    this.checkBounds(row, col);
    return this.data[this.offset + row * this.rowStride + col];
  }

  /**
   * Set element at (row, col) - returns new matrix
   */
  set(row: number, col: number, value: number): DenseMatrix {
    this.checkBounds(row, col);
    const newData = this.toFlatFloat64Array();
    newData[row * this.cols + col] = value;
    return new DenseMatrix(this.rows, this.cols, newData);
  }

  /**
   * Get the raw Float64Array data (copy if view, reference otherwise)
   */
  private toFlatFloat64Array(): Float64Array {
    if (!this.isView && this.offset === 0 && this.rowStride === this.cols) {
      // Return a copy of the data
      return new Float64Array(this.data);
    }
    // Extract data from view
    const result = new Float64Array(this.rows * this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result[i * this.cols + j] = this.data[this.offset + i * this.rowStride + j];
      }
    }
    return result;
  }

  // =========================================================================
  // Row/Column/Slice Operations
  // =========================================================================

  /**
   * Get a row as a 1×n matrix (view, no copy)
   */
  row(index: number): DenseMatrix {
    if (index < 0 || index >= this.rows) {
      throw new RangeError(`Row index ${index} out of bounds for matrix with ${this.rows} rows`);
    }
    return new DenseMatrix(1, this.cols, this.data, {
      isView: true,
      offset: this.offset + index * this.rowStride,
      rowStride: this.rowStride,
    });
  }

  /**
   * Get a column as an m×1 matrix (copy, since data is row-major)
   */
  column(index: number): DenseMatrix {
    if (index < 0 || index >= this.cols) {
      throw new RangeError(
        `Column index ${index} out of bounds for matrix with ${this.cols} columns`
      );
    }
    const data = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      data[i] = this.get(i, index);
    }
    return new DenseMatrix(this.rows, 1, data);
  }

  /**
   * Get a submatrix
   */
  slice(spec: SliceSpec): DenseMatrix {
    const rowStart = spec.rowStart ?? 0;
    const rowEnd = spec.rowEnd ?? this.rows;
    const colStart = spec.colStart ?? 0;
    const colEnd = spec.colEnd ?? this.cols;

    if (rowStart < 0 || rowEnd > this.rows || colStart < 0 || colEnd > this.cols) {
      throw new RangeError('Slice indices out of bounds');
    }
    if (rowStart >= rowEnd || colStart >= colEnd) {
      throw new Error('Invalid slice: start must be less than end');
    }

    const newRows = rowEnd - rowStart;
    const newCols = colEnd - colStart;

    // For contiguous columns, create a view
    if (colStart === 0 && colEnd === this.cols) {
      return new DenseMatrix(newRows, newCols, this.data, {
        isView: true,
        offset: this.offset + rowStart * this.rowStride,
        rowStride: this.rowStride,
      });
    }

    // Otherwise, copy the data
    const data = new Float64Array(newRows * newCols);
    for (let i = 0; i < newRows; i++) {
      for (let j = 0; j < newCols; j++) {
        data[i * newCols + j] = this.get(rowStart + i, colStart + j);
      }
    }
    return new DenseMatrix(newRows, newCols, data);
  }

  /**
   * Get the diagonal elements
   */
  diagonal(k: number = 0): DenseMatrix {
    const diagLength = Math.min(this.rows - Math.max(0, k), this.cols - Math.max(0, -k));

    if (diagLength <= 0) {
      return new DenseMatrix(0, 1);
    }

    const data = new Float64Array(diagLength);
    const rowOffset = Math.max(0, -k);
    const colOffset = Math.max(0, k);

    for (let i = 0; i < diagLength; i++) {
      data[i] = this.get(rowOffset + i, colOffset + i);
    }

    return new DenseMatrix(diagLength, 1, data);
  }

  // =========================================================================
  // Arithmetic Operations
  // =========================================================================

  /**
   * Matrix addition
   */
  add(other: Matrix<number>): DenseMatrix {
    this.checkDimensionsMatch(other);
    return new DenseMatrix(this.rows, this.cols, arithmetic.add(this, other));
  }

  /**
   * Matrix subtraction
   */
  subtract(other: Matrix<number>): DenseMatrix {
    this.checkDimensionsMatch(other);
    return new DenseMatrix(this.rows, this.cols, arithmetic.subtract(this, other));
  }

  /**
   * Element-wise multiplication (Hadamard product)
   */
  multiplyElementwise(other: Matrix<number>): DenseMatrix {
    this.checkDimensionsMatch(other);
    return new DenseMatrix(this.rows, this.cols, arithmetic.multiplyElementwise(this, other));
  }

  /**
   * Matrix multiplication
   */
  multiply(other: Matrix<number>): DenseMatrix {
    this.checkMultiplyDimensions(other);
    return new DenseMatrix(this.rows, other.cols, arithmetic.multiply(this, other));
  }

  /**
   * Scalar multiplication
   */
  scale(scalar: number): DenseMatrix {
    return new DenseMatrix(this.rows, this.cols, arithmetic.scale(this, scalar));
  }

  /**
   * Matrix transpose
   */
  transpose(): DenseMatrix {
    return new DenseMatrix(this.cols, this.rows, arithmetic.transpose(this));
  }

  /**
   * Negate all elements
   */
  negate(): DenseMatrix {
    return this.scale(-1);
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements
   */
  sum(): number {
    return reduction.sum(this);
  }

  /**
   * Mean of all elements
   */
  mean(): number {
    return reduction.mean(this);
  }

  /**
   * Minimum element
   */
  min(): number {
    return reduction.min(this);
  }

  /**
   * Maximum element
   */
  max(): number {
    return reduction.max(this);
  }

  /**
   * Frobenius norm (sqrt of sum of squared elements)
   */
  norm(): number {
    return reduction.norm(this);
  }

  /**
   * Trace (sum of diagonal elements)
   */
  trace(): number {
    return reduction.trace(this);
  }

  // =========================================================================
  // Conversion Methods
  // =========================================================================

  /**
   * Convert to nested array
   */
  toArray(): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      result[i] = [];
      for (let j = 0; j < this.cols; j++) {
        result[i][j] = this.get(i, j);
      }
    }
    return result;
  }

  /**
   * Convert to flat array (row-major)
   */
  toFlatArray(): number[] {
    return Array.from(this.toFlatFloat64Array());
  }

  /**
   * Get the underlying Float64Array (copy)
   */
  toFloat64Array(): Float64Array {
    return this.toFlatFloat64Array();
  }

  /**
   * Clone the matrix
   */
  clone(): DenseMatrix {
    return new DenseMatrix(this.rows, this.cols, this.toFlatFloat64Array());
  }

  /**
   * Convert to sparse matrix (CSR format)
   *
   * This is a synchronous conversion that creates a SparseMatrix
   * containing only the non-zero elements of this matrix.
   *
   * @param dropTolerance - Values below this threshold are treated as zero
   * @returns SparseMatrix representation (typed as the `Matrix` base — the
   *   `SparseMatrix` subtype is loaded lazily to avoid an import cycle)
   */
  toSparse(dropTolerance: number = 0): Matrix {
    // Build CSR components directly to avoid circular import issues
    const values: number[] = [];
    const colIndices: number[] = [];
    const rowPointers: number[] = [0];

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const val = this.get(i, j);
        if (Math.abs(val) > dropTolerance) {
          values.push(val);
          colIndices.push(j);
        }
      }
      rowPointers.push(values.length);
    }

    // Synchronous lazy require to break the DenseMatrix ↔ SparseMatrix cycle
    // — `toSparse()` is sync, so dynamic `import()` (which is async) can't be
    // used here. The static `import type { SparseMatrix }` was already dropped
    // per the cycle-elimination work in 2026-05-22; this require materialises
    // the runtime value only when the method is actually called.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SparseMatrixModule = require('./SparseMatrix.js');
    return new SparseMatrixModule.SparseMatrix(
      this.rows,
      this.cols,
      new Float64Array(values),
      new Int32Array(colIndices),
      new Int32Array(rowPointers)
    );
  }

  // =========================================================================
  // Iteration
  // =========================================================================

  /**
   * Iterate over entries with indices
   */
  *entries(): IterableIterator<MatrixEntry<number>> {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        yield { row: i, col: j, value: this.get(i, j) };
      }
    }
  }

  /**
   * Iterate over values (row-major)
   */
  *values(): IterableIterator<number> {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        yield this.get(i, j);
      }
    }
  }

  /**
   * Support for...of iteration (iterates over values)
   */
  [Symbol.iterator](): IterableIterator<number> {
    return this.values();
  }

  // =========================================================================
  // Map/Apply Operations
  // =========================================================================

  /**
   * Apply a function to each element
   */
  map(fn: (value: number, row: number, col: number) => number): DenseMatrix {
    const result = new Float64Array(this.rows * this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result[i * this.cols + j] = fn(this.get(i, j), i, j);
      }
    }
    return new DenseMatrix(this.rows, this.cols, result);
  }

  /**
   * Apply a function to each element (no return, for side effects)
   */
  forEach(fn: (value: number, row: number, col: number) => void): void {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        fn(this.get(i, j), i, j);
      }
    }
  }
}

/**
 * Type guard for DenseMatrix
 */
export function isDenseMatrix(value: unknown): value is DenseMatrix {
  return value instanceof DenseMatrix;
}
