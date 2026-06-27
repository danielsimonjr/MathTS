/**
 * Optimization kernels — AssemblyScript fallback: linear programming
 * (simplex), quadratic programming (projected gradient), and null-space basis.
 *
 * Matrices are flat row-major `Float64Array`s with explicit dimensions.
 */

/**
 * Quadratic programming: minimize `0.5 x^T H x + f^T x` s.t. `A x <= b`.
 * Returns the solution vector `x` (length `n`).
 */
export function quadprog(
  h: Float64Array,
  n: i32,
  f: Float64Array,
  a: Float64Array,
  m: i32,
  b: Float64Array
): Float64Array {
  if (n <= 0) return new Float64Array(0);
  const mc: i32 = m < 0 ? 0 : m;
  const x = new Float64Array(n);
  const grad = new Float64Array(n);
  const xNew = new Float64Array(n);
  const lr: f64 = 0.01;

  for (let iter = 0; iter < 2000; iter++) {
    for (let i = 0; i < n; i++) {
      grad[i] = f[i];
      for (let j = 0; j < n; j++) grad[i] += h[i * n + j] * x[j];
    }
    for (let i = 0; i < n; i++) xNew[i] = x[i] - lr * grad[i];
    for (let c = 0; c < mc; c++) {
      let ax: f64 = 0.0;
      for (let j = 0; j < n; j++) ax += a[c * n + j] * xNew[j];
      if (ax > b[c]) {
        let aNorm: f64 = 0.0;
        for (let j = 0; j < n; j++) aNorm += a[c * n + j] * a[c * n + j];
        if (aNorm > 1e-15) {
          const scale: f64 = (ax - b[c]) / aNorm;
          for (let j = 0; j < n; j++) xNew[j] -= scale * a[c * n + j];
        }
      }
    }
    let maxDiff: f64 = 0.0;
    for (let i = 0; i < n; i++) {
      const d: f64 = Math.abs(xNew[i] - x[i]);
      if (d > maxDiff) maxDiff = d;
    }
    for (let i = 0; i < n; i++) x[i] = xNew[i];
    if (maxDiff < 1e-10) break;
  }
  return x;
}

/**
 * Linear programming: minimize `c^T x` s.t. `A x <= b`, `x >= 0`, via the
 * simplex method. Returns `x` (length `n`), or an empty array if unbounded.
 */
export function linprog(
  c: Float64Array,
  n: i32,
  a: Float64Array,
  b: Float64Array,
  m: i32
): Float64Array {
  if (n <= 0 || m < 0) return new Float64Array(0);
  const total: i32 = n + m;
  const cols: i32 = total + 1;
  const rows: i32 = m + 1;
  const t = new Float64Array(rows * cols);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) t[i * cols + j] = a[i * n + j];
    t[i * cols + n + i] = 1.0;
    t[i * cols + total] = b[i];
  }
  for (let j = 0; j < n; j++) t[m * cols + j] = c[j];

  for (let iter = 0; iter < 1000; iter++) {
    let pivotCol: i32 = -1;
    let minVal: f64 = -1e-10;
    for (let j = 0; j < total; j++) {
      if (t[m * cols + j] < minVal) {
        minVal = t[m * cols + j];
        pivotCol = j;
      }
    }
    if (pivotCol == -1) break;
    let pivotRow: i32 = -1;
    let minRatio: f64 = Infinity;
    for (let i = 0; i < m; i++) {
      const cv: f64 = t[i * cols + pivotCol];
      if (cv > 1e-10) {
        const ratio: f64 = t[i * cols + total] / cv;
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }
    if (pivotRow == -1) return new Float64Array(0); // unbounded
    const pv: f64 = t[pivotRow * cols + pivotCol];
    for (let j = 0; j < cols; j++) t[pivotRow * cols + j] /= pv;
    for (let i = 0; i < rows; i++) {
      if (i == pivotRow) continue;
      const factor: f64 = t[i * cols + pivotCol];
      for (let j = 0; j < cols; j++) {
        t[i * cols + j] -= factor * t[pivotRow * cols + j];
      }
    }
  }

  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let basicRow: i32 = -1;
    let isBasic: bool = true;
    for (let i = 0; i < rows; i++) {
      if (Math.abs(t[i * cols + j] - 1.0) < 1e-10) {
        if (basicRow != -1) {
          isBasic = false;
          break;
        }
        basicRow = i;
      } else if (Math.abs(t[i * cols + j]) > 1e-10) {
        isBasic = false;
        break;
      }
    }
    x[j] = isBasic && basicRow != -1 ? t[basicRow * cols + total] : 0.0;
  }
  return x;
}

/**
 * Null-space basis of an `m x n` matrix `A`. Returns the basis vectors
 * packed row-major (`count * n` values); the caller derives
 * `count = result.length / n`.
 */
export function nullspace(a: Float64Array, m: i32, n: i32): Float64Array {
  if (m <= 0 || n <= 0) return new Float64Array(0);
  const mm = new Float64Array(m * n);
  for (let i = 0; i < m * n; i++) mm[i] = a[i];
  const pcols = new Int32Array(n);
  let npiv: i32 = 0;
  let r: i32 = 0;

  for (let col = 0; col < n; col++) {
    if (r >= m) break;
    let maxRow: i32 = r;
    let maxVal: f64 = Math.abs(mm[r * n + col]);
    for (let row = r + 1; row < m; row++) {
      const v: f64 = Math.abs(mm[row * n + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-10) continue;
    if (maxRow != r) {
      for (let j = 0; j < n; j++) {
        const tt: f64 = mm[r * n + j];
        mm[r * n + j] = mm[maxRow * n + j];
        mm[maxRow * n + j] = tt;
      }
    }
    const pivot: f64 = mm[r * n + col];
    for (let j = 0; j < n; j++) mm[r * n + j] /= pivot;
    for (let row = 0; row < m; row++) {
      if (row != r && Math.abs(mm[row * n + col]) > 1e-15) {
        const factor: f64 = mm[row * n + col];
        for (let j = 0; j < n; j++) mm[row * n + j] -= factor * mm[r * n + j];
      }
    }
    pcols[npiv] = col;
    npiv++;
    r++;
  }

  const count: i32 = n - npiv;
  const out = new Float64Array(count * n);
  let ci: i32 = 0;
  for (let col = 0; col < n; col++) {
    let isPivot: bool = false;
    for (let k = 0; k < npiv; k++) {
      if (pcols[k] == col) {
        isPivot = true;
        break;
      }
    }
    if (isPivot) continue;
    const base: i32 = ci * n;
    out[base + col] = 1.0;
    for (let i = 0; i < npiv; i++) out[base + pcols[i]] = -mm[i * n + col];
    ci++;
  }
  return out;
}
