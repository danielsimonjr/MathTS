//! Spectral-windowing WASM kernels — Slice 5.6.
//!
//! Adds five hot-loop kernels for windowed PSD estimation and frequency
//! analysis:
//!
//! 1. `apply_window_f64`    — element-wise window multiplication
//! 2. `welch_psd_f64`       — Welch's overlapped-segment-averaging PSD
//! 3. `bartlett_psd_f64`    — Bartlett's non-overlapped segment-averaging PSD
//! 4. `goertzel_f64`        — Goertzel single-bin DFT (returns |X[k]|²)
//! 5. `chirp_z_transform_f64` — Bluestein chirp-Z transform
//!
//! Window-type encoding (matches `windowing.rs::windowFunction`):
//!   0 = Hann, 1 = Hamming, 2 = Blackman, 3 = Rectangular (no-op)
//!
//! Pointer-ABI convention (mirrors `bessel.rs`, `tridiag.rs`):
//!   - Arrays are raw `*const f64` / `*mut f64`.
//!   - Lengths are `usize`.
//!   - Integer params (window_type) are `i32`.
//!   - Return value is 0 on success, -1 on error.

use alloc::vec;
use alloc::vec::Vec;
use core::f64::consts::PI;

use rustfft::{num_complex::Complex64, FftPlanner};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Apply a window function to `buf` in-place.
/// window_type: 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
fn apply_window_inplace(buf: &mut [f64], window_type: i32) {
    let n = buf.len();
    if n == 0 {
        return;
    }
    match window_type {
        // Hann
        0 => {
            let n1 = (n - 1) as f64;
            for (i, v) in buf.iter_mut().enumerate() {
                *v *= 0.5 * (1.0 - libm::cos(2.0 * PI * i as f64 / n1));
            }
        }
        // Hamming
        1 => {
            let n1 = (n - 1) as f64;
            for (i, v) in buf.iter_mut().enumerate() {
                *v *= 0.54 - 0.46 * libm::cos(2.0 * PI * i as f64 / n1);
            }
        }
        // Blackman
        2 => {
            let n1 = (n - 1) as f64;
            for (i, v) in buf.iter_mut().enumerate() {
                *v *= 0.42 - 0.5 * libm::cos(2.0 * PI * i as f64 / n1)
                    + 0.08 * libm::cos(4.0 * PI * i as f64 / n1);
            }
        }
        // Rectangular (3 or anything else) — no-op
        _ => {}
    }
}

/// Forward FFT of `n` real samples → complex spectrum of length `n`.
/// Allocates an internal buffer.
fn fft_real(samples: &[f64]) -> Vec<Complex64> {
    let n = samples.len();
    let mut buf: Vec<Complex64> = samples.iter().map(|&re| Complex64::new(re, 0.0)).collect();
    let mut planner = FftPlanner::<f64>::new();
    let plan = planner.plan_fft_forward(n);
    plan.process(&mut buf);
    buf
}

// ---------------------------------------------------------------------------
// 1. apply_window_f64
// ---------------------------------------------------------------------------

/// Apply a window function to `samples` in-place.
///
/// # Safety
/// `samples_ptr` must point to `n` valid, writable f64 values.
#[no_mangle]
pub unsafe extern "C" fn apply_window_f64(
    samples_ptr: *mut f64,
    n: usize,
    window_type: i32,
) -> i32 {
    if n == 0 || samples_ptr.is_null() {
        return -1;
    }
    let buf = core::slice::from_raw_parts_mut(samples_ptr, n);
    apply_window_inplace(buf, window_type);
    0
}

// ---------------------------------------------------------------------------
// 2. welch_psd_f64
// ---------------------------------------------------------------------------

