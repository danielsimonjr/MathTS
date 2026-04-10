//! AssemblyScript-compatible matrix function names.
//!
//! These thin wrappers provide the exact `matrix_*` symbol names that the
//! TypeScript `MathTSWasmExports` interface expects from the AS WASM module.
//!
//! All matrices use row-major flat `f64` arrays.
//! Element at (i, j) in an (rows x cols) matrix is at index `i * cols + j`.

use libm;

// =============================================================================
// Matrix Creation (5 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_zeros(out_ptr: *mut f64, rows: i32, cols: i32) {
    let total = (rows * cols) as usize;
    for i in 0..total {
        *out_ptr.add(i) = 0.0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_ones(out_ptr: *mut f64, rows: i32, cols: i32) {
    let total = (rows * cols) as usize;
    for i in 0..total {
        *out_ptr.add(i) = 1.0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_fill_compat(out_ptr: *mut f64, rows: i32, cols: i32, value: f64) {
    let total = (rows * cols) as usize;
    for i in 0..total {
        *out_ptr.add(i) = value;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_identity(out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    for i in 0..n {
        for j in 0..n {
            *out_ptr.add(i * n + j) = if i == j { 1.0 } else { 0.0 };
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_diag(values_ptr: *const f64, n: i32, out_ptr: *mut f64) {
    let n = n as usize;
    // Zero the output first
    for i in 0..n * n {
        *out_ptr.add(i) = 0.0;
    }
    for i in 0..n {
        *out_ptr.add(i * n + i) = *values_ptr.add(i);
    }
}

// =============================================================================
// Element Access (5 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_get(data_ptr: *const f64, cols: i32, row: i32, col: i32) -> f64 {
    *data_ptr.add((row * cols + col) as usize)
}

#[no_mangle]
pub unsafe extern "C" fn matrix_set(data_ptr: *mut f64, cols: i32, row: i32, col: i32, value: f64) {
    *data_ptr.add((row * cols + col) as usize) = value;
}

#[no_mangle]
pub unsafe extern "C" fn matrix_get_row(
    data_ptr: *const f64,
    cols: i32,
    row: i32,
    out_ptr: *mut f64,
) {
    let offset = (row * cols) as usize;
    for j in 0..cols as usize {
        *out_ptr.add(j) = *data_ptr.add(offset + j);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_get_col(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    col: i32,
    out_ptr: *mut f64,
) {
    for i in 0..rows as usize {
        *out_ptr.add(i) = *data_ptr.add(i * cols as usize + col as usize);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_get_diag(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    out_ptr: *mut f64,
) {
    let n = if rows < cols { rows } else { cols } as usize;
    let cols = cols as usize;
    for i in 0..n {
        *out_ptr.add(i) = *data_ptr.add(i * cols + i);
    }
}

// =============================================================================
// Matrix Arithmetic (7 functions)
// =============================================================================

// Note: matrix_add already exists in matrix::multiply with the same export name.
// We provide matrix_add_compat to avoid symbol collision; the TS glue can alias.
#[no_mangle]
pub unsafe extern "C" fn matrix_add_compat(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) + *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_sub(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) - *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_mul_elementwise(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) * *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_div_elementwise(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) / *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_scale(
    a_ptr: *const f64,
    scalar: f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) * scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_add_scalar(
    a_ptr: *const f64,
    scalar: f64,
    out_ptr: *mut f64,
    size: i32,
) {
    for i in 0..size as usize {
        *out_ptr.add(i) = *a_ptr.add(i) + scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_neg(a_ptr: *const f64, out_ptr: *mut f64, size: i32) {
    for i in 0..size as usize {
        *out_ptr.add(i) = -*a_ptr.add(i);
    }
}

// =============================================================================
// Matrix Multiplication (5 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_multiply(
    a_ptr: *const f64,
    a_rows: i32,
    a_cols: i32,
    b_ptr: *const f64,
    b_cols: i32,
    out_ptr: *mut f64,
) {
    let ar = a_rows as usize;
    let ac = a_cols as usize;
    let bc = b_cols as usize;

    // Zero the output
    for i in 0..ar * bc {
        *out_ptr.add(i) = 0.0;
    }
    // ikj loop order for cache-friendly access
    for i in 0..ar {
        for k in 0..ac {
            let a_ik = *a_ptr.add(i * ac + k);
            for j in 0..bc {
                *out_ptr.add(i * bc + j) += a_ik * *b_ptr.add(k * bc + j);
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_vector_multiply(
    a_ptr: *const f64,
    rows: i32,
    cols: i32,
    x_ptr: *const f64,
    out_ptr: *mut f64,
) {
    let rows = rows as usize;
    let cols = cols as usize;
    for i in 0..rows {
        let mut sum = 0.0_f64;
        let offset = i * cols;
        for j in 0..cols {
            sum += *a_ptr.add(offset + j) * *x_ptr.add(j);
        }
        *out_ptr.add(i) = sum;
    }
}

#[no_mangle]
pub unsafe extern "C" fn vector_matrix_multiply(
    x_ptr: *const f64,
    a_ptr: *const f64,
    rows: i32,
    cols: i32,
    out_ptr: *mut f64,
) {
    let rows = rows as usize;
    let cols = cols as usize;
    for j in 0..cols {
        *out_ptr.add(j) = 0.0;
    }
    for i in 0..rows {
        let xi = *x_ptr.add(i);
        let offset = i * cols;
        for j in 0..cols {
            *out_ptr.add(j) += xi * *a_ptr.add(offset + j);
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_outer(
    x_ptr: *const f64,
    m: i32,
    y_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) {
    let m = m as usize;
    let n = n as usize;
    for i in 0..m {
        let xi = *x_ptr.add(i);
        let offset = i * n;
        for j in 0..n {
            *out_ptr.add(offset + j) = xi * *y_ptr.add(j);
        }
    }
}

// =============================================================================
// Transpose (1 function)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_transpose(
    a_ptr: *const f64,
    rows: i32,
    cols: i32,
    out_ptr: *mut f64,
) {
    let rows = rows as usize;
    let cols = cols as usize;
    for i in 0..rows {
        for j in 0..cols {
            *out_ptr.add(j * rows + i) = *a_ptr.add(i * cols + j);
        }
    }
}

// =============================================================================
// Reductions (8 functions)
// =============================================================================

// Note: matrix_sum already exists in matrix::basic. Use _compat suffix.
#[no_mangle]
pub unsafe extern "C" fn matrix_sum_compat(data_ptr: *const f64, size: i32) -> f64 {
    let mut sum = 0.0_f64;
    for i in 0..size as usize {
        sum += *data_ptr.add(i);
    }
    sum
}

#[no_mangle]
pub unsafe extern "C" fn matrix_mean(data_ptr: *const f64, size: i32) -> f64 {
    if size == 0 {
        return f64::NAN;
    }
    let mut sum = 0.0_f64;
    for i in 0..size as usize {
        sum += *data_ptr.add(i);
    }
    sum / size as f64
}

// Note: matrix_min and matrix_max already exist in matrix::basic.
// We skip them to avoid symbol collision.

#[no_mangle]
pub unsafe extern "C" fn matrix_norm_frobenius(data_ptr: *const f64, size: i32) -> f64 {
    let mut sum_sq = 0.0_f64;
    for i in 0..size as usize {
        let v = *data_ptr.add(i);
        sum_sq += v * v;
    }
    libm::sqrt(sum_sq)
}

#[no_mangle]
pub unsafe extern "C" fn matrix_trace(data_ptr: *const f64, rows: i32, cols: i32) -> f64 {
    let n = (if rows < cols { rows } else { cols }) as usize;
    let cols = cols as usize;
    let mut sum = 0.0_f64;
    for i in 0..n {
        sum += *data_ptr.add(i * cols + i);
    }
    sum
}

#[no_mangle]
pub unsafe extern "C" fn matrix_sum_rows(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    out_ptr: *mut f64,
) {
    let rows = rows as usize;
    let cols = cols as usize;
    for i in 0..rows {
        let mut sum = 0.0_f64;
        let offset = i * cols;
        for j in 0..cols {
            sum += *data_ptr.add(offset + j);
        }
        *out_ptr.add(i) = sum;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_sum_cols(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    out_ptr: *mut f64,
) {
    let rows = rows as usize;
    let cols = cols as usize;
    for j in 0..cols {
        *out_ptr.add(j) = 0.0;
    }
    for i in 0..rows {
        let offset = i * cols;
        for j in 0..cols {
            *out_ptr.add(j) += *data_ptr.add(offset + j);
        }
    }
}

// =============================================================================
// Matrix Queries (4 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_is_square(rows: i32, cols: i32) -> i32 {
    if rows == cols {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_is_symmetric(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    tolerance: f64,
) -> i32 {
    if rows != cols {
        return 0;
    }
    let n = rows as usize;
    let cols_u = cols as usize;
    for i in 0..n {
        for j in (i + 1)..n {
            let aij = *data_ptr.add(i * cols_u + j);
            let aji = *data_ptr.add(j * cols_u + i);
            let diff = if aij > aji { aij - aji } else { aji - aij };
            if diff > tolerance {
                return 0;
            }
        }
    }
    1
}

#[no_mangle]
pub unsafe extern "C" fn matrix_is_diagonal(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    tolerance: f64,
) -> i32 {
    let rows = rows as usize;
    let cols_u = cols as usize;
    for i in 0..rows {
        for j in 0..cols_u {
            if i != j {
                let v = *data_ptr.add(i * cols_u + j);
                let abs_v = if v < 0.0 { -v } else { v };
                if abs_v > tolerance {
                    return 0;
                }
            }
        }
    }
    1
}

#[no_mangle]
pub unsafe extern "C" fn matrix_is_identity(
    data_ptr: *const f64,
    rows: i32,
    cols: i32,
    tolerance: f64,
) -> i32 {
    if rows != cols {
        return 0;
    }
    let n = rows as usize;
    let cols_u = cols as usize;
    for i in 0..n {
        for j in 0..n {
            let expected = if i == j { 1.0 } else { 0.0 };
            let v = *data_ptr.add(i * cols_u + j) - expected;
            let abs_v = if v < 0.0 { -v } else { v };
            if abs_v > tolerance {
                return 0;
            }
        }
    }
    1
}

// =============================================================================
// In-place Operations (4 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_scale_inplace(data_ptr: *mut f64, scalar: f64, size: i32) {
    for i in 0..size as usize {
        *data_ptr.add(i) *= scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_add_scalar_inplace(data_ptr: *mut f64, scalar: f64, size: i32) {
    for i in 0..size as usize {
        *data_ptr.add(i) += scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_add_inplace(a_ptr: *mut f64, b_ptr: *const f64, size: i32) {
    for i in 0..size as usize {
        *a_ptr.add(i) += *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_copy(src_ptr: *const f64, dst_ptr: *mut f64, size: i32) {
    for i in 0..size as usize {
        *dst_ptr.add(i) = *src_ptr.add(i);
    }
}

// =============================================================================
// BLAS-like Operations (3 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn matrix_axpy(alpha: f64, x_ptr: *const f64, y_ptr: *mut f64, size: i32) {
    for i in 0..size as usize {
        *y_ptr.add(i) += alpha * *x_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_gemm(
    alpha: f64,
    a_ptr: *const f64,
    m: i32,
    k: i32,
    b_ptr: *const f64,
    n: i32,
    beta: f64,
    c_ptr: *mut f64,
) {
    let m = m as usize;
    let k_u = k as usize;
    let n = n as usize;

    // Scale C by beta
    let c_len = m * n;
    for i in 0..c_len {
        *c_ptr.add(i) *= beta;
    }

    // Add alpha * A * B
    for i in 0..m {
        for p in 0..k_u {
            let a_ip = alpha * *a_ptr.add(i * k_u + p);
            for j in 0..n {
                *c_ptr.add(i * n + j) += a_ip * *b_ptr.add(p * n + j);
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn matrix_gemv(
    alpha: f64,
    a_ptr: *const f64,
    m: i32,
    n: i32,
    x_ptr: *const f64,
    beta: f64,
    y_ptr: *mut f64,
) {
    let m = m as usize;
    let n_u = n as usize;
    for i in 0..m {
        let mut dot = 0.0_f64;
        let offset = i * n_u;
        for j in 0..n_u {
            dot += *a_ptr.add(offset + j) * *x_ptr.add(j);
        }
        *y_ptr.add(i) = alpha * dot + beta * *y_ptr.add(i);
    }
}
