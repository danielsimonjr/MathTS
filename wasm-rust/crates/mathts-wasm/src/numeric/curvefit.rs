//! Log-linearized curve fitting — exponential, logarithmic, power models.
//!
//! Gap B. Each fit writes its two coefficients `[a, b]` into `out` and
//! returns `0`, or `-1` for invalid input. Allocation-free.

/// Least-squares slope/intercept of `(px, py)` paired sums.
fn lin_fit(n: f64, sx: f64, sy: f64, sxx: f64, sxy: f64) -> (f64, f64) {
    let slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    let intercept = (sy - slope * sx) / n;
    (slope, intercept)
}

/// Exponential fit `y = a * exp(b * x)`. Writes `[a, b]` to `out`.
///
/// # Safety
/// `xs_ptr`/`ys_ptr` reference `len` f64s; `out_ptr` references 2.
#[no_mangle]
pub unsafe extern "C" fn expfit(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    len: i32,
    out_ptr: *mut f64,
) -> i32 {
    if len <= 0 {
        return -1;
    }
    let n = len as usize;
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);
    let (mut sx, mut sy, mut sxx, mut sxy) = (0.0, 0.0, 0.0, 0.0);
    for i in 0..n {
        let absy = libm::fabs(ys[i]);
        let log_y = libm::log(if absy != 0.0 { absy } else { 1e-15 });
        sx += xs[i];
        sy += log_y;
        sxx += xs[i] * xs[i];
        sxy += xs[i] * log_y;
    }
    let (b, lna) = lin_fit(n as f64, sx, sy, sxx, sxy);
    *out_ptr = libm::exp(lna);
    *out_ptr.add(1) = b;
    0
}

/// Logarithmic fit `y = a * ln(x) + b`. Writes `[a, b]` to `out`.
///
/// # Safety
/// As [`expfit`].
#[no_mangle]
pub unsafe extern "C" fn logfit(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    len: i32,
    out_ptr: *mut f64,
) -> i32 {
    if len <= 0 {
        return -1;
    }
    let n = len as usize;
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);
    let (mut sx, mut sy, mut sxx, mut sxy) = (0.0, 0.0, 0.0, 0.0);
    for i in 0..n {
        let log_x = libm::log(xs[i]);
        sx += log_x;
        sy += ys[i];
        sxx += log_x * log_x;
        sxy += log_x * ys[i];
    }
    let (a, b) = lin_fit(n as f64, sx, sy, sxx, sxy);
    *out_ptr = a;
    *out_ptr.add(1) = b;
    0
}

/// Power fit `y = a * x^b`. Writes `[a, b]` to `out`.
///
/// # Safety
/// As [`expfit`].
#[no_mangle]
pub unsafe extern "C" fn powerfit(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    len: i32,
    out_ptr: *mut f64,
) -> i32 {
    if len <= 0 {
        return -1;
    }
    let n = len as usize;
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);
    let (mut sx, mut sy, mut sxx, mut sxy) = (0.0, 0.0, 0.0, 0.0);
    for i in 0..n {
        let log_x = libm::log(xs[i]);
        let log_y = libm::log(ys[i]);
        sx += log_x;
        sy += log_y;
        sxx += log_x * log_x;
        sxy += log_x * log_y;
    }
    let (b, lna) = lin_fit(n as f64, sx, sy, sxx, sxy);
    *out_ptr = libm::exp(lna);
    *out_ptr.add(1) = b;
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec::Vec;

    fn fit(
        f: unsafe extern "C" fn(*const f64, *const f64, i32, *mut f64) -> i32,
        xs: &[f64],
        ys: &[f64],
    ) -> (f64, f64) {
        let mut out = [0.0f64; 2];
        unsafe {
            f(xs.as_ptr(), ys.as_ptr(), xs.len() as i32, out.as_mut_ptr());
        }
        (out[0], out[1])
    }

    #[test]
    fn exponential_fit() {
        // y = 2 * exp(0.5 x)
        let xs = [0.0, 1.0, 2.0, 3.0, 4.0];
        let ys: Vec<f64> = xs.iter().map(|&x| 2.0 * libm::exp(0.5 * x)).collect();
        let (a, b) = fit(expfit, &xs, &ys);
        assert!((a - 2.0).abs() < 1e-9, "a = {a}");
        assert!((b - 0.5).abs() < 1e-9, "b = {b}");
    }

    #[test]
    fn logarithmic_fit() {
        // y = 3 ln(x) + 1
        let xs = [1.0, 2.0, 3.0, 4.0, 5.0];
        let ys: Vec<f64> = xs.iter().map(|&x| 3.0 * libm::log(x) + 1.0).collect();
        let (a, b) = fit(logfit, &xs, &ys);
        assert!((a - 3.0).abs() < 1e-9, "a = {a}");
        assert!((b - 1.0).abs() < 1e-9, "b = {b}");
    }

    #[test]
    fn power_fit() {
        // y = 2 * x^1.5
        let xs = [1.0, 2.0, 3.0, 4.0, 5.0];
        let ys: Vec<f64> = xs.iter().map(|&x| 2.0 * libm::pow(x, 1.5)).collect();
        let (a, b) = fit(powerfit, &xs, &ys);
        assert!((a - 2.0).abs() < 1e-9, "a = {a}");
        assert!((b - 1.5).abs() < 1e-9, "b = {b}");
    }
}
