/**
 * Dense matrix implementation
 */

import { Matrix } from './matrix';

/**
 * Dense matrix stored as a flat array
 */
export class DenseMatrix extends Matrix {
  readonly rows: number;
  readonly cols: number;
  private data: Float64Array;

  constructor(rows: number, cols: number, data?: Float64Array) {
    super();
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float64Array(rows * cols);
  }

  get(row: number, col: number): number {
    return this.data[row * this.cols + col];
  }

  set(row: number, col: number, value: number): void {
    this.data[row * this.cols + col] = value;
  }

  multiply(_other: Matrix): Matrix {
    // TODO: Implement with backend selection
    throw new Error('DenseMatrix.multiply not yet implemented');
  }

  add(_other: Matrix): Matrix {
    throw new Error('DenseMatrix.add not yet implemented');
  }

  subtract(_other: Matrix): Matrix {
    throw new Error('DenseMatrix.subtract not yet implemented');
  }

  transpose(): Matrix {
    throw new Error('DenseMatrix.transpose not yet implemented');
  }

  determinant(): number {
    throw new Error('DenseMatrix.determinant not yet implemented');
  }

  inverse(): Matrix {
    throw new Error('DenseMatrix.inverse not yet implemented');
  }

  eigenvalues(): number[] {
    throw new Error('DenseMatrix.eigenvalues not yet implemented');
  }

  toArray(): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.get(i, j));
      }
      result.push(row);
    }
    return result;
  }
}
