//! Advanced interpolation: Bezier, B-spline, LOESS, RBF, griddata.

/// Evaluate a Bezier curve at parameter t using De Casteljau's algorithm.
///
/// * `ctrl_ptr` - Pointer to control points (n_points * dims f64 values, row-major)
/// * `n_points` - Number of control points
/// * `dims` - Number of dimensions per point
/// * `t` - Parameter in [0, 1]
/// * `result_ptr` - Output: evaluated point (dims elements)
#[no_mangle]
pub unsafe extern "C" fn bezier_eval_wasm(
    ctrl_ptr: *const f64,
    n_points: i32,
    dims: i32,
    t: f64,
    result_ptr: *mut f64,
) {
    let n = n_points as usize;
    let d = dims as usize;

    if n == 0 {
        return;
    }
    if n == 1 {
        for k in 0..d {
            *result_ptr.add(k) = *ctrl_ptr.add(k);
        }
        return;
    }

    // Copy control points into work buffer
    let mut work = alloc::vec![0.0f64; n * d];
    for i in 0..(n * d) {
        work[i] = *ctrl_ptr.add(i);
    }

    // De Casteljau's algorithm
    let omt = 1.0 - t;
    for level in 1..n {
        let count = n - level;
        for i in 0..count {
            for k in 0..d {
                work[i * d + k] = omt * work[i * d + k] + t * work[(i + 1) * d + k];
            }
        }
    }

    for k in 0..d {
        *result_ptr.add(k) = work[k];
    }
}

/// Evaluate a B-spline curve at parameter t using De Boor's algorithm.
///
/// Uses a uniform knot vector clamped at both ends.
///
/// * `ctrl_ptr` - Pointer to control points (n_points * 1, single-dimension values)
/// * `n_points` - Number of control points
/// * `degree` - B-spline degree
/// * `t` - Parameter in [0, 1]
/// * `result_ptr` - Output: single evaluated value
#[no_mangle]
pub unsafe extern "C" fn bspline_eval_wasm(
    ctrl_ptr: *const f64,
    n_points: i32,
    degree: i32,
    t: f64,
    result_ptr: *mut f64,
) {
    let n = n_points as usize;
    let p = degree as usize;

    if n == 0 || p >= n {
        *result_ptr = 0.0;
        return;
    }

    // Build clamped uniform knot vector
    let m = n + p + 1;
    let mut knots = alloc::vec![0.0f64; m];
    let n_internal = m - 2 * (p + 1);
    for i in 0..m {
        if i <= p {
            knots[i] = 0.0;
        } else if i >= m - p - 1 {
            knots[i] = 1.0;
        } else {
            knots[i] = (i - p) as f64 / (n_internal + 1) as f64;
        }
    }

    // Clamp t
    let t = if t < 0.0 {
        0.0
    } else if t > 1.0 {
        1.0
    } else {
        t
    };

    // Find knot span: largest k such that knots[k] <= t and k < n
    let mut k = p;
    for i in (p + 1)..n {
        if knots[i] <= t && knots[i + 1] > t {
            k = i;
            break;
        }
    }
    // Handle t == 1.0
    if t >= 1.0 {
        k = n - 1;
    }

    // De Boor's algorithm
    let mut d = alloc::vec![0.0f64; p + 1];
    for j in 0..=p {
        let idx = k.wrapping_sub(p) + j;
        if idx < n {
            d[j] = *ctrl_ptr.add(idx);
        }
    }

    for r in 1..=p {
        for j in (r..=p).rev() {
            let left = k.wrapping_sub(p) + j;
            let knot_left = if left < m { knots[left] } else { 1.0 };
            let knot_right_idx = left + p + 1 - r;
            let knot_right = if knot_right_idx < m {
                knots[knot_right_idx]
            } else {
                1.0
            };
            let denom = knot_right - knot_left;
            let alpha = if libm::fabs(denom) > 1e-15 {
                (t - knot_left) / denom
            } else {
                0.0
            };
            d[j] = (1.0 - alpha) * d[j - 1] + alpha * d[j];
        }
    }

    *result_ptr = d[p];
}

