/**
 * Matrix Operations for AssemblyScript
 *
 * Dense matrix operations using flat Float64Array storage.
 * Row-major order: element at (i,j) is at index i*cols + j
 *
 * Note: AssemblyScript doesn't support classes with complex patterns,
 * so we use pure functions with explicit dimensions.
 */

// =============================================================================
// Matrix Creation
// =============================================================================

/**
 * Create a matrix filled with zeros
 */
export function matrix_zeros(rows: i32, cols: i32): Float64Array {
  return new Float64Array(rows * cols);
}

/**
 * Create a matrix filled with ones
 */
export function matrix_ones(rows: i32, cols: i32): Float64Array {
  const data = new Float64Array(rows * cols);
  const len = rows * cols;
  for (let i = 0; i < len; i++) {
    unchecked((data[i] = 1.0));
  }
  return data;
}

/**
 * Create a matrix filled with a specific value
 */
export function matrix_fill(rows: i32, cols: i32, value: f64): Float64Array {
  const data = new Float64Array(rows * cols);
  const len = rows * cols;
  for (let i = 0; i < len; i++) {
    unchecked((data[i] = value));
  }
  return data;
}

/**
 * Create an identity matrix
 */
export function matrix_identity(n: i32): Float64Array {
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    unchecked((data[i * n + i] = 1.0));
  }
  return data;
}

/**
 * Create a diagonal matrix from array of values
 */
export function matrix_diag(values: Float64Array): Float64Array {
  const n = values.length;
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    unchecked((data[i * n + i] = unchecked(values[i])));
  }
  return data;
}

// =============================================================================
// Element Access
// =============================================================================

/**
 * Get element at (row, col)
 */
export function matrix_get(data: Float64Array, cols: i32, row: i32, col: i32): f64 {
  return unchecked(data[row * cols + col]);
}

/**
 * Set element at (row, col)
 */
export function matrix_set(data: Float64Array, cols: i32, row: i32, col: i32, value: f64): void {
  unchecked((data[row * cols + col] = value));
}

/**
 * Get a row as a new array
 */
export function matrix_get_row(data: Float64Array, cols: i32, row: i32): Float64Array {
  const result = new Float64Array(cols);
  const offset = row * cols;
  for (let j = 0; j < cols; j++) {
    unchecked((result[j] = unchecked(data[offset + j])));
  }
  return result;
}

/**
 * Get a column as a new array
 */
export function matrix_get_col(data: Float64Array, rows: i32, cols: i32, col: i32): Float64Array {
  const result = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    unchecked((result[i] = unchecked(data[i * cols + col])));
  }
  return result;
}

/**
 * Get diagonal elements
 */
export function matrix_get_diag(data: Float64Array, rows: i32, cols: i32): Float64Array {
  const n = min(rows, cols);
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    unchecked((result[i] = unchecked(data[i * cols + i])));
  }
  return result;
}

// =============================================================================
// Matrix Arithmetic
// =============================================================================

/**
 * Matrix addition: C = A + B
 */
export function matrix_add(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) + unchecked(b[i])));
  }
}

/**
 * Matrix subtraction: C = A - B
 */
export function matrix_sub(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) - unchecked(b[i])));
  }
}

/**
 * Element-wise multiplication (Hadamard product): C = A .* B
 */
export function matrix_mul_elementwise(
  a: Float64Array,
  b: Float64Array,
  result: Float64Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) * unchecked(b[i])));
  }
}

/**
 * Element-wise division: C = A ./ B
 */
export function matrix_div_elementwise(
  a: Float64Array,
  b: Float64Array,
  result: Float64Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) / unchecked(b[i])));
  }
}

/**
 * Scalar multiplication: C = A * scalar
 */
export function matrix_scale(a: Float64Array, scalar: f64, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) * scalar));
  }
}

/**
 * Scalar addition: C = A + scalar
 */
export function matrix_add_scalar(a: Float64Array, scalar: f64, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) + scalar));
  }
}

/**
 * Negate matrix: C = -A
 */
export function matrix_neg(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = -unchecked(a[i])));
  }
}

// =============================================================================
// Matrix Multiplication
// =============================================================================

/**
 * Matrix multiplication: C = A * B
 * A is (aRows x aCols), B is (aCols x bCols), C is (aRows x bCols)
 *
 * Uses naive O(n^3) algorithm - suitable for SIMD optimization
 */
