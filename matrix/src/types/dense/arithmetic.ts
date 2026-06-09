import type { DenseMatrix } from '../DenseMatrix.js';
import type { Matrix } from '../Matrix.js';

export function add(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const result = new Float64Array(a.rows * a.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      result[i * a.cols + j] = a.get(i, j) + b.get(i, j);
    }
  }
  return result;
}

export function subtract(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const result = new Float64Array(a.rows * a.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      result[i * a.cols + j] = a.get(i, j) - b.get(i, j);
    }
  }
  return result;
}

export function multiplyElementwise(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const result = new Float64Array(a.rows * a.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      result[i * a.cols + j] = a.get(i, j) * b.get(i, j);
    }
  }
  return result;
}

export function multiply(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const result = new Float64Array(a.rows * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < b.cols; j++) {
      let sum = 0;
      for (let k = 0; k < a.cols; k++) {
        sum += a.get(i, k) * b.get(k, j);
      }
      result[i * b.cols + j] = sum;
    }
  }
  return result;
}

export function scale(a: DenseMatrix, scalar: number): Float64Array {
  const result = new Float64Array(a.rows * a.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      result[i * a.cols + j] = a.get(i, j) * scalar;
    }
  }
  return result;
}

export function transpose(a: DenseMatrix): Float64Array {
  const result = new Float64Array(a.cols * a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      result[j * a.rows + i] = a.get(i, j);
    }
  }
  return result;
}
