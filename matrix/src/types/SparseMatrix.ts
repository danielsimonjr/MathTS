/**
 * Sparse Matrix Implementation (CSR Format)
 *
 * Compressed Sparse Row (CSR) format sparse matrix for efficient storage
 * and operations on matrices with many zero elements.
 *
 * CSR stores:
 * - values: Non-zero values in row-major order
 * - colIndices: Column index for each non-zero value
 * - rowPointers: Index into values/colIndices where each row starts
 *
 * @packageDocumentation
 */

import { Matrix, MatrixEntry, SliceSpec } from './Matrix.js';
import { DenseMatrix } from './DenseMatrix.js';

/**
 * Sparse matrix using Compressed Sparse Row (CSR) format
 *
 * Efficient for:
 * - Row slicing and iteration
 * - Sparse matrix-vector multiplication
 * - Matrices with many zeros (typically < 10% non-zero)
 */
export class SparseMatrix extends Matrix<number> {
  readonly type = 'SparseMatrix' as const;
  readonly rows: number;
  readonly cols: number;

  /**
   * Non-zero values in row-major order
   */
  private readonly _data: Float64Array;

  /**
   * Column indices for each non-zero value
   */
  private readonly _colIndices: Int32Array;

  /**
   * Row pointers: rowPointers[i] = index of first non-zero in row i
   * rowPointers[rows] = total number of non-zeros (nnz)
   */
  private readonly _rowPointers: Int32Array;

  /**
   * Create a sparse matrix from CSR components
   *
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param values - Non-zero values
   * @param colIndices - Column index for each value
   * @param rowPointers - Row start indices
   */
  constructor(
    rows: number,
    cols: number,
    values: Float64Array | number[],
    colIndices: Int32Array | number[],
    rowPointers: Int32Array | number[]
  ) {
    super();

    if (rows < 0 || cols < 0) {
      throw new Error('Matrix dimensions must be non-negative');
    }

    this.rows = rows;
    this.cols = cols;
    this._data = values instanceof Float64Array ? values : new Float64Array(values);
    this._colIndices = colIndices instanceof Int32Array ? colIndices : new Int32Array(colIndices);
    this._rowPointers = rowPointers instanceof Int32Array ? rowPointers : new Int32Array(rowPointers);

    // Validate CSR structure
    if (this._rowPointers.length !== rows + 1) {
      throw new Error(`rowPointers length must be ${rows + 1}, got ${this._rowPointers.length}`);
    }
    if (this._data.length !== this._colIndices.length) {
      throw new Error('values and colIndices must have same length');
    }
    if (this._rowPointers[rows] !== this._data.length) {
      throw new Error('rowPointers[rows] must equal number of non-zeros');
    }
  }

  // =========================================================================
  // Static Factory Methods
  // =========================================================================

  /**
   * Create a sparse matrix from a dense matrix
   *
   * @param dense - Dense matrix to convert
   * @param dropTolerance - Values below this threshold are treated as zero
   */
  static fromDense(dense: DenseMatrix, dropTolerance: number = 0): SparseMatrix {
    const values: number[] = [];
    const colIndices: number[] = [];
    const rowPointers: number[] = [0];

    for (let i = 0; i < dense.rows; i++) {
      for (let j = 0; j < dense.cols; j++) {
        const val = dense.get(i, j);
        if (Math.abs(val) > dropTolerance) {
          values.push(val);
          colIndices.push(j);
        }
      }
      rowPointers.push(values.length);
    }

    return new SparseMatrix(
      dense.rows,
      dense.cols,
      new Float64Array(values),
      new Int32Array(colIndices),
      new Int32Array(rowPointers)
    );
  }

  /**
   * Create a sparse matrix from coordinate (COO) format
   *
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param entries - Array of {row, col, value} entries
   */
  static fromCOO(
    rows: number,
    cols: number,
    entries: Array<{ row: number; col: number; value: number }>
  ): SparseMatrix {
    // Sort entries by row, then by column
    const sorted = [...entries].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const values: number[] = [];
    const colIndices: number[] = [];
    const rowPointers: number[] = new Array(rows + 1).fill(0);

    // Count entries per row
    for (const entry of sorted) {
      if (entry.value !== 0) {
        rowPointers[entry.row + 1]++;
      }
    }

    // Cumulative sum for row pointers
    for (let i = 1; i <= rows; i++) {
      rowPointers[i] += rowPointers[i - 1];
    }

    // Fill values and column indices
    for (const entry of sorted) {
      if (entry.value !== 0) {
        values.push(entry.value);
        colIndices.push(entry.col);
      }
    }

    return new SparseMatrix(
      rows,
      cols,
      new Float64Array(values),
      new Int32Array(colIndices),
      new Int32Array(rowPointers)
    );
  }