export function matrix_multiply(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bCols: i32,
  result: Float64Array
): void {
  // Clear result
  const resultLen = aRows * bCols;
  for (let i = 0; i < resultLen; i++) {
    unchecked((result[i] = 0.0));
  }

  // Naive matmul with good cache access pattern
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = unchecked(a[i * aCols + k]);
      for (let j = 0; j < bCols; j++) {
        unchecked((result[i * bCols + j] += aik * unchecked(b[k * bCols + j])));
      }
    }
  }
}

/**
 * Matrix-vector multiplication: y = A * x
 * A is (rows x cols), x is (cols), y is (rows)
 */
export function matrix_vector_multiply(
  a: Float64Array,
  rows: i32,
  cols: i32,
  x: Float64Array,
  result: Float64Array
): void {
  for (let i = 0; i < rows; i++) {
    let sum: f64 = 0.0;
    const offset = i * cols;
    for (let j = 0; j < cols; j++) {
      sum += unchecked(a[offset + j]) * unchecked(x[j]);
    }
    unchecked((result[i] = sum));
  }
}

/**
 * Vector-matrix multiplication: y = x^T * A
 * x is (rows), A is (rows x cols), y is (cols)
 */
export function vector_matrix_multiply(
  x: Float64Array,
  a: Float64Array,
  rows: i32,
  cols: i32,
  result: Float64Array
): void {
  // Clear result
  for (let j = 0; j < cols; j++) {
    unchecked((result[j] = 0.0));
  }

  for (let i = 0; i < rows; i++) {
    const xi = unchecked(x[i]);
    const offset = i * cols;
    for (let j = 0; j < cols; j++) {
      unchecked((result[j] += xi * unchecked(a[offset + j])));
    }
  }
}

/**
 * Outer product: C = x * y^T
 * x is (m), y is (n), C is (m x n)
 */
export function matrix_outer(x: Float64Array, y: Float64Array, result: Float64Array): void {
  const m = x.length;
  const n = y.length;
  for (let i = 0; i < m; i++) {
    const xi = unchecked(x[i]);
    const offset = i * n;
    for (let j = 0; j < n; j++) {
      unchecked((result[offset + j] = xi * unchecked(y[j])));
    }
  }
}

// =============================================================================
// Matrix Transpose
// =============================================================================

/**
 * Transpose matrix: B = A^T
 * A is (rows x cols), B is (cols x rows)
 */
export function matrix_transpose(
  a: Float64Array,
  rows: i32,
  cols: i32,
  result: Float64Array
): void {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      unchecked((result[j * rows + i] = unchecked(a[i * cols + j])));
    }
  }
}

// =============================================================================
// Matrix Reductions
// =============================================================================

/**
 * Sum of all elements
 */
export function matrix_sum(data: Float64Array): f64 {
  let sum: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    sum += unchecked(data[i]);
  }
  return sum;
}

/**
 * Mean of all elements
 */
export function matrix_mean(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;
  return matrix_sum(data) / f64(len);
}

/**
 * Minimum element
 */
export function matrix_min(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let minVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val < minVal) minVal = val;
  }
  return minVal;
}

/**
 * Maximum element
 */
export function matrix_max(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let maxVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/**
 * Frobenius norm (sqrt of sum of squares)
 */
export function matrix_norm_frobenius(data: Float64Array): f64 {
  let sumSq: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const val = unchecked(data[i]);
    sumSq += val * val;
  }
  return sqrt(sumSq);
}

/**
 * Trace (sum of diagonal elements)
 */
export function matrix_trace(data: Float64Array, rows: i32, cols: i32): f64 {
  const n = min(rows, cols);
  let sum: f64 = 0.0;
  for (let i = 0; i < n; i++) {
    sum += unchecked(data[i * cols + i]);
  }
  return sum;
}

/**
 * Sum along rows (result is column vector)
 */
export function matrix_sum_rows(
  data: Float64Array,
  rows: i32,
  cols: i32,
  result: Float64Array
): void {
  for (let i = 0; i < rows; i++) {
    let sum: f64 = 0.0;
    const offset = i * cols;
    for (let j = 0; j < cols; j++) {
      sum += unchecked(data[offset + j]);
    }
    unchecked((result[i] = sum));
  }
}

/**
 * Sum along columns (result is row vector)
 */
export function matrix_sum_cols(
  data: Float64Array,
  rows: i32,
  cols: i32,
  result: Float64Array
): void {
  // Clear result
  for (let j = 0; j < cols; j++) {
    unchecked((result[j] = 0.0));
  }

  for (let i = 0; i < rows; i++) {
    const offset = i * cols;
    for (let j = 0; j < cols; j++) {
      unchecked((result[j] += unchecked(data[offset + j])));
    }
  }
}

