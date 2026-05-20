//! Signal windowing / resampling kernels — window generators, linear
//! resampling, median filtering.
//!
//! Gap B: these DSP kernels were absent from the crate's `signal/` modules.
//! All allocation-free (caller buffers).

use core::f64::consts::PI;

/// Output length of [`resample`] for the given parameters.
#[no_mangle]
pub extern "C" fn resampleLength(x_len: i32, new_rate: f64, old_rate: f64) -> i32 {
    if x_len <= 0 || new_rate <= 0.0 || old_rate <= 0.0 {
        return 0;
    }
    let ratio = old_rate / new_rate;
    libm::round(x_len as f64 / ratio) as i32
}

/// Linear-interpolation resampling of signal `x` from `old_rate` to
/// `new_rate`. `out` must hold `resampleLength(x_len, new_rate, old_rate)`.
///
/// # Safety
/// `x_ptr` references `x_len` `f64`s; `out_ptr` the resampled length.
#[no_mangle]
pub unsafe extern "C" fn resample(
    x_ptr: *const f64,
    x_len: i32,
    new_rate: f64,
    old_rate: f64,
    out_ptr: *mut f64,
) -> i32 {
    if x_len <= 0 || new_rate <= 0.0 || old_rate <= 0.0 {
        return -1;
    }
    let x = core::slice::from_raw_parts(x_ptr, x_len as usize);
    let ratio = old_rate / new_rate;
    let new_len = libm::round(x_len as f64 / ratio) as i32;
    for i in 0..new_len {
        let src_idx = i as f64 * ratio;
        let lo = (libm::floor(src_idx) as i32).clamp(0, x_len - 1);
        let hi = (lo + 1).clamp(0, x_len - 1);
        let frac = src_idx - lo as f64;
        *out_ptr.add(i as usize) =
            x[lo as usize] * (1.0 - frac) + x[hi as usize] * frac;
    }
    new_len
}

/// Median filter of `x` with window size `n` (forced odd). `out` holds
/// `x_len` values; `work` holds `n` (or `n + 1` if `n` was even).
///
/// # Safety
/// `x_ptr`/`out_ptr` reference `x_len` `f64`s; `work_ptr` references `n|1`.
#[no_mangle]
pub unsafe extern "C" fn medfilt(
    x_ptr: *const f64,
    x_len: i32,
    n: i32,
    out_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if x_len <= 0 {
        return -1;
    }
    let mut win = if n < 1 { 1 } else { n };
    if win % 2 == 0 {
        win += 1;
    }
    let half = win / 2;
    let x = core::slice::from_raw_parts(x_ptr, x_len as usize);
    let work = core::slice::from_raw_parts_mut(work_ptr, win as usize);

    for i in 0..x_len {
        let mut wlen = 0usize;
        let mut j = i - half;
        while j <= i + half {
            if j >= 0 && j < x_len {
                work[wlen] = x[j as usize];
                wlen += 1;
            }
            j += 1;
        }
        // Insertion sort the (small) window.
        for a in 1..wlen {
            let key = work[a];
            let mut b = a;
            while b > 0 && work[b - 1] > key {
                work[b] = work[b - 1];
                b -= 1;
            }
            work[b] = key;
        }
        *out_ptr.add(i as usize) = work[wlen / 2];
    }
    x_len
}

/// Generate a window of length `n`. `window_type`: 0 rectangular,
/// 1 hamming, 2 hann, 3 blackman, 4 bartlett. `out` must hold `n` values.
///
/// # Safety
/// `out_ptr` must reference `n` writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn windowFunction(
    n: i32,
    window_type: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    let n1 = (n - 1) as f64;
    for i in 0..n {
        let fi = i as f64;
        let v = match window_type {
            1 => 0.54 - 0.46 * libm::cos(2.0 * PI * fi / n1),
            2 => 0.5 * (1.0 - libm::cos(2.0 * PI * fi / n1)),
            3 => {
                0.42 - 0.5 * libm::cos(2.0 * PI * fi / n1)
                    + 0.08 * libm::cos(4.0 * PI * fi / n1)
            }
            4 => 1.0 - libm::fabs((2.0 * fi - n1) / n1),
            _ => 1.0,
        };
        *out_ptr.add(i as usize) = v;
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn window_rectangular() {
        let mut out = [0.0f64; 5];
        let n = unsafe { windowFunction(5, 0, out.as_mut_ptr()) };
        assert_eq!(n, 5);
        assert!(out.iter().all(|&v| v == 1.0));
    }

    #[test]
    fn window_hamming_hann() {
        let mut out = [0.0f64; 3];
        unsafe { windowFunction(3, 1, out.as_mut_ptr()) };
        assert!(close(out[0], 0.08) && close(out[1], 1.0) && close(out[2], 0.08));
        unsafe { windowFunction(3, 2, out.as_mut_ptr()) };
        assert!(close(out[0], 0.0) && close(out[1], 1.0) && close(out[2], 0.0));
    }

    #[test]
    fn window_bartlett() {
        let mut out = [0.0f64; 5];
        unsafe { windowFunction(5, 4, out.as_mut_ptr()) };
        // triangular: peak 1.0 in the middle, 0 at the ends
        assert!(close(out[0], 0.0) && close(out[2], 1.0) && close(out[4], 0.0));
    }

    #[test]
    fn median_filter() {
        let x = [1.0, 5.0, 2.0, 8.0, 3.0];
        let mut out = [0.0f64; 5];
        let mut work = [0.0f64; 3];
        let n = unsafe {
            medfilt(x.as_ptr(), 5, 3, out.as_mut_ptr(), work.as_mut_ptr())
        };
        assert_eq!(n, 5);
        assert_eq!(out.to_vec(), vec![5.0, 2.0, 5.0, 3.0, 8.0]);
    }

    #[test]
    fn resample_down_and_up() {
        // Downsample [0,1,2,3] by 2 -> [0, 2]
        let x = [0.0, 1.0, 2.0, 3.0];
        assert_eq!(resampleLength(4, 2.0, 4.0), 2);
        let mut out = [0.0f64; 8];
        let n = unsafe { resample(x.as_ptr(), 4, 2.0, 4.0, out.as_mut_ptr()) };
        assert_eq!(n, 2);
        assert!(close(out[0], 0.0) && close(out[1], 2.0));

        // Upsample [0,10,20,30] by 2 -> length 8
        let y = [0.0, 10.0, 20.0, 30.0];
        let n2 = unsafe { resample(y.as_ptr(), 4, 8.0, 4.0, out.as_mut_ptr()) };
        assert_eq!(n2, 8);
        assert!(close(out[1], 5.0) && close(out[3], 15.0) && close(out[6], 30.0));
    }
}
