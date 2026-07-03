import type { Matrix } from '../Matrix.js';

export function sum(a: Matrix<number>): number {
  let total = 0;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      total += a.get(i, j);
    }
  }
  return total;
}

export function mean(a: Matrix<number>): number {
  return sum(a) / a.length;
}

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