  /**
   * Create a zero sparse matrix
   */
  static zeros(rows: number, cols: number): SparseMatrix {
    return new SparseMatrix(
      rows,
      cols,
      new Float64Array(0),
      new Int32Array(0),
      new Int32Array(rows + 1).fill(0)
    );
  }

  /**
   * Create a sparse identity matrix
   */
  static identity(n: number): SparseMatrix {
    const values = new Float64Array(n).fill(1);
    const colIndices = new Int32Array(n);
    const rowPointers = new Int32Array(n + 1);

    for (let i = 0; i < n; i++) {
      colIndices[i] = i;
      rowPointers[i] = i;
    }
    rowPointers[n] = n;

    return new SparseMatrix(n, n, values, colIndices, rowPointers);
  }

  /**
   * Create a sparse diagonal matrix
   */
  static diag(values: number[]): SparseMatrix {
    const n = values.length;
    const vals = new Float64Array(values.filter((v) => v !== 0));
    const colIndices: number[] = [];
    const rowPointers: number[] = [0];

    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (values[i] !== 0) {
        colIndices.push(i);
        idx++;
      }
      rowPointers.push(idx);
    }

    return new SparseMatrix(
      n,
      n,
      vals,
      new Int32Array(colIndices),
      new Int32Array(rowPointers)
    );
  }

  // =========================================================================
  // Properties
  // =========================================================================

  /**
   * Number of non-zero elements
   */
  get nnz(): number {
    return this._data.length;
  }

  /**
   * Sparsity: fraction of zero elements
   */
  get sparsity(): number {
    const total = this.rows * this.cols;
    return total === 0 ? 1 : 1 - this.nnz / total;
  }

  /**
   * Density: fraction of non-zero elements
   */
  get density(): number {
    return 1 - this.sparsity;
  }

  // =========================================================================
  // Element Access
  // =========================================================================

  /**
   * Get element at (row, col) - O(log(nnz_in_row)) for sorted columns
   */
  get(row: number, col: number): number {
    this.checkBounds(row, col);

    const start = this._rowPointers[row];
    const end = this._rowPointers[row + 1];

    // Binary search within the row
    let left = start;
    let right = end - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midCol = this._colIndices[mid];

      if (midCol === col) {
        return this._data[mid];
      } else if (midCol < col) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return 0; // Not found = zero
  }

  /**
   * Set element at (row, col) - returns new matrix (immutable)
   */
  set(row: number, col: number, value: number): SparseMatrix {
    this.checkBounds(row, col);

    const start = this._rowPointers[row];
    const end = this._rowPointers[row + 1];

    // Find insertion point
    let insertPos = start;
    let found = false;

    for (let i = start; i < end; i++) {
      if (this._colIndices[i] === col) {
        insertPos = i;
        found = true;
        break;
      } else if (this._colIndices[i] > col) {
        insertPos = i;
        break;
      } else {
        insertPos = i + 1;
      }
    }

    if (found) {
      if (value === 0) {
        // Remove existing entry
        const newData = new Float64Array(this._data.length - 1);
        const newColIndices = new Int32Array(this._colIndices.length - 1);
        const newRowPointers = new Int32Array(this._rowPointers.length);

        // Copy before removal point
        for (let i = 0; i < insertPos; i++) {
          newData[i] = this._data[i];
          newColIndices[i] = this._colIndices[i];
        }

        // Copy after removal point
        for (let i = insertPos + 1; i < this._data.length; i++) {
          newData[i - 1] = this._data[i];
          newColIndices[i - 1] = this._colIndices[i];
        }

        // Update row pointers
        for (let i = 0; i <= row; i++) {
          newRowPointers[i] = this._rowPointers[i];
        }
        for (let i = row + 1; i <= this.rows; i++) {
          newRowPointers[i] = this._rowPointers[i] - 1;
        }

        return new SparseMatrix(this.rows, this.cols, newData, newColIndices, newRowPointers);
      } else {
        // Update existing entry
        const newData = new Float64Array(this._data);
        newData[insertPos] = value;
        return new SparseMatrix(
          this.rows,
          this.cols,
          newData,
          this._colIndices,
          this._rowPointers
        );
      }
    } else {
      if (value === 0) {
        // No change needed
        return this;
      }

      // Insert new entry
      const newData = new Float64Array(this._data.length + 1);
      const newColIndices = new Int32Array(this._colIndices.length + 1);
      const newRowPointers = new Int32Array(this._rowPointers.length);

      // Copy before insertion point
      for (let i = 0; i < insertPos; i++) {
        newData[i] = this._data[i];
        newColIndices[i] = this._colIndices[i];
      }

      // Insert new value
      newData[insertPos] = value;
      newColIndices[insertPos] = col;

      // Copy after insertion point
      for (let i = insertPos; i < this._data.length; i++) {
        newData[i + 1] = this._data[i];
        newColIndices[i + 1] = this._colIndices[i];
      }

      // Update row pointers
      for (let i = 0; i <= row; i++) {
        newRowPointers[i] = this._rowPointers[i];
      }
      for (let i = row + 1; i <= this.rows; i++) {
        newRowPointers[i] = this._rowPointers[i] + 1;
      }

      return new SparseMatrix(this.rows, this.cols, newData, newColIndices, newRowPointers);
    }
  }

  // =========================================================================
  // Row/Column/Slice Operations
  // =========================================================================

  /**
   * Get a row as a sparse 1×n matrix
   */
  row(index: number): SparseMatrix {
    if (index < 0 || index >= this.rows) {
      throw new RangeError(`Row index ${index} out of bounds for matrix with ${this.rows} rows`);
    }

    const start = this._rowPointers[index];
    const end = this._rowPointers[index + 1];
    const nnzCount = end - start;

    const data = new Float64Array(nnzCount);
    const colIndices = new Int32Array(nnzCount);
    const rowPointers = new Int32Array([0, nnzCount]);

    for (let i = 0; i < nnzCount; i++) {
      data[i] = this._data[start + i];
      colIndices[i] = this._colIndices[start + i];
    }

    return new SparseMatrix(1, this.cols, data, colIndices, rowPointers);
  }

  /**
   * Get a column as a sparse m×1 matrix
   */
  column(index: number): SparseMatrix {
    if (index < 0 || index >= this.cols) {
      throw new RangeError(
        `Column index ${index} out of bounds for matrix with ${this.cols} columns`
      );
    }

    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        if (this._colIndices[j] === index) {
          entries.push({ row: i, col: 0, value: this._data[j] });
          break;
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, 1, entries);
  }

  /**
   * Get a submatrix
   */
  slice(spec: SliceSpec): SparseMatrix {
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

    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = rowStart; i < rowEnd; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        const col = this._colIndices[j];
        if (col >= colStart && col < colEnd) {
          entries.push({
            row: i - rowStart,
            col: col - colStart,
            value: this._data[j],
          });
        }
      }
    }

    return SparseMatrix.fromCOO(rowEnd - rowStart, colEnd - colStart, entries);
  }

  /**
   * Get the diagonal elements
   */
  diagonal(k: number = 0): SparseMatrix {
    const diagLength = Math.min(
      this.rows - Math.max(0, -k),
      this.cols - Math.max(0, k)
    );

    if (diagLength <= 0) {
      return SparseMatrix.zeros(0, 1);
    }

    const entries: Array<{ row: number; col: number; value: number }> = [];
    const rowOffset = Math.max(0, -k);
    const colOffset = Math.max(0, k);

    for (let i = 0; i < diagLength; i++) {
      const val = this.get(rowOffset + i, colOffset + i);
      if (val !== 0) {
        entries.push({ row: i, col: 0, value: val });
      }
    }

    return SparseMatrix.fromCOO(diagLength, 1, entries);
  }

  // =========================================================================
  // Arithmetic Operations
  // =========================================================================

  /**
   * Sparse matrix addition
   */
  add(other: Matrix<number>): SparseMatrix {
    this.checkDimensionsMatch(other);

    if (other instanceof SparseMatrix) {
      return this.addSparse(other);
    }

    // Convert to dense, add, convert back
    const dense = this.toDense();
    const result = dense.add(other);
    return SparseMatrix.fromDense(result as DenseMatrix);
  }

  private addSparse(other: SparseMatrix): SparseMatrix {
    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      const thisStart = this._rowPointers[i];
      const thisEnd = this._rowPointers[i + 1];
      const otherStart = other._rowPointers[i];
      const otherEnd = other._rowPointers[i + 1];

      let thisIdx = thisStart;
      let otherIdx = otherStart;

      while (thisIdx < thisEnd || otherIdx < otherEnd) {
        const thisCol = thisIdx < thisEnd ? this._colIndices[thisIdx] : this.cols;
        const otherCol = otherIdx < otherEnd ? other._colIndices[otherIdx] : this.cols;

        if (thisCol < otherCol) {
          entries.push({ row: i, col: thisCol, value: this._data[thisIdx] });
          thisIdx++;
        } else if (otherCol < thisCol) {
          entries.push({ row: i, col: otherCol, value: other._data[otherIdx] });
          otherIdx++;
        } else {
          const sum = this._data[thisIdx] + other._data[otherIdx];
          if (sum !== 0) {
            entries.push({ row: i, col: thisCol, value: sum });
          }
          thisIdx++;
          otherIdx++;
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, this.cols, entries);
  }

  /**
   * Sparse matrix subtraction
   */
  subtract(other: Matrix<number>): SparseMatrix {
    this.checkDimensionsMatch(other);

    if (other instanceof SparseMatrix) {
      return this.addSparse(other.scale(-1));
    }

    const dense = this.toDense();
    const result = dense.subtract(other);
    return SparseMatrix.fromDense(result as DenseMatrix);
  }

  /**
   * Element-wise multiplication (Hadamard product)
   */
  multiplyElementwise(other: Matrix<number>): SparseMatrix {
    this.checkDimensionsMatch(other);

    const entries: Array<{ row: number; col: number; value: number }> = [];

    // Only non-zeros in this matrix can produce non-zeros
    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        const col = this._colIndices[j];
        const product = this._data[j] * other.get(i, col);
        if (product !== 0) {
          entries.push({ row: i, col, value: product });
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, this.cols, entries);
  }

  /**
   * Sparse matrix multiplication
   */
  multiply(other: Matrix<number>): SparseMatrix {
    this.checkMultiplyDimensions(other);

    if (other instanceof SparseMatrix) {
      return this.multiplySparse(other);
    }

    // Sparse × Dense
    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      const rowStart = this._rowPointers[i];
      const rowEnd = this._rowPointers[i + 1];

      for (let j = 0; j < other.cols; j++) {
        let sum = 0;

        for (let k = rowStart; k < rowEnd; k++) {
          const col = this._colIndices[k];
          sum += this._data[k] * other.get(col, j);
        }

        if (sum !== 0) {
          entries.push({ row: i, col: j, value: sum });
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, other.cols, entries);
  }

  private multiplySparse(other: SparseMatrix): SparseMatrix {
    const entries: Array<{ row: number; col: number; value: number }> = [];

    // Use row-wise sparse-sparse multiplication
    for (let i = 0; i < this.rows; i++) {
      const rowStart = this._rowPointers[i];
      const rowEnd = this._rowPointers[i + 1];

      // Accumulator for this row of result
      const rowResult = new Map<number, number>();

      for (let k = rowStart; k < rowEnd; k++) {
        const colA = this._colIndices[k];
        const valA = this._data[k];

        // Multiply by corresponding row of other
        const otherRowStart = other._rowPointers[colA];
        const otherRowEnd = other._rowPointers[colA + 1];

        for (let l = otherRowStart; l < otherRowEnd; l++) {
          const colB = other._colIndices[l];
          const valB = other._data[l];

          const existing = rowResult.get(colB) || 0;
          rowResult.set(colB, existing + valA * valB);
        }
      }

      // Add non-zero results to entries
      for (const [col, value] of rowResult.entries()) {
        if (value !== 0) {
          entries.push({ row: i, col, value });
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, other.cols, entries);
  }

  /**
   * Scalar multiplication
   */
  scale(scalar: number): SparseMatrix {
    if (scalar === 0) {
      return SparseMatrix.zeros(this.rows, this.cols);
    }

    const newData = new Float64Array(this._data.length);
    for (let i = 0; i < this._data.length; i++) {
      newData[i] = this._data[i] * scalar;
    }

    return new SparseMatrix(
      this.rows,
      this.cols,
      newData,
      this._colIndices,
      this._rowPointers
    );
  }

  /**
   * Sparse matrix transpose
   */
  transpose(): SparseMatrix {
    // CSR transpose = CSC of transposed = CSR of transposed
    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        entries.push({
          row: this._colIndices[j],
          col: i,
          value: this._data[j],
        });
      }
    }

    return SparseMatrix.fromCOO(this.cols, this.rows, entries);
  }

  /**
   * Negate all elements
   */
  negate(): SparseMatrix {
    return this.scale(-1);
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements
   */
  sum(): number {
    let total = 0;
    for (let i = 0; i < this._data.length; i++) {
      total += this._data[i];
    }
    return total;
  }

  /**
   * Frobenius norm
   */
  norm(): number {
    let sumSq = 0;
    for (let i = 0; i < this._data.length; i++) {
      sumSq += this._data[i] * this._data[i];
    }
    return Math.sqrt(sumSq);
  }

  /**
   * Trace (sum of diagonal elements)
   */
  trace(): number {
    if (!this.isSquare) {
      throw new Error('Trace is only defined for square matrices');
    }

    let sum = 0;
    for (let i = 0; i < this.rows; i++) {
      sum += this.get(i, i);
    }
    return sum;
  }

  // =========================================================================
  // Conversion Methods
  // =========================================================================

  /**
   * Convert to dense matrix
   */
  toDense(): DenseMatrix {
    const data = new Float64Array(this.rows * this.cols);

    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        data[i * this.cols + this._colIndices[j]] = this._data[j];
      }
    }

    return new DenseMatrix(this.rows, this.cols, data);
  }

  /**
   * Convert to nested array
   */
  toArray(): number[][] {
    return this.toDense().toArray();
  }

  /**
   * Convert to flat array (row-major)
   */
  toFlatArray(): number[] {
    return this.toDense().toFlatArray();
  }

  /**
   * Clone the matrix
   */
  clone(): SparseMatrix {
    return new SparseMatrix(
      this.rows,
      this.cols,
      new Float64Array(this._data),
      new Int32Array(this._colIndices),
      new Int32Array(this._rowPointers)
    );
  }

  /**
   * Get the CSR components
   */
  getCSR(): {
    values: Float64Array;
    colIndices: Int32Array;
    rowPointers: Int32Array;
  } {
    return {
      values: new Float64Array(this._data),
      colIndices: new Int32Array(this._colIndices),
      rowPointers: new Int32Array(this._rowPointers),
    };
  }

  // =========================================================================
  // Iteration
  // =========================================================================

  /**
   * Iterate over non-zero entries
   */
  *entries(): IterableIterator<MatrixEntry<number>> {
    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        yield {
          row: i,
          col: this._colIndices[j],
          value: this._data[j],
        };
      }
    }
  }

  /**
   * Iterate over non-zero values
   */
  *values(): IterableIterator<number> {
    for (let i = 0; i < this._data.length; i++) {
      yield this._data[i];
    }
  }

  /**
   * Iterate over all values (including zeros, row-major)
   */
  *allValues(): IterableIterator<number> {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        yield this.get(i, j);
      }
    }
  }

  /**
   * Support for...of iteration (iterates over non-zero values)
   */
  [Symbol.iterator](): IterableIterator<number> {
    return this.values();
  }

  // =========================================================================
  // Map/Apply Operations
  // =========================================================================

  /**
   * Apply a function to each non-zero element
   */
  mapNonZeros(fn: (value: number, row: number, col: number) => number): SparseMatrix {
    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      const start = this._rowPointers[i];
      const end = this._rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        const col = this._colIndices[j];
        const newVal = fn(this._data[j], i, col);
        if (newVal !== 0) {
          entries.push({ row: i, col, value: newVal });
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, this.cols, entries);
  }

  /**
   * Apply a function to each element (including zeros)
   * Warning: This may create a dense result
   */
  map(fn: (value: number, row: number, col: number) => number): SparseMatrix {
    const entries: Array<{ row: number; col: number; value: number }> = [];

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const newVal = fn(this.get(i, j), i, j);
        if (newVal !== 0) {
          entries.push({ row: i, col: j, value: newVal });
        }
      }
    }

    return SparseMatrix.fromCOO(this.rows, this.cols, entries);
  }
}

/**
 * Type guard for SparseMatrix
 */
export function isSparseMatrix(value: unknown): value is SparseMatrix {
  return value instanceof SparseMatrix;
}
