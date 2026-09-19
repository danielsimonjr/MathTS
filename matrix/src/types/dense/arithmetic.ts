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

/**
 * Add two matrices element by element.
 *
 * The function does not check the shapes. The two matrices must have the
 * same number of elements.
 *
 * @param a - First matrix.
 * @param b - Second matrix.
 * @returns A new row-major array that holds a + b.
 */
export function add(a: Matrix<number>, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] + bd[i];
  return result;
}

/**
 * Subtract one matrix from another, element by element.
 *
 * The function does not check the shapes. The two matrices must have the
 * same number of elements.
 *
 * @param a - Matrix to subtract from.
 * @param b - Matrix to subtract.
 * @returns A new row-major array that holds a - b.
 */
export function subtract(a: Matrix<number>, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] - bd[i];
  return result;
}

/**
 * Multiply two matrices element by element (Hadamard product).
 *
 * The function does not check the shapes. The two matrices must have the
 * same number of elements.
 *
 * @param a - First matrix.
 * @param b - Second matrix.
 * @returns A new row-major array that holds the element-wise product.
 */
export function multiplyElementwise(a: Matrix<number>, b: Matrix<number>): Float64Array {
  const ad = flat(a);
  const bd = flat(b);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] * bd[i];
  return result;
}

/**
 * Multiply two matrices (matrix product a · b).
 *
 * The function does not check that `a.cols` equals `b.rows`. The loop skips
 * the zero elements of `a`.
 *
 * @param a - Left matrix (n × p).
 * @param b - Right matrix (p × m).
 * @returns A new row-major array of length n · m that holds a · b.
 */
export function multiply(a: Matrix<number>, b: Matrix<number>): Float64Array {
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

/**
 * Multiply each element of a matrix by a scalar.
 *
 * @param a - Input matrix.
 * @param scalar - Value to multiply by.
 * @returns A new row-major array that holds scalar · a.
 */
export function scale(a: Matrix<number>, scalar: number): Float64Array {
  const ad = flat(a);
  const result = new Float64Array(ad.length);
  for (let i = 0; i < ad.length; i++) result[i] = ad[i] * scalar;
  return result;
}

/**
 * Transpose a matrix.
 *
 * @param a - Input matrix (rows × cols).
 * @returns A new row-major array of the transposed matrix (cols × rows).
 */
export function transpose(a: Matrix<number>): Float64Array {
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
