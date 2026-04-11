//! Extended signal processing functions: DCT, DST, DWT, Hilbert, STFT, PSD, FIR.
//!
//! All functions use raw memory pointers for WASM interop.

use alloc::vec::Vec;
use core::f64::consts::PI;
use rustfft::num_complex::Complex64;
use rustfft::FftPlanner;

// ---------------------------------------------------------------------------
// Internal helper: in-place FFT via rustfft (interleaved complex)
// ---------------------------------------------------------------------------

/// Run forward/inverse FFT on `n` complex values stored as interleaved f64.
unsafe fn fft_interleaved(ptr: *mut f64, n: usize, inverse: bool) {
    let mut planner = FftPlanner::<f64>::new();
    let plan = if inverse {
        planner.plan_fft_inverse(n)
    } else {
        planner.plan_fft_forward(n)
    };
    let mut buf: Vec<Complex64> = Vec::with_capacity(n);
    for i in 0..n {
        buf.push(Complex64::new(*ptr.add(i * 2), *ptr.add(i * 2 + 1)));
    }
    plan.process(&mut buf);
    if inverse {
        let scale = 1.0 / n as f64;
        for i in 0..n {
            *ptr.add(i * 2) = buf[i].re * scale;
            *ptr.add(i * 2 + 1) = buf[i].im * scale;
        }
    } else {
        for i in 0..n {
            *ptr.add(i * 2) = buf[i].re;
            *ptr.add(i * 2 + 1) = buf[i].im;
        }
    }
}

/// Run forward/inverse FFT on separate real/imag arrays of length `n`.
unsafe fn fft_split(re: *mut f64, im: *mut f64, n: usize, inverse: bool) {
    let mut planner = FftPlanner::<f64>::new();
    let plan = if inverse {
        planner.plan_fft_inverse(n)
    } else {
        planner.plan_fft_forward(n)
    };
    let mut buf: Vec<Complex64> = Vec::with_capacity(n);
    for i in 0..n {
        buf.push(Complex64::new(*re.add(i), *im.add(i)));
    }
    plan.process(&mut buf);
    if inverse {
        let scale = 1.0 / n as f64;
        for i in 0..n {
            *re.add(i) = buf[i].re * scale;
            *im.add(i) = buf[i].im * scale;
        }
    } else {
        for i in 0..n {
            *re.add(i) = buf[i].re;
            *im.add(i) = buf[i].im;
        }
    }
}

fn next_power_of_2(n: usize) -> usize {
    let mut v = n;
    v -= 1;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v += 1;
    if v < 1 {
        1
    } else {
        v
    }
}

// ===========================================================================
// 1. DCT-II (Type II Discrete Cosine Transform)
// ===========================================================================

/// Compute DCT-II: X[k] = sum_{n=0}^{N-1} x[n] * cos(pi/N * (n + 0.5) * k)
///
/// Orthonormal scaling: k=0 scaled by sqrt(1/N), k>0 by sqrt(2/N).
///
/// # Safety
/// `in_ptr` must point to `n` f64 values, `out_ptr` to `n` writable f64.
#[no_mangle]
pub unsafe extern "C" fn dct_wasm(in_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    if n == 0 {
        return;
    }
    let factor = PI / n as f64;
    let scale0 = libm::sqrt(1.0 / n as f64);
    let scalek = libm::sqrt(2.0 / n as f64);

    for k in 0..n {
        let mut sum = 0.0_f64;
        for i in 0..n {
            sum += *in_ptr.add(i) * libm::cos(factor * (i as f64 + 0.5) * k as f64);
        }
        *out_ptr.add(k) = sum * if k == 0 { scale0 } else { scalek };
    }
}

// ===========================================================================
// 2. IDCT (Type III DCT = inverse of Type II)
// ===========================================================================

/// Compute IDCT (DCT-III), the inverse of dct_wasm.
///
/// # Safety
/// `in_ptr` must point to `n` f64 values, `out_ptr` to `n` writable f64.
#[no_mangle]
pub unsafe extern "C" fn idct_wasm(in_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    if n == 0 {
        return;
    }
    let factor = PI / n as f64;
    let scale0 = libm::sqrt(1.0 / n as f64);
    let scalek = libm::sqrt(2.0 / n as f64);

    for i in 0..n {
        let mut sum = *in_ptr * scale0; // k=0 term
        for k in 1..n {
            sum += *in_ptr.add(k) * scalek * libm::cos(factor * (i as f64 + 0.5) * k as f64);
        }
        *out_ptr.add(i) = sum;
    }
}

// ===========================================================================
// 3. DST-II (Type II Discrete Sine Transform)
// ===========================================================================