/// Welch's overlapped-segment-averaging power spectral density.
///
/// Splits `samples` into overlapping frames of `frame_length`, windows each
/// frame, computes its FFT, accumulates |X[k]|², and averages.
///
/// Output length: `frame_length / 2 + 1` (one-sided PSD).
///
/// Returns 0 on success, -1 on invalid arguments.
///
/// # Safety
/// `samples_ptr` must reference `n` f64s; `out_psd_ptr` must reference
/// `frame_length / 2 + 1` writable f64s.
#[no_mangle]
pub unsafe extern "C" fn welch_psd_f64(
    samples_ptr: *const f64,
    n: usize,
    frame_length: usize,
    overlap: usize,
    window_type: i32,
    out_psd_ptr: *mut f64,
) -> i32 {
    if samples_ptr.is_null()
        || out_psd_ptr.is_null()
        || frame_length < 2
        || n < frame_length
        || overlap >= frame_length
    {
        return -1;
    }

    let samples = core::slice::from_raw_parts(samples_ptr, n);
    let psd_len = frame_length / 2 + 1;
    let out = core::slice::from_raw_parts_mut(out_psd_ptr, psd_len);

    // Zero the output accumulator
    for v in out.iter_mut() {
        *v = 0.0;
    }

    let hop = frame_length - overlap;
    let mut num_frames: usize = 0;
    let mut start = 0usize;

    // Window normalization factor (sum of squared window coefficients)
    let win_power: f64 = {
        let mut tmp: Vec<f64> = vec![1.0_f64; frame_length];
        apply_window_inplace(&mut tmp, window_type);
        tmp.iter().map(|&v| v * v).sum::<f64>() / frame_length as f64
    };

    while start + frame_length <= n {
        // Copy frame and apply window
        let mut frame: Vec<f64> = samples[start..start + frame_length].to_vec();
        apply_window_inplace(&mut frame, window_type);

        // FFT
        let spectrum = fft_real(&frame);

        // Accumulate |X[k]|²
        for k in 0..psd_len {
            out[k] += spectrum[k].norm_sqr();
        }

        num_frames += 1;
        start += hop;
    }

    if num_frames == 0 {
        return -1;
    }

    // Average and normalize
    let norm = (num_frames as f64) * (frame_length as f64) * win_power;
    for v in out.iter_mut() {
        *v /= norm;
    }
    // Double one-sided bins (except DC and Nyquist)
    for k in 1..psd_len - 1 {
        out[k] *= 2.0;
    }

    0
}

// ---------------------------------------------------------------------------
// 3. bartlett_psd_f64
// ---------------------------------------------------------------------------

/// Bartlett's non-overlapped segment-averaging PSD (Welch with overlap=0).
///
/// Output length: `frame_length / 2 + 1`.
///
/// # Safety
/// Same as `welch_psd_f64`.
#[no_mangle]
pub unsafe extern "C" fn bartlett_psd_f64(
    samples_ptr: *const f64,
    n: usize,
    frame_length: usize,
    out_psd_ptr: *mut f64,
) -> i32 {
    // Bartlett is Welch with rectangular window and no overlap
    welch_psd_f64(samples_ptr, n, frame_length, 0, 3, out_psd_ptr)
}

// ---------------------------------------------------------------------------
// 4. goertzel_f64
// ---------------------------------------------------------------------------

/// Goertzel algorithm: compute |X[k]|² for a single DFT bin.
///
/// The target bin index is `k = round(target_freq * n / sample_rate)`.
/// Returns |X[k]|² (power at the target frequency).
///
/// Returns NaN on invalid input.
///
/// # Safety
/// `samples_ptr` must reference `n` valid f64 values.
#[no_mangle]
pub unsafe extern "C" fn goertzel_f64(
    samples_ptr: *const f64,
    n: usize,
    target_freq: f64,
    sample_rate: f64,
) -> f64 {
    if samples_ptr.is_null() || n == 0 || sample_rate <= 0.0 {
        return f64::NAN;
    }

    let samples = core::slice::from_raw_parts(samples_ptr, n);

    // k: target bin (floating-point for accuracy, then round)
    let k_f = target_freq * (n as f64) / sample_rate;
    let omega = 2.0 * PI * k_f / n as f64;
    let cos_omega = libm::cos(omega);
    let coeff = 2.0 * cos_omega;

    let mut s_prev2: f64 = 0.0;
    let mut s_prev1: f64 = 0.0;

    for &x in samples.iter() {
        let s = x + coeff * s_prev1 - s_prev2;
        s_prev2 = s_prev1;
        s_prev1 = s;
    }

    // |X[k]|² = s_prev2² + s_prev1² − coeff·s_prev1·s_prev2
    s_prev2 * s_prev2 + s_prev1 * s_prev1 - coeff * s_prev1 * s_prev2
}