/// LOESS (locally estimated scatterplot smoothing) at a single query point.
///
/// * `xs_ptr` - Pointer to x data (n elements)
/// * `ys_ptr` - Pointer to y data (n elements)
/// * `n` - Number of data points
/// * `x` - Query point
/// * `bandwidth` - Fraction of data to use (0, 1]
///
/// Returns the LOESS estimate at x.
#[no_mangle]
pub unsafe extern "C" fn loess_wasm(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: i32,
    x: f64,
    bandwidth: f64,
) -> f64 {
    let n = n as usize;
    if n == 0 {
        return 0.0;
    }
    if n == 1 {
        return *ys_ptr;
    }

    let k = {
        let k_raw = libm::ceil(bandwidth * n as f64) as usize;
        if k_raw < 2 {
            2
        } else if k_raw > n {
            n
        } else {
            k_raw
        }
    };

    // Compute distances and find k nearest neighbors
    // Use simple selection: compute all distances, then partial sort
    let mut dist_idx: alloc::vec::Vec<(f64, usize)> = alloc::vec::Vec::with_capacity(n);
    for i in 0..n {
        dist_idx.push((libm::fabs(*xs_ptr.add(i) - x), i));
    }

    // Partial sort to find k smallest distances (selection sort for k elements)
    for i in 0..k {
        let mut min_j = i;
        let mut min_d = dist_idx[i].0;
        for j in (i + 1)..n {
            if dist_idx[j].0 < min_d {
                min_d = dist_idx[j].0;
                min_j = j;
            }
        }
        if min_j != i {
            dist_idx.swap(i, min_j);
        }
    }

    let max_dist = dist_idx[k - 1].0;
    let max_dist = if max_dist < 1e-15 { 1.0 } else { max_dist };

    // Weighted linear regression with tricube kernel
    let mut sw = 0.0f64;
    let mut swx = 0.0f64;
    let mut swy = 0.0f64;
    let mut swxx = 0.0f64;
    let mut swxy = 0.0f64;

    for i in 0..k {
        let (d, idx) = dist_idx[i];
        let u = d / max_dist;
        let w = if u < 1.0 {
            let v = 1.0 - u * u * u;
            v * v * v
        } else {
            0.0
        };

        let xi = *xs_ptr.add(idx);
        let yi = *ys_ptr.add(idx);

        sw += w;
        swx += w * xi;
        swy += w * yi;
        swxx += w * xi * xi;
        swxy += w * xi * yi;
    }

    let det = sw * swxx - swx * swx;
    if libm::fabs(det) < 1e-15 {
        return if sw > 0.0 { swy / sw } else { 0.0 };
    }

    let a = (swxx * swy - swx * swxy) / det;
    let b = (sw * swxy - swx * swy) / det;
    a + b * x
}

