import type { DenseMatrix } from '../DenseMatrix.js';
import type { Matrix } from '../Matrix.js';

/**
 * Contiguous row-major view of a matrix's data. Using the flat Float64Array
 * directly in the hot loops avoids the per-element `get()` method-call +
 * bounds-check overhead, which dominated runtime: an 800x800 multiply issues
 * ~1e9 get() calls and took ~114s before this change.
 */
function flat(m: Matrix<number>): Float64Array {
  const maybe = m as { toFloat64Array?: () => Float64Array };
  if (typeof maybe.toFloat64Array === 'function') return maybe.toFloat64Array();
  // Generic fallback for matrix types without a flat accessor (e.g. sparse).
  const out = new Float64Array(m.rows * m.cols);
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.cols; j++) out[i * m.cols + j] = m.get(i, j);
  }
  return out;
}

export function add(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] + bd[i];
  return result;
}

export function subtract(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] - bd[i];
  return result;
}

export function multiplyElementwise(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] * bd[i];
  return result;
}

export function multiply(a: DenseMatrix, b: Matrix<number>): Float64Array {
  const n = a.rows;
  const p = a.cols;
  const m = b.cols;
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(n * m);
  // ikj loop order: sequential access of bd and result rows (cache-friendly),
  // hoists a[i][k] out of the inner loop.
  for (let i = 0; i < n; i++) {
    const ai = i * p;
    const ri = i * m;
    for (let k = 0; k < p; k++) {
      const aik = ad[ai + k];
      if (aik === 0) continue;
      const bk = k * m;
      for (let j = 0; j < m; j++) result[ri + j] += aik * bd[bk + j];
    }
  }
  return result;
}

export function scale(a: DenseMatrix, scalar: number): Float64Array {
  const ad = flat(a);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] * scalar;
  return result;
}

export function transpose(a: DenseMatrix): Float64Array {
  const ad = flat(a);
  const rows = a.rows;
  const cols = a.cols;
  const result = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    const ai = i * cols;
    for (let j = 0; j < cols; j++) result[j * rows + i] = ad[ai + j];
  }
  return result;
}
