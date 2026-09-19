import type { Matrix } from '../Matrix.js';

/**
 * Add all elements of a matrix.
 *
 * @param a - Input matrix.
 * @returns The sum of all elements. For an empty matrix, 0.
 */
export function sum(a: Matrix<number>): number {
  let total = 0;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      total += a.get(i, j);
    }
  }
  return total;
}

/**
 * Compute the arithmetic mean of all elements of a matrix.
 *
 * @param a - Input matrix.
 * @returns The sum of the elements divided by the number of elements.
 */
export function mean(a: Matrix<number>): number {
  return sum(a) / a.length;
}

/**
 * Find the smallest element of a matrix.
 *
 * @param a - Input matrix.
 * @returns The smallest element. For an empty matrix, `Infinity`.
 */
export function min(a: Matrix<number>): number {
  let minVal = Infinity;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const val = a.get(i, j);
      if (val < minVal) minVal = val;
    }
  }
  return minVal;
}

/**
 * Find the largest element of a matrix.
 *
 * @param a - Input matrix.
 * @returns The largest element. For an empty matrix, `-Infinity`.
 */
export function max(a: Matrix<number>): number {
  let maxVal = -Infinity;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const val = a.get(i, j);
      if (val > maxVal) maxVal = val;
    }
  }
  return maxVal;
}

/**
 * Compute the Frobenius norm of a matrix: the square root of the sum of the
 * squares of all elements.
 *
 * @param a - Input matrix.
 * @returns The Frobenius norm.
 */
export function norm(a: Matrix<number>): number {
  let sumSquared = 0;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const val = a.get(i, j);
      sumSquared += val * val;
    }
  }
  return Math.sqrt(sumSquared);
}

/**
 * Compute the trace of a square matrix: the sum of its diagonal elements.
 *
 * @param a - Square input matrix.
 * @returns The sum of the diagonal elements.
 * @throws Error if the matrix is not square.
 */
export function trace(a: Matrix<number>): number {
  if (!a.isSquare) {
    throw new Error('Trace is only defined for square matrices');
  }
  let traceSum = 0;
  for (let i = 0; i < a.rows; i++) {
    traceSum += a.get(i, i);
  }
  return traceSum;
}