/// Radial basis function (RBF) interpolation with Gaussian kernel.
///
/// Solves the RBF system: sum_j w_j * phi(||xi - xj||) = f_j for weights,
/// then evaluates at query points.
///
/// * `points_ptr` - Data points (n * dims, row-major)
/// * `values_ptr` - Data values (n elements)
/// * `n` - Number of data points
/// * `dims` - Dimensionality of points
/// * `xi_ptr` - Query points (ni * dims, row-major)
/// * `ni` - Number of query points
/// * `result_ptr` - Output: interpolated values (ni elements)
#[no_mangle]
pub unsafe extern "C" fn rbf_interp_wasm(
    points_ptr: *const f64,
    values_ptr: *const f64,
    n: i32,
    dims: i32,
    xi_ptr: *const f64,
    ni: i32,
    result_ptr: *mut f64,
) {
    let n = n as usize;
    let d = dims as usize;
    let ni = ni as usize;

    if n == 0 || ni == 0 {
        return;
    }

    // Compute average inter-point distance for epsilon
    let mut sum_dist = 0.0f64;
    let mut count = 0usize;
    let sample = if n < 50 { n } else { 50 };
    for i in 0..sample {
        for j in (i + 1)..sample {
            let mut dist_sq = 0.0f64;
            for k in 0..d {
                let diff = *points_ptr.add(i * d + k) - *points_ptr.add(j * d + k);
                dist_sq += diff * diff;
            }
            sum_dist += libm::sqrt(dist_sq);
            count += 1;
        }
    }
    let epsilon = if count > 0 {
        1.0 / (sum_dist / count as f64)
    } else {
        1.0
    };

    // Build RBF matrix phi(||xi - xj||) using Gaussian kernel
    let mut phi = alloc::vec![0.0f64; n * n];
    for i in 0..n {
        for j in 0..n {
            let mut dist_sq = 0.0f64;
            for k in 0..d {
                let diff = *points_ptr.add(i * d + k) - *points_ptr.add(j * d + k);
                dist_sq += diff * diff;
            }
            phi[i * n + j] = libm::exp(-epsilon * epsilon * dist_sq);
        }
    }

    // Solve phi * w = values via Gaussian elimination
    let mut aug = alloc::vec![0.0f64; n * (n + 1)];
    for i in 0..n {
        for j in 0..n {
            aug[i * (n + 1) + j] = phi[i * n + j];
        }
        aug[i * (n + 1) + n] = *values_ptr.add(i);
    }

    for k in 0..n {
        let mut max_val = libm::fabs(aug[k * (n + 1) + k]);
        let mut max_row = k;
        for i in (k + 1)..n {
            let v = libm::fabs(aug[i * (n + 1) + k]);
            if v > max_val {
                max_val = v;
                max_row = i;
            }
        }
        if max_val < 1e-14 {
            continue;
        }
        if max_row != k {
            for j in 0..(n + 1) {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
        }
        let pivot = aug[k * (n + 1) + k];
        for i in (k + 1)..n {
            let factor = aug[i * (n + 1) + k] / pivot;
            for j in (k + 1)..(n + 1) {
                aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
            }
            aug[i * (n + 1) + k] = 0.0;
        }
    }

    let mut weights = alloc::vec![0.0f64; n];
    let mut i = n as isize - 1;
    while i >= 0 {
        let iu = i as usize;
        let mut s = aug[iu * (n + 1) + n];
        for j in (iu + 1)..n {
            s -= aug[iu * (n + 1) + j] * weights[j];
        }
        let diag = aug[iu * (n + 1) + iu];
        weights[iu] = if libm::fabs(diag) > 1e-14 {
            s / diag
        } else {
            0.0
        };
        i -= 1;
    }

    // Evaluate at query points
    for qi in 0..ni {
        let mut val = 0.0f64;
        for j in 0..n {
            let mut dist_sq = 0.0f64;
            for k in 0..d {
                let diff = *xi_ptr.add(qi * d + k) - *points_ptr.add(j * d + k);
                dist_sq += diff * diff;
            }
            val += weights[j] * libm::exp(-epsilon * epsilon * dist_sq);
        }
        *result_ptr.add(qi) = val;
    }
}

/// Scattered data gridding using inverse distance weighting (IDW).
///
/// Interpolates scattered 2D data onto a regular grid.
///
/// * `points_ptr` - Data point coordinates (n * 2: [x0,y0, x1,y1, ...])
/// * `values_ptr` - Data values (n elements)
/// * `n` - Number of data points
/// * `xi_ptr` - x-coordinates of output grid (ni elements)
/// * `yi_ptr` - y-coordinates of output grid (ni elements)
/// * `ni` - Number of grid points (total, flattened)
/// * `result_ptr` - Output: interpolated values (ni elements)
#[no_mangle]
pub unsafe extern "C" fn griddata_wasm(
    points_ptr: *const f64,
    values_ptr: *const f64,
    n: i32,
    xi_ptr: *const f64,
    yi_ptr: *const f64,
    ni: i32,
    result_ptr: *mut f64,
) {
    let n = n as usize;
    let ni = ni as usize;
    let power = 2.0f64;

    for qi in 0..ni {
        let qx = *xi_ptr.add(qi);
        let qy = *yi_ptr.add(qi);

        let mut sum_w = 0.0f64;
        let mut sum_wv = 0.0f64;
        let mut exact = false;
        let mut exact_val = 0.0f64;

        for k in 0..n {
            let dx = qx - *points_ptr.add(k * 2);
            let dy = qy - *points_ptr.add(k * 2 + 1);
            let d = libm::sqrt(dx * dx + dy * dy);

            if d < 1e-15 {
                exact = true;
                exact_val = *values_ptr.add(k);
                break;
            }

            let w = 1.0 / libm::pow(d, power);
            sum_w += w;
            sum_wv += w * *values_ptr.add(k);
        }

        *result_ptr.add(qi) = if exact {
            exact_val
        } else if sum_w > 0.0 {
            sum_wv / sum_w
        } else {
            0.0
        };
    }
}