/// Compute DST-II: X[k] = sum_{n=0}^{N-1} x[n] * sin(pi/N * (n+0.5) * (k+1))
///
/// Orthonormal scaling: sqrt(2/N).
///
/// # Safety
/// `in_ptr` must point to `n` f64, `out_ptr` to `n` writable f64.
#[no_mangle]
pub unsafe extern "C" fn dst_wasm(in_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    if n == 0 {
        return;
    }
    let factor = PI / n as f64;
    let scale = libm::sqrt(2.0 / n as f64);

    for k in 0..n {
        let mut sum = 0.0_f64;
        for i in 0..n {
            sum += *in_ptr.add(i) * libm::sin(factor * (i as f64 + 0.5) * (k as f64 + 1.0));
        }
        *out_ptr.add(k) = sum * scale;
    }
}

// ===========================================================================
// 4. IDST (Type III DST = inverse of Type II DST)
// ===========================================================================

/// Compute IDST (DST-III), the inverse of dst_wasm.
///
/// # Safety
/// `in_ptr` must point to `n` f64, `out_ptr` to `n` writable f64.
#[no_mangle]
pub unsafe extern "C" fn idst_wasm(in_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    if n == 0 {
        return;
    }
    let factor = PI / n as f64;
    let scale = libm::sqrt(2.0 / n as f64);
    let scale_last = libm::sqrt(1.0 / n as f64);

    for i in 0..n {
        let mut sum = 0.0_f64;
        for k in 0..n {
            let s = if k == n - 1 { scale_last } else { scale };
            sum += *in_ptr.add(k) * s * libm::sin(factor * (i as f64 + 0.5) * (k as f64 + 1.0));
        }
        *out_ptr.add(i) = sum;
    }
}

// ===========================================================================
// 5. DWT — Haar Discrete Wavelet Transform
// ===========================================================================

/// Single-level Haar DWT.
///
/// `approx[i] = (x[2i] + x[2i+1]) / sqrt(2)`
/// `detail[i] = (x[2i] - x[2i+1]) / sqrt(2)`
///
/// Output length: n/2 each for approx and detail.
///
/// # Safety
/// `in_ptr` points to `n` f64. `approx_ptr` and `detail_ptr` each point
/// to `n/2` writable f64. `n` must be even.
#[no_mangle]
pub unsafe extern "C" fn dwt_wasm(
    in_ptr: *const f64,
    approx_ptr: *mut f64,
    detail_ptr: *mut f64,
    n: i32,
) {
    let n = n as usize;
    let half = n / 2;
    let s = core::f64::consts::FRAC_1_SQRT_2; // 1/sqrt(2)

    for i in 0..half {
        let x0 = *in_ptr.add(2 * i);
        let x1 = *in_ptr.add(2 * i + 1);
        *approx_ptr.add(i) = (x0 + x1) * s;
        *detail_ptr.add(i) = (x0 - x1) * s;
    }
}

// ===========================================================================
// 6. Hilbert Transform via FFT
// ===========================================================================

/// Hilbert transform of a real signal via FFT.
///
/// Produces the analytic signal: zero negative frequencies, double positive.
/// Output: real and imaginary parts of the analytic signal.
///
/// # Safety
/// `in_re` and `in_im` point to `n` f64 input (set `in_im` to zeros for
/// real input). `out_re` and `out_im` point to `n` writable f64.
/// `n` must be a power of 2.
#[no_mangle]
pub unsafe extern "C" fn hilbert_wasm(
    in_re: *const f64,
    in_im: *const f64,
    out_re: *mut f64,
    out_im: *mut f64,
    n: i32,
) {
    let n = n as usize;
    if n == 0 {
        return;
    }

    // Copy input to output buffers
    for i in 0..n {
        *out_re.add(i) = *in_re.add(i);
        *out_im.add(i) = *in_im.add(i);
    }

    // Forward FFT
    fft_split(out_re, out_im, n, false);

    // Build analytic signal spectrum:
    // DC (k=0): keep as-is
    // Positive freqs (k=1..N/2-1): multiply by 2
    // Nyquist (k=N/2): keep as-is
    // Negative freqs (k=N/2+1..N-1): set to zero
    if n > 1 {
        let half = n / 2;
        for i in 1..half {
            *out_re.add(i) *= 2.0;
            *out_im.add(i) *= 2.0;
        }
        // Nyquist stays as-is
        for i in (half + 1)..n {
            *out_re.add(i) = 0.0;
            *out_im.add(i) = 0.0;
        }
    }

    // Inverse FFT
    fft_split(out_re, out_im, n, true);
}

// ===========================================================================
// 7. Spectrogram (STFT magnitude)
// ===========================================================================

