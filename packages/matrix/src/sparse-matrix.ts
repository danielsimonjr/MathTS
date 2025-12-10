/**
 * Sparse matrix implementation (CSR format)
 */

import { Matrix } from './matrix';

/**
 * Sparse matrix using Compressed Sparse Row (CSR) format
 */
export class SparseMatrix extends Matrix {
  readonly rows: number;
  readonly cols: number;

  // CSR format arrays
  private values: Float64Array;
  private colIndices: Uint32Array;
  private rowPointers: Uint32Array;

  constructor(
    rows: number,
    cols: number,
    values: Float64Array,
    colIndices: Uint32Array,
    rowPointers: Uint32Array
  ) {
    super();
    this.rows = rows;
    this.cols = cols;
    this.values = values;
    this.colIndices = colIndices;
    this.rowPointers = rowPointers;
  }

  get(row: number, col: number): number {
    const start = this.rowPointers[row];
    const end = this.rowPointers[row + 1];

    for (let i = start; i < end; i++) {
      if (this.colIndices[i] === col) {
        return this.values[i];
      }
    }
    return 0;
  }

  set(_row: number, _col: number, _value: number): void {
    throw new Error('SparseMatrix.set not yet implemented (requires reallocation)');
  }

  multiply(_other: Matrix): Matrix {
    throw new Error('SparseMatrix.multiply not yet implemented');
  }

  add(_other: Matrix): Matrix {
    throw new Error('SparseMatrix.add not yet implemented');
  }

  subtract(_other: Matrix): Matrix {
    throw new Error('SparseMatrix.subtract not yet implemented');
  }

  transpose(): Matrix {
    throw new Error('SparseMatrix.transpose not yet implemented');
  }

  determinant(): number {
    throw new Error('SparseMatrix.determinant not yet implemented');
  }

  inverse(): Matrix {
    throw new Error('SparseMatrix.inverse not yet implemented');
  }

  eigenvalues(): number[] {
    throw new Error('SparseMatrix.eigenvalues not yet implemented');
  }

  toArray(): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: number[] = new Array(this.cols).fill(0);
      const start = this.rowPointers[i];
      const end = this.rowPointers[i + 1];

      for (let j = start; j < end; j++) {
        row[this.colIndices[j]] = this.values[j];
      }
      result.push(row);
    }
    return result;
  }

  /**
   * Get the number of non-zero elements
   */
  get nnz(): number {
    return this.values.length;
  }
}
