/**
 * Extra linear-algebra kernels — AssemblyScript fallback mirroring
 * `wasm-rust/.../matrix/linalg_ext.rs`: reduced row echelon form and the
 * characteristic polynomial (Faddeev-LeVerrier).
 */

/** Reduced row echelon form of an m x n row-major matrix. */
export function rowReduce(a: Float64Array, m: i32, n: i32, tol: f64): Float64Array {
  if (m <= 0 || n <= 0) return new Float64Array(0);
  const out = new Float64Array(m * n);
  for (let i = 0; i < m * n; i++) out[i] = a[i];

  let pivotRow: i32 = 0;
  for (let col = 0; col < n; col++) {
    if (pivotRow >= m) break;
    let maxRow: i32 = pivotRow;
    let maxVal: f64 = Math.abs(out[pivotRow * n + col]);
    for (let row = pivotRow + 1; row < m; row++) {
      const v: f64 = Math.abs(out[row * n + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < tol) continue;
    if (maxRow != pivotRow) {
      for (let j = 0; j < n; j++) {
        const t: f64 = out[pivotRow * n + j];
        out[pivotRow * n + j] = out[maxRow * n + j];
        out[maxRow * n + j] = t;
      }
    }
    const scale: f64 = out[pivotRow * n + col];
    for (let j = col; j < n; j++) out[pivotRow * n + j] /= scale;
    for (let row = 0; row < m; row++) {
      if (row == pivotRow) continue;
      const factor: f64 = out[row * n + col];
      if (Math.abs(factor) < tol) continue;
      for (let j = col; j < n; j++) {
        out[row * n + j] -= factor * out[pivotRow * n + j];
      }
    }
    pivotRow++;
  }
  for (let i = 0; i < m * n; i++) {
    if (Math.abs(out[i]) < tol) out[i] = 0.0;
  }
  return out;
}

/**
 * Characteristic polynomial of an n x n matrix (Faddeev-LeVerrier).
 * Returns n + 1 coefficients, constant term first, monic.
 */
export function characteristicPolynomial(a: Float64Array, n: i32): Float64Array {
  if (n <= 0) return new Float64Array(0);
  const out = new Float64Array(n + 1);
  out[n] = 1.0;

  let m = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) m[i] = a[i];
  const shifted = new Float64Array(n * n);
  const prod = new Float64Array(n * n);

  for (let k = 1; k <= n; k++) {
    let tr: f64 = 0.0;
    for (let i = 0; i < n; i++) tr += m[i * n + i];
    const coeff: f64 = -tr / <f64>k;
    out[n - k] = coeff;

    if (k < n) {
      for (let i = 0; i < n * n; i++) shifted[i] = m[i];
      for (let i = 0; i < n; i++) shifted[i * n + i] += coeff;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let s: f64 = 0.0;
          for (let t = 0; t < n; t++) s += a[i * n + t] * shifted[t * n + j];
          prod[i * n + j] = s;
        }
      }
      for (let i = 0; i < n * n; i++) m[i] = prod[i];
    }
  }
  return out;
}