/// Compute spectrogram via Short-Time Fourier Transform.
///
/// Applies a Hann window, computes FFT magnitude for each frame.
/// Output is row-major: `out[frame * (window_size/2+1) + bin]`.
/// Returns the number of frames.
///
/// # Safety
/// `in_ptr` points to `n` f64. `out_ptr` must have room for
/// `num_frames * (window_size/2 + 1)` f64 where
/// `num_frames = (n - window_size) / hop + 1`.
#[no_mangle]
pub unsafe extern "C" fn spectrogram_wasm(
    in_ptr: *const f64,
    out_ptr: *mut f64,
    n: i32,
    window_size: i32,
    hop: i32,
) -> i32 {
    let n = n as usize;
    let ws = window_size as usize;
    let hop = hop as usize;
    if ws == 0 || hop == 0 || n < ws {
        return 0;
    }

    let nfft = next_power_of_2(ws);
    let n_freqs = nfft / 2 + 1;

    // Pre-compute Hann window
    let mut win: Vec<f64> = Vec::with_capacity(ws);
    let n1 = (ws - 1) as f64;
    for i in 0..ws {
        win.push(0.5 * (1.0 - libm::cos(2.0 * PI * i as f64 / n1)));
    }

    // Temp buffer for FFT (interleaved complex)
    let mut buf: Vec<f64> = alloc::vec![0.0; nfft * 2];

    let mut num_frames: i32 = 0;
    let mut start = 0usize;
    while start + ws <= n {
        // Zero the buffer
        for v in buf.iter_mut() {
            *v = 0.0;
        }
        // Apply window and copy
        for i in 0..ws {
            buf[i * 2] = *in_ptr.add(start + i) * win[i];
            // imag stays 0
        }

        // In-place FFT
        fft_interleaved(buf.as_mut_ptr(), nfft, false);

        // Compute magnitude for positive frequencies
        let out_offset = num_frames as usize * n_freqs;
        for i in 0..n_freqs {
            let re = buf[i * 2];
            let im = buf[i * 2 + 1];
            *out_ptr.add(out_offset + i) = libm::sqrt(re * re + im * im);
        }

        num_frames += 1;
        start += hop;
    }

    num_frames
}

// ===========================================================================
// 8. Periodogram (Welch's method PSD)
// ===========================================================================

/// Estimate power spectral density using Welch's periodogram method.
///
/// Applies a Hann window, computes |FFT|^2 / (N * win_power).
/// One-sided spectrum with doubled interior bins.
/// Output length: nfft/2 + 1 where nfft = next_power_of_2(n).
///
/// # Safety
/// `in_ptr` points to `n` f64. `out_ptr` must have room for `nfft/2 + 1` f64.
#[no_mangle]
pub unsafe extern "C" fn periodogram_wasm(in_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    if n == 0 {
        return;
    }

    let nfft = next_power_of_2(n);
    let n_freqs = nfft / 2 + 1;

    // Hann window + window power
    let mut win_power = 0.0_f64;
    let n1 = (n - 1) as f64;
    let mut buf: Vec<f64> = alloc::vec![0.0; nfft * 2];

    for i in 0..n {
        let w = if n > 1 {
            0.5 * (1.0 - libm::cos(2.0 * PI * i as f64 / n1))
        } else {
            1.0
        };
        win_power += w * w;
        buf[i * 2] = *in_ptr.add(i) * w;
    }
    win_power /= n as f64;

    // FFT
    fft_interleaved(buf.as_mut_ptr(), nfft, false);

    // PSD
    let norm = n as f64 * win_power;
    for i in 0..n_freqs {
        let re = buf[i * 2];
        let im = buf[i * 2 + 1];
        let power = (re * re + im * im) / norm;
        // Double interior bins for one-sided spectrum
        *out_ptr.add(i) = if i > 0 && i < nfft / 2 {
            2.0 * power
        } else {
            power
        };
    }
}

// ===========================================================================
// 9. FIR Filter (generic convolution with coefficients)
// ===========================================================================

/// Apply an FIR filter to a signal via direct convolution.
///
/// `y[i] = sum_{j=0}^{M-1} coeffs[j] * x[i - j + M/2]` (centered).
///
/// Output has the same length as input. Out-of-bounds samples treated as 0.
///
/// # Safety
/// `in_ptr` points to `n` f64. `coeffs_ptr` points to `num_coeffs` f64.
/// `out_ptr` points to `n` writable f64.
#[no_mangle]
pub unsafe extern "C" fn fir_filter_wasm(
    in_ptr: *const f64,
    coeffs_ptr: *const f64,
    out_ptr: *mut f64,
    n: i32,
    num_coeffs: i32,
) {
    let n = n as usize;
    let m = num_coeffs as usize;
    let offset = m / 2;

    for i in 0..n {
        let mut sum = 0.0_f64;
        for j in 0..m {
            let idx = i as isize - offset as isize + j as isize;
            if idx >= 0 && (idx as usize) < n {
                sum += *in_ptr.add(idx as usize) * *coeffs_ptr.add(j);
            }
        }
        *out_ptr.add(i) = sum;
    }
}