// =============================================================================
// Matrix Queries
// =============================================================================

/**
 * Check if matrix is square
 */
export function matrix_is_square(rows: i32, cols: i32): bool {
  return rows == cols;
}

/**
 * Check if matrix is symmetric (within tolerance)
 */
export function matrix_is_symmetric(
  data: Float64Array,
  rows: i32,
  cols: i32,
  tolerance: f64
): bool {
  if (rows != cols) return false;

  for (let i = 0; i < rows; i++) {
    for (let j = i + 1; j < cols; j++) {
      const aij = unchecked(data[i * cols + j]);
      const aji = unchecked(data[j * cols + i]);
      if (abs(aij - aji) > tolerance) return false;
    }
  }
  return true;
}

/**
 * Check if matrix is diagonal (within tolerance)
 */
export function matrix_is_diagonal(data: Float64Array, rows: i32, cols: i32, tolerance: f64): bool {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (i != j) {
        if (abs(unchecked(data[i * cols + j])) > tolerance) return false;
      }
    }
  }
  return true;
}

/**
 * Check if matrix equals identity (within tolerance)
 */
export function matrix_is_identity(data: Float64Array, rows: i32, cols: i32, tolerance: f64): bool {
  if (rows != cols) return false;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected: f64 = i == j ? 1.0 : 0.0;
      if (abs(unchecked(data[i * cols + j]) - expected) > tolerance) return false;
    }
  }
  return true;
}

// =============================================================================
// In-place Operations
// =============================================================================

/**
 * Scale matrix in place: A *= scalar
 */
export function matrix_scale_inplace(data: Float64Array, scalar: f64): void {
  const len = data.length;
  for (let i = 0; i < len; i++) {
    unchecked((data[i] = unchecked(data[i]) * scalar));
  }
}

/**
 * Add scalar in place: A += scalar
 */
export function matrix_add_scalar_inplace(data: Float64Array, scalar: f64): void {
  const len = data.length;
  for (let i = 0; i < len; i++) {
    unchecked((data[i] = unchecked(data[i]) + scalar));
  }
}

/**
 * Add matrix in place: A += B
 */
export function matrix_add_inplace(a: Float64Array, b: Float64Array): void {
  const len = min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    unchecked((a[i] = unchecked(a[i]) + unchecked(b[i])));
  }
}

/**
 * Copy matrix: dst = src
 */
export function matrix_copy(src: Float64Array, dst: Float64Array): void {
  const len = min(src.length, dst.length);
  for (let i = 0; i < len; i++) {
    unchecked((dst[i] = unchecked(src[i])));
  }
}

// =============================================================================
// Linear Algebra Basics
// =============================================================================

/**
 * AXPY operation: Y = alpha*X + Y (BLAS Level 1)
 */
export function matrix_axpy(alpha: f64, x: Float64Array, y: Float64Array): void {
  const len = min(x.length, y.length);
  for (let i = 0; i < len; i++) {
    unchecked((y[i] = alpha * unchecked(x[i]) + unchecked(y[i])));
  }
}

/**
 * GEMM: C = alpha*A*B + beta*C (General Matrix Multiply)
 * A is (m x k), B is (k x n), C is (m x n)
 */
export function matrix_gemm(
  alpha: f64,
  a: Float64Array,
  m: i32,
  k: i32,
  b: Float64Array,
  n: i32,
  beta: f64,
  c: Float64Array
): void {
  // Scale C by beta
  const cLen = m * n;
  for (let i = 0; i < cLen; i++) {
    unchecked((c[i] = beta * unchecked(c[i])));
  }

  // Add alpha * A * B
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const aip = alpha * unchecked(a[i * k + p]);
      for (let j = 0; j < n; j++) {
        unchecked((c[i * n + j] += aip * unchecked(b[p * n + j])));
      }
    }
  }
}

/**
 * GEMV: y = alpha*A*x + beta*y (General Matrix-Vector Multiply)
 * A is (m x n), x is (n), y is (m)
 */
export function matrix_gemv(
  alpha: f64,
  a: Float64Array,
  m: i32,
  n: i32,
  x: Float64Array,
  beta: f64,
  y: Float64Array
): void {
  for (let i = 0; i < m; i++) {
    let dot: f64 = 0.0;
    const offset = i * n;
    for (let j = 0; j < n; j++) {
      dot += unchecked(a[offset + j]) * unchecked(x[j]);
    }
    unchecked((y[i] = alpha * dot + beta * unchecked(y[i])));
  }
}