// ---------------------------------------------------------------------------
// 5. chirp_z_transform_f64
// ---------------------------------------------------------------------------

/// Chirp-Z Transform (Bluestein algorithm).
///
/// Computes `M` points of the z-transform along a chirp contour.
///
/// The contour is parameterized by:
///   A = (phi_start_re + i·phi_start_im)  — initial phase (complex exponential)
///   W = (phi_step_re  + i·phi_step_im)   — step ratio  (complex exponential)
///
/// Caller should pass the complex exponentials directly:
///   phi_start = exp(2πi·f_start / fs)
///   phi_step  = exp(-2πi·Δf     / fs)
///
/// Output: M complex values written to `out_re_ptr` and `out_im_ptr`.
///
/// Returns 0 on success, -1 on error.
///
/// # Safety
/// `samples_ptr` must reference `n` f64s.
/// `out_re_ptr` and `out_im_ptr` must each reference `m` writable f64s.
#[no_mangle]
pub unsafe extern "C" fn chirp_z_transform_f64(
    samples_ptr: *const f64,
    n: usize,
    m: usize,
    phi_start_re: f64,
    phi_start_im: f64,
    phi_step_re: f64,
    phi_step_im: f64,
    out_re_ptr: *mut f64,
    out_im_ptr: *mut f64,
) -> i32 {
    if samples_ptr.is_null()
        || out_re_ptr.is_null()
        || out_im_ptr.is_null()
        || n == 0
        || m == 0
    {
        return -1;
    }

    let samples = core::slice::from_raw_parts(samples_ptr, n);
    let out_re = core::slice::from_raw_parts_mut(out_re_ptr, m);
    let out_im = core::slice::from_raw_parts_mut(out_im_ptr, m);

    // A = phi_start, W = phi_step (already complex exponentials from caller)
    let a = Complex64::new(phi_start_re, phi_start_im);
    let w = Complex64::new(phi_step_re, phi_step_im);

    // Bluestein's algorithm:
    //   X[k] = sum_{n=0}^{N-1} x[n] · A^{-n} · W^{nk}
    //
    //   Using the identity nk = [k² + n² - (k-n)²] / 2:
    //   X[k] = W^{k²/2} · sum_{n=0}^{N-1} [x[n] · A^{-n} · W^{n²/2}] · W^{-(k-n)²/2}
    //
    // Steps:
    //   yn[i] = x[i] · A^{-i} · W^{i²/2}
    //   hn[i] = W^{-i²/2}   (Bluestein chirp)
    //   Convolve y and h via FFT of length L = next power of 2 >= N+M-1
    //   X[k] = W^{k²/2} · conv[k + N - 1]   (or equivalently conv[k] if zero-padded)

    let l_min = n + m - 1;
    // Next power of 2 >= l_min
    let mut l = 1usize;
    while l < l_min {
        l <<= 1;
    }

    // Build yn: length L (zero-padded after N)
    let mut yn: Vec<Complex64> = vec![Complex64::new(0.0, 0.0); l];
    // A^{-n}: starts at A^0 = 1, multiplied by A^{-1} each step.
    let a_inv = if a.norm_sqr() > 1e-300 {
        a.conj() / a.norm_sqr()
    } else {
        Complex64::new(0.0, 0.0)
    };
    let mut a_pow = Complex64::new(1.0, 0.0); // A^{-n}

    for i in 0..n {
        // W^{i²/2}: increment by W^{i-1/2} each step, starting from W^0.
        // Precompute chirp_n[i] = W^{i²/2}.
        // We'll compute it directly below to avoid accumulation error.
        let i_f = i as f64;
        // W^{i²/2} = exp(i² · ln(W) / 2) — but W is already a unit complex;
        // use the angle: arg(W) · i² / 2
        // For numerical precision we compute the phase directly.
        let arg_w = w.im.atan2(w.re); // arg(W)
        let phase = arg_w * i_f * i_f * 0.5;
        let w_half_sq = Complex64::new(libm::cos(phase), libm::sin(phase));

        yn[i] = Complex64::new(samples[i], 0.0) * a_pow * w_half_sq;
        a_pow = a_pow * a_inv;
    }

    // Build hn (chirp filter): length L (circular)
    // hn[i] = W^{-i²/2} for i = 0..M-1
    // hn[L-i] = W^{-i²/2} for i = 1..N-1
    let mut hn: Vec<Complex64> = vec![Complex64::new(0.0, 0.0); l];
    let arg_w = w.im.atan2(w.re);
    for i in 0..m {
        let phase = -arg_w * (i as f64) * (i as f64) * 0.5;
        hn[i] = Complex64::new(libm::cos(phase), libm::sin(phase));
    }
    for i in 1..n {
        let phase = -arg_w * (i as f64) * (i as f64) * 0.5;
        let v = Complex64::new(libm::cos(phase), libm::sin(phase));
        hn[l - i] = v;
    }

    // FFT(yn), FFT(hn), pointwise multiply, IFFT
    let mut planner = FftPlanner::<f64>::new();
    let fft_fwd = planner.plan_fft_forward(l);
    let fft_inv = planner.plan_fft_inverse(l);

    fft_fwd.process(&mut yn);
    fft_fwd.process(&mut hn);

    let mut gz: Vec<Complex64> = yn.iter().zip(hn.iter()).map(|(y, h)| y * h).collect();
    fft_inv.process(&mut gz);

    let scale = 1.0 / l as f64;

    // Extract M output points and multiply by W^{k²/2}
    for k in 0..m {
        let k_f = k as f64;
        let phase = arg_w * k_f * k_f * 0.5;
        let w_half_sq_k = Complex64::new(libm::cos(phase), libm::sin(phase));
        let val = gz[k] * scale * w_half_sq_k;
        out_re[k] = val.re;
        out_im[k] = val.im;
    }

    0
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    fn close(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    #[test]
    fn apply_window_hann_symmetric() {
        // Hann: w[0] = 0, w[N/2] = 1, w[N-1] = 0 for N even
        let n = 8usize;
        let mut buf = vec![1.0_f64; n];
        unsafe { apply_window_f64(buf.as_mut_ptr(), n, 0) };
        // First and last sample should be ~0
        assert!(buf[0].abs() < 1e-9, "Hann w[0] = {}", buf[0]);
        assert!(buf[n - 1].abs() < 1e-9, "Hann w[N-1] = {}", buf[n - 1]);
    }

    #[test]
    fn apply_window_rectangular_noop() {
        let n = 8usize;
        let mut buf = vec![2.5_f64; n];
        unsafe { apply_window_f64(buf.as_mut_ptr(), n, 3) };
        assert!(buf.iter().all(|&v| (v - 2.5).abs() < 1e-12));
    }

    #[test]
    fn apply_window_hamming_peak() {
        // Hamming: w[N/2] should be ~1.0
        let n = 9usize; // odd so middle is exact
        let mut buf = vec![1.0_f64; n];
        unsafe { apply_window_f64(buf.as_mut_ptr(), n, 1) };
        assert!(close(buf[n / 2], 1.0, 1e-6), "Hamming peak = {}", buf[n / 2]);
    }

    #[test]
    fn goertzel_matches_fft_bin() {
        // Generate a pure 10 Hz sinusoid sampled at 100 Hz, 100 samples.
        let n = 100usize;
        let fs = 100.0_f64;
        let f0 = 10.0_f64;
        let samples: Vec<f64> = (0..n)
            .map(|i| libm::sin(2.0 * PI * f0 * i as f64 / fs))
            .collect();

        let power = unsafe { goertzel_f64(samples.as_ptr(), n, f0, fs) };

        // |X[k]|² for a pure sine of amplitude 1 should be ~N²/4 = 2500
        // (DFT convention without normalization).
        let expected = (n as f64 / 2.0).powi(2);
        assert!(
            close(power, expected, expected * 0.05),
            "Goertzel power = {}, expected ≈ {}",
            power,
            expected
        );
    }

    #[test]
    fn goertzel_dc() {
        // DC signal: all ones at frequency 0
        let n = 64usize;
        let samples = vec![1.0_f64; n];
        let power = unsafe { goertzel_f64(samples.as_ptr(), n, 0.0, n as f64) };
        let expected = (n as f64).powi(2);
        assert!(
            close(power, expected, expected * 0.01),
            "Goertzel DC = {}, expected {}",
            power,
            expected
        );
    }

    #[test]
    fn bartlett_psd_peak_at_frequency() {
        // 8192-sample sinusoid at fs/8; peak should be in lower half of spectrum.
        let n = 8192usize;
        let fs = 8192.0_f64;
        let f0 = fs / 8.0; // bin 1024 out of 4096
        let samples: Vec<f64> = (0..n)
            .map(|i| libm::sin(2.0 * PI * f0 * i as f64 / fs))
            .collect();
        let frame = 1024usize;
        let psd_len = frame / 2 + 1;
        let mut psd = vec![0.0_f64; psd_len];

        let ret = unsafe {
            bartlett_psd_f64(samples.as_ptr(), n, frame, psd.as_mut_ptr())
        };
        assert_eq!(ret, 0, "bartlett_psd_f64 returned error");

        let peak_bin = psd
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap();
        // Expected bin: f0 / (fs / frame) = (fs/8) / (fs/frame) = frame/8 = 128
        let expected_bin = frame / 8;
        assert!(
            (peak_bin as i64 - expected_bin as i64).abs() <= 2,
            "Bartlett PSD peak at bin {} (expected ~{})",
            peak_bin,
            expected_bin
        );
    }

    #[test]
    fn welch_psd_peak_at_frequency() {
        let n = 8192usize;
        let fs = 8192.0_f64;
        let f0 = fs / 8.0;
        let samples: Vec<f64> = (0..n)
            .map(|i| libm::sin(2.0 * PI * f0 * i as f64 / fs))
            .collect();
        let frame = 1024usize;
        let overlap = frame / 2;
        let psd_len = frame / 2 + 1;
        let mut psd = vec![0.0_f64; psd_len];

        let ret = unsafe {
            welch_psd_f64(samples.as_ptr(), n, frame, overlap, 0, psd.as_mut_ptr())
        };
        assert_eq!(ret, 0);

        let peak_bin = psd
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap();
        let expected_bin = frame / 8;
        assert!(
            (peak_bin as i64 - expected_bin as i64).abs() <= 2,
            "Welch PSD peak at bin {} (expected ~{})",
            peak_bin,
            expected_bin
        );
    }

    #[test]
    fn chirp_z_identity_fft() {
        // CZT with W = exp(-2πi/N) and A = 1 should match DFT.
        let n = 8usize;
        let samples: Vec<f64> = (0..n).map(|i| (i as f64 + 1.0)).collect();
        let m = n;

        // W = exp(-2πi/N)
        let angle_w = -2.0 * PI / n as f64;
        let phi_step_re = libm::cos(angle_w);
        let phi_step_im = libm::sin(angle_w);
        // A = 1 (phi_start = exp(0) = 1)
        let phi_start_re = 1.0_f64;
        let phi_start_im = 0.0_f64;

        let mut out_re = vec![0.0_f64; m];
        let mut out_im = vec![0.0_f64; m];

        let ret = unsafe {
            chirp_z_transform_f64(
                samples.as_ptr(),
                n,
                m,
                phi_start_re,
                phi_start_im,
                phi_step_re,
                phi_step_im,
                out_re.as_mut_ptr(),
                out_im.as_mut_ptr(),
            )
        };
        assert_eq!(ret, 0);

        // Compare against direct FFT
        let spectrum = fft_real(&samples);
        for k in 0..m {
            let tol = 1e-7;
            assert!(
                close(out_re[k], spectrum[k].re, tol),
                "CZT re[{}] = {} vs FFT = {} (diff = {})",
                k,
                out_re[k],
                spectrum[k].re,
                (out_re[k] - spectrum[k].re).abs()
            );
            assert!(
                close(out_im[k], spectrum[k].im, tol),
                "CZT im[{}] = {} vs FFT = {} (diff = {})",
                k,
                out_im[k],
                spectrum[k].im,
                (out_im[k] - spectrum[k].im).abs()
            );
        }
    }
}
